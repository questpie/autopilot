import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import {
	adminExec,
	createDisposableDb,
	sweepStaleHarnessDbs,
} from "../scenarios/harness/real/disposable-db";
import { createRunContext } from "../scenarios/harness/real/run-context";

const TEST_TIMEOUT = 120_000;
const DB_NAME_PATTERN = /^qp_harness_\d{14}_[a-z0-9]{6}$/;

const datnameRows = async (name: string) =>
	(await adminExec("SELECT datname FROM pg_database WHERE datname = $1", [name])).rows;

const dropIfExists = (name: string) => adminExec(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);

describe("scenario-harness disposable postgres", () => {
	it(
		"createRunContext mints a lowercase sortable runId and an evidence dir under tmp/scenario-harness",
		() => {
			const ctx = createRunContext();
			expect(ctx.runId).toMatch(/^\d{14}_[a-z0-9]{6}$/);
			expect(ctx.runId).toBe(ctx.runId.toLowerCase());
			expect(isAbsolute(ctx.evidenceDir)).toBe(true);
			expect(ctx.evidenceDir).toBe(
				join(import.meta.dir, "..", "..", "tmp", "scenario-harness", ctx.runId),
			);
			expect(existsSync(ctx.evidenceDir)).toBe(true);
		},
		TEST_TIMEOUT,
	);

	it(
		"create provisions pg_trgm and the migrated schema; drop removes the database",
		async () => {
			const ctx = createRunContext();
			const db = await createDisposableDb(ctx.runId);
			try {
				expect(db.name).toBe(`qp_harness_${ctx.runId}`);
				expect(db.name).toMatch(DB_NAME_PATTERN);
				expect(db.name.length).toBeLessThanOrEqual(63);
				const extension = await db.exec(
					"SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'",
				);
				expect(extension.rows).toHaveLength(1);
				const tables = await db.exec(
					"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[]) ORDER BY table_name",
					[["companies", "questpie_channel_event", "user"]],
				);
				expect(tables.rows.map((row) => row.table_name)).toEqual([
					"companies",
					"questpie_channel_event",
					"user",
				]);
			} finally {
				await db.drop();
			}
			expect(await datnameRows(db.name)).toHaveLength(0);
		},
		TEST_TIMEOUT,
	);

	it(
		"an unreachable admin url throws fast and loud with the docker hint",
		async () => {
			const previous = process.env.HARNESS_PG_ADMIN_URL;
			process.env.HARNESS_PG_ADMIN_URL = "postgres://x@127.0.0.1:1/x";
			const startedAt = performance.now();
			try {
				await expect(createDisposableDb("20200101000000_redred")).rejects.toThrow(
					"docker compose up -d",
				);
				expect(performance.now() - startedAt).toBeLessThan(15_000);
			} finally {
				if (previous === undefined) delete process.env.HARNESS_PG_ADMIN_URL;
				else process.env.HARNESS_PG_ADMIN_URL = previous;
			}
		},
		TEST_TIMEOUT,
	);

	it(
		"sweepStaleHarnessDbs collects stale matching databases and spares young or non-matching names",
		async () => {
			const staleName = "qp_harness_20200101000000_aaaaaa";
			const oldButMalformed = "qp_harness_20200101000000_zz";
			const youngName = `qp_harness_${createRunContext().runId}`;
			try {
				for (const name of [staleName, oldButMalformed, youngName]) {
					await dropIfExists(name);
					await adminExec(`CREATE DATABASE ${name}`);
				}
				const swept = await sweepStaleHarnessDbs();
				expect(swept).toContain(staleName);
				expect(swept).not.toContain(youngName);
				expect(swept).not.toContain(oldButMalformed);
				expect(await datnameRows(staleName)).toHaveLength(0);
				expect(await datnameRows(youngName)).toHaveLength(1);
				expect(await datnameRows(oldButMalformed)).toHaveLength(1);
			} finally {
				for (const name of [staleName, oldButMalformed, youngName]) {
					await dropIfExists(name);
				}
			}
		},
		TEST_TIMEOUT,
	);
});
