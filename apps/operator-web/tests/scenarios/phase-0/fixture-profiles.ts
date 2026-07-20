export type InvitationFixtureMode =
	| "eligible"
	| "expired"
	| "revoked"
	| "already-used"
	| "wrong-account"
	| "superseded-by-resend"
	| "accept-resend-race";

export type CompanyScreenStateFixture =
	| "home-loading"
	| "home-empty-human-only"
	| "home-populated"
	| "activity-loading"
	| "activity-empty"
	| "activity-populated"
	| "long-slovak-copy";

export interface ChannelFixtureDefinition {
	readonly key: string;
	readonly spaceKey: "whole-company" | "marketing";
	readonly kind: "system_default" | "standard";
	readonly systemKey: "general" | null;
	readonly slug: "general" | "kampan";
}

export type PermissionFixtureMode =
	| "eligible-approver"
	| "no-approver"
	| "configuration-only-recipient"
	| "wrong-approver"
	| "newly-ineligible-approver"
	| "expired-request"
	| "expired-grant"
	| "unknown-effect"
	| "revoked-access"
	| "forged-authority"
	| "stale-principal"
	| "stale-lease"
	| "duplicate-decision";

export interface RevisionFixture {
	readonly key: string;
	readonly revision: 1;
}

export interface ActivatedAgentFixtureDefinition {
	readonly actorKey: "architect" | "critic";
	readonly state: "active";
	readonly membership: {
		readonly spaceKey: "marketing";
		readonly state: "active";
	};
	readonly roleBinding: RevisionFixture;
	readonly skill: RevisionFixture;
	readonly requestPolicy: RevisionFixture;
	readonly executionPolicy: RevisionFixture;
	readonly providerSnapshot: "qualified-commercial-provider:v1";
	readonly modelSnapshot: "qualified-commercial-offering:v1";
	readonly runtimeSnapshot: "self-hosted-embedded:v1";
	readonly workerSnapshot: "hreben-worker-01:lease-1";
}

export interface RootRunFixtureDefinition {
	readonly agentKey: "architect" | "critic";
	readonly requestKey: string;
	readonly runKey: string;
	readonly anchorMessageKey: "mention-architect-and-critic";
}

export interface AgentAdmissionFixtureDefinition {
	readonly mode: "eligible" | "missing-membership" | "inactive-agent" | "incompatible-runtime";
	readonly agentKey: "architect" | "critic";
	readonly expected: "accepted" | "rejected";
}

export interface AgentLineageFixtureDefinition {
	readonly mode: "allowed-child" | "depth-exceeded" | "repeated-fingerprint";
	readonly parentAgentKey: "architect" | "critic";
	readonly childAgentKey: "architect" | "critic";
	readonly depth: 2 | 3 | 4;
	readonly fingerprint: string;
	readonly expected: "accepted" | "rejected";
}

export interface SiblingIsolationFixtureDefinition {
	readonly changedRunKey: "architect-root-run" | "critic-root-run";
	readonly state: "failed" | "cancelled";
	readonly unaffectedRunKey: "architect-root-run" | "critic-root-run";
}

const agentRuntimeSnapshot = {
	providerSnapshot: "qualified-commercial-provider:v1",
	modelSnapshot: "qualified-commercial-offering:v1",
	runtimeSnapshot: "self-hosted-embedded:v1",
	workerSnapshot: "hreben-worker-01:lease-1",
} as const;

export const phase0FixtureProfiles = {
	F01: {
		invitationModes: [
			"eligible",
			"expired",
			"revoked",
			"already-used",
			"wrong-account",
			"superseded-by-resend",
			"accept-resend-race",
		] as const satisfies readonly InvitationFixtureMode[],
		screenStates: [
			"home-loading",
			"home-empty-human-only",
			"home-populated",
			"activity-loading",
			"activity-empty",
			"activity-populated",
			"long-slovak-copy",
		] as const satisfies readonly CompanyScreenStateFixture[],
	},
	F03: {
		channels: [
			{
				key: "whole-company-general",
				spaceKey: "whole-company",
				kind: "system_default",
				systemKey: "general",
				slug: "general",
			},
			{
				key: "marketing-general",
				spaceKey: "marketing",
				kind: "system_default",
				systemKey: "general",
				slug: "general",
			},
			{
				key: "marketing-campaign",
				spaceKey: "marketing",
				kind: "standard",
				systemKey: null,
				slug: "kampan",
			},
		] as const satisfies readonly ChannelFixtureDefinition[],
	},
	F06: {
		permissionModes: [
			"eligible-approver",
			"no-approver",
			"configuration-only-recipient",
			"wrong-approver",
			"newly-ineligible-approver",
			"expired-request",
			"expired-grant",
			"unknown-effect",
			"revoked-access",
			"forged-authority",
			"stale-principal",
			"stale-lease",
			"duplicate-decision",
		] as const satisfies readonly PermissionFixtureMode[],
	},
	F08: {
		agents: [
			{
				actorKey: "architect",
				state: "active",
				membership: { spaceKey: "marketing", state: "active" },
				roleBinding: { key: "marketing-space-lead", revision: 1 },
				skill: { key: "campaign-architecture", revision: 1 },
				requestPolicy: { key: "architect-request-policy", revision: 1 },
				executionPolicy: { key: "architect-execution-policy", revision: 1 },
				...agentRuntimeSnapshot,
			},
			{
				actorKey: "critic",
				state: "active",
				membership: { spaceKey: "marketing", state: "active" },
				roleBinding: { key: "marketing-space-member", revision: 1 },
				skill: { key: "campaign-critique", revision: 1 },
				requestPolicy: { key: "critic-request-policy", revision: 1 },
				executionPolicy: { key: "critic-execution-policy", revision: 1 },
				...agentRuntimeSnapshot,
			},
		] as const satisfies readonly ActivatedAgentFixtureDefinition[],
		rootRuns: [
			{
				agentKey: "architect",
				requestKey: "architect-root-request",
				runKey: "architect-root-run",
				anchorMessageKey: "mention-architect-and-critic",
			},
			{
				agentKey: "critic",
				requestKey: "critic-root-request",
				runKey: "critic-root-run",
				anchorMessageKey: "mention-architect-and-critic",
			},
		] as const satisfies readonly RootRunFixtureDefinition[],
		lineageGuard: {
			maximumDepth: 3,
			rejectRepeatedFingerprint: true,
		},
		admissionCases: [
			{ mode: "eligible", agentKey: "architect", expected: "accepted" },
			{ mode: "missing-membership", agentKey: "architect", expected: "rejected" },
			{ mode: "inactive-agent", agentKey: "architect", expected: "rejected" },
			{ mode: "incompatible-runtime", agentKey: "critic", expected: "rejected" },
		] as const satisfies readonly AgentAdmissionFixtureDefinition[],
		lineageCases: [
			{
				mode: "allowed-child",
				parentAgentKey: "architect",
				childAgentKey: "critic",
				depth: 2,
				fingerprint: "architect>critic:campaign-review",
				expected: "accepted",
			},
			{
				mode: "depth-exceeded",
				parentAgentKey: "architect",
				childAgentKey: "critic",
				depth: 4,
				fingerprint: "depth-4:campaign-review",
				expected: "rejected",
			},
			{
				mode: "repeated-fingerprint",
				parentAgentKey: "critic",
				childAgentKey: "architect",
				depth: 3,
				fingerprint: "architect>critic:campaign-review",
				expected: "rejected",
			},
		] as const satisfies readonly AgentLineageFixtureDefinition[],
		siblingIsolationCases: [
			{
				changedRunKey: "architect-root-run",
				state: "failed",
				unaffectedRunKey: "critic-root-run",
			},
			{
				changedRunKey: "critic-root-run",
				state: "cancelled",
				unaffectedRunKey: "architect-root-run",
			},
		] as const satisfies readonly SiblingIsolationFixtureDefinition[],
	},
} as const;
