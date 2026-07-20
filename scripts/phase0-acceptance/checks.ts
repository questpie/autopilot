/**
 * Phase-0 acceptance gate — pure check functions over plain data.
 *
 * HARD CONSTRAINT: no fs, no spawn, no process.exit in this module. All
 * inputs arrive as plain data (sources.ts and the CLI own I/O), which keeps
 * every check testable against synthetic fixtures.
 */
import {
	US_ROW_BLOCKING_REPLAY,
	US_ROW_PROXY_PASSED,
	usRowBlockingOwner,
	usRowBlockingReusedBy,
} from "./report-format";

export type AcceptanceViolation = {
	check: string;
	subject: string;
	message: string;
};

export type SuiteSummary = { pass: number; fail: number; skip: number; todo: number };

export type JunitTestcase = { name: string; status: "pass" | "todo" | "skip" | "fail" };

export type RecordingFile = { name: string; sourceText: string };

export type ArtifactLine = { source: string; line: string };

export type HttpTranscriptEntryInput = { source?: string; status: number };

export type UsRowInput = { id: string; ownerFlow: string; reusedBy: readonly string[] };

export type ContractInput = {
	flow: string;
	useCase: string;
	slug: string;
	stableSelectors: readonly string[];
};

/** Sums EVERY bun summary occurrence, so turbo-prefixed multi-suite output aggregates. */
const SUMMARY_PATTERN = /(\d+)\s+(pass|fail|skip|todo)/g;

export function parseBunTestSummary(text: string): SuiteSummary {
	const summary: SuiteSummary = { pass: 0, fail: 0, skip: 0, todo: 0 };
	for (const match of text.matchAll(SUMMARY_PATTERN)) {
		const kind = match[2] as keyof SuiteSummary;
		summary[kind] += Number(match[1]);
	}
	return summary;
}

const TESTCASE_PATTERN = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
const NAME_ATTRIBUTE_PATTERN = /(?:^|\s)name="([^"]*)"/;

const decodeXmlEntities = (value: string): string =>
	value
		.replaceAll("&quot;", '"')
		.replaceAll("&apos;", "'")
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&amp;", "&");

/** Parses bun's junit reporter output (format captured live on bun 1.3.14). */
export function parseJunitTestcases(xml: string): JunitTestcase[] {
	const testcases: JunitTestcase[] = [];
	for (const match of xml.matchAll(TESTCASE_PATTERN)) {
		const attributes = match[1] ?? "";
		const inner = match[3];
		const nameMatch = NAME_ATTRIBUTE_PATTERN.exec(attributes);
		if (!nameMatch?.[1]) continue;
		const name = decodeXmlEntities(nameMatch[1]);
		let status: JunitTestcase["status"] = "pass";
		if (inner !== undefined) {
			if (/<failure\b/.test(inner)) status = "fail";
			else if (/<skipped\b[^>]*\bmessage="TODO"/.test(inner)) status = "todo";
			else if (/<skipped\b/.test(inner)) status = "skip";
		}
		testcases.push({ name, status });
	}
	return testcases;
}

/**
 * Guard (b) regex source, pinned VERBATIM to
 * apps/operator-web/tests/scenarios/harness-guards.test.ts (guard (b)). The
 * self-test asserts the harness file still contains HARNESS_GUARD_B_LITERAL,
 * so any divergence is a reviewed edit on both sides.
 */
const HARNESS_GUARD_B_SOURCE = String.raw`\.(skip|todo|only)\b|\bskipIf\b|\btodoIf\b|\b(?:test|it|describe)\.if\s*\(`;
export const HARNESS_GUARD_B_LITERAL = `/${HARNESS_GUARD_B_SOURCE}/`;

/** Superset scan token: guard (b) plus `.failing`, which guard (b) misses. */
export const FORBIDDEN_TOKEN_REGEX = new RegExp(`${HARNESS_GUARD_B_SOURCE}|\\.failing\\b`);

/**
 * Reviewed substring allowlist for C6: a line is explained only when EVERY
 * substring of one entry appears in it. Growth requires editing this literal.
 */
export const ERROR_ALLOWLIST: readonly (readonly string[])[] = [
	["WARN [Better Auth]", "oauth-authorization-server"],
];

export const REQUIRED_HARNESS_EXECUTORS = [
	"organization-db-contract.test.ts",
	"qprobe-replay.test.ts",
] as const;

export const canonicalReplayName = (flow: string, slug: string): string =>
	`${flow.toLowerCase()}-${slug}.spec.ts`;

const scenarioTestcaseName = (contract: ContractInput): string =>
	`${contract.flow} ${contract.useCase} ${contract.slug}`;

/** C1 — pending manifest flows, manifest coupling, and manifest-shrink bypass. */
export function checkPendingTodoFlows(input: {
	pendingFlows: readonly string[];
	proofTasks: Readonly<Record<string, string>>;
	contracts: readonly ContractInput[];
	junitTestcases: readonly JunitTestcase[];
	exitCode: number;
}): AcceptanceViolation[] {
	const violations: AcceptanceViolation[] = [];
	const check = "C1";
	if (input.exitCode !== 0) {
		violations.push({
			check,
			subject: "test:phase-0",
			message: `test:phase-0 exited with nonzero code ${input.exitCode}`,
		});
	}
	const contractByFlow = new Map(input.contracts.map((contract) => [contract.flow, contract]));
	const statusByName = new Map(
		input.junitTestcases.map((testcase) => [testcase.name, testcase.status]),
	);
	const pending = new Set(input.pendingFlows);
	for (const flow of input.pendingFlows) {
		const contract = contractByFlow.get(flow);
		if (!contract) {
			violations.push({
				check,
				subject: flow,
				message: `manifest-coupling drift: pending flow ${flow} has no scenario contract`,
			});
			continue;
		}
		const proofTask = input.proofTasks[flow] ?? "unpinned-proof-task";
		violations.push({
			check,
			subject: flow,
			message: `pending executable flow ${flow} (${contract.slug}) still requires ${proofTask} before it can pass`,
		});
		const name = scenarioTestcaseName(contract);
		if (statusByName.get(name) !== "todo") {
			violations.push({
				check,
				subject: flow,
				message: `manifest-coupling drift: expected TODO junit testcase "${name}" for pending flow ${flow}`,
			});
		}
	}
	const todoTotal = input.junitTestcases.filter((testcase) => testcase.status === "todo").length;
	const expectedTodo = input.pendingFlows.filter((flow) => contractByFlow.has(flow)).length;
	if (todoTotal !== expectedTodo) {
		violations.push({
			check,
			subject: "junit",
			message: `manifest-coupling drift: junit todo count ${todoTotal} != ${expectedTodo} (|manifest ∩ contracts|)`,
		});
	}
	for (const contract of input.contracts) {
		if (pending.has(contract.flow)) continue;
		const name = scenarioTestcaseName(contract);
		if (statusByName.get(name) !== "pass") {
			violations.push({
				check,
				subject: contract.flow,
				message: `flow ${contract.flow} left the pending manifest without a passing replacement testcase "${name}" (manifest-shrink bypass)`,
			});
		}
	}
	return violations;
}

/** C2 — forbidden todo/skip/only/failing tokens in phase-0 scenario sources. */
export function checkStrayTodoSkip(
	files: readonly { path: string; sourceText: string }[],
): AcceptanceViolation[] {
	return files
		.filter((file) => FORBIDDEN_TOKEN_REGEX.test(file.sourceText))
		.map((file) => ({
			check: "C2",
			subject: file.path,
			message: `forbidden todo/skip/only/failing token in ${file.path}`,
		}));
}

/** C3 — the rebuilt scenario-harness suite must run green, skip-free, todo-free. */
export function checkScenarioHarnessSuite(report: {
	exitCode: number;
	output: string;
}): AcceptanceViolation[] {
	const violations: AcceptanceViolation[] = [];
	const check = "C3";
	const subject = "test:scenario-harness";
	if (report.exitCode !== 0) {
		violations.push({
			check,
			subject,
			message: `test:scenario-harness exited with nonzero code ${report.exitCode}`,
		});
	}
	const summary = parseBunTestSummary(report.output);
	if (summary.skip > 0) {
		violations.push({
			check,
			subject,
			message: `test:scenario-harness summary reports ${summary.skip} skip (must be 0)`,
		});
	}
	if (summary.todo > 0) {
		violations.push({
			check,
			subject,
			message: `test:scenario-harness summary reports ${summary.todo} todo (must be 0)`,
		});
	}
	for (const executor of REQUIRED_HARNESS_EXECUTORS) {
		if (!report.output.includes(executor)) {
			violations.push({
				check,
				subject,
				message: `required executor ${executor} not named in suite output (path-ignore drop?)`,
			});
		}
	}
	return violations;
}

/** C4 — canonical replay recordings exist and use their contract's selectors. */
export function checkReplayPresenceAndContent(input: {
	contracts: readonly ContractInput[];
	recordings: readonly RecordingFile[];
}): AcceptanceViolation[] {
	const violations: AcceptanceViolation[] = [];
	const recordingByName = new Map(input.recordings.map((recording) => [recording.name, recording]));
	for (const contract of input.contracts) {
		const required = canonicalReplayName(contract.flow, contract.slug);
		const recording = recordingByName.get(required);
		if (!recording) {
			violations.push({
				check: "C4",
				subject: required,
				message: `missing required replay recording ${required} for ${contract.flow} (${contract.slug})`,
			});
			continue;
		}
		const usesSelector = contract.stableSelectors.some((selector) =>
			recording.sourceText.includes(selector),
		);
		if (!usesSelector) {
			violations.push({
				check: "C4",
				subject: required,
				message: `replay ${required} contains none of ${contract.flow}'s stable selectors (rename/trivial-spec bypass)`,
			});
		}
	}
	return violations;
}

/** C5 — every replay run must exit green with a nonzero passed count. */
export function checkReplayExecution(
	reports: readonly { name: string; exitCode: number; output: string }[],
): AcceptanceViolation[] {
	const violations: AcceptanceViolation[] = [];
	for (const report of reports) {
		if (report.exitCode !== 0) {
			violations.push({
				check: "C5",
				subject: report.name,
				message: `replay ${report.name} exited with nonzero code ${report.exitCode}`,
			});
		}
		const passed = /(\d+) passed/.exec(report.output);
		if (!passed || Number(passed[1]) === 0) {
			violations.push({
				check: "C5",
				subject: report.name,
				message: `replay ${report.name} reports no passing checks`,
			});
		}
		if (/failed/.test(report.output)) {
			violations.push({
				check: "C5",
				subject: report.name,
				message: `replay ${report.name} output reports failures`,
			});
		}
	}
	return violations;
}

const STDERR_PREFIX = "[stderr]";
const PLAYWRIGHT_FAILURE_MARKER = /✘|✗|\bfailed\b/;

const tryParseJsonObject = (line: string): Record<string, unknown> | undefined => {
	try {
		const value: unknown = JSON.parse(line);
		return value !== null && typeof value === "object"
			? (value as Record<string, unknown>)
			: undefined;
	} catch {
		return undefined;
	}
};

const isAllowlisted = (line: string): boolean =>
	ERROR_ALLOWLIST.some((entry) => entry.every((substring) => line.includes(substring)));

/** C6 — unexplained errors in gate-owned artifacts only (see synthesis review issue 6). */
export function checkErrorLedger(input: {
	serverLogLines: readonly ArtifactLine[];
	httpTranscript: readonly HttpTranscriptEntryInput[];
	testResultsDeltaLines?: readonly ArtifactLine[];
}): AcceptanceViolation[] {
	const violations: AcceptanceViolation[] = [];
	const check = "C6";
	for (const { source, line } of input.serverLogLines) {
		if (line.startsWith(STDERR_PREFIX)) {
			const rest = line.slice(STDERR_PREFIX.length).trim();
			const parsed = tryParseJsonObject(rest);
			if (parsed !== undefined && typeof parsed.level === "number") {
				// Structured pino via stderr: the level decides alone. The allowlist
				// never excuses a structured error, so an embedded allowlisted
				// substring cannot launder a level>=50 line.
				if (parsed.level < 50) continue;
			} else if (isAllowlisted(line)) {
				continue;
			}
			violations.push({
				check,
				subject: source,
				message: `unexplained stderr line: ${line.trim()}`,
			});
			continue;
		}
		const parsed = tryParseJsonObject(line);
		if (parsed === undefined) continue;
		if (typeof parsed.level === "number" && parsed.level >= 50) {
			violations.push({
				check,
				subject: source,
				message: `server log error (level ${parsed.level}): ${line.trim()}`,
			});
			continue;
		}
		if (typeof parsed.status === "number" && parsed.status >= 500) {
			violations.push({
				check,
				subject: source,
				message: `http.request status ${parsed.status} >= 500: ${line.trim()}`,
			});
		}
	}
	for (const entry of input.httpTranscript) {
		if (entry.status >= 500) {
			violations.push({
				check,
				subject: entry.source ?? "http-transcript",
				message: `http transcript entry status ${entry.status} >= 500`,
			});
		}
	}
	for (const { source, line } of input.testResultsDeltaLines ?? []) {
		if (PLAYWRIGHT_FAILURE_MARKER.test(line)) {
			violations.push({
				check,
				subject: source,
				message: `playwright failure marker in test-results delta: ${line.trim()}`,
			});
		}
	}
	return violations;
}

/** C7 — flow-level proxy per US row; every non-passed row is a violation. */
export function checkUsRowEvidence(input: {
	rows: readonly UsRowInput[];
	pendingFlows: readonly string[];
	contracts: readonly ContractInput[];
	presentReplayNames: readonly string[];
}): { violations: AcceptanceViolation[]; table: { id: string; status: string }[] } {
	const violations: AcceptanceViolation[] = [];
	const table: { id: string; status: string }[] = [];
	const pending = new Set(input.pendingFlows);
	const slugByFlow = new Map(input.contracts.map((contract) => [contract.flow, contract.slug]));
	const present = new Set(input.presentReplayNames);
	for (const row of input.rows) {
		let status: string;
		const pendingReused = row.reusedBy.find((flow) => pending.has(flow));
		if (pending.has(row.ownerFlow)) {
			status = usRowBlockingOwner(row.ownerFlow);
		} else if (pendingReused !== undefined) {
			status = usRowBlockingReusedBy(pendingReused);
		} else {
			const slug = slugByFlow.get(row.ownerFlow);
			const replayPresent =
				slug !== undefined && present.has(canonicalReplayName(row.ownerFlow, slug));
			status = replayPresent ? US_ROW_PROXY_PASSED : US_ROW_BLOCKING_REPLAY;
		}
		table.push({ id: row.id, status });
		if (status !== US_ROW_PROXY_PASSED) {
			violations.push({ check: "C7", subject: row.id, message: `${row.id}: ${status}` });
		}
	}
	return { violations, table };
}
