import { type AppClient, createAppClient } from "../../../../src/lib/client";
import type { DisposableDb } from "./disposable-db";
import { registerSecret, type RunEvidence } from "./run-evidence";

// The canonical value-level secret set lives in run-evidence; re-exported here
// so existing identity importers keep working.
export { registerSecret, registeredSecretValues } from "./run-evidence";

export type CookieJar = {
	/** Absorbs every Set-Cookie header on the response into the jar. */
	capture: (response: Response) => void;
	/** Serialized `cookie` request-header value for everything held. */
	cookieHeader: () => string;
};

export const createCookieJar = (): CookieJar => {
	const cookies = new Map<string, string>();
	return {
		capture: (response) => {
			for (const raw of response.headers.getSetCookie()) {
				const pair = raw.split(";")[0] ?? "";
				const separator = pair.indexOf("=");
				if (separator <= 0) continue;
				const name = pair.slice(0, separator).trim();
				const value = pair.slice(separator + 1).trim();
				if (!value) {
					cookies.delete(name);
					continue;
				}
				cookies.set(name, value);
				registerSecret(value);
			}
		},
		cookieHeader: () =>
			[...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; "),
	};
};

/**
 * Fetch wrapper injecting the jar's `cookie` AND `Origin: <appUrl>` on EVERY
 * request, then capturing Set-Cookie from every response. Pass it as the
 * `fetch` option of createAppClient({ baseURL, fetch }) — static client
 * `headers` are not guaranteed to reach the SSE transport's own fetch, and any
 * cookie-bearing /api/realtime or /api/channels/publish request without a
 * trusted Origin throws channel_origin_denied (framework
 * routes/channels/_shared.ts, requireOriginForCookies = true).
 */
export const makeAuthedFetch = (
	jar: CookieJar,
	appUrl: string,
	evidence?: RunEvidence,
): typeof fetch => {
	const authedFetch = async (
		input: Parameters<typeof fetch>[0],
		init?: Parameters<typeof fetch>[1],
	): Promise<Response> => {
		const headers = new Headers(
			init?.headers ?? (input instanceof Request ? input.headers : undefined),
		);
		headers.set("origin", appUrl);
		const cookie = jar.cookieHeader();
		if (cookie) headers.set("cookie", cookie);
		const response = await fetch(input, { ...init, headers });
		jar.capture(response);
		evidence?.recordHttp({
			at: new Date().toISOString(),
			method: init?.method ?? (input instanceof Request ? input.method : "GET"),
			url: input instanceof Request ? input.url : String(input),
			status: response.status,
			requestHeaders: Object.fromEntries(headers.entries()),
			responseHeaders: Object.fromEntries(response.headers.entries()),
		});
		return response;
	};
	return authedFetch as typeof fetch;
};

const RATE_LIMIT_PATIENCE_BUDGET_MS = 90_000;

/**
 * better-auth rate-limits its sensitive endpoints (max 3 per rolling 10s on
 * /sign-up and /sign-in; 429 + X-Retry-After seconds). The composite session
 * seam honors that real contract the way a well-behaved client would: wait
 * the server-stated interval and retry, bounded by one budget per session.
 * Any other status — and a 429 outliving the budget — is returned untouched
 * for the caller's own asserts. Callers here pass string bodies (JSON), so
 * replaying the same init is safe.
 */
const withRateLimitPatience = (fetchImpl: typeof fetch): typeof fetch => {
	const deadline = Date.now() + RATE_LIMIT_PATIENCE_BUDGET_MS;
	const patient = async (
		input: Parameters<typeof fetch>[0],
		init?: Parameters<typeof fetch>[1],
	): Promise<Response> => {
		let response = await fetchImpl(input, init);
		while (response.status === 429 && Date.now() < deadline) {
			const retryAfterSeconds = Number(response.headers.get("x-retry-after"));
			const waitMs =
				Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
					? retryAfterSeconds * 1000
					: 1000;
			if (Date.now() + waitMs > deadline) break;
			await response.arrayBuffer().catch(() => undefined);
			await new Promise((resolve) => setTimeout(resolve, waitMs));
			response = await fetchImpl(input, init);
		}
		return response;
	};
	return patient as typeof fetch;
};

export type AuthEndpointPaths = {
	signUpEmail: string;
	signInEmail: string;
	getSession: string;
};

/**
 * Pins better-auth endpoint paths from the live openAPI reference route
 * (GET /api/openapi.json) — never from memory. Paths are matched by their
 * `/auth/...` suffix and normalized onto the real mount (the /api/$ catch-all,
 * basePath /api), so a drifted or missing live reference fails loudly here.
 */
export const resolveAuthEndpointPaths = async (baseUrl: string): Promise<AuthEndpointPaths> => {
	const response = await fetch(`${baseUrl}/api/openapi.json`);
	if (response.status !== 200) {
		throw new Error(`GET /api/openapi.json answered ${response.status}; cannot pin auth paths`);
	}
	const spec = (await response.json()) as {
		paths?: Record<string, Record<string, unknown>>;
	};
	const specPaths = Object.keys(spec.paths ?? {});
	const resolve = (suffix: string, method: "get" | "post"): string => {
		const key = specPaths.find((path) => path.endsWith(suffix));
		if (!key) {
			throw new Error(
				`live openAPI reference documents no path ending with ${suffix} (saw ${specPaths.length} paths)`,
			);
		}
		const operations = spec.paths?.[key];
		if (!operations || !(method in operations)) {
			throw new Error(`live openAPI path ${key} lacks the ${method} operation`);
		}
		return `/api${key.slice(key.indexOf("/auth/"))}`;
	};
	return {
		signUpEmail: resolve("/auth/sign-up/email", "post"),
		signInEmail: resolve("/auth/sign-in/email", "post"),
		getSession: resolve("/auth/get-session", "get"),
	};
};

const PASSWORD_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Per-run random password; always registered with the evidence secret set. */
const randomPassword = (): string => {
	const bytes = crypto.getRandomValues(new Uint8Array(24));
	let out = "hp-";
	for (const byte of bytes) out += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
	return out;
};

export type SignUpUserOptions = {
	fetchImpl: typeof fetch;
	baseUrl: string;
	paths: AuthEndpointPaths;
	email: string;
	password?: string;
	name?: string;
};

export type SignedUpUser = { email: string; password: string; response: Response };

/** POST sign-up/email; the response is returned unconsumed for the caller's asserts. */
export const signUpUser = async (options: SignUpUserOptions): Promise<SignedUpUser> => {
	const password = options.password ?? randomPassword();
	registerSecret(password);
	const response = await options.fetchImpl(`${options.baseUrl}${options.paths.signUpEmail}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			name: options.name ?? `Harness User ${options.email}`,
			email: options.email,
			password,
		}),
	});
	return { email: options.email, password, response };
};

/**
 * Documented harness-only deviation: requireEmailVerification is true and the
 * app now wires sendVerificationEmail (config/auth.ts), so a verification email
 * DOES reach the ConsoleAdapter on sign-up. The harness cannot click that
 * emailed link, so this one admin SQL flip (quoted camelCase column, straight
 * from the committed migration) is how it satisfies verification without the
 * interactive step; the sign-in-before-verify 403 negative keeps it honest.
 */
export const markEmailVerified = async (db: DisposableDb, email: string): Promise<void> => {
	const result = await db.exec(
		'UPDATE "user" SET "emailVerified" = true WHERE email = $1 RETURNING id',
		[email],
	);
	if (result.rows.length !== 1) {
		throw new Error(`emailVerified flip matched ${result.rows.length} rows for ${email}`);
	}
};

export type SignInOptions = {
	fetchImpl: typeof fetch;
	baseUrl: string;
	paths: AuthEndpointPaths;
	email: string;
	password: string;
};

/** POST sign-in/email; the response is returned unconsumed for the caller's asserts. */
export const signInWithPassword = (options: SignInOptions): Promise<Response> =>
	options.fetchImpl(`${options.baseUrl}${options.paths.signInEmail}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email: options.email, password: options.password }),
	});

export type SignUpVerifiedUserOptions = {
	fetchImpl: typeof fetch;
	baseUrl: string;
	db: DisposableDb;
	paths: AuthEndpointPaths;
	email: string;
	password?: string;
};

/** Sign-up followed by the documented emailVerified flip — no session yet. */
export const signUpVerifiedUser = async (
	options: SignUpVerifiedUserOptions,
): Promise<{ email: string; password: string }> => {
	const signedUp = await signUpUser(options);
	if (signedUp.response.status !== 200) {
		const body = await signedUp.response.text();
		throw new Error(`sign-up for ${options.email} answered ${signedUp.response.status}: ${body}`);
	}
	await signedUp.response.arrayBuffer().catch(() => undefined);
	await markEmailVerified(options.db, options.email);
	return { email: signedUp.email, password: signedUp.password };
};

export type CreateSessionOptions = {
	baseUrl: string;
	db: DisposableDb;
	runId: string;
	email?: string;
	/** When present, every authed exchange lands in http-transcript.jsonl (redacted). */
	evidence?: RunEvidence;
};

export type AuthenticatedSession = {
	email: string;
	password: string;
	/** Serialized cookie header carrying the better-auth session token. */
	cookie: string;
	jar: CookieJar;
	fetch: typeof fetch;
	client: AppClient;
};

/**
 * Full composite: sign-up → emailVerified flip → sign-in into a fresh cookie
 * jar → typed createAppClient bound to the cookie+Origin-injecting fetch.
 */
export const createAuthenticatedSession = async (
	options: CreateSessionOptions,
): Promise<AuthenticatedSession> => {
	const jar = createCookieJar();
	const authedFetch = makeAuthedFetch(jar, options.baseUrl, options.evidence);
	const patientAuthFetch = withRateLimitPatience(authedFetch);
	const paths = await resolveAuthEndpointPaths(options.baseUrl);
	const email = options.email ?? `authed-${options.runId}@harness.invalid`;
	const user = await signUpVerifiedUser({
		fetchImpl: patientAuthFetch,
		baseUrl: options.baseUrl,
		db: options.db,
		paths,
		email,
	});
	const signIn = await signInWithPassword({
		fetchImpl: patientAuthFetch,
		baseUrl: options.baseUrl,
		paths,
		email,
		password: user.password,
	});
	if (signIn.status !== 200) {
		const body = await signIn.text();
		throw new Error(`sign-in for ${email} answered ${signIn.status}: ${body}`);
	}
	await signIn.arrayBuffer().catch(() => undefined);
	const cookie = jar.cookieHeader();
	if (!cookie.includes("session_token")) {
		throw new Error("sign-in did not yield a session cookie in the jar");
	}
	registerSecret(cookie);
	const client = createAppClient({ baseURL: options.baseUrl, fetch: authedFetch });
	return { email, password: user.password, cookie, jar, fetch: authedFetch, client };
};

export type FreshSignInOptions = {
	baseUrl: string;
	email: string;
	password: string;
};

export type FreshSession = { jar: CookieJar; fetch: typeof fetch };

/**
 * A brand-new cookie jar signing in with already-registered credentials — no
 * sign-up, no emailVerified flip (the user is already verified). This is the
 * server-truth resume seam: whatever "/" resolves to for this fresh jar is
 * derived purely from the session cookie's identity, never from client state.
 */
export const signInFreshSession = async (options: FreshSignInOptions): Promise<FreshSession> => {
	const jar = createCookieJar();
	const authedFetch = makeAuthedFetch(jar, options.baseUrl);
	const patientFetch = withRateLimitPatience(authedFetch);
	const paths = await resolveAuthEndpointPaths(options.baseUrl);
	const signIn = await signInWithPassword({
		fetchImpl: patientFetch,
		baseUrl: options.baseUrl,
		paths,
		email: options.email,
		password: options.password,
	});
	if (signIn.status !== 200) {
		const body = await signIn.text();
		throw new Error(`fresh sign-in for ${options.email} answered ${signIn.status}: ${body}`);
	}
	await signIn.arrayBuffer().catch(() => undefined);
	if (!jar.cookieHeader().includes("session_token")) {
		throw new Error("fresh sign-in did not yield a session cookie in the jar");
	}
	return { jar, fetch: authedFetch };
};
