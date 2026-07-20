import { Client } from "pg";
import { appRoot, parseUtcStamp } from "./run-context";
import { registerSecret } from "./run-evidence";

const HARNESS_DB_PREFIX = "qp_harness_";
const HARNESS_DB_PATTERN = /^qp_harness_(\d{14})_[a-z0-9]{6}$/;
const STALE_AFTER_MS = 30 * 60 * 1000;
const CONNECT_TIMEOUT_MS = 5_000;
const MAX_PG_IDENTIFIER_LENGTH = 63;

export type SqlResult = { rows: Record<string, unknown>[] };

/** Registers the URL's password (raw + decoded forms) and the full URL with the secret set. */
const registerUrlSecrets = (url: string): void => {
	registerSecret(url);
	try {
		const parsed = new URL(url);
		if (!parsed.password) return;
		registerSecret(parsed.password);
		try {
			registerSecret(decodeURIComponent(parsed.password));
		} catch {
			// malformed percent-encoding — the raw form is already registered
		}
	} catch {
		// unparseable URL carries nothing further to register
	}
};

/** Admin connection: explicit override first, else the dev DATABASE_URL (compose user is superuser). */
export const resolveAdminUrl = (): string => {
	const url = process.env.HARNESS_PG_ADMIN_URL ?? process.env.DATABASE_URL;
	if (!url) {
		throw new Error(
			"No Postgres admin URL: set HARNESS_PG_ADMIN_URL or DATABASE_URL. " +
				"Locally, start the database with `docker compose up -d` in apps/operator-web " +
				"(its .env provides DATABASE_URL).",
		);
	}
	registerUrlSecrets(url);
	return url;
};

const redactUrl = (url: string): string => {
	try {
		const parsed = new URL(url);
		if (parsed.password) parsed.password = "***";
		return parsed.toString();
	} catch {
		return "<unparseable postgres url>";
	}
};

const connectFailure = (url: string, cause: unknown): Error =>
	new Error(
		`Cannot reach Postgres at ${redactUrl(url)}. ` +
			"Start the harness database with `docker compose up -d` in apps/operator-web, " +
			"or point HARNESS_PG_ADMIN_URL at a reachable superuser.",
		{ cause },
	);

const withClient = async <T>(url: string, run: (client: Client) => Promise<T>): Promise<T> => {
	const client = new Client({ connectionString: url, connectionTimeoutMillis: CONNECT_TIMEOUT_MS });
	try {
		await client.connect();
	} catch (cause) {
		await client.end().catch(() => undefined);
		throw connectFailure(url, cause);
	}
	try {
		return await run(client);
	} finally {
		await client.end();
	}
};

const execOn = (url: string, sqlText: string, params: unknown[] = []): Promise<SqlResult> =>
	withClient(url, async (client) => {
		const result = await client.query(sqlText, params);
		return { rows: (result.rows ?? []) as Record<string, unknown>[] };
	});

/** Raw SQL against the admin connection (dev DB) — also the cross-DB negative-proof seam. */
export const adminExec = (sqlText: string, params: unknown[] = []): Promise<SqlResult> =>
	execOn(resolveAdminUrl(), sqlText, params);

const databaseUrlFor = (adminUrl: string, databaseName: string): string => {
	const parsed = new URL(adminUrl);
	parsed.pathname = `/${databaseName}`;
	return parsed.toString();
};

/** The questpie CLI has no --db-url flag; env drives it. Allowlist env, no process.env spread. */
const migrate = async (databaseUrl: string): Promise<void> => {
	const child = Bun.spawn(
		["bun", "--no-env-file", "./node_modules/.bin/questpie", "migrate", "-c", "questpie.config.ts"],
		{
			cwd: appRoot,
			env: {
				PATH: process.env.PATH ?? "",
				HOME: process.env.HOME ?? "",
				DATABASE_URL: databaseUrl,
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
	if (exitCode !== 0) {
		const tail = `${stdout}\n${stderr}`.trim().split("\n").slice(-12).join("\n");
		throw new Error(
			`questpie migrate exited ${exitCode} against ${redactUrl(databaseUrl)}:\n${tail}`,
		);
	}
};

export type DisposableDb = {
	name: string;
	url: string;
	exec: (sqlText: string, params?: unknown[]) => Promise<SqlResult>;
	drop: () => Promise<void>;
};

export const createDisposableDb = async (runId: string): Promise<DisposableDb> => {
	const name = `${HARNESS_DB_PREFIX}${runId}`;
	if (!HARNESS_DB_PATTERN.test(name) || name.length > MAX_PG_IDENTIFIER_LENGTH) {
		throw new Error(
			`Disposable database name ${name} must match ${HARNESS_DB_PATTERN} (<=63 chars)`,
		);
	}
	const adminUrl = resolveAdminUrl();
	// Every harness start sweeps leftovers first; the >30min name-encoded age
	// guard makes this immune to the concurrent-provisioning race.
	await sweepStaleHarnessDbs();
	await execOn(adminUrl, `CREATE DATABASE ${name}`);
	const url = databaseUrlFor(adminUrl, name);
	registerUrlSecrets(url);
	const exec = (sqlText: string, params: unknown[] = []) => execOn(url, sqlText, params);
	const drop = async (): Promise<void> => {
		await execOn(adminUrl, `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
	};
	try {
		// Mirrors docker/init-extensions.sql: the committed migration builds a gin_trgm_ops index.
		await exec("CREATE EXTENSION IF NOT EXISTS pg_trgm");
		await migrate(url);
	} catch (cause) {
		await drop().catch(() => undefined);
		throw cause;
	}
	return { name, url, exec, drop };
};

/**
 * Drops qp_harness_* databases whose NAME-ENCODED timestamp is >30min old.
 * The age guard (not idle-backend detection) makes the sweep immune to the
 * concurrent-provisioning race; non-matching names are never touched.
 */
export const sweepStaleHarnessDbs = async (now: Date = new Date()): Promise<string[]> => {
	const adminUrl = resolveAdminUrl();
	const result = await execOn(adminUrl, "SELECT datname FROM pg_database WHERE datname LIKE $1", [
		`${HARNESS_DB_PREFIX}%`,
	]);
	const dropped: string[] = [];
	for (const row of result.rows) {
		const name = String(row.datname);
		const match = HARNESS_DB_PATTERN.exec(name);
		if (!match) continue;
		const mintedAt = parseUtcStamp(match[1] ?? "");
		if (!mintedAt) continue;
		if (now.getTime() - mintedAt.getTime() <= STALE_AFTER_MS) continue;
		await execOn(adminUrl, `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
		dropped.push(name);
	}
	return dropped;
};
