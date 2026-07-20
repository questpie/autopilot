export type EvidenceSource = "browser" | "console" | "network" | "server";

export interface ScenarioEvidenceEntry {
	readonly source: EvidenceSource;
	readonly level: "info" | "error";
	readonly message: string;
	readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

const forbiddenMetadataKey = /(authorization|cookie|credential|password|prompt|secret|token)/i;

export class ScenarioEvidenceRecorder {
	readonly #entries: ScenarioEvidenceEntry[] = [];

	record(entry: ScenarioEvidenceEntry): void {
		if (
			entry.metadata &&
			Object.keys(entry.metadata).some((key) => forbiddenMetadataKey.test(key))
		) {
			throw new Error("Evidence metadata cannot contain credentials or unrestricted prompts");
		}

		this.#entries.push(entry);
	}

	get entries(): readonly ScenarioEvidenceEntry[] {
		return this.#entries;
	}

	errors(): readonly ScenarioEvidenceEntry[] {
		return this.#entries.filter((entry) => entry.level === "error");
	}
}
