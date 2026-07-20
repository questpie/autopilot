import { describe, expect, it } from "bun:test";
import { createDisposableDb } from "../scenarios/harness/real/disposable-db";
import { createRunContext } from "../scenarios/harness/real/run-context";
import { drainQueue, startServer } from "../scenarios/harness/real/server-process";

const DRAIN_TEST_TIMEOUT = 240_000;

/** Failure carries the child's output tail so a non-zero exit is diagnosable. */
const outcome = (result: { exitCode: number; output: string }) => ({
	exitCode: result.exitCode,
	tail: result.exitCode === 0 ? "" : result.output.split("\n").slice(-12).join("\n"),
});

describe("scenario-harness queue drain", () => {
	it(
		"drainQueue() exits 0 deterministically and twice in a row (idempotent) against a booted run",
		async () => {
			const ctx = createRunContext();
			const db = await createDisposableDb(ctx.runId);
			try {
				const server = await startServer({ databaseUrl: db.url, evidenceDir: ctx.evidenceDir });
				try {
					// Nothing else ever consumes jobs (no worker entrypoint; pg-boss never
					// auto-consumes here) — the explicit drain lever must exit 0 on demand.
					const first = await drainQueue(server.databaseUrl);
					expect(outcome(first)).toEqual({ exitCode: 0, tail: "" });
					// The drain ran the real queue machinery against THIS disposable DB:
					// pg-boss installs its schema there on first start.
					const schema = await db.exec("SELECT nspname FROM pg_namespace WHERE nspname = 'pgboss'");
					expect(schema.rows).toHaveLength(1);
					// Idempotent: a second drain against the same booted run is also clean.
					const second = await drainQueue(server.databaseUrl);
					expect(outcome(second)).toEqual({ exitCode: 0, tail: "" });
				} finally {
					await server.stop();
				}
			} finally {
				await db.drop();
			}
		},
		DRAIN_TEST_TIMEOUT,
	);
});
