/**
 * Phase-0 acceptance gate report vocabulary — string constants and one-line
 * builders ONLY. Both the gate CLI (verify-phase-0-acceptance.ts) and its
 * self-tests import these literals, so the report format cannot drift from
 * what the tests assert. No logic lives here.
 */

export const CHECK_HEADERS = {
	C1: "C1 pending-and-replaced-flows",
	C2: "C2 stray-todo-skip-scan",
	C3: "C3 scenario-harness-suite",
	C4: "C4 replay-presence-and-content",
	C5: "C5 replay-execution",
	C6: "C6 error-ledger",
	C7: "C7 us-row-evidence",
	C8: "C8 root-quality-gates",
} as const;

/** US-row status vocabulary (C7 table cells). */
export const US_ROW_PROXY_PASSED = "proxy-passed (flow-level)";
export const US_ROW_BLOCKING_REPLAY = "still blocking (replay missing)";
export const usRowBlockingOwner = (flow: string): string =>
	`still blocking (ownerFlow ${flow} pending)`;
export const usRowBlockingReusedBy = (flow: string): string =>
	`still blocking (reusedBy ${flow} pending)`;

/** Marker for a required check skipped because an earlier stage failed. */
export const NOT_RUN_BLOCKED = "not-run (blocked by earlier stage)";

/** Final report line builders. */
export const FINAL_PASS_LINE = "PHASE-0 ACCEPTANCE: PASS";
export const finalFailLine = (violationCount: number): string =>
	`PHASE-0 ACCEPTANCE: FAIL (${violationCount} violations)`;

/** Legend printed under the always-complete 26-row US table. */
export const REPORT_LEGEND: readonly string[] = [
	"Legend:",
	`- '${US_ROW_PROXY_PASSED}' claims flow-level evidence ONLY: the row's ownerFlow and every reusedBy flow have left the pending manifest AND the owner's canonical replay recording exists. It is not per-row proof.`,
	"- 'still blocking (...)' names the specific missing evidence (pending ownerFlow, pending reusedBy flow, or missing replay recording); every such row is a violation.",
	"- The spec's 'deliberately non-applicable' row category is intentionally never machine-emitted here: per-cell NA dispositions live in apps/operator-web/tests/scenarios/phase-0/state-obligation-registry/query-coverage.ts.",
	`- '${NOT_RUN_BLOCKED}' marks a required check that could not run because an earlier stage already failed; it still forces a FAIL exit.`,
];
