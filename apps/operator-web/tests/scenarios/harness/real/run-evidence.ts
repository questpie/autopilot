import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { appRoot } from "./run-context";

export const REDACTED = "[REDACTED]";
const MIN_SECRET_LENGTH = 4;

/**
 * Process-wide registered-secret set — the union across live harness runs.
 * Extra registered values only ever redact MORE, so sharing is safe; every
 * evidence writer below pushes its output through redact(). Value-level
 * redaction here EXTENDS the key-name-screening ScenarioEvidenceRecorder
 * (tests/scenarios/harness/evidence.ts); it does not replace it.
 */
const secrets = new Set<string>();

export const registerSecret = (value: string): void => {
	if (value.length >= MIN_SECRET_LENGTH) secrets.add(value);
};

export const registeredSecretValues = (): string[] => [...secrets];

type PatternPass = { pattern: RegExp; replacement: string };

/** Structure-aware pattern passes run first; the exact-value pass mops up. */
const PATTERN_PASSES: PatternPass[] = [
	// postgres/postgresql URL credentials: keep host/db readable, mask the password.
	{ pattern: /\b(postgres(?:ql)?:\/\/[^:@/\s]+:)([^@\s"']+)@/gi, replacement: `$1${REDACTED}@` },
	// better-auth session-token pairs wherever they appear (cookie lines, stray logs).
	{
		pattern: /((?:__Secure-)?better-auth\.[\w.-]*session_token=)([^;",\s]+)/gi,
		replacement: `$1${REDACTED}`,
	},
	// JSON-form sensitive headers: {"set-cookie":"…"} / {"cookie":"…"} / {"authorization":"…"}.
	{
		pattern: /("(?:set-cookie|cookie|authorization)"\s*:\s*")((?:[^"\\]|\\.)*)(")/gi,
		replacement: `$1${REDACTED}$3`,
	},
	// Plain header lines: `Set-Cookie: …` / `cookie: …` / `authorization: …`.
	{
		pattern: /^(\s*(?:set-cookie|cookie|authorization)\s*:\s*)(.+)$/gim,
		replacement: `$1${REDACTED}`,
	},
	// Generic secret-ish JSON values: any key mentioning password|secret|token.
	{
		pattern: /("[^"\n]*(?:password|secret|token)[^"\n]*"\s*:\s*")((?:[^"\\]|\\.)*)(")/gi,
		replacement: `$1${REDACTED}$3`,
	},
];

/** Exact-value pass over the registered set plus the pattern passes above. */
export const redact = (text: string): string => {
	let out = text;
	for (const pass of PATTERN_PASSES) out = out.replace(pass.pattern, pass.replacement);
	for (const secret of secrets) out = out.replaceAll(secret, REDACTED);
	return out;
};

export type HttpTranscriptEntry = {
	at: string;
	method: string;
	url: string;
	status: number;
	requestHeaders: Record<string, string>;
	responseHeaders: Record<string, string>;
};

export type RunEvidence = {
	evidenceDir: string;
	/** Line-wise redacting sink: appends redact(line) to <evidenceDir>/<file>. */
	appendLine: (file: string, line: string) => void;
	/** Lifecycle log: one redacted JSON line per event in events.jsonl. */
	logEvent: (type: string, data?: Record<string, unknown>) => void;
	/** HTTP transcript with redacted headers in http-transcript.jsonl. */
	recordHttp: (entry: HttpTranscriptEntry) => void;
	/** run.json manifest — serialized through redact() as a hard guarantee. */
	writeManifest: (manifest: Record<string, unknown>) => void;
};

/** Version from real package resolution; a failed resolve fails the manifest asserts loudly. */
const packageVersion = (name: string): string => {
	try {
		const resolved = Bun.resolveSync(`${name}/package.json`, appRoot);
		const parsed = JSON.parse(readFileSync(resolved, "utf8")) as { version?: string };
		return parsed.version ?? "unknown";
	} catch {
		return "unresolved";
	}
};

const gitSha = (): string => {
	const result = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: appRoot });
	if (result.exitCode !== 0) return "unknown";
	return result.stdout.toString().trim();
};

const nitroBuildInfo = (): Record<string, unknown> => {
	const path = join(appRoot, ".output", "nitro.json");
	if (!existsSync(path)) return { present: false };
	const parsed = JSON.parse(readFileSync(path, "utf8")) as {
		date?: string;
		preset?: string;
		versions?: { nitro?: string };
	};
	return {
		present: true,
		date: parsed.date,
		preset: parsed.preset,
		nitroVersion: parsed.versions?.nitro,
	};
};

export type RunManifestInput = {
	runId: string;
	port: number;
	baseUrl: string;
	/** Database NAME only — the URL (it carries credentials) never reaches the manifest. */
	databaseName: string;
	databaseServerVersion: string;
	startedAt: Date;
	finishedAt: Date;
	/** Pass KILL_SEMANTICS from server-process (imported there to avoid a module cycle). */
	killSemantics: Record<string, unknown>;
};

export const buildRunManifest = (input: RunManifestInput): Record<string, unknown> => ({
	runId: input.runId,
	port: input.port,
	baseUrl: input.baseUrl,
	database: { name: input.databaseName, serverVersion: input.databaseServerVersion },
	git: { sha: gitSha() },
	timestamps: {
		startedAt: input.startedAt.toISOString(),
		finishedAt: input.finishedAt.toISOString(),
	},
	killSemantics: input.killSemantics,
	versions: {
		bun: Bun.version,
		questpie: packageVersion("questpie"),
		betterAuth: packageVersion("better-auth"),
		playwrightTest: packageVersion("@playwright/test"),
	},
	build: nitroBuildInfo(),
});

export const createRunEvidence = (evidenceDir: string): RunEvidence => {
	mkdirSync(evidenceDir, { recursive: true });
	const appendLine = (file: string, line: string): void => {
		appendFileSync(join(evidenceDir, file), `${redact(line)}\n`);
	};
	return {
		evidenceDir,
		appendLine,
		logEvent: (type, data = {}) =>
			appendLine("events.jsonl", JSON.stringify({ at: new Date().toISOString(), type, ...data })),
		recordHttp: (entry) => appendLine("http-transcript.jsonl", JSON.stringify(entry)),
		writeManifest: (manifest) => {
			writeFileSync(
				join(evidenceDir, "run.json"),
				`${redact(JSON.stringify(manifest, null, "\t"))}\n`,
			);
		},
	};
};
