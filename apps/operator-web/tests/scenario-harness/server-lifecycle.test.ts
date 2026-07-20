import { describe, expect, it } from "bun:test";
import { createDisposableDb } from "../scenarios/harness/real/disposable-db";
import { createRunContext } from "../scenarios/harness/real/run-context";
import { startServer } from "../scenarios/harness/real/server-process";

const BOOT_TEST_TIMEOUT = 240_000;
const RESERVED_PORTS = [3000, 6006, 6007];

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

const waitForTcpRefused = async (port: number, withinMs = 5_000): Promise<boolean> => {
	const deadline = Date.now() + withinMs;
	while (Date.now() < deadline) {
		if (await isTcpRefused(port)) return true;
		await Bun.sleep(100);
	}
	return isTcpRefused(port);
};

/** The port must be immediately rebindable after stop(): Bun.serve succeeds, then closes. */
const canRebind = (port: number): boolean => {
	try {
		const probe = Bun.serve({ port, fetch: () => new Response("rebind-probe") });
		probe.stop(true);
		return true;
	} catch {
		return false;
	}
};

const fetchHealth = async (baseUrl: string) => {
	const response = await fetch(`${baseUrl}/api/health`);
	const body = (await response.json()) as {
		status: string;
		checks: { database?: { status: string } };
	};
	return { status: response.status, body };
};

describe("scenario-harness server lifecycle", () => {
	it(
		"boots on a random non-reserved port, serves /api/health 200, and stop() leaves the port refused and rebindable",
		async () => {
			const ctx = createRunContext();
			const db = await createDisposableDb(ctx.runId);
			try {
				const server = await startServer({ databaseUrl: db.url, evidenceDir: ctx.evidenceDir });
				try {
					expect(RESERVED_PORTS).not.toContain(server.port);
					expect(server.baseUrl).toBe(`http://localhost:${server.port}`);
					// Readiness IS this poll: the first health hit forces lazy QUESTPIE init incl. DB connect.
					const health = await fetchHealth(server.baseUrl);
					expect(health.status).toBe(200);
					expect(health.body.checks.database?.status).toBe("ok");
				} finally {
					await server.stop();
				}
				expect(await waitForTcpRefused(server.port)).toBe(true);
				expect(canRebind(server.port)).toBe(true);
			} finally {
				await db.drop();
			}
		},
		BOOT_TEST_TIMEOUT,
	);

	it(
		"boot-stop-boot: two full cycles against the same disposable DB come up cleanly on fresh ports",
		async () => {
			const ctx = createRunContext();
			const db = await createDisposableDb(ctx.runId);
			const ports: number[] = [];
			try {
				for (let cycle = 0; cycle < 2; cycle += 1) {
					const server = await startServer({ databaseUrl: db.url, evidenceDir: ctx.evidenceDir });
					try {
						ports.push(server.port);
						const health = await fetchHealth(server.baseUrl);
						expect(health.status).toBe(200);
						expect(health.body.checks.database?.status).toBe("ok");
					} finally {
						await server.stop();
					}
					expect(await waitForTcpRefused(server.port)).toBe(true);
				}
				expect(ports).toHaveLength(2);
				for (const port of ports) expect(RESERVED_PORTS).not.toContain(port);
			} finally {
				await db.drop();
			}
		},
		BOOT_TEST_TIMEOUT,
	);
});
