import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	phase0PendingExecutableFlows,
	phase0ProofTasks,
} from "../apps/operator-web/tests/scenarios/phase-0/case-matrix";
import { phase0ScenarioContracts } from "../apps/operator-web/tests/scenarios/phase-0/contracts";
import { stateObligationRegistry } from "../apps/operator-web/tests/scenarios/phase-0/state-obligations";
import {
	canonicalReplayName,
	checkErrorLedger,
	checkPendingTodoFlows,
	checkReplayPresenceAndContent,
	checkScenarioHarnessSuite,
	checkStrayTodoSkip,
	checkUsRowEvidence,
	HARNESS_GUARD_B_LITERAL,
	type JunitTestcase,
	parseBunTestSummary,
	parseJunitTestcases,
} from "./phase0-acceptance/checks";
import {
	finalFailLine,
	NOT_RUN_BLOCKED,
	US_ROW_BLOCKING_REPLAY,
	US_ROW_PROXY_PASSED,
	usRowBlockingOwner,
	usRowBlockingReusedBy,
} from "./phase0-acceptance/report-format";

const repoRoot = join(import.meta.dir, "..");
const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
	);
});

async function createTempDir(prefix: string): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), prefix));
	temporaryRoots.push(root);
	return root;
}

const contractFixture = (flow: string, useCase: string, slug: string) => ({
	flow,
	useCase,
	slug,
	stableSelectors: [] as readonly string[],
});

const f01Contract = contractFixture("F01", "UC-P0-001", "bootstrap-human-only-company");
const f02Contract = contractFixture("F02", "UC-P0-002", "activate-autopilot-commercial-provider");
const proofTasksFixture = {
	F01: "prove-f01-human-only-company-bootstrap",
	F02: "prove-f02-provider-gated-autopilot-activation",
} as const;
const todoCase = (contract: { flow: string; useCase: string; slug: string }): JunitTestcase => ({
	name: `${contract.flow} ${contract.useCase} ${contract.slug}`,
	status: "todo",
});
const passCase = (contract: { flow: string; useCase: string; slug: string }): JunitTestcase => ({
	name: `${contract.flow} ${contract.useCase} ${contract.slug}`,
	status: "pass",
});

describe("group 1: checkPendingTodoFlows (C1 deliberately-introduced TODO)", () => {
	it("reports one violation per manifest flow, naming flow, slug, and proof task", () => {
		const violations = checkPendingTodoFlows({
			pendingFlows: ["F01", "F02"],
			proofTasks: proofTasksFixture,
			contracts: [f01Contract, f02Contract],
			junitTestcases: [todoCase(f01Contract), todoCase(f02Contract)],
			exitCode: 0,
		});
		expect(violations).toHaveLength(2);
		expect(violations[0]?.message).toContain("F01");
		expect(violations[0]?.message).toContain("bootstrap-human-only-company");
		expect(violations[0]?.message).toContain("prove-f01-human-only-company-bootstrap");
		expect(violations[1]?.message).toContain("F02");
		expect(violations[1]?.message).toContain("activate-autopilot-commercial-provider");
		expect(violations[1]?.message).toContain("prove-f02-provider-gated-autopilot-activation");
	});

	it("flags a manifest shrink without a passing executable replacement testcase", () => {
		const violations = checkPendingTodoFlows({
			pendingFlows: ["F02"],
			proofTasks: proofTasksFixture,
			contracts: [f01Contract, f02Contract],
			junitTestcases: [todoCase(f02Contract)],
			exitCode: 0,
		});
		const shrink = violations.filter((v) => v.message.includes("manifest-shrink bypass"));
		expect(shrink).toHaveLength(1);
		expect(shrink[0]?.subject).toBe("F01");
		expect(shrink[0]?.message).toContain("F01 UC-P0-001 bootstrap-human-only-company");
	});

	it("accepts a shrunk manifest once the exact passing replacement testcase exists", () => {
		const violations = checkPendingTodoFlows({
			pendingFlows: ["F02"],
			proofTasks: proofTasksFixture,
			contracts: [f01Contract, f02Contract],
			junitTestcases: [passCase(f01Contract), todoCase(f02Contract)],
			exitCode: 0,
		});
		expect(violations.filter((v) => v.subject === "F01")).toHaveLength(0);
		expect(violations).toHaveLength(1);
	});

	it("flags manifest-coupling drift when a stray TODO testcase appears", () => {
		const violations = checkPendingTodoFlows({
			pendingFlows: [],
			proofTasks: {},
			contracts: [],
			junitTestcases: [todoCase(f01Contract)],
			exitCode: 0,
		});
		expect(violations.filter((v) => v.message.includes("manifest-coupling drift"))).toHaveLength(1);
	});

	it("returns zero violations for an empty manifest with an all-pass junit", () => {
		const violations = checkPendingTodoFlows({
			pendingFlows: [],
			proofTasks: {},
			contracts: [f01Contract],
			junitTestcases: [passCase(f01Contract)],
			exitCode: 0,
		});
		expect(violations).toEqual([]);
	});

	it("flags a nonzero test:phase-0 exit code", () => {
		const violations = checkPendingTodoFlows({
			pendingFlows: [],
			proofTasks: {},
			contracts: [f01Contract],
			junitTestcases: [passCase(f01Contract)],
			exitCode: 1,
		});
		expect(violations).toHaveLength(1);
		expect(violations[0]?.message).toContain("nonzero");
	});
});

describe("group 2: checkStrayTodoSkip (C2 stray-token scan)", () => {
	it("flags skip and failing tokens in a synthetic tree, sparing the clean file", async () => {
		const root = await createTempDir("phase0-gate-stray-tokens-");
		const skipPath = join(root, "uses-skip.ts");
		const failingPath = join(root, "uses-failing.ts");
		const cleanPath = join(root, "clean.ts");
		await writeFile(skipPath, 'it.skip("pending", () => {});\n', "utf8");
		await writeFile(failingPath, 'test.failing("flaky", () => {});\n', "utf8");
		await writeFile(cleanPath, 'it("runs", () => {});\n', "utf8");
		const files = await Promise.all(
			[skipPath, failingPath, cleanPath].map(async (path) => ({
				path,
				sourceText: await readFile(path, "utf8"),
			})),
		);
		const violations = checkStrayTodoSkip(files);
		expect(violations).toHaveLength(2);
		expect(violations.map((v) => v.subject).sort()).toEqual([failingPath, skipPath].sort());
	});

	it("stays pinned to the guard (b) literal in the real harness-guards test", async () => {
		const guardSource = await readFile(
			join(repoRoot, "apps/operator-web/tests/scenarios/harness-guards.test.ts"),
			"utf8",
		);
		expect(guardSource).toContain(HARNESS_GUARD_B_LITERAL);
	});
});

describe("group 3: checkScenarioHarnessSuite (C3 deliberately-introduced DB skip)", () => {
	const bothNames = "organization-db-contract.test.ts\nqprobe-replay.test.ts";

	it("flags a skipped test in an otherwise green run", () => {
		const violations = checkScenarioHarnessSuite({
			exitCode: 0,
			output: `${bothNames}\n12 pass\n1 skip\n0 fail`,
		});
		expect(violations).toHaveLength(1);
		expect(violations[0]?.message).toContain("skip");
	});

	it("flags a missing organization-db-contract.test.ts executor", () => {
		const violations = checkScenarioHarnessSuite({
			exitCode: 0,
			output: "qprobe-replay.test.ts\n12 pass\n0 fail",
		});
		expect(violations).toHaveLength(1);
		expect(violations[0]?.message).toContain("organization-db-contract.test.ts");
	});

	it("flags a missing qprobe-replay.test.ts executor", () => {
		const violations = checkScenarioHarnessSuite({
			exitCode: 0,
			output: "organization-db-contract.test.ts\n12 pass\n0 fail",
		});
		expect(violations).toHaveLength(1);
		expect(violations[0]?.message).toContain("qprobe-replay.test.ts");
	});

	it("flags a nonzero exit code", () => {
		const violations = checkScenarioHarnessSuite({
			exitCode: 1,
			output: `${bothNames}\n12 pass\n0 fail`,
		});
		expect(violations).toHaveLength(1);
		expect(violations[0]?.message).toContain("exit");
	});

	it("returns zero violations for a clean run naming both executors", () => {
		expect(
			checkScenarioHarnessSuite({ exitCode: 0, output: `${bothNames}\n12 pass\n0 fail` }),
		).toEqual([]);
	});
});

describe("group 4: checkReplayPresenceAndContent (C4 missing or faked replay)", () => {
	const requiredNames = phase0ScenarioContracts.map((contract) =>
		canonicalReplayName(contract.flow, contract.slug),
	);

	const listRecordings = async (dir: string) => {
		const names = (await readdir(dir)).sort();
		return Promise.all(
			names.map(async (name) => ({ name, sourceText: await readFile(join(dir, name), "utf8") })),
		);
	};

	const smokeSource = () =>
		readFile(join(repoRoot, "tests/qprobe-product/recordings/harness-smoke.spec.ts"), "utf8");

	it("flags nine missing canonical names plus a selector-free canonical spec as content bypass", async () => {
		const dir = await createTempDir("phase0-gate-recordings-");
		const f01Name = canonicalReplayName("F01", "bootstrap-human-only-company");
		// harness-smoke legitimately asserts screen-sign-in (an F01 stable
		// selector) since anonymous "/" redirects there, so the content-bypass
		// fixture must be its own selector-free spec.
		const selectorFree = 'test("copy", async ({ page }) => {\n\tawait page.goto("/");\n});\n';
		await writeFile(join(dir, f01Name), selectorFree, "utf8");
		await writeFile(join(dir, "harness-smoke.spec.ts"), await smokeSource(), "utf8");
		const violations = checkReplayPresenceAndContent({
			contracts: phase0ScenarioContracts,
			recordings: await listRecordings(dir),
		});
		expect(violations).toHaveLength(10);
		const missing = violations.filter((v) => v.message.includes("missing"));
		expect(missing.map((v) => v.subject).sort()).toEqual(
			requiredNames.filter((name) => name !== f01Name).sort(),
		);
		const content = violations.filter((v) => !v.message.includes("missing"));
		expect(content).toHaveLength(1);
		expect(content[0]?.subject).toBe(f01Name);
		expect(content[0]?.message).toContain("stable selectors");
	});

	it("accepts an f01 spec that uses a stable selector, leaving only missing names", async () => {
		const dir = await createTempDir("phase0-gate-recordings-");
		const f01Name = canonicalReplayName("F01", "bootstrap-human-only-company");
		await writeFile(join(dir, f01Name), 'await page.getByTestId("screen-sign-in");\n', "utf8");
		const violations = checkReplayPresenceAndContent({
			contracts: phase0ScenarioContracts,
			recordings: await listRecordings(dir),
		});
		expect(violations).toHaveLength(9);
		expect(violations.filter((v) => v.subject === f01Name)).toEqual([]);
	});

	it("returns zero violations when all ten canonical specs use an owner selector", async () => {
		const dir = await createTempDir("phase0-gate-recordings-");
		for (const contract of phase0ScenarioContracts) {
			await writeFile(
				join(dir, canonicalReplayName(contract.flow, contract.slug)),
				`await page.getByTestId("${contract.stableSelectors[0]}");\n`,
				"utf8",
			);
		}
		const violations = checkReplayPresenceAndContent({
			contracts: phase0ScenarioContracts,
			recordings: await listRecordings(dir),
		});
		expect(violations).toEqual([]);
	});

	it("never lets harness-smoke or storybook names satisfy a flow", async () => {
		const dir = await createTempDir("phase0-gate-recordings-");
		await writeFile(join(dir, "harness-smoke.spec.ts"), await smokeSource(), "utf8");
		await writeFile(join(dir, "storybook-home.spec.ts"), "await page.goto('/');\n", "utf8");
		const violations = checkReplayPresenceAndContent({
			contracts: phase0ScenarioContracts,
			recordings: await listRecordings(dir),
		});
		expect(violations).toHaveLength(10);
		expect(violations.map((v) => v.subject).sort()).toEqual([...requiredNames].sort());
	});
});

describe("group 5: checkErrorLedger (C6 unexplained errors)", () => {
	const serverLog = (line: string) => ({ source: "server.log", line });

	it("flags a pino level-50 server log line", () => {
		const violations = checkErrorLedger({
			serverLogLines: [serverLog('{"level":50,"msg":"boom"}')],
			httpTranscript: [],
		});
		expect(violations).toHaveLength(1);
		expect(violations[0]?.message).toContain("level");
	});

	it("flags a raw unexplained stderr line", () => {
		const violations = checkErrorLedger({
			serverLogLines: [serverLog("[stderr] boom")],
			httpTranscript: [],
		});
		expect(violations).toHaveLength(1);
		expect(violations[0]?.message).toContain("stderr");
	});

	it("flags a pino http.request line with status 503", () => {
		const violations = checkErrorLedger({
			serverLogLines: [serverLog('{"level":30,"msg":"http.request","status":503}')],
			httpTranscript: [],
		});
		expect(violations).toHaveLength(1);
		expect(violations[0]?.message).toContain("503");
	});

	it("flags an http-transcript entry with status 500", () => {
		const violations = checkErrorLedger({
			serverLogLines: [],
			httpTranscript: [{ source: "http-transcript.jsonl", status: 500 }],
		});
		expect(violations).toHaveLength(1);
		expect(violations[0]?.message).toContain("500");
	});

	it("allowlists the Better Auth WARN line regardless of timestamp prefix", () => {
		const line =
			"[stderr] 2031-04-05T06:07:08.901Z WARN [Better Auth]: OAuth metadata endpoint " +
			"oauth-authorization-server is not configured";
		expect(checkErrorLedger({ serverLogLines: [serverLog(line)], httpTranscript: [] })).toEqual([]);
	});

	it("never lets allowlist substrings launder a structured level>=50 stderr error", () => {
		const line = '[stderr] {"level":50,"msg":"boom WARN [Better Auth] oauth-authorization-server"}';
		const violations = checkErrorLedger({
			serverLogLines: [serverLog(line)],
			httpTranscript: [],
		});
		expect(violations).toHaveLength(1);
		expect(violations[0]?.check).toBe("C6");
	});

	it("accepts clean level-30 lines", () => {
		const violations = checkErrorLedger({
			serverLogLines: [
				serverLog('{"level":30,"msg":"http.request","status":200}'),
				serverLog('{"level":30,"msg":"ready"}'),
			],
			httpTranscript: [{ source: "http-transcript.jsonl", status: 204 }],
		});
		expect(violations).toEqual([]);
	});
});

describe("group 6: checkUsRowEvidence (C7 US-row proxy)", () => {
	const contracts = [
		contractFixture("F01", "UC-P0-001", "alpha-flow"),
		contractFixture("F02", "UC-P0-002", "beta-flow"),
	];
	const f01Replay = canonicalReplayName("F01", "alpha-flow");

	it("blocks on a pending ownerFlow", () => {
		const result = checkUsRowEvidence({
			rows: [{ id: "US-A-01", ownerFlow: "F01", reusedBy: [] }],
			pendingFlows: ["F01"],
			contracts,
			presentReplayNames: [f01Replay],
		});
		expect(result.table).toEqual([{ id: "US-A-01", status: usRowBlockingOwner("F01") }]);
		expect(result.violations).toHaveLength(1);
		expect(result.violations[0]?.subject).toBe("US-A-01");
	});

	it("blocks on a pending reusedBy flow even when the owner is proven", () => {
		const result = checkUsRowEvidence({
			rows: [{ id: "US-B-01", ownerFlow: "F01", reusedBy: ["F02"] }],
			pendingFlows: ["F02"],
			contracts,
			presentReplayNames: [f01Replay],
		});
		expect(result.table).toEqual([{ id: "US-B-01", status: usRowBlockingReusedBy("F02") }]);
		expect(result.violations).toHaveLength(1);
	});

	it("blocks on a missing owner replay when all flows are proven", () => {
		const result = checkUsRowEvidence({
			rows: [{ id: "US-C-01", ownerFlow: "F02", reusedBy: [] }],
			pendingFlows: [],
			contracts,
			presentReplayNames: [f01Replay],
		});
		expect(result.table).toEqual([{ id: "US-C-01", status: US_ROW_BLOCKING_REPLAY }]);
		expect(result.violations).toHaveLength(1);
	});

	it("proxy-passes only with proven flows plus a present owner replay", () => {
		const result = checkUsRowEvidence({
			rows: [{ id: "US-D-01", ownerFlow: "F01", reusedBy: ["F02"] }],
			pendingFlows: [],
			contracts,
			presentReplayNames: [f01Replay],
		});
		expect(result.table).toEqual([{ id: "US-D-01", status: US_ROW_PROXY_PASSED }]);
		expect(result.violations).toEqual([]);
	});

	it("keeps every row in the table and one violation per non-passed row", () => {
		const result = checkUsRowEvidence({
			rows: [
				{ id: "US-A-01", ownerFlow: "F01", reusedBy: [] },
				{ id: "US-D-01", ownerFlow: "F02", reusedBy: [] },
			],
			pendingFlows: ["F01"],
			contracts,
			presentReplayNames: [canonicalReplayName("F02", "beta-flow")],
		});
		expect(result.table.map((row) => row.id)).toEqual(["US-A-01", "US-D-01"]);
		expect(result.table[1]?.status).toBe(US_ROW_PROXY_PASSED);
		expect(result.violations.map((v) => v.subject)).toEqual(["US-A-01"]);
	});
});

describe("group 7: parsers", () => {
	it("parseBunTestSummary sums every summary across turbo-prefixed output", () => {
		const output = [
			"@autopilot/operator-web:test:  34 pass",
			"@autopilot/operator-web:test:  10 todo",
			"@autopilot/operator-web:test:  0 fail",
			"@autopilot/operator-web:test: Ran 44 tests across 4 files. [59.00ms]",
			"@autopilot/ui:test:  5 pass",
			"@autopilot/ui:test:  1 skip",
			"@autopilot/ui:test:  0 fail",
		].join("\n");
		expect(parseBunTestSummary(output)).toEqual({ pass: 39, fail: 0, skip: 1, todo: 10 });
	});

	it("parseJunitTestcases maps pass, TODO-skipped, skipped, and failure testcases", () => {
		const junit = [
			'<?xml version="1.0" encoding="UTF-8"?>',
			'<testsuites name="bun test" tests="4" assertions="3" failures="1" skipped="2" time="0.05">',
			'  <testsuite name="tests/scenarios/phase-0/organization-domain.test.ts" tests="4" failures="1" skipped="2" time="0" hostname="fixture">',
			'    <testcase name="Company role permissions never imply Space content permissions" classname="F01 Company participation and authority contract" time="0.000174" file="tests/scenarios/phase-0/organization-domain.test.ts" line="13" assertions="2" />',
			'    <testcase name="F01 UC-P0-001 bootstrap-human-only-company" classname="Phase 0 product scenarios" time="0" file="tests/scenarios/phase-0/product-scenarios.test.ts" line="11" assertions="0">',
			'      <skipped message="TODO" />',
			"    </testcase>",
			'    <testcase name="a deliberately skipped case" classname="Fixture suite" time="0">',
			"      <skipped />",
			"    </testcase>",
			'    <testcase name="a failing case" classname="Fixture suite" time="0.001">',
			'      <failure message="expected 1 to be 2" type="AssertionError" />',
			"    </testcase>",
			"  </testsuite>",
			"</testsuites>",
		].join("\n");
		expect(parseJunitTestcases(junit)).toEqual([
			{ name: "Company role permissions never imply Space content permissions", status: "pass" },
			{ name: "F01 UC-P0-001 bootstrap-human-only-company", status: "todo" },
			{ name: "a deliberately skipped case", status: "skip" },
			{ name: "a failing case", status: "fail" },
		]);
	});
});

describe("group 8: honest integration (--static-only) and reentry guard", () => {
	const gateEntry = join(repoRoot, "scripts/verify-phase-0-acceptance.ts");

	const runGate = async (extraEnv?: Record<string, string>) => {
		const child = Bun.spawn(["bun", gateEntry, "--static-only"], {
			cwd: repoRoot,
			env: { ...process.env, ...extraEnv },
			stderr: "pipe",
			stdout: "pipe",
		});
		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		]);
		return { exitCode, stdout, stderr, output: `${stdout}\n${stderr}` };
	};

	it("fails honestly today, enumerating pending flows, missing replays, and the full US table", async () => {
		const result = await runGate();
		const pending = new Set<string>(phase0PendingExecutableFlows);
		if (pending.size > 0) expect(result.exitCode).not.toBe(0);
		for (const contract of phase0ScenarioContracts) {
			const pendingLine = `pending executable flow ${contract.flow}`;
			if (pending.has(contract.flow)) {
				expect(result.output).toContain(pendingLine);
				expect(result.output).toContain(phase0ProofTasks[contract.flow]);
			} else {
				expect(result.output).not.toContain(pendingLine);
			}
		}
		const presentNames = new Set(await readdir(join(repoRoot, "tests/qprobe-product/recordings")));
		for (const contract of phase0ScenarioContracts) {
			const required = canonicalReplayName(contract.flow, contract.slug);
			const missingLine = `missing required replay recording ${required}`;
			if (presentNames.has(required)) expect(result.output).not.toContain(missingLine);
			else expect(result.output).toContain(missingLine);
		}
		const expectedRows = checkUsRowEvidence({
			rows: stateObligationRegistry,
			pendingFlows: phase0PendingExecutableFlows,
			contracts: phase0ScenarioContracts,
			presentReplayNames: [...presentNames],
		});
		for (const row of expectedRows.table) {
			expect(result.stdout).toContain(`${row.id}: ${row.status}`);
		}
		const tableLines = result.stdout
			.split("\n")
			.filter((line) => /^ {2}US-[A-Z0-9-]+: /.test(line));
		expect(tableLines).toHaveLength(stateObligationRegistry.length);
		expect(result.stdout).toContain(NOT_RUN_BLOCKED);
		const lastLine = result.stdout.trim().split("\n").at(-1) ?? "";
		const failMatch = /FAIL \((\d+) violations\)$/.exec(lastLine);
		expect(failMatch).not.toBeNull();
		const reportedCount = Number(failMatch?.[1] ?? 0);
		expect(reportedCount).toBeGreaterThan(0);
		expect(lastLine).toBe(finalFailLine(reportedCount));
	}, 120000);

	it("refuses to start when PHASE0_GATE_CHILD is already set (reentry guard)", async () => {
		const result = await runGate({ PHASE0_GATE_CHILD: "1" });
		expect(result.exitCode).not.toBe(0);
		expect(result.output).toContain("PHASE0_GATE_CHILD");
	});
});
