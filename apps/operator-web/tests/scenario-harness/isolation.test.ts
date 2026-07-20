import { describe, expect, it } from "bun:test";
import { adminExec, createDisposableDb } from "../scenarios/harness/real/disposable-db";
import { createRunContext, formatUtcStamp } from "../scenarios/harness/real/run-context";
import { startServer } from "../scenarios/harness/real/server-process";

const TEST_TIMEOUT = 240_000;

const datnameRows = async (name: string) =>
	(await adminExec("SELECT datname FROM pg_database WHERE datname = $1", [name])).rows;

const dropIfExists = (name: string) => adminExec(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);

/** Explicit leak probe — the assertion itself, never delegated to --no-orphans. */
const isTcpRefused = async (port: number): Promise<boolean> => {
	try {
		const socket = await Bun.connect({
			hostname: "127.0.0.1",
			port,
			socket: { data: () => undefined },
		});
		socket.end();
		return false;
	} catch {
		return true;
	}
};

describe("scenario-harness isolation + crash convergence", () => {
	it(
		"two sequential runs come and go without colliding on ports, databases, or evidence dirs",
		async () => {
			const first = createRunContext();
			const db1 = await createDisposableDb(first.runId);
			const server1 = await startServer({ databaseUrl: db1.url, evidenceDir: first.evidenceDir });
			await server1.stop();
			await db1.drop();
			const second = createRunContext();
			expect(second.runId).not.toBe(first.runId);
			expect(second.evidenceDir).not.toBe(first.evidenceDir);
			const db2 = await createDisposableDb(second.runId);
			try {
				expect(db2.name).not.toBe(db1.name);
				const server2 = await startServer({
					databaseUrl: db2.url,
					evidenceDir: second.evidenceDir,
				});
				try {
					const health = await fetch(`${server2.baseUrl}/api/health`);
					expect(health.status).toBe(200);
					await health.arrayBuffer();
				} finally {
					await server2.stop();
				}
				expect(await isTcpRefused(server2.port)).toBe(true);
			} finally {
				await db2.drop();
			}
			expect(await datnameRows(db1.name)).toHaveLength(0);
			expect(await datnameRows(db2.name)).toHaveLength(0);
		},
		TEST_TIMEOUT,
	);

	it(
		"a second harness boots while the first is alive, on distinct ports and databases",
		async () => {
			const a = createRunContext();
			const b = createRunContext();
			const dbA = await createDisposableDb(a.runId);
			try {
				const dbB = await createDisposableDb(b.runId);
				try {
					expect(dbB.name).not.toBe(dbA.name);
					const serverA = await startServer({ databaseUrl: dbA.url, evidenceDir: a.evidenceDir });
					try {
						const serverB = await startServer({ databaseUrl: dbB.url, evidenceDir: b.evidenceDir });
						try {
							expect(serverB.port).not.toBe(serverA.port);
							const [healthA, healthB] = await Promise.all([
								fetch(`${serverA.baseUrl}/api/health`),
								fetch(`${serverB.baseUrl}/api/health`),
							]);
							expect(healthA.status).toBe(200);
							expect(healthB.status).toBe(200);
							await Promise.all([healthA.arrayBuffer(), healthB.arrayBuffer()]);
						} finally {
							await serverB.stop();
						}
					} finally {
						await serverA.stop();
					}
				} finally {
					await dbB.drop();
				}
			} finally {
				await dbA.drop();
			}
		},
		TEST_TIMEOUT,
	);

	it(
		"the next harness start sweeps a planted stale database and spares a planted young one",
		async () => {
			const staleName = "qp_harness_20200101000000_zzzzzz";
			const youngName = `qp_harness_${formatUtcStamp(new Date())}_yyyyyy`;
			const ctx = createRunContext();
			try {
				for (const name of [staleName, youngName]) {
					await dropIfExists(name);
					await adminExec(`CREATE DATABASE ${name}`);
				}
				// "Next start" = the next createDisposableDb, which sweeps before creating.
				const db = await createDisposableDb(ctx.runId);
				try {
					expect(await datnameRows(staleName)).toHaveLength(0);
					expect(await datnameRows(youngName)).toHaveLength(1);
				} finally {
					await db.drop();
				}
			} finally {
				for (const name of [staleName, youngName]) {
					await dropIfExists(name);
				}
			}
		},
		TEST_TIMEOUT,
	);

	it(
		"SIGKILLing the server child mid-run still converges: port refused by explicit probe, database dropped",
		async () => {
			const ctx = createRunContext();
			const db = await createDisposableDb(ctx.runId);
			const server = await startServer({ databaseUrl: db.url, evidenceDir: ctx.evidenceDir });
			const pid = server.pid();
			if (pid === undefined) throw new Error("booted server exposed no pid");
			// External crash — not the harness's own stop lever.
			process.kill(pid, "SIGKILL");
			await server.stop();
			expect(server.pid()).toBeUndefined();
			expect(await isTcpRefused(server.port)).toBe(true);
			await db.drop();
			expect(await datnameRows(db.name)).toHaveLength(0);
		},
		TEST_TIMEOUT,
	);

	it(
		"an admin url at a dead port fails loudly within the short connect timeout, with the docker hint",
		async () => {
			const previous = process.env.HARNESS_PG_ADMIN_URL;
			process.env.HARNESS_PG_ADMIN_URL = "postgres://x@127.0.0.1:1/x";
			const startedAt = performance.now();
			try {
				await expect(createDisposableDb(createRunContext().runId)).rejects.toThrow(
					"docker compose up -d",
				);
				expect(performance.now() - startedAt).toBeLessThan(8_000);
			} finally {
				if (previous === undefined) delete process.env.HARNESS_PG_ADMIN_URL;
				else process.env.HARNESS_PG_ADMIN_URL = previous;
			}
		},
		TEST_TIMEOUT,
	);
});
