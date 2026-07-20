interface ScheduledWait {
	readonly dueAt: number;
	readonly resolve: () => void;
}

export class FixtureClock {
	readonly #scheduled: ScheduledWait[] = [];
	#now: number;

	constructor(startAt = Date.parse("2026-07-19T08:00:00.000Z")) {
		this.#now = startAt;
	}

	now(): Date {
		return new Date(this.#now);
	}

	sleep(durationMs: number): Promise<void> {
		if (durationMs < 0) {
			throw new Error("FixtureClock cannot sleep for a negative duration");
		}

		return new Promise((resolve) => {
			this.#scheduled.push({ dueAt: this.#now + durationMs, resolve });
			this.#scheduled.sort((left, right) => left.dueAt - right.dueAt);
		});
	}

	advanceBy(durationMs: number): void {
		if (durationMs < 0) {
			throw new Error("FixtureClock cannot move backwards");
		}

		this.#now += durationMs;
		this.#flushDueWaits();
	}

	get pendingWaitCount(): number {
		return this.#scheduled.length;
	}

	#flushDueWaits(): void {
		while (this.#scheduled[0]?.dueAt !== undefined && this.#scheduled[0].dueAt <= this.#now) {
			this.#scheduled.shift()?.resolve();
		}
	}
}
