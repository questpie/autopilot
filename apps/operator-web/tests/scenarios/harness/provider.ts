import type { FixtureClock } from "./clock";

export type ProviderFixtureMode =
	| "valid"
	| "invalid-credential"
	| "unavailable"
	| "no-supported-model"
	| "no-capacity";

export type ProviderVerificationResult =
	| { readonly status: "verified"; readonly modelIds: readonly string[] }
	| {
			readonly status: "failed";
			readonly reason:
				| "invalid_credential"
				| "provider_unavailable"
				| "no_supported_model"
				| "no_capacity";
	  };

export class ProviderFixture {
	#mode: ProviderFixtureMode;
	#status: "idle" | "verifying" | "settled" = "idle";
	#callCount = 0;

	constructor(
		private readonly clock: FixtureClock,
		mode: ProviderFixtureMode = "valid",
		private readonly delayMs = 750,
	) {
		this.#mode = mode;
	}

	get status(): "idle" | "verifying" | "settled" {
		return this.#status;
	}

	get callCount(): number {
		return this.#callCount;
	}

	setMode(mode: ProviderFixtureMode): void {
		this.#mode = mode;
	}

	async verify(): Promise<ProviderVerificationResult> {
		this.#status = "verifying";
		this.#callCount += 1;
		await this.clock.sleep(this.delayMs);
		this.#status = "settled";

		switch (this.#mode) {
			case "valid":
				return { status: "verified", modelIds: ["claude-sonnet-fixture"] };
			case "invalid-credential":
				return { status: "failed", reason: "invalid_credential" };
			case "unavailable":
				return { status: "failed", reason: "provider_unavailable" };
			case "no-supported-model":
				return { status: "failed", reason: "no_supported_model" };
			case "no-capacity":
				return { status: "failed", reason: "no_capacity" };
		}
	}
}
