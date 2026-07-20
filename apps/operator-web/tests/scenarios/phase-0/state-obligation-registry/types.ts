import type { Phase0FlowId, ScenarioLayer } from "../../harness";

export interface StateObligation {
	readonly id: `US-${string}-01`;
	readonly ownerFlow: Phase0FlowId;
	readonly proofTask: `prove-${string}`;
	readonly reusedBy: readonly Phase0FlowId[];
	readonly selectors: readonly string[];
	readonly fixtureModeIds: readonly `${string}:${string}`[];
	readonly layers: readonly ScenarioLayer[];
	readonly absenceAssertion: string;
}

export const queryStateKeys = [
	"initialLoading",
	"intrinsicEmpty",
	"filteredNoResults",
	"wholeSurfaceError",
	"deniedOrNotFound",
	"revokedWhileOpen",
	"archiveReadOnlyRestore",
	"versionConflict",
	"mutationError",
	"reconnectOrReplayGap",
	"longCopy",
] as const;

export type QueryStateKey = (typeof queryStateKeys)[number];
export const notApplicableReasons = [
	"NA-DATA",
	"NA-FILTER",
	"NA-LIFECYCLE",
	"NA-IMMUTABLE",
	"NA-READONLY",
	"NA-STATIC",
	"NA-SECURITY",
	"NA-INVARIANT",
] as const;

export type NotApplicableReason = (typeof notApplicableReasons)[number];
export type QueryStateDisposition =
	| {
			readonly obligationId: StateObligation["id"];
			readonly fixtureModeId: `${string}:${string}`;
	  }
	| { readonly notApplicable: NotApplicableReason };

export interface QueryStateCoverage {
	readonly selector: string;
	readonly states: Readonly<Record<QueryStateKey, QueryStateDisposition>>;
}
