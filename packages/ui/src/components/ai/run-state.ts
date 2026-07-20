import type { ActorProjection } from "@questpie/ui/components/composites/actor";
import type { StatusState } from "@questpie/ui/components/composites/status";

export interface RunPermissionProjection {
	id: string;
	capability: string;
	scope: string;
	consequence: string;
	requestedBy: ActorProjection;
	decision: "pending" | "approved" | "denied" | "expired";
	canDecide: boolean;
	expiresAt?: string;
}

export interface RunProvenanceProjection {
	id: string;
	kind: "effect" | "output" | "evidence";
	label: string;
	referenceId: string;
	actor: ActorProjection;
	occurredAt: string;
	detail?: string;
}

export interface RunRecapProjection {
	summary: string;
	items: readonly RunProvenanceProjection[];
}

export type RunActivePhase = "queued" | "evaluating" | "working" | "responding";

export type RunPresentationState =
	| { kind: "live"; phase: RunActivePhase; phaseLabel: string; currentAction: string }
	| { kind: "waiting-permission"; permission: RunPermissionProjection }
	| { kind: "failed"; summary: string; retryLabel: string }
	| { kind: "reconnecting"; label: string; replayLabel: string }
	| {
			kind: "cancel-requested";
			requestId: string;
			label: string;
			requestedAt: string;
			requestedBy: ActorProjection;
	  }
	| { kind: "rejected"; reason: string; occurredAt: string; policyReferenceId: string }
	| { kind: "timed-out"; summary: string; occurredAt: string; retryLabel: string }
	| {
			kind: "cancelled";
			reason: string;
			cancelledAt: string;
			cancelledBy: ActorProjection;
	  }
	| { kind: "completed"; recap: RunRecapProjection };

export interface RunProjection {
	id: string;
	actor: ActorProjection;
	state: RunPresentationState;
	elapsed?: string;
	activity: string;
	hiddenActivityCount?: number;
}

const runStateStatus: Record<RunPresentationState["kind"], StatusState> = {
	live: "running",
	"waiting-permission": "attention",
	failed: "failed",
	reconnecting: "attention",
	"cancel-requested": "attention",
	rejected: "blocked",
	"timed-out": "failed",
	cancelled: "blocked",
	completed: "done",
};

const runStateLabels: Record<RunPresentationState["kind"], string> = {
	live: "Pracuje",
	"waiting-permission": "Čaká na povolenie",
	failed: "Zlyhalo",
	reconnecting: "Obnovuje spojenie",
	"cancel-requested": "Ruší sa",
	rejected: "Odmietnuté",
	"timed-out": "Vypršal čas",
	cancelled: "Zrušené",
	completed: "Hotovo",
};

function getRunStateStatus(state: RunPresentationState): StatusState {
	return runStateStatus[state.kind];
}

function getRunStateLabel(state: RunPresentationState): string {
	return state.kind === "live" ? state.phaseLabel : runStateLabels[state.kind];
}

export { getRunStateLabel, getRunStateStatus };
