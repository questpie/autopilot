/**
 * Phase-0 acceptance gate — real-data loaders and child runners.
 *
 * All I/O for the gate lives here (checks.ts stays pure). Every spawned child
 * carries PHASE0_GATE_CHILD=1 so the CLI's reentry guard makes recursion
 * structurally impossible. Evidence scanning is scoped to gate-owned artifacts
 * only: RunContexts the gate itself creates, its own captured child output,
 * and the test-results/ delta of files new or modified during stage C.
 */
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import {
	createDisposableDb,
	type DisposableDb,
} from "../../apps/operator-web/tests/scenarios/harness/real/disposable-db";
import {
	createRunContext,
	type RunContext,
} from "../../apps/operator-web/tests/scenarios/harness/real/run-context";
import {
	type StartedServer,
	startServer,
} from "../../apps/operator-web/tests/scenarios/harness/real/server-process";
import type { ArtifactLine, HttpTranscriptEntryInput, RecordingFile } from "./checks";

export {
	phase0PendingExecutableFlows,
	phase0ProofTasks,
} from "../../apps/operator-web/tests/scenarios/phase-0/case-matrix";
export {
	phase0ScenarioContracts,
	stableSelectors,
} from "../../apps/operator-web/tests/scenarios/phase-0/contracts";
export { stateObligationRegistry } from "../../apps/operator-web/tests/scenarios/phase-0/state-obligations";

export const repoRoot = join(import.meta.dir, "..", "..");
export const operatorWebRoot = join(repoRoot, "apps", "operator-web");
export const operatorWebOutputDir = join(operatorWebRoot, ".output");
export const phase0ScenarioDir = join(operatorWebRoot, "tests", "scenarios", "phase-0");
export const qprobeProductDir = join(repoRoot, "tests", "qprobe-product");
export const recordingsDir = join(qprobeProductDir, "recordings");
export const testResultsDir = join(repoRoot, "test-results");

/** C2 scope excludes the manifest-driven todo file (C1 owns its coupling). */
export const PHASE0_SCAN_EXCLUDED = "product-scenarios.test.ts";

export type ChildReport = { exitCode: number; stdout: string; stderr: string; output: string };

/** Spawns a gate child with output captured and PHASE0_GATE_CHILD=1 always set. */
export async function runGateChild(
	cmd: readonly string[],
	options: { cwd?: string; env?: Record<string, string | undefined> } = {},
): Promise<ChildReport> {
	const child = Bun.spawn([...cmd], {
		cwd: options.cwd ?? repoRoot,
		env: { ...(options.env ?? process.env), PHASE0_GATE_CHILD: "1" },
		stderr: "pipe",
		stdout: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	return { exitCode, stdout, stderr, output: `${stdout}\n${stderr}` };
}

/** Phase-0 scenario sources for the C2 stray-token scan. */
export async function listPhase0SourceFiles(): Promise<{ path: string; sourceText: string }[]> {
	const entries = await readdir(phase0ScenarioDir, { recursive: true });
	const files = entries
		.filter((entry) => entry.endsWith(".ts") && basename(entry) !== PHASE0_SCAN_EXCLUDED)
		.sort();
	return Promise.all(
		files.map(async (relative) => {
			const path = join(phase0ScenarioDir, relative);
			return { path, sourceText: await readFile(path, "utf8") };
		}),
	);
}

export type Phase0JunitRun = { exitCode: number; output: string; junitXml: string };

/** One test:phase-0 spawn (build-first; flows/** run on the real harness) with the junit reporter (C1's coupling evidence). */
export async function spawnPhase0Junit(): Promise<Phase0JunitRun> {
	const outDir = await mkdtemp(join(tmpdir(), "phase0-gate-junit-"));
	const outfile = join(outDir, "phase0.xml");
	try {
		const report = await runGateChild([
			"bun",
			"run",
			"--cwd",
			operatorWebRoot,
			"test:phase-0",
			"--reporter=junit",
			`--reporter-outfile=${outfile}`,
		]);
		let junitXml = "";
		try {
			junitXml = await readFile(outfile, "utf8");
		} catch {
			junitXml = "";
		}
		return { exitCode: report.exitCode, output: report.output, junitXml };
	} finally {
		await rm(outDir, { force: true, recursive: true });
	}
}

/** Replay recordings with source text (C4 selector-containment needs it). */
export async function listRecordings(): Promise<RecordingFile[]> {
	let names: string[];
	try {
		names = await readdir(recordingsDir);
	} catch {
		return [];
	}
	return Promise.all(
		names
			.filter((name) => name.endsWith(".spec.ts"))
			.sort()
			.map(async (name) => ({
				name,
				sourceText: await readFile(join(recordingsDir, name), "utf8"),
			})),
	);
}

/** file path -> mtimeMs; only files NEW or MODIFIED versus a snapshot are scanned. */
export type TestResultsSnapshot = ReadonlyMap<string, number>;

const SCANNABLE_DELTA_EXTENSIONS = [".txt", ".log", ".json", ".jsonl", ".xml", ".md"];

export async function snapshotTestResults(): Promise<TestResultsSnapshot> {
	const snapshot = new Map<string, number>();
	let entries: string[];
	try {
		entries = await readdir(testResultsDir, { recursive: true });
	} catch {
		return snapshot;
	}
	for (const relative of entries) {
		const path = join(testResultsDir, relative);
		try {
			const info = await stat(path);
			if (info.isFile()) snapshot.set(path, info.mtimeMs);
		} catch {
			// Raced deletion — a vanished file has no lines to scan.
		}
	}
	return snapshot;
}

export async function collectTestResultsDelta(
	before: TestResultsSnapshot,
): Promise<ArtifactLine[]> {
	const lines: ArtifactLine[] = [];
	const after = await snapshotTestResults();
	for (const [path, mtimeMs] of after) {
		if (before.get(path) === mtimeMs) continue;
		if (!SCANNABLE_DELTA_EXTENSIONS.some((extension) => path.endsWith(extension))) continue;
		try {
			for (const line of (await readFile(path, "utf8")).split("\n")) {
				if (line.trim() !== "") lines.push({ source: path, line });
			}
		} catch {
			// Unreadable artifact: playwright markers cannot hide in what has no text.
		}
	}
	return lines;
}

export type GateEvidence = {
	serverLogLines: ArtifactLine[];
	httpTranscript: HttpTranscriptEntryInput[];
};

/** Reads server.log and http-transcript.jsonl from gate-owned evidence dirs ONLY. */
export async function collectEvidenceLines(evidenceDirs: readonly string[]): Promise<GateEvidence> {
	const serverLogLines: ArtifactLine[] = [];
	const httpTranscript: HttpTranscriptEntryInput[] = [];
	for (const dir of evidenceDirs) {
		const logPath = join(dir, "server.log");
		try {
			for (const line of (await readFile(logPath, "utf8")).split("\n")) {
				if (line.trim() !== "") serverLogLines.push({ source: logPath, line });
			}
		} catch {
			// No server.log in this evidence dir.
		}
		const transcriptPath = join(dir, "http-transcript.jsonl");
		try {
			for (const line of (await readFile(transcriptPath, "utf8")).split("\n")) {
				if (line.trim() === "") continue;
				try {
					const parsed: unknown = JSON.parse(line);
					const status =
						parsed !== null && typeof parsed === "object"
							? (parsed as { status?: unknown }).status
							: undefined;
					if (typeof status === "number") httpTranscript.push({ source: transcriptPath, status });
				} catch {
					// Non-JSON transcript line — ignore.
				}
			}
		} catch {
			// No http transcript in this evidence dir.
		}
	}
	return { serverLogLines, httpTranscript };
}

/** mtimeMs of apps/operator-web/.output, or null when it does not exist. */
export async function outputBuildStampMs(): Promise<number | null> {
	try {
		return (await stat(operatorWebOutputDir)).mtimeMs;
	} catch {
		return null;
	}
}

/** Machine-global qprobe preflight (C5). */
export const qprobeBinaryPath = (): string | null => Bun.which("qprobe");

export const QPROBE_INSTALL_HINT = "install with `bun add -g @questpie/probe`";

/** The exact replay contract qprobe-replay.test.ts proved (plus the reentry env). */
export async function runQprobeReplay(
	name: string,
	baseUrl: string,
): Promise<ChildReport & { name: string }> {
	const report = await runGateChild(
		["qprobe", "replay", name, "--base", baseUrl, "--browser", "chromium"],
		{
			cwd: qprobeProductDir,
			env: {
				HOME: process.env.HOME,
				PATH: process.env.PATH,
				QPROBE_CONFIG: join(repoRoot, "qprobe.config.ts"),
			},
		},
	);
	return { name, ...report };
}

export type GateServer = {
	runContext: RunContext;
	db: DisposableDb;
	server: StartedServer;
	stop: () => Promise<void>;
};

/**
 * Boots ONE gate-owned disposable-DB server for C5, teeing evidence into a
 * gate-created RunContext so C6 scans only artifacts this invocation produced.
 */
export async function bootGateServer(): Promise<GateServer> {
	const runContext = createRunContext();
	const db = await createDisposableDb(runContext.runId);
	const server = await startServer({ databaseUrl: db.url, evidenceDir: runContext.evidenceDir });
	return {
		db,
		runContext,
		server,
		stop: async () => {
			await server.stop();
			await db.drop();
		},
	};
}
