import type { Phase0FlowId } from "../harness";
import { phase0AiCases } from "./case-matrix/ai-cases";
import { phase0Cases } from "./case-matrix/cases";
import type { Phase0ScenarioCase } from "./case-matrix/types";
import {
	type AgentAdmissionFixtureDefinition,
	type AgentLineageFixtureDefinition,
	type CompanyScreenStateFixture,
	phase0FixtureProfiles,
	type SiblingIsolationFixtureDefinition,
} from "./fixture-profiles";

/**
 * Phase 0 case-matrix barrel — planning METADATA only, never executable proof.
 *
 * A green `test:phase-0` run over this matrix proves plan completeness and
 * internal consistency; it is never citable as behavior, HTTP, database,
 * realtime, or browser completion. Executable journeys stay pending in
 * `phase0PendingExecutableFlows` until their prove-* tasks land.
 *
 * Contract actor lists are narrower than the accepted proof-task prose for
 * F03/F06/F08 (Lucia and an activated Autopilot on F03, ineligible recipients
 * on F06, the requesting Human on F08); each case caps `actors` at the frozen
 * contract vocabulary and records that nuance in `permissionState` instead.
 *
 * The pinned literals here and in case-matrix.test.ts (case ledger, matrix
 * unions, modeless ledger) are intended review friction: a legitimate case
 * append edits them deliberately.
 */
export const phase0CaseMatrix = [
	...phase0Cases,
	...phase0AiCases,
] as const satisfies readonly Phase0ScenarioCase[];

/** One accepted proof task per flow; `prove-*` case sources must extend these (T8/T10). */
export const phase0ProofTasks = {
	F01: "prove-f01-human-only-company-bootstrap",
	F02: "prove-f02-provider-gated-autopilot-activation",
	F03: "prove-f03-space-project-goal-and-task-creation",
	F04: "prove-f04-structured-mention-to-attributable-result",
	F05: "prove-f05-one-agent-assignment-event",
	F06: "prove-f06-exact-run-permission-decision",
	F07: "prove-f07-durable-cancel-and-fresh-authority-retry",
	F08: "prove-f08-bounded-independent-agent-delegation",
	F09: "prove-f09-realtime-gap-recovery-without-duplicates",
	F10: "prove-f10-provider-and-capacity-loss-without-fallback",
} as const satisfies Record<Phase0FlowId, `prove-${string}`>;

/**
 * Pending manifest of executable product journeys: every flow listed here still
 * has a bodyless pending-manifest todo entry in product-scenarios.test.ts, which iterates this
 * same constant. Shrinking this list and replacing the todo with a real
 * public-seam failing test are therefore the same reviewed edit; nothing in the
 * matrix marks a flow green.
 */
export const phase0PendingExecutableFlows = [
	"F02",
	"F03",
	"F04",
	"F05",
	"F06",
	"F07",
	"F08",
	"F09",
	"F10",
] as const satisfies readonly Phase0FlowId[];

/**
 * Accepted case names with NO accepted fixture-mode or profile id anywhere in
 * the frozen registry/profile vocabulary. They stay modeless (fixtureModes: [])
 * rather than minting registry vocabulary; their fixture capabilities remain
 * machine-checked. T7 enforces `fixtureModes === []` exactly for these nine.
 */
export const phase0ModelessCases = [
	// Owner-removal race is named by the F01 flow row and the prove-f01
	// invariant (at least one active Human Owner); no setup/rbac mode names it.
	"F01-N07-last-human-owner-survives-race",
	// Channel identity derives from the F03 channels profile records; no
	// channels:* mode names the two-#general distinct-anchor split.
	"F03-P05-two-general-channels-distinct-anchors",
	// Plain text containing an @-name is accepted case prose; no thread:* mode
	// names the no-run gate.
	"F04-N01-plain-text-at-name-no-run",
	// The inactive/unavailable-Agent mention gate is accepted case prose; no
	// thread:* or run-live:* mode names it.
	"F04-N02-inactive-or-unavailable-agent-mention",
	// Duplicate Mention delivery rides the duplicate-delivery fixture
	// capability; no thread:* mode names the single-run projection.
	"F04-N03-duplicate-delivery-single-run",
	// Same-actor reassign no-op is named by prove-f05 acceptance prose and the
	// week-1-end-to-end-scenarios F05 flow row; no fixture mode names it.
	"F05-N03-same-actor-reassign-no-new-event",
	// Active-transfer fencing (wait or cancel-and-transfer) is named by
	// prove-f05 acceptance prose and the week-1-end-to-end-scenarios F05 flow
	// row; no fixture mode names it.
	"F05-N04-active-transfer-fencing",
	// Revoked-authority-at-dispatch is named only by prove-f05 acceptance prose.
	"F05-N06-revoked-authority-at-dispatch",
	// Duplicate child delivery is named only by the prove-f08 negative oracle;
	// the duplicate-delivery fixture capability carries it.
	"F08-N07-duplicate-child-delivery-one-run",
] as const satisfies readonly Phase0ScenarioCase["id"][];

/**
 * Forced-triage valve for FUTURE registry fixture modes: T12 requires every
 * registry mode to be case-referenced, grid-cited, alias-covered, or parked
 * here with a reviewed reason. Empty today — every accepted registry mode is
 * already dispositioned.
 */
export const phase0UncasedModeLedger = [] as const satisfies readonly `${string}:${string}`[];

/**
 * Pinned alias maps: accepted profile spellings -> the fixture-mode spellings
 * cases cite. case-matrix.test.ts pins its own copies (T9) so a divergence is
 * a reviewed drift signal. Targets that are not registry ids (the F08
 * admission trio) are matrix-minted strings, never registry vocabulary.
 */
const screenStateAliasTargets = {
	"home-loading": "home:loading",
	"home-empty-human-only": "home:empty-human-only",
	"home-populated": "home:populated",
	"activity-loading": "activity:loading",
	"activity-empty": "activity:empty",
	"activity-populated": "activity:populated",
	"long-slovak-copy": "copy:long-company",
} as const satisfies Record<CompanyScreenStateFixture, `${string}:${string}`>;

const admissionAliasTargets = {
	eligible: "agent-peers:independent-roots",
	"missing-membership": "agent-peers:missing-membership",
	"inactive-agent": "agent-peers:inactive-agent",
	"incompatible-runtime": "agent-peers:incompatible-runtime",
} as const satisfies Record<AgentAdmissionFixtureDefinition["mode"], `agent-peers:${string}`>;

const lineageAliasTargets = {
	"allowed-child": "agent-peers:allowed-child",
	"depth-exceeded": "agent-peers:depth-rejected",
	"repeated-fingerprint": "agent-peers:fingerprint-rejected",
} as const satisfies Record<AgentLineageFixtureDefinition["mode"], `agent-peers:${string}`>;

const siblingAliasTargets = {
	failed: "agent-peers:sibling-failure",
	cancelled: "agent-peers:sibling-cancel",
} as const satisfies Record<SiblingIsolationFixtureDefinition["state"], `agent-peers:${string}`>;

/**
 * Fixture-mode vocabulary derived mechanically from `phase0FixtureProfiles`.
 * T7 unions these per flow with owned/reused registry modes, so a profile
 * change breaks this build before it can silently widen any case. Only
 * F01/F06/F08 carry accepted profiles today.
 */
export const phase0ProfileDerivedFixtureModes: Readonly<
	Partial<Record<Phase0FlowId, readonly `${string}:${string}`[]>>
> = {
	F01: [
		...phase0FixtureProfiles.F01.invitationModes.map((mode) => `invitation:${mode}` as const),
		...phase0FixtureProfiles.F01.screenStates.map((state) => screenStateAliasTargets[state]),
	],
	F06: phase0FixtureProfiles.F06.permissionModes.map((mode) => `permission:${mode}` as const),
	F08: [
		...phase0FixtureProfiles.F08.admissionCases.map((entry) => admissionAliasTargets[entry.mode]),
		...phase0FixtureProfiles.F08.lineageCases.map((entry) => lineageAliasTargets[entry.mode]),
		...phase0FixtureProfiles.F08.siblingIsolationCases.map(
			(entry) => siblingAliasTargets[entry.state],
		),
	],
};
