/**
 * Interactive scenario-harness serve session — the documented target for
 * `qprobe record` sessions (see tests/qprobe-product/README.md at the repo root).
 *
 * Boots a disposable Postgres + the built production server via the same harness
 * library the tests use, prints the base URL and database name, then waits for
 * SIGINT/SIGTERM and tears everything down (drops the database).
 *
 * Run via: bun run test:scenario-harness:serve
 * (the script builds first — the server boots .output/server/index.mjs)
 */
import { createDisposableDb } from "../scenarios/harness/real/disposable-db";
import { createRunContext } from "../scenarios/harness/real/run-context";
import { startServer } from "../scenarios/harness/real/server-process";

const ctx = createRunContext();
const db = await createDisposableDb(ctx.runId);
const server = await startServer({ databaseUrl: db.url, evidenceDir: ctx.evidenceDir });

console.log("scenario-harness serve session ready");
console.log(`  base url:  ${server.baseUrl}`);
console.log(`  database:  ${db.name}`);
// Local-only convenience for adaptive/breakpoint evidence sessions: the disposable
// DB connection string, so a serve-session operator can flip emailVerified (the
// documented markEmailVerified seam) to reach the authenticated pages. Never
// committed anywhere — this line prints only to the interactive session's stdout.
console.log(`  db url:    ${db.url}`);
console.log(`  evidence:  ${ctx.evidenceDir}`);
console.log("record (from the repo root):");
console.log('  qprobe record start "f01-sign-in"');
console.log(`  qprobe browser open ${server.baseUrl}/`);
console.log("replay (from the repo root):");
console.log("  cd tests/qprobe-product && QPROBE_CONFIG=<abs path to qprobe.config.ts> \\");
console.log(`    qprobe replay harness-smoke --base ${server.baseUrl} --browser chromium`);
console.log(`press Ctrl+C to tear down (drops ${db.name})`);

let closing = false;
const teardown = async (): Promise<void> => {
	if (closing) return;
	closing = true;
	console.log("\ntearing down serve session…");
	try {
		await server.stop();
	} finally {
		await db.drop();
	}
	process.exit(0);
};
process.on("SIGINT", () => void teardown());
process.on("SIGTERM", () => void teardown());

// Keep the session alive until a signal arrives.
await new Promise(() => undefined);
