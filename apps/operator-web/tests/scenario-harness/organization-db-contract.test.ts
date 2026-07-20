import { describe, expect, it } from "bun:test";
import { createDisposableDb } from "../scenarios/harness/real/disposable-db";
import { appRoot, createRunContext } from "../scenarios/harness/real/run-context";

const TEST_TIMEOUT = 240_000;

/**
 * Runs the de-gated F01 organization DB contract (tests/scenarios/phase-0/
 * organization-db.test.ts) for real: in a CHILD bun test process against a
 * freshly migrated disposable database. The child owns the in-process
 * generated-app import, so app module globals never enter the harness test
 * process, and the allowlist env keeps dev credentials away from the
 * contract run. The former RUN_ORGANIZATION_DB_TESTS gate is gone — this
 * wrapper is the one true way the contract executes, and it can never
 * masquerade: the summary must show real passes and zero skip rows.
 */
describe("scenario-harness organization DB contract (ungated)", () => {
	it(
		"passes against a disposable database with >=1 pass, 0 fail, and no skip rows",
		async () => {
			const ctx = createRunContext();
			const db = await createDisposableDb(ctx.runId);
			try {
				const child = Bun.spawn(
					[
						"bun",
						"--no-env-file",
						"test",
						"--timeout",
						"60000",
						"tests/scenarios/phase-0/organization-db.test.ts",
					],
					{
						cwd: appRoot,
						env: {
							PATH: process.env.PATH ?? "",
							HOME: process.env.HOME ?? "",
							DATABASE_URL: db.url,
						},
						stdout: "pipe",
						stderr: "pipe",
					},
				);
				const [exitCode, stdout, stderr] = await Promise.all([
					child.exited,
					new Response(child.stdout).text(),
					new Response(child.stderr).text(),
				]);
				const summary = `${stdout}\n${stderr}`;
				const tail = summary.trim().split("\n").slice(-15).join("\n");
				expect({ exitCode, tail: exitCode === 0 ? "" : tail }).toEqual({ exitCode: 0, tail: "" });
				const passCount = Number(/(\d+)\s+pass/.exec(summary)?.[1] ?? "0");
				const failCount = Number(/(\d+)\s+fail/.exec(summary)?.[1] ?? "-1");
				expect(passCount).toBeGreaterThanOrEqual(1);
				expect(failCount).toBe(0);
				expect(/\d+\s+skip/.test(summary)).toBe(false);
				expect(/\d+\s+todo/.test(summary)).toBe(false);
			} finally {
				await db.drop();
			}
		},
		TEST_TIMEOUT,
	);
});
