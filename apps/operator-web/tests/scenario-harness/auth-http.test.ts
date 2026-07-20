import { afterAll, describe, expect, it } from "bun:test";
import { createAppClient } from "../../src/lib/client";
import {
	adminExec,
	createDisposableDb,
	type DisposableDb,
} from "../scenarios/harness/real/disposable-db";
import {
	type AuthEndpointPaths,
	type AuthenticatedSession,
	type CookieJar,
	createAuthenticatedSession,
	createCookieJar,
	makeAuthedFetch,
	markEmailVerified,
	resolveAuthEndpointPaths,
	signInWithPassword,
	signUpUser,
} from "../scenarios/harness/real/identity";
import { createRunContext } from "../scenarios/harness/real/run-context";
import { type StartedServer, startServer } from "../scenarios/harness/real/server-process";

const TEST_TIMEOUT = 240_000;

type Harness = {
	runId: string;
	db: DisposableDb;
	server: StartedServer;
	paths: AuthEndpointPaths;
	jar: CookieJar;
	authedFetch: typeof fetch;
};

let bootPromise: Promise<Harness> | null = null;

/** One boot shared by the ordered facets below; the first caller pays inside its own timeout. */
const boot = (): Promise<Harness> => {
	bootPromise ??= (async () => {
		const ctx = createRunContext();
		const db = await createDisposableDb(ctx.runId);
		const server = await startServer({ databaseUrl: db.url, evidenceDir: ctx.evidenceDir });
		const paths = await resolveAuthEndpointPaths(server.baseUrl);
		const jar = createCookieJar();
		const authedFetch = makeAuthedFetch(jar, server.baseUrl);
		return { runId: ctx.runId, db, server, paths, jar, authedFetch };
	})();
	return bootPromise;
};

afterAll(async () => {
	if (!bootPromise) return;
	const harness = await bootPromise.catch(() => null);
	if (!harness) return;
	await harness.server.stop();
	await harness.db.drop();
});

/** State minted by earlier facets; later facets fail loudly when a predecessor failed. */
const minted: {
	email?: string;
	password?: string;
	session?: AuthenticatedSession;
	companyId?: string;
} = {};

const requireMinted = <K extends keyof typeof minted>(key: K): NonNullable<(typeof minted)[K]> => {
	const value = minted[key];
	if (!value) throw new Error(`facet ordering: ${String(key)} was not minted by an earlier test`);
	return value as NonNullable<(typeof minted)[K]>;
};

const sessionCookiesOf = (response: Response): string[] =>
	response.headers.getSetCookie().filter((cookie) => cookie.includes("session_token"));

describe("scenario-harness auth over real HTTP", () => {
	it(
		"pins better-auth endpoint paths from the live openAPI reference route, never memory",
		async () => {
			const { paths } = await boot();
			expect(paths.signUpEmail).toBe("/api/auth/sign-up/email");
			expect(paths.signInEmail).toBe("/api/auth/sign-in/email");
			expect(paths.getSession).toBe("/api/auth/get-session");
		},
		TEST_TIMEOUT,
	);

	it(
		"signs up a fresh user without granting a session cookie before verification",
		async () => {
			const { runId, server, paths, authedFetch } = await boot();
			const user = await signUpUser({
				fetchImpl: authedFetch,
				baseUrl: server.baseUrl,
				paths,
				email: `fresh-${runId}@harness.invalid`,
			});
			minted.email = user.email;
			minted.password = user.password;
			expect(user.response.status).toBe(200);
			const body = (await user.response.json()) as { user?: { email?: string } };
			expect(body.user?.email).toBe(user.email);
			// requireEmailVerification: sign-up must NOT auto-sign-in.
			expect(sessionCookiesOf(user.response)).toHaveLength(0);
		},
		TEST_TIMEOUT,
	);

	it(
		"rejects sign-in before verification with 403 — the negative oracle for requireEmailVerification",
		async () => {
			const { server, paths, authedFetch } = await boot();
			const response = await signInWithPassword({
				fetchImpl: authedFetch,
				baseUrl: server.baseUrl,
				paths,
				email: requireMinted("email"),
				password: requireMinted("password"),
			});
			expect(response.status).toBe(403);
			const body = (await response.json()) as { code?: string; message?: string };
			expect(`${body.code ?? ""} ${body.message ?? ""}`).toMatch(/verif/i);
			expect(sessionCookiesOf(response)).toHaveLength(0);
		},
		TEST_TIMEOUT,
	);

	it(
		"after the documented harness-only emailVerified flip, sign-in sets exactly better-auth.session_token (HttpOnly, Path=/, no __Secure- on http)",
		async () => {
			const { db, server, paths, jar, authedFetch } = await boot();
			await markEmailVerified(db, requireMinted("email"));
			const response = await signInWithPassword({
				fetchImpl: authedFetch,
				baseUrl: server.baseUrl,
				paths,
				email: requireMinted("email"),
				password: requireMinted("password"),
			});
			expect(response.status).toBe(200);
			await response.arrayBuffer();
			const sessionCookies = sessionCookiesOf(response);
			expect(sessionCookies).toHaveLength(1);
			const cookie = sessionCookies[0] ?? "";
			expect(cookie.startsWith("better-auth.session_token=")).toBe(true);
			expect(cookie.startsWith("__Secure-")).toBe(false);
			expect(cookie).toMatch(/;\s*HttpOnly/i);
			expect(cookie).toMatch(/;\s*Path=\//i);
			// The jar now carries the session for every later authed request.
			expect(jar.cookieHeader()).toContain("better-auth.session_token=");
		},
		TEST_TIMEOUT,
	);

	it(
		"get-session returns the user WITH the cookie and null without it",
		async () => {
			const { server, paths, authedFetch } = await boot();
			const withCookie = await authedFetch(`${server.baseUrl}${paths.getSession}`);
			expect(withCookie.status).toBe(200);
			const session = (await withCookie.json()) as { user?: { email?: string } } | null;
			expect(session?.user?.email).toBe(requireMinted("email"));
			const withoutCookie = await fetch(`${server.baseUrl}${paths.getSession}`);
			expect(withoutCookie.status).toBe(200);
			expect(await withoutCookie.json()).toBeNull();
		},
		TEST_TIMEOUT,
	);

	it(
		"redirect facet: no framework redirect surface exists under /api yet — the admin probe answers 404 with no Location for anonymous AND authed GETs (facet deferred to F01's guarded sign-in route)",
		async () => {
			const { server, authedFetch } = await boot();
			// The only admin-ish surface is the /api/$ catch-all; no admin UI/module is
			// mounted, so the honest observed equivalent is: identical 404, never a redirect.
			const anonymous = await fetch(`${server.baseUrl}/api/admin`, { redirect: "manual" });
			expect(anonymous.status).toBe(404);
			expect(anonymous.headers.get("location")).toBeNull();
			await anonymous.arrayBuffer();
			const authed = await authedFetch(`${server.baseUrl}/api/admin`, { redirect: "manual" });
			expect(authed.status).toBe(404);
			expect(authed.headers.get("location")).toBeNull();
			await authed.arrayBuffer();
		},
		TEST_TIMEOUT,
	);

	it(
		"AC3 redirect facet: anonymous GET / lands on /sign-in while the authed GET / resolves elsewhere",
		async () => {
			const { server, authedFetch } = await boot();
			const anonymous = await fetch(`${server.baseUrl}/`, { redirect: "manual" });
			expect(anonymous.status).toBeGreaterThanOrEqual(300);
			expect(anonymous.status).toBeLessThan(400);
			expect(anonymous.headers.get("location") ?? "").toContain("/sign-in");
			await anonymous.arrayBuffer();
			const authed = await authedFetch(`${server.baseUrl}/`, { redirect: "manual" });
			expect(authed.status).toBeGreaterThanOrEqual(300);
			expect(authed.status).toBeLessThan(400);
			const authedLocation = authed.headers.get("location") ?? "";
			expect(authedLocation.length).toBeGreaterThan(0);
			expect(authedLocation.includes("/sign-in")).toBe(false);
			await authed.arrayBuffer();
		},
		TEST_TIMEOUT,
	);

	it(
		"POST /api/companies/bootstrap as a typed command through createAppClient returns a receipt with companyId",
		async () => {
			const harness = await boot();
			const session = await createAuthenticatedSession({
				baseUrl: harness.server.baseUrl,
				db: harness.db,
				runId: harness.runId,
			});
			minted.session = session;
			const receipt = await session.client.routes.companies.bootstrap.post({
				idempotencyKey: `harness-bootstrap-${harness.runId}`,
				name: `Harness Co ${harness.runId}`,
			});
			expect(typeof receipt.companyId).toBe("string");
			expect(receipt.companyId.length).toBeGreaterThan(0);
			expect(receipt.replayed).toBe(false);
			minted.companyId = receipt.companyId;
		},
		TEST_TIMEOUT,
	);

	it(
		"one authorized company-scoped read succeeds with the cookie and the identical cookieless read is rejected",
		async () => {
			const { server, runId } = await boot();
			const session = requireMinted("session");
			const companyId = requireMinted("companyId");
			const doc = await session.client.collections.companies.findOne({
				where: { id: companyId },
			});
			expect(doc?.id).toBe(companyId);
			expect(doc?.name).toBe(`Harness Co ${runId}`);
			const cookieless = createAppClient({ baseURL: server.baseUrl });
			let rejection: unknown;
			try {
				await cookieless.collections.companies.findOne({ where: { id: companyId } });
			} catch (error) {
				rejection = error;
			}
			expect(rejection).toBeDefined();
			expect((rejection as { status?: number }).status).toBe(403);
		},
		TEST_TIMEOUT,
	);

	it(
		"cross-DB negative: harness users exist in the disposable DB and are ABSENT from the dev DB",
		async () => {
			const { db } = await boot();
			const emails = [requireMinted("email"), requireMinted("session").email];
			for (const email of emails) {
				const inDisposable = await db.exec(
					'SELECT count(*)::int AS count FROM "user" WHERE email = $1',
					[email],
				);
				expect(inDisposable.rows[0]?.count).toBe(1);
			}
			// Admin connection = dev DB. An unmigrated dev DB has no "user" table at all,
			// which proves absence outright; otherwise the row count must be zero.
			const devUserTable = await adminExec(
				"SELECT to_regclass('public.user') IS NOT NULL AS present",
			);
			if (devUserTable.rows[0]?.present === true) {
				for (const email of emails) {
					const inDev = await adminExec(
						'SELECT count(*)::int AS count FROM "user" WHERE email = $1',
						[email],
					);
					expect(inDev.rows[0]?.count).toBe(0);
				}
			}
		},
		TEST_TIMEOUT,
	);
});
