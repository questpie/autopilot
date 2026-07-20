export type Phase0FlowId =
	| "F01"
	| "F02"
	| "F03"
	| "F04"
	| "F05"
	| "F06"
	| "F07"
	| "F08"
	| "F09"
	| "F10";

export type Phase0UseCaseId =
	| "UC-P0-001"
	| "UC-P0-002"
	| "UC-P0-003"
	| "UC-P0-004"
	| "UC-P0-005"
	| "UC-P0-006"
	| "UC-P0-007"
	| "UC-P0-008"
	| "UC-P0-009"
	| "UC-P0-010";

export type ScenarioLayer = "contract" | "http" | "integration" | "browser" | "realtime";

export type FixtureCapability =
	| "auth"
	| "activated-agents"
	| "clock"
	| "company"
	| "duplicate-delivery"
	| "evidence"
	| "invitations"
	| "permissions"
	| "provider"
	| "queue"
	| "rbac"
	| "realtime-gap"
	| "screen-states"
	| "spaces-channels";

export interface Phase0ScenarioContract {
	readonly flow: Phase0FlowId;
	readonly useCase: Phase0UseCaseId;
	readonly slug: string;
	readonly actors: readonly string[];
	readonly fixtures: readonly FixtureCapability[];
	readonly layers: readonly ScenarioLayer[];
	readonly stableSelectors: readonly string[];
	readonly negativeOracle: string;
	readonly requiresRealHttp: boolean;
}
