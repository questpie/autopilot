export interface FixtureIdFactory {
	next(prefix: string): string;
}

export function createFixtureIdFactory(seed = "phase0"): FixtureIdFactory {
	let sequence = 0;

	return {
		next(prefix) {
			sequence += 1;
			return `${prefix}_${seed}_${String(sequence).padStart(4, "0")}`;
		},
	};
}
