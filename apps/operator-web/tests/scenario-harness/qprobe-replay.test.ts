import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createDisposableDb } from "../scenarios/harness/real/disposable-db";
import { appRoot, createRunContext } from "../scenarios/harness/real/run-context";
import { registeredSecretValues } from "../scenarios/harness/real/run-evidence";
import { startServer } from "../scenarios/harness/real/server-process";

const REPLAY_TEST_TIMEOUT = 240_000;
const RING_SCAN_LINES = 1_000;

const repoRoot = join(appRoot, "..", "..");
const productTestsDir = join(repoRoot, "tests", "qprobe-product");
const productConfigPath = join(repoRoot, "qprobe.config.ts");
const storybookPlaywrightConfigPath = join(repoRoot, "tests", "qprobe", "playwright.config.ts");

const countHealthRequestLines = (lines: string[]): number =>
	lines.filter((line) => line.includes('"event":"http.request"') && line.includes("/api/health"))
		.length;

/** Recursive walk collecting every file path under dir (empty when dir is absent). */
const collectFiles = (dir: string): string[] => {
	if (!existsSync(dir)) return [];
	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) files.push(...collectFiles(path));
		else if (entry.isFile()) files.push(path);
	}
	return files;
};

type ReplayResult = { exitCode: number; output: string };

/**
 * Spawns the machine-global qprobe CLI. cwd MUST be the product tests dir:
 * `qprobe replay` shells out to `npx playwright test`, and Playwright only
 * discovers the freshly rewritten <tests.dir>/playwright.config.ts (which bakes
 * in --base) when its cwd IS that directory. QPROBE_CONFIG pins the PRODUCT
 * config by absolute path so the tests.dir/base contract cannot drift with cwd.
 */
const runQprobeReplay = async (baseUrl: string): Promise<ReplayResult> => {
	let child: ReturnType<typeof Bun.spawn>;
	try {
		child = Bun.spawn(
			["qprobe", "replay", "harness-smoke", "--base", baseUrl, "--browser", "chromium"],
			{
				cwd: productTestsDir,
				env: {
					PATH: process.env.PATH ?? "",
					HOME: process.env.HOME ?? "",
					QPROBE_CONFIG: productConfigPath,
				},
				stdout: "pipe",
				stderr: "pipe",
			},
		);
	} catch (cause) {
		throw new Error(
			"Could not spawn the qprobe CLI. The replay gate requires the machine-global " +
				"@questpie/probe install: run `bun add -g @questpie/probe` and retry.",
			{ cause },
		);
	}
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	return { exitCode, output: `${stdout}\n${stderr}` };
};

describe("scenario-harness qprobe replay", () => {
	it(
		"replays harness-smoke against the harness server, spares the Storybook config, and leaks no secrets",
		async () => {
			const storybookConfigBefore = readFileSync(storybookPlaywrightConfigPath);
			const ctx = createRunContext();
			const db = await createDisposableDb(ctx.runId);
			try {
				const server = await startServer({ databaseUrl: db.url, evidenceDir: ctx.evidenceDir });
				try {
					const healthLinesBefore = countHealthRequestLines(server.logTail(RING_SCAN_LINES));

					const replay = await runQprobeReplay(server.baseUrl);
					if (replay.exitCode !== 0) {
						throw new Error(
							`qprobe replay exited ${replay.exitCode}:\n${replay.output.slice(-2_000)}`,
						);
					}
					expect(replay.exitCode).toBe(0);
					expect(replay.output).toMatch(/1 passed/);

					// The replay hit THIS harness server, not a stray :3000 dev server: the
					// spec's /api/health probe (and nothing else — no other client touches
					// this per-run port) must have appended http.request lines to the ring
					// buffer beyond the boot-time readiness polls. The page facet is bound
					// by exit 0: the h1 assertion ran against the baked --base origin.
					const healthLinesAfter = countHealthRequestLines(server.logTail(RING_SCAN_LINES));
					expect(healthLinesAfter).toBeGreaterThan(healthLinesBefore);

					// Storybook non-clobber: the product replay rewrote ONLY
					// tests/qprobe-product/playwright.config.ts (gitignored), never the
					// committed tests/qprobe/playwright.config.ts.
					const storybookConfigAfter = readFileSync(storybookPlaywrightConfigPath);
					expect(storybookConfigAfter.equals(storybookConfigBefore)).toBe(true);
					const generatedConfig = readFileSync(
						join(productTestsDir, "playwright.config.ts"),
						"utf8",
					);
					expect(generatedConfig).toContain(server.baseUrl);

					// qprobe/playwright write OUTSIDE the harness evidence redaction
					// boundary — prove no registered secret value landed in any of it.
					const secrets = registeredSecretValues();
					expect(secrets.length).toBeGreaterThan(0);
					const scanTargets = [
						...collectFiles(join(repoRoot, "test-results")),
						...collectFiles(productTestsDir),
					];
					expect(scanTargets.length).toBeGreaterThan(0);
					for (const file of scanTargets) {
						const content = readFileSync(file);
						for (const secret of secrets) {
							if (content.includes(secret)) {
								throw new Error(`registered secret leaked into ${file}`);
							}
						}
					}
				} finally {
					await server.stop();
				}
			} finally {
				await db.drop();
			}
		},
		REPLAY_TEST_TIMEOUT,
	);
});
