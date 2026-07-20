import { describe, expect, test } from "bun:test";
import {
	phase0CaseMatrix,
	phase0ModelessCases,
	phase0PendingExecutableFlows,
	phase0ProfileDerivedFixtureModes,
	phase0ProofTasks,
	phase0UncasedModeLedger,
} from "./case-matrix";
import { phase0ScenarioContracts, stableSelectors } from "./contracts";
import { phase0FixtureProfiles } from "./fixture-profiles";
import { phase0QueryStateCoverage, stateObligationRegistry } from "./state-obligations";

/**
 * Phase 0 case matrix drift suite (T1-T12).
 *
 * The suite asserts METADATA CONSISTENCY ONLY: it binds the 96-case matrix to the
 * frozen scenario contracts, the state-obligation registry, and the fixture
 * profiles. No test in this file (or anywhere in the matrix) asserts execution,
 * greenness, or product behavior — all 10 executable product flows stay pending
 * todos in product-scenarios.test.ts until their prove-* tasks land, and the
 * accepted registry vocabulary is never extended or renamed here.
 */
const flowIds = ["F01", "F02", "F03", "F04", "F05", "F06", "F07", "F08", "F09", "F10"] as const;

type FlowId = (typeof flowIds)[number];

const contractFor = (flow: FlowId) => {
	const contract = phase0ScenarioContracts.find((entry) => entry.flow === flow);
	if (!contract) {
		throw new Error(`missing scenario contract for ${flow}`);
	}
	return contract;
};

const casesFor = (flow: FlowId) => phase0CaseMatrix.filter((entry) => entry.flow === flow);

const obligationById = (id: string) => {
	const obligation = stateObligationRegistry.find((entry) => entry.id === id);
	if (!obligation) {
		throw new Error(`unregistered state obligation ${id}`);
	}
	return obligation;
};

const sortedUnique = (values: readonly string[]) => [...new Set(values)].sort();

const registryObligationIds = new Set<string>(
	stateObligationRegistry.map((obligation) => obligation.id),
);

const registryModeIds = new Set<string>(
	stateObligationRegistry.flatMap((obligation) => [...obligation.fixtureModeIds]),
);

/** T1 — the ONLY per-case count pin: 96 case ids in flow order (33 positive / 63 negative). */
const pinnedCaseLedger: readonly string[] = [
	"F01-P01-founder-bootstrap-journey",
	"F01-P02-lucia-invitation-acceptance",
	"F01-P03-resumable-setup-continuation",
	"F01-P04-home-activity-persisted-truth",
	"F01-P05-copy-and-adaptive-measurements",
	"F01-N01-duplicate-bootstrap-idempotent",
	"F01-N02-terminal-invitation-tokens",
	"F01-N03-wrong-account-acceptor",
	"F01-N04-accept-resend-race-single-winner",
	"F01-N05-mention-gate-without-active-agent",
	"F01-N06-company-role-not-widened-into-space",
	"F01-N07-last-human-owner-survives-race",
	"F01-N08-credential-pending-single-submit",
	"F02-P01-credential-verify-activate-journey",
	"F02-P02-skip-preserves-human-work",
	"F02-N01-invalid-credential",
	"F02-N02-stale-verification",
	"F02-N03-model-less-or-retired-offering",
	"F02-N04-provider-unavailable",
	"F02-N05-worker-capacity-unavailable",
	"F02-N06-duplicate-activation-submit",
	"F02-N07-rotated-credential-goes-stale",
	"F03-P01-space-channel-scope-journey",
	"F03-P02-project-context-narrowing",
	"F03-P03-goal-criteria-activation",
	"F03-P04-task-creation-independent-assignees",
	"F03-P05-two-general-channels-distinct-anchors",
	"F03-N01-duplicate-slug-same-space",
	"F03-N02-cross-space-message-rejected",
	"F03-N03-cross-space-relation-or-move-rejected",
	"F03-N04-stale-version-conflict-preserves-draft",
	"F03-N05-invalid-transition-or-cycle",
	"F03-N06-denied-vs-not-found-equivalence",
	"F03-N07-access-revoked-while-open",
	"F03-N08-default-channel-archive-blocked-and-restore-race",
	"F03-N09-archived-space-readonly-and-restore-race",
	"F04-P01-structured-mention-to-result",
	"F04-P02-run-card-timing-states",
	"F04-P03-reconnect-during-run",
	"F04-P04-long-structured-result-card",
	"F04-N01-plain-text-at-name-no-run",
	"F04-N02-inactive-or-unavailable-agent-mention",
	"F04-N03-duplicate-delivery-single-run",
	"F04-N04-revoked-access-before-projection",
	"F05-P01-typed-assignment-dispatches-once",
	"F05-P02-run-result-in-task-thread",
	"F05-N01-unrelated-save-no-run",
	"F05-N02-duplicate-delivery-one-event",
	"F05-N03-same-actor-reassign-no-new-event",
	"F05-N04-active-transfer-fencing",
	"F05-N05-assignment-error-preserves-intent",
	"F05-N06-revoked-authority-at-dispatch",
	"F06-P01-pause-approve-resume-journey",
	"F06-P02-deny-terminates-without-leak",
	"F06-P03-no-approver-configuration-route",
	"F06-N01-wrong-approver",
	"F06-N02-newly-ineligible-approver",
	"F06-N03-configuration-only-recipient-cannot-decide",
	"F06-N04-expired-request",
	"F06-N05-expired-grant",
	"F06-N06-unknown-or-changed-effect",
	"F06-N07-forged-authority",
	"F06-N08-revoked-access-removes-detail",
	"F06-N09-stale-principal-or-lease",
	"F06-N10-duplicate-decision-idempotent",
	"F06-N11-approval-cannot-widen-other-runs",
	"F07-P01-durable-cancel-at-safe-boundary",
	"F07-P02-explicit-retry-linked-attempt",
	"F07-P03-committed-effects-remain-visible",
	"F07-N01-late-or-duplicate-cancel-idempotent",
	"F07-N02-terminal-attempt-immutable",
	"F07-N03-retry-cannot-reuse-revoked-authority",
	"F07-N04-client-abort-not-durable-cancel",
	"F08-P01-dual-mention-independent-roots",
	"F08-P02-allowed-child-delegation",
	"F08-P03-rejection-as-attributable-thread-notice",
	"F08-N01-missing-membership-admission",
	"F08-N02-inactive-agent-admission",
	"F08-N03-incompatible-runtime-admission",
	"F08-N04-depth-above-three-rejected",
	"F08-N05-repeated-fingerprint-rejected",
	"F08-N06-sibling-lifecycle-isolation",
	"F08-N07-duplicate-child-delivery-one-run",
	"F09-P01-disconnect-stale-visible-reconnecting",
	"F09-P02-bounded-replay-resume",
	"F09-P03-gap-refetch-reconcile-nonce",
	"F09-N01-no-duplicates-after-gap",
	"F09-N02-replay-rechecks-current-access",
	"F09-N03-no-success-before-truth-agrees",
	"F10-P01-known-invalid-rejects-before-run",
	"F10-P02-transient-loss-queued-until-deadline",
	"F10-P03-stable-retryable-failure-with-retry-path",
	"F10-N01-no-fallback-model-or-runtime",
	"F10-N02-no-fake-run-or-success",
	"F10-N03-no-silent-wait-past-deadline",
	"F10-N04-no-secret-or-diagnostic-leak",
];

/** T5 — pinned sorted serverRequirement set per flow (e.g. F02 claiming real-database goes red). */
const pinnedServerRequirementSets: Readonly<Record<FlowId, readonly string[]>> = {
	F01: ["fixture-double", "real-database", "real-http"],
	F02: ["fixture-double", "real-http"],
	F03: ["fixture-double", "real-database", "real-http"],
	F04: ["fixture-double", "real-http"],
	F05: ["fixture-double", "real-database"],
	F06: ["fixture-double", "real-http"],
	F07: ["fixture-double"],
	F08: ["fixture-double"],
	F09: ["fixture-double", "real-http"],
	F10: ["fixture-double"],
};

/**
 * T6 — pinned sorted actor union per flow. Equals contract.actors for every flow
 * EXCEPT F08: the contract's "Autopilot / Agent" is not exercisable under the
 * accepted Architect/Critic fixture profile — a documented gap (board evidence),
 * not a silently degenerate matrix.
 */
const pinnedActorUnions: Readonly<Record<FlowId, readonly string[]>> = {
	F01: ["Lucia / invited Human", "Marek / Owner"],
	F02: ["Autopilot / Agent", "Tomáš / Admin"],
	F03: ["Marek / Owner"],
	F04: ["Autopilot / Agent", "Lucia / Space Member"],
	F05: ["Autopilot / Agent", "Marek / Space Lead"],
	F06: ["Autopilot / Agent", "Marek / authorized approver"],
	F07: ["Autopilot / Agent", "Lucia / requester", "Marek / Space Lead"],
	F08: ["Architect / Agent", "Critic / Agent"],
	F09: ["Lucia / Space Member"],
	F10: ["Lucia / requester", "Tomáš / Admin"],
};

/**
 * T7 — pinned modeless-case ledger: fixtureModes === [] exactly for these nine ids.
 * A modeless case gaining a mode or a moded case going bare both force an explicit
 * edit to this reviewed literal.
 */
const pinnedModelessCases: readonly string[] = [
	"F01-N07-last-human-owner-survives-race",
	"F03-P05-two-general-channels-distinct-anchors",
	"F04-N01-plain-text-at-name-no-run",
	"F04-N02-inactive-or-unavailable-agent-mention",
	"F04-N03-duplicate-delivery-single-run",
	"F05-N03-same-actor-reassign-no-new-event",
	"F05-N04-active-transfer-fencing",
	"F05-N06-revoked-authority-at-dispatch",
	"F08-N07-duplicate-child-delivery-one-run",
];

/**
 * T9b — pinned F01 screenStates alias map (profile spelling -> registry fixture mode).
 * MEMBERSHIP ONLY by decision: home:loading / activity:loading / activity:empty are
 * grid-dispositioned surface states, so there is deliberately no per-target
 * case-reference rule here — T12 proves their triage.
 */
const pinnedScreenStateAliases: Readonly<Record<string, string>> = {
	"home-loading": "home:loading",
	"home-empty-human-only": "home:empty-human-only",
	"home-populated": "home:populated",
	"activity-loading": "activity:loading",
	"activity-empty": "activity:empty",
	"activity-populated": "activity:populated",
	"long-slovak-copy": "copy:long-company",
};

/**
 * T9c — pinned registry<->profile permission alias map. The registry vocabulary is
 * NEVER renamed by this suite; alias-covered registry ids count as referenced in T12.
 */
const pinnedPermissionAliases: Readonly<Record<string, string>> = {
	"permission:eligible-approval": "permission:eligible-approver",
	"permission:configuration-only": "permission:configuration-only-recipient",
	"permission:newly-ineligible": "permission:newly-ineligible-approver",
	"permission:expired": "permission:expired-request",
};

/** T9d — pinned F08 alias maps (profile admission/lineage/sibling spellings -> registry modes). */
const pinnedAdmissionAliases: Readonly<Record<string, string>> = {
	eligible: "agent-peers:independent-roots",
	"missing-membership": "agent-peers:missing-membership",
	"inactive-agent": "agent-peers:inactive-agent",
	"incompatible-runtime": "agent-peers:incompatible-runtime",
};

const pinnedLineageAliases: Readonly<Record<string, string>> = {
	"allowed-child": "agent-peers:allowed-child",
	"depth-exceeded": "agent-peers:depth-rejected",
	"repeated-fingerprint": "agent-peers:fingerprint-rejected",
};

const pinnedSiblingAliases: Readonly<Record<string, string>> = {
	failed: "agent-peers:sibling-failure",
	cancelled: "agent-peers:sibling-cancel",
};

describe("Phase 0 case matrix", () => {
	test("pins the complete case ledger once", () => {
		const caseIds = phase0CaseMatrix.map((scenarioCase) => scenarioCase.id);
		expect(caseIds).toEqual([...pinnedCaseLedger]);
		expect(new Set(caseIds).size).toBe(caseIds.length);
	});

	test("enforces the stable case-id grammar", () => {
		for (const scenarioCase of phase0CaseMatrix) {
			expect(scenarioCase.id).toMatch(/^F(0[1-9]|10)-[PN][0-9]{2}-[a-z][a-z0-9-]+$/);
			expect(scenarioCase.id.startsWith(`${scenarioCase.flow}-`)).toBe(true);
			expect(scenarioCase.id.charAt(4)).toBe(scenarioCase.kind === "positive" ? "P" : "N");
		}
		for (const flow of flowIds) {
			const flowCases = casesFor(flow);
			for (const kindPrefix of ["P", "N"] as const) {
				// Dense from 01: renumbering is a renamed case and must go red.
				const sequence = flowCases
					.filter((scenarioCase) => scenarioCase.id.charAt(4) === kindPrefix)
					.map((scenarioCase) => Number.parseInt(scenarioCase.id.slice(5, 7), 10))
					.sort((left, right) => left - right);
				expect(sequence).toEqual(sequence.map((_, index) => index + 1));
			}
		}
	});

	test("keeps the exact selector matrix", () => {
		for (const scenarioCase of phase0CaseMatrix) {
			const contractSelectors = new Set<string>(contractFor(scenarioCase.flow).stableSelectors);
			expect(scenarioCase.selectors.length).toBeGreaterThan(0);
			expect(scenarioCase.selectors.filter((entry) => !contractSelectors.has(entry))).toEqual([]);
		}
		for (const flow of flowIds) {
			expect(
				sortedUnique(casesFor(flow).flatMap((scenarioCase) => [...scenarioCase.selectors])),
			).toEqual(sortedUnique([...contractFor(flow).stableSelectors]));
		}
		// Global union covers every registered stable selector — rejects orphaned selectors.
		expect(
			sortedUnique(phase0CaseMatrix.flatMap((scenarioCase) => [...scenarioCase.selectors])),
		).toEqual(sortedUnique(Object.values(stableSelectors)));
	});

	test("keeps the exact layer matrix", () => {
		for (const scenarioCase of phase0CaseMatrix) {
			const contractLayers = new Set<string>(contractFor(scenarioCase.flow).layers);
			expect(contractLayers.has(scenarioCase.layer)).toBe(true);
		}
		for (const flow of flowIds) {
			expect(sortedUnique(casesFor(flow).map((scenarioCase) => scenarioCase.layer))).toEqual(
				sortedUnique([...contractFor(flow).layers]),
			);
		}
	});

	test("keeps the exact server-requirement matrix", () => {
		for (const scenarioCase of phase0CaseMatrix) {
			const contract = contractFor(scenarioCase.flow);
			if (scenarioCase.serverRequirement === "real-http") {
				expect(contract.requiresRealHttp).toBe(true);
				expect(["http", "browser", "realtime"]).toContain(scenarioCase.layer);
			}
			if (scenarioCase.serverRequirement === "real-database") {
				expect(scenarioCase.layer).toBe("integration");
			}
		}
		for (const flow of flowIds) {
			expect(
				casesFor(flow).some((scenarioCase) => scenarioCase.serverRequirement === "real-http"),
			).toBe(contractFor(flow).requiresRealHttp);
		}
		const observedServerRequirementSets = Object.fromEntries(
			flowIds.map((flow) => [
				flow,
				sortedUnique(casesFor(flow).map((scenarioCase) => scenarioCase.serverRequirement)),
			]),
		);
		expect(observedServerRequirementSets).toEqual({ ...pinnedServerRequirementSets });
	});

	test("keeps the exact actor and fixture-capability matrices", () => {
		for (const scenarioCase of phase0CaseMatrix) {
			const contract = contractFor(scenarioCase.flow);
			const contractActors = new Set<string>(contract.actors);
			const contractFixtures = new Set<string>(contract.fixtures);
			expect(scenarioCase.actors.length).toBeGreaterThan(0);
			expect(scenarioCase.actors.filter((actor) => !contractActors.has(actor))).toEqual([]);
			expect(scenarioCase.fixtures.length).toBeGreaterThan(0);
			expect(
				scenarioCase.fixtures.filter((capability) => !contractFixtures.has(capability)),
			).toEqual([]);
		}
		const observedActorUnions = Object.fromEntries(
			flowIds.map((flow) => [
				flow,
				sortedUnique(casesFor(flow).flatMap((scenarioCase) => [...scenarioCase.actors])),
			]),
		);
		expect(observedActorUnions).toEqual({ ...pinnedActorUnions });
		for (const flow of flowIds) {
			expect(
				sortedUnique(casesFor(flow).flatMap((scenarioCase) => [...scenarioCase.fixtures])),
			).toEqual(sortedUnique([...contractFor(flow).fixtures]));
		}
	});

	test("binds cases to registered obligations and accepted fixture-mode vocabulary", () => {
		expect(phase0ModelessCases).toEqual([...pinnedModelessCases]);
		const modelessCaseIds = new Set<string>(phase0ModelessCases);
		for (const flow of flowIds) {
			const allowedObligations = stateObligationRegistry.filter(
				(obligation) => obligation.ownerFlow === flow || obligation.reusedBy.includes(flow),
			);
			const allowedObligationIds = new Set<string>(
				allowedObligations.map((obligation) => obligation.id),
			);
			// Flow-restricted mode vocabulary: owned + reused obligation modes plus the
			// flow's profile-derived modes (an F03 case citing permission:waiting is red).
			const allowedModeIds = new Set<string>([
				...allowedObligations.flatMap((obligation) => [...obligation.fixtureModeIds]),
				...(phase0ProfileDerivedFixtureModes[flow] ?? []),
			]);
			const flowCases = casesFor(flow);
			for (const scenarioCase of flowCases) {
				expect(scenarioCase.obligations.filter((id) => !registryObligationIds.has(id))).toEqual([]);
				expect(scenarioCase.obligations.filter((id) => !allowedObligationIds.has(id))).toEqual([]);
				for (const mode of scenarioCase.fixtureModes) {
					expect(mode).toMatch(/^[a-z][a-z0-9-]+:[a-z0-9-]+$/);
				}
				expect(scenarioCase.fixtureModes.filter((mode) => !allowedModeIds.has(mode))).toEqual([]);
				expect(scenarioCase.fixtureModes.length === 0).toBe(modelessCaseIds.has(scenarioCase.id));
			}
			// Every OWNED obligation is referenced by at least one case — rejects orphaned US rows.
			const referencedObligationIds = new Set(
				flowCases.flatMap((scenarioCase) => [...scenarioCase.obligations]),
			);
			expect(
				stateObligationRegistry
					.filter((obligation) => obligation.ownerFlow === flow)
					.map((obligation) => obligation.id)
					.filter((id) => !referencedObligationIds.has(id)),
			).toEqual([]);
		}
	});

	test("keeps prose fields non-empty and sources registry-anchored", () => {
		// Honest scope: beyond the source prefix anchor, these are non-emptiness floors,
		// review-checked — NOT semantic machine-checks.
		for (const scenarioCase of phase0CaseMatrix) {
			expect(scenarioCase.absenceAssertions.length).toBeGreaterThanOrEqual(1);
			for (const absenceAssertion of scenarioCase.absenceAssertions) {
				expect(absenceAssertion.length).toBeGreaterThan(10);
			}
			expect(scenarioCase.positiveObservation.length).toBeGreaterThan(20);
			expect(scenarioCase.permissionState.length).toBeGreaterThan(10);
			expect(scenarioCase.source).toMatch(
				/^(week-1-end-to-end-scenarios|prove-f(0[1-9]|10)-[a-z0-9-]+|fixture-profiles\.F0[1368])/,
			);
			if (scenarioCase.source.startsWith("prove-")) {
				expect(scenarioCase.source.startsWith(phase0ProofTasks[scenarioCase.flow])).toBe(true);
			}
		}
		for (const flow of flowIds) {
			expect(
				casesFor(flow).filter((scenarioCase) => scenarioCase.kind === "negative").length,
			).toBeGreaterThanOrEqual(2);
		}
	});

	test("binds fixture profiles to case coverage through pinned alias maps", () => {
		// (a) F01 invitations: every profile mode is registry vocabulary and case-referenced.
		const f01ModeIds = new Set(
			casesFor("F01").flatMap((scenarioCase) => [...scenarioCase.fixtureModes]),
		);
		const invitationModeIds = new Set<string>(obligationById("US-INVITE-01").fixtureModeIds);
		for (const profileMode of phase0FixtureProfiles.F01.invitationModes) {
			expect(invitationModeIds.has(`invitation:${profileMode}`)).toBe(true);
			expect(f01ModeIds.has(`invitation:${profileMode}`)).toBe(true);
		}
		// (b) F01 screenStates: membership-only alias map (see pinnedScreenStateAliases note).
		expect(Object.keys(pinnedScreenStateAliases)).toEqual([
			...phase0FixtureProfiles.F01.screenStates,
		]);
		expect(
			Object.values(pinnedScreenStateAliases).filter((target) => !registryModeIds.has(target)),
		).toEqual([]);
		// (c) F06 permissions: all 13 derived modes case-referenced; registry ids alias-mapped.
		const f06ModeIds = new Set(
			casesFor("F06").flatMap((scenarioCase) => [...scenarioCase.fixtureModes]),
		);
		const derivedPermissionModeIds = new Set(
			phase0FixtureProfiles.F06.permissionModes.map((profileMode) => `permission:${profileMode}`),
		);
		for (const profileMode of phase0FixtureProfiles.F06.permissionModes) {
			expect(f06ModeIds.has(`permission:${profileMode}`)).toBe(true);
		}
		const permissionModeIds = new Set<string>(obligationById("US-PERMISSION-01").fixtureModeIds);
		for (const [registryMode, profileMode] of Object.entries(pinnedPermissionAliases)) {
			expect(permissionModeIds.has(registryMode)).toBe(true);
			expect(derivedPermissionModeIds.has(profileMode)).toBe(true);
		}
		// (d) F08: alias keys equal the profile case/state sets; every target case-referenced.
		const f08ModeIds = new Set(
			casesFor("F08").flatMap((scenarioCase) => [...scenarioCase.fixtureModes]),
		);
		expect(Object.keys(pinnedAdmissionAliases).sort()).toEqual(
			sortedUnique(phase0FixtureProfiles.F08.admissionCases.map((entry) => entry.mode)),
		);
		expect(Object.keys(pinnedLineageAliases).sort()).toEqual(
			sortedUnique(phase0FixtureProfiles.F08.lineageCases.map((entry) => entry.mode)),
		);
		expect(Object.keys(pinnedSiblingAliases).sort()).toEqual(
			sortedUnique(phase0FixtureProfiles.F08.siblingIsolationCases.map((entry) => entry.state)),
		);
		expect(
			[
				...Object.values(pinnedAdmissionAliases),
				...Object.values(pinnedLineageAliases),
				...Object.values(pinnedSiblingAliases),
			].filter((target) => !f08ModeIds.has(target)),
		).toEqual([]);
		// (e) F03 channels: the two-general-channels proof case exists, modeless, profile-sourced.
		const channelCase = phase0CaseMatrix.find(
			(scenarioCase) => scenarioCase.id === "F03-P05-two-general-channels-distinct-anchors",
		);
		if (!channelCase) {
			throw new Error("missing case F03-P05-two-general-channels-distinct-anchors");
		}
		expect(channelCase.fixtureModes).toEqual([]);
		expect(channelCase.source.startsWith("fixture-profiles.F03")).toBe(true);
		expect(phase0ModelessCases).toContain(channelCase.id);
	});

	test("pins one proof task per flow", () => {
		// AC 1's mechanical edge: case.flow -> phase0ProofTasks[flow] -> registry proofTask.
		expect(phase0ProofTasks).toEqual({
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
		});
		for (const obligation of stateObligationRegistry) {
			expect(obligation.proofTask).toBe(phase0ProofTasks[obligation.ownerFlow]);
		}
	});

	test("keeps the pending manifest honest", () => {
		// Shrinking this manifest and dropping the matching pending todo must be the
		// same reviewed edit; no flow is marked green by this metadata suite.
		expect(phase0PendingExecutableFlows).toEqual([
			"F02",
			"F03",
			"F04",
			"F05",
			"F06",
			"F07",
			"F08",
			"F09",
			"F10",
		]);
		expect(phase0ScenarioContracts).toHaveLength(10);
		const contractFlows = new Set<string>(phase0ScenarioContracts.map((contract) => contract.flow));
		expect(phase0PendingExecutableFlows.filter((flow) => !contractFlows.has(flow))).toEqual([]);
	});

	test("dispositions every registry fixture mode exactly once", () => {
		// Every registry fixture mode is case-referenced, grid-cited, alias-covered, or
		// explicitly parked in the uncased-mode ledger. Any FUTURE registry mode forces
		// an explicit triage edit (new case or ledger entry); today all registry modes
		// are dispositioned with an empty ledger.
		expect(phase0UncasedModeLedger).toEqual([]);
		const caseReferencedModeIds = new Set(
			phase0CaseMatrix.flatMap((scenarioCase) => [...scenarioCase.fixtureModes]),
		);
		const gridCitedModeIds = new Set(
			phase0QueryStateCoverage.flatMap((surface) =>
				Object.values(surface.states).flatMap((disposition) =>
					"fixtureModeId" in disposition ? [disposition.fixtureModeId] : [],
				),
			),
		);
		const aliasCoveredModeIds = new Set(Object.keys(pinnedPermissionAliases));
		const ledgerModeIds = new Set<string>(phase0UncasedModeLedger);
		expect(
			[...registryModeIds].filter(
				(mode) =>
					!caseReferencedModeIds.has(mode) &&
					!gridCitedModeIds.has(mode) &&
					!aliasCoveredModeIds.has(mode) &&
					!ledgerModeIds.has(mode),
			),
		).toEqual([]);
		// Staleness guard: a ledger entry must be a real registry mode that nothing covers.
		for (const mode of phase0UncasedModeLedger) {
			expect(registryModeIds.has(mode)).toBe(true);
			expect(
				caseReferencedModeIds.has(mode) ||
					gridCitedModeIds.has(mode) ||
					aliasCoveredModeIds.has(mode),
			).toBe(false);
		}
	});
});
