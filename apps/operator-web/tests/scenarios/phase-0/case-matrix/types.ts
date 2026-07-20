import type { FixtureCapability, Phase0FlowId, ScenarioLayer } from "../../harness";
import type { StateObligation } from "../state-obligation-registry/types";

/**
 * Case-matrix METADATA vocabulary. A Phase0ScenarioCase is a planning record that
 * binds one positive or negative scenario case to the frozen contract, registry, and
 * fixture-profile vocabulary. It is never executable proof: no case here marks a
 * flow green, and the accepted registry vocabulary is never extended or renamed by
 * this module.
 */
export type Phase0CaseKind = "positive" | "negative";

export type Phase0CaseId = `${Phase0FlowId}-${"P" | "N"}${string}`;

export type Phase0ServerRequirement = "real-http" | "real-database" | "fixture-double";

export interface Phase0ScenarioCase {
	readonly id: Phase0CaseId;
	readonly flow: Phase0FlowId;
	readonly kind: Phase0CaseKind;
	readonly source: string;
	readonly obligations: readonly StateObligation["id"][];
	readonly actors: readonly string[];
	readonly permissionState: string;
	readonly fixtures: readonly FixtureCapability[];
	readonly fixtureModes: readonly `${string}:${string}`[];
	readonly layer: ScenarioLayer;
	readonly serverRequirement: Phase0ServerRequirement;
	readonly positiveObservation: string;
	readonly absenceAssertions: readonly string[];
	readonly selectors: readonly string[];
}
