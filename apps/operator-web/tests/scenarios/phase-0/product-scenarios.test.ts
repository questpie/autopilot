import { describe, test } from "bun:test";
import { phase0PendingExecutableFlows } from "./case-matrix";
import { phase0ScenarioContracts } from "./contracts";

describe("Phase 0 product scenarios", () => {
	const pendingFlows = new Set<string>(phase0PendingExecutableFlows);
	for (const scenario of phase0ScenarioContracts) {
		if (!pendingFlows.has(scenario.flow)) {
			continue;
		}
		test.todo(`${scenario.flow} ${scenario.useCase} ${scenario.slug}`);
	}
});
