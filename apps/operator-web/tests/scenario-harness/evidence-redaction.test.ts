import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createDisposableDb } from "../scenarios/harness/real/disposable-db";
import { createAuthenticatedSession } from "../scenarios/harness/real/identity";
import { createRunContext } from "../scenarios/harness/real/run-context";
import {
	buildRunManifest,
	createRunEvidence,
	redact,
	registeredSecretValues,
	registerSecret,
} from "../scenarios/harness/real/run-evidence";
import { KILL_SEMANTICS, startServer } from "../scenarios/harness/real/server-process";

const TEST_TIMEOUT = 240_000;

/** Recursive file walk without Dirent.parentPath (keeps older lib typings happy). */
const listFiles = (dir: string): string[] => {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...listFiles(path));
		else if (entry.isFile()) out.push(path);
	}
	return out;
};

describe("redact(text) unit", () => {
	it("masks postgres URL passwords while keeping host and database readable", () => {
		const out = redact(
			"db at postgresql://app:pw-unit-url-1@127.0.0.1:5432/qp_x and postgres://a:pw-unit-url-2@h/d",
		);
		expect(out).not.toContain("pw-unit-url-1");
		expect(out).not.toContain("pw-unit-url-2");
		expect(out).toContain("127.0.0.1:5432/qp_x");
	});

	it("masks registered exact values (per-run BETTER_AUTH_SECRET, sign-up password) anywhere", () => {
		const authSecret = `harness-${crypto.randomUUID()}`;
		const signUpPassword = "hp-UnitCaseSignupPw123456";
		registerSecret(authSecret);
		registerSecret(signUpPassword);
		const out = redact(
			`boot BETTER_AUTH_SECRET=${authSecret}; later a stray echo of ${signUpPassword}`,
		);
		expect(out).not.toContain(authSecret);
		expect(out).not.toContain(signUpPassword);
	});

	it("masks Set-Cookie/cookie/authorization header values in plain and JSON forms", () => {
		const plain = redact(
			"Set-Cookie: better-auth.session_token=pw-unit-sc-1; Path=/\ncookie: pw-unit-c-1\nauthorization: Bearer pw-unit-a-1",
		);
		for (const leak of ["pw-unit-sc-1", "pw-unit-c-1", "pw-unit-a-1"]) {
			expect(plain).not.toContain(leak);
		}
		const json = redact(
			'{"set-cookie":"pw-unit-sc-2","cookie":"pw-unit-c-2","authorization":"pw-unit-a-2","host":"kept-host"}',
		);
		for (const leak of ["pw-unit-sc-2", "pw-unit-c-2", "pw-unit-a-2"]) {
			expect(json).not.toContain(leak);
		}
		expect(json).toContain("kept-host");
	});

	it("masks better-auth session-token values even when unregistered", () => {
		const out = redact("saw better-auth.session_token=pw-unit-token-1.sig in a stray log line");
		expect(out).not.toContain("pw-unit-token-1");
	});

	it("masks generic password|secret|token JSON values even when unregistered", () => {
		const out = redact(
			'{"password":"pw-unit-g1","apiSecret":"pw-unit-g2","accessToken":"pw-unit-g3","name":"kept-name"}',
		);
		for (const leak of ["pw-unit-g1", "pw-unit-g2", "pw-unit-g3"]) {
			expect(out).not.toContain(leak);
		}
		expect(out).toContain("kept-name");
	});
});

describe("scenario-harness evidence + redaction", () => {
	it(
		"a full boot+auth+publish cycle leaves zero registered-secret hits in the run dir and a complete run.json manifest",
		async () => {
			const ctx = createRunContext();
			const startedAt = new Date();
			const evidence = createRunEvidence(ctx.evidenceDir);
			const db = await createDisposableDb(ctx.runId);
			try {
				const server = await startServer({ databaseUrl: db.url, evidenceDir: ctx.evidenceDir });
				const canary = `canary-${crypto.randomUUID()}`;
				try {
					const session = await createAuthenticatedSession({
						baseUrl: server.baseUrl,
						db,
						runId: ctx.runId,
						evidence,
					});
					// Publish leg: one authed channel publish through the typed client.
					const receipt = await session.client.channels.harnessProbe.publish({
						event: "tick",
						data: { seq: 1 },
					});
					expect(typeof receipt.eventId).toBe("string");
					// Canary planted THROUGH the server-log sink: the sink must redact it.
					registerSecret(canary);
					server.logNote(`canary planted through the server-log sink: ${canary}`);
					expect(server.logTail(3).join("\n")).not.toContain(canary);
				} finally {
					await server.stop();
				}
				// Let the stdout/stderr tees flush their final lines before scanning.
				await Bun.sleep(500);
				const versionRow = await db.exec(
					"SELECT current_setting('server_version') AS server_version",
				);
				evidence.writeManifest(
					buildRunManifest({
						runId: ctx.runId,
						port: server.port,
						baseUrl: server.baseUrl,
						databaseName: db.name,
						databaseServerVersion: String(versionRow.rows[0]?.server_version ?? ""),
						startedAt,
						finishedAt: new Date(),
						killSemantics: KILL_SEMANTICS,
					}),
				);

				const files = listFiles(ctx.evidenceDir);
				const names = files.map((file) => file.slice(ctx.evidenceDir.length + 1));
				for (const expected of [
					"run.json",
					"server.log",
					"events.jsonl",
					"http-transcript.jsonl",
				]) {
					expect(names).toContain(expected);
				}

				// Every registered ACTUAL secret must be absent from EVERY evidence file.
				const secrets = registeredSecretValues();
				expect(secrets).toContain(canary);
				// admin password, BETTER_AUTH_SECRET, sign-up password, session cookie, canary at minimum
				expect(secrets.length).toBeGreaterThanOrEqual(5);
				const hits: { file: string; secretIndex: number }[] = [];
				for (const file of files) {
					const content = readFileSync(file, "utf8");
					for (const [secretIndex, secret] of secrets.entries()) {
						if (content.includes(secret)) hits.push({ file, secretIndex });
					}
				}
				expect(hits).toEqual([]);

				// Manifest: exact run identity and versions, database NAME only (never the URL).
				const rawManifest = readFileSync(join(ctx.evidenceDir, "run.json"), "utf8");
				expect(rawManifest).not.toContain(db.url);
				const manifest = JSON.parse(rawManifest) as {
					runId: string;
					port: number;
					baseUrl: string;
					database: { name: string; serverVersion: string };
					git: { sha: string };
					timestamps: { startedAt: string; finishedAt: string };
					killSemantics: Record<string, unknown>;
					versions: Record<string, string>;
					build: { present: boolean; preset?: string; nitroVersion?: string };
				};
				expect(manifest.runId).toBe(ctx.runId);
				expect(manifest.port).toBe(server.port);
				expect(manifest.baseUrl).toBe(server.baseUrl);
				expect(manifest.database.name).toBe(db.name);
				expect(manifest.database.serverVersion).toMatch(/^\d+/);
				expect(manifest.git.sha).toMatch(/^[0-9a-f]{40}$/);
				expect(Date.parse(manifest.timestamps.startedAt)).toBeLessThanOrEqual(
					Date.parse(manifest.timestamps.finishedAt),
				);
				expect(manifest.killSemantics).toEqual({ ...KILL_SEMANTICS });
				expect(manifest.killSemantics.stopSignal).toBe("SIGTERM");
				expect(manifest.killSemantics.graceMs).toBe(5_000);
				expect(manifest.killSemantics.fallbackSignal).toBe("SIGKILL");
				expect(manifest.versions.bun).toBe(Bun.version);
				for (const dependency of ["questpie", "betterAuth", "playwrightTest"]) {
					expect(manifest.versions[dependency]).toMatch(/^\d+\.\d+\.\d+/);
				}
				expect(manifest.build.present).toBe(true);
				expect(manifest.build.preset).toBe("bun");
				expect(typeof manifest.build.nitroVersion).toBe("string");

				// Lifecycle log: the boot and the stop both left events.jsonl entries.
				const events = readFileSync(join(ctx.evidenceDir, "events.jsonl"), "utf8")
					.trim()
					.split("\n")
					.map((line) => JSON.parse(line) as { type: string });
				const eventTypes = events.map((event) => event.type);
				expect(eventTypes).toContain("server:ready");
				expect(eventTypes).toContain("server:stop");

				// HTTP transcript: entries exist and cookie-bearing headers are redacted.
				const transcript = readFileSync(join(ctx.evidenceDir, "http-transcript.jsonl"), "utf8")
					.trim()
					.split("\n")
					.map(
						(line) =>
							JSON.parse(line) as {
								method: string;
								url: string;
								status: number;
								requestHeaders: Record<string, string>;
							},
					);
				expect(transcript.length).toBeGreaterThan(0);
				const cookieCarrying = transcript.filter(
					(entry) => entry.requestHeaders.cookie !== undefined,
				);
				expect(cookieCarrying.length).toBeGreaterThan(0);
				for (const entry of cookieCarrying) {
					expect(entry.requestHeaders.cookie).toBe("[REDACTED]");
				}
			} finally {
				await db.drop();
			}
		},
		TEST_TIMEOUT,
	);
});
