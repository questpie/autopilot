/**
 * Phase-0 acceptance gate: no TODO, no skip, and qprobe-replay evidence.
 *
 * Usage: bun scripts/verify-phase-0-acceptance.ts [--static-only] [--json]
 *
 * Stages (fail-closed): A = {C1, C2, C4, C7} always runs (one junit spawn;
 * test:phase-0 is build-first and its flows/** tests use the real harness,
 * so stage A needs a build and Docker Postgres). B = {C8, C3} only when A is clean.
 * C = {C5, C6} only when B is clean. Blocked required checks report the
 * not-run marker and still force exit 1; `--static-only` runs stage A alone
 * and therefore can never grant PASS. Exit 0 only on zero violations with
 * all checks run.
 */
import {
	type AcceptanceViolation,
	checkErrorLedger,
	checkPendingTodoFlows,
	checkReplayExecution,
	checkReplayPresenceAndContent,
	checkScenarioHarnessSuite,
	checkStrayTodoSkip,
	checkUsRowEvidence,
	parseBunTestSummary,
	parseJunitTestcases,
	type RecordingFile,
} from "./phase0-acceptance/checks";
import {
	CHECK_HEADERS,
	FINAL_PASS_LINE,
	finalFailLine,
	NOT_RUN_BLOCKED,
	REPORT_LEGEND,
} from "./phase0-acceptance/report-format";
import * as sources from "./phase0-acceptance/sources";

const REENTRY_GUARD_ENV = "PHASE0_GATE_CHILD";

if (process.env[REENTRY_GUARD_ENV] !== undefined) {
	console.error(
		`phase-0 acceptance gate: refusing to start — ${REENTRY_GUARD_ENV} is set ` +
			"(reentry guard: gate children must never respawn the gate).",
	);
	process.exit(2);
}

type CheckId = keyof typeof CHECK_HEADERS;

const CHECK_ORDER: readonly CheckId[] = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"];

const C8_EXCLUSION_NOTE =
	"note: C8 runs the root test chain's two halves itself and STRUCTURALLY EXCLUDES " +
	"scripts/verify-phase-0-acceptance.test.ts — a gate must not verify itself by running " +
	"itself; root `bun run test` and CI own that file.";

type GateState = {
	violations: AcceptanceViolation[];
	sections: Partial<Record<CheckId, string[]>>;
	table: { id: string; status: string }[];
};

const recordCheck = (state: GateState, check: CheckId, found: AcceptanceViolation[]): void => {
	state.violations.push(...found);
	state.sections[check] =
		found.length === 0 ? ["clean"] : found.map((violation) => `VIOLATION: ${violation.message}`);
};

const markNotRun = (state: GateState, check: CheckId, reason?: string): void => {
	const message = reason === undefined ? NOT_RUN_BLOCKED : `not-run: ${reason}`;
	state.violations.push({ check, subject: CHECK_HEADERS[check], message });
	state.sections[check] = [message];
};

async function runStageA(state: GateState): Promise<{ recordings: RecordingFile[] }> {
	const junitRun = await sources.spawnPhase0Junit();
	recordCheck(
		state,
		"C1",
		checkPendingTodoFlows({
			pendingFlows: sources.phase0PendingExecutableFlows,
			proofTasks: sources.phase0ProofTasks,
			contracts: sources.phase0ScenarioContracts,
			junitTestcases: parseJunitTestcases(junitRun.junitXml),
			exitCode: junitRun.exitCode,
		}),
	);
	recordCheck(state, "C2", checkStrayTodoSkip(await sources.listPhase0SourceFiles()));
	const recordings = await sources.listRecordings();
	recordCheck(
		state,
		"C4",
		checkReplayPresenceAndContent({ contracts: sources.phase0ScenarioContracts, recordings }),
	);
	const usRows = checkUsRowEvidence({
		rows: sources.stateObligationRegistry,
		pendingFlows: sources.phase0PendingExecutableFlows,
		contracts: sources.phase0ScenarioContracts,
		presentReplayNames: recordings.map((recording) => recording.name),
	});
	state.violations.push(...usRows.violations);
	state.table = usRows.table;
	state.sections.C7 = [
		...usRows.table.map((row) => `  ${row.id}: ${row.status}`),
		...REPORT_LEGEND,
	];
	return { recordings };
}

const C8_COMMANDS: readonly { label: string; cmd: readonly string[]; parseSummary: boolean }[] = [
	{ label: "bun run format:check", cmd: ["bun", "run", "format:check"], parseSummary: false },
	{ label: "bun run lint", cmd: ["bun", "run", "lint"], parseSummary: false },
	{ label: "bun run check-types", cmd: ["bun", "run", "check-types"], parseSummary: false },
	{
		label: "bun test scripts/lint-framework-boundaries.test.ts",
		cmd: ["bun", "test", "scripts/lint-framework-boundaries.test.ts"],
		parseSummary: true,
	},
	{ label: "turbo run test", cmd: ["bun", "x", "turbo", "run", "test"], parseSummary: true },
];

async function runStageB(state: GateState): Promise<{ c3StartedAtMs: number }> {
	const c8Violations: AcceptanceViolation[] = [];
	let skipTotal = 0;
	let todoTotal = 0;
	for (const { label, cmd, parseSummary } of C8_COMMANDS) {
		const report = await sources.runGateChild(cmd);
		if (report.exitCode !== 0) {
			c8Violations.push({
				check: "C8",
				subject: label,
				message: `${label} exited with nonzero code ${report.exitCode}`,
			});
		}
		if (!parseSummary) continue;
		const summary = parseBunTestSummary(report.output);
		skipTotal += summary.skip;
		todoTotal += summary.todo;
	}
	if (skipTotal > 0) {
		c8Violations.push({
			check: "C8",
			subject: "root test chain",
			message: `root test outputs report ${skipTotal} skip (must be 0)`,
		});
	}
	const contractFlows = new Set(sources.phase0ScenarioContracts.map((contract) => contract.flow));
	const expectedTodo = sources.phase0PendingExecutableFlows.filter((flow) =>
		contractFlows.has(flow),
	).length;
	if (todoTotal !== expectedTodo) {
		c8Violations.push({
			check: "C8",
			subject: "root test chain",
			message: `root test outputs report ${todoTotal} todo != ${expectedTodo} (|manifest ∩ contracts|)`,
		});
	}
	recordCheck(state, "C8", c8Violations);
	state.sections.C8?.push(C8_EXCLUSION_NOTE);
	const c3StartedAtMs = Date.now();
	const harness = await sources.runGateChild([
		"bun",
		"run",
		"--cwd",
		sources.operatorWebRoot,
		"test:scenario-harness",
	]);
	recordCheck(
		state,
		"C3",
		checkScenarioHarnessSuite({ exitCode: harness.exitCode, output: harness.output }),
	);
	return { c3StartedAtMs };
}

async function runStageC(
	state: GateState,
	recordings: readonly RecordingFile[],
	c3StartedAtMs: number,
): Promise<void> {
	if (sources.qprobeBinaryPath() === null) {
		markNotRun(state, "C5", `qprobe is not on PATH — ${sources.QPROBE_INSTALL_HINT}`);
		markNotRun(state, "C6", "blocked by the C5 qprobe preflight");
		return;
	}
	const outputStamp = await sources.outputBuildStampMs();
	if (outputStamp === null || outputStamp < c3StartedAtMs) {
		markNotRun(
			state,
			"C5",
			"apps/operator-web/.output is missing or older than this invocation's C3 build",
		);
		markNotRun(state, "C6", "blocked by the C5 build-freshness preflight");
		return;
	}
	const beforeTestResults = await sources.snapshotTestResults();
	const gateServer = await sources.bootGateServer();
	const replayReports: (sources.ChildReport & { name: string })[] = [];
	try {
		for (const recording of recordings) {
			replayReports.push(await sources.runQprobeReplay(recording.name, gateServer.server.baseUrl));
		}
	} finally {
		await gateServer.stop();
	}
	recordCheck(state, "C5", checkReplayExecution(replayReports));
	const evidence = await sources.collectEvidenceLines([gateServer.runContext.evidenceDir]);
	const childStderrLines = replayReports.flatMap((report) =>
		report.stderr
			.split("\n")
			.filter((line) => line.trim() !== "")
			.map((line) => ({ source: `qprobe:${report.name}`, line: `[stderr] ${line}` })),
	);
	recordCheck(
		state,
		"C6",
		checkErrorLedger({
			serverLogLines: [...evidence.serverLogLines, ...childStderrLines],
			httpTranscript: evidence.httpTranscript,
			testResultsDeltaLines: await sources.collectTestResultsDelta(beforeTestResults),
		}),
	);
}

const renderReport = (state: GateState, modeLine: string, finalLine: string): string => {
	const lines: string[] = ["PHASE-0 ACCEPTANCE GATE", `mode: ${modeLine}`, ""];
	for (const check of CHECK_ORDER) {
		lines.push(`## ${CHECK_HEADERS[check]}`);
		lines.push(...(state.sections[check] ?? ["clean"]));
		lines.push("");
	}
	lines.push(finalLine);
	return lines.join("\n");
};

async function main(): Promise<number> {
	const args = new Set(process.argv.slice(2));
	const staticOnly = args.has("--static-only");
	const modeLine = staticOnly
		? "static-only (stage A only; stages B and C are required for PASS)"
		: "full";
	const state: GateState = { sections: {}, table: [], violations: [] };
	const { recordings } = await runStageA(state);
	const stageAClean = state.violations.length === 0;
	if (staticOnly || !stageAClean) {
		markNotRun(state, "C8");
		markNotRun(state, "C3");
		markNotRun(state, "C5");
		markNotRun(state, "C6");
	} else {
		const { c3StartedAtMs } = await runStageB(state);
		if (state.violations.length === 0) {
			await runStageC(state, recordings, c3StartedAtMs);
		} else {
			markNotRun(state, "C5");
			markNotRun(state, "C6");
		}
	}
	const finalLine =
		state.violations.length === 0 ? FINAL_PASS_LINE : finalFailLine(state.violations.length);
	if (args.has("--json")) {
		const machineReport = {
			mode: staticOnly ? "static-only" : "full",
			final: finalLine,
			table: state.table,
			violations: state.violations,
		};
		console.log(JSON.stringify(machineReport, null, 2));
	} else {
		console.log(renderReport(state, modeLine, finalLine));
	}
	return state.violations.length === 0 ? 0 : 1;
}

process.exit(await main());
