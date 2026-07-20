import type { FixtureIdFactory } from "./ids";

export type FixtureActorKind = "human" | "agent";

export interface FixtureActor {
	readonly id: string;
	readonly kind: FixtureActorKind;
	readonly name: string;
}

export interface FixtureSpace {
	readonly id: string;
	readonly name: string;
	readonly isWholeCompany: boolean;
}

export interface DisposableCompanyFixture {
	readonly company: { readonly id: string; readonly name: string };
	readonly actors: Map<string, FixtureActor>;
	readonly spaces: Map<string, FixtureSpace>;
	readonly databaseName: string;
	readonly disposed: boolean;
	addActor(input: Omit<FixtureActor, "id">): FixtureActor;
	addSpace(input: Omit<FixtureSpace, "id">): FixtureSpace;
	dispose(): void;
}

export function createDisposableCompanyFixture(
	ids: FixtureIdFactory,
	companyName = "Hrebeň",
): DisposableCompanyFixture {
	const companyId = ids.next("company");
	const actors = new Map<string, FixtureActor>();
	const spaces = new Map<string, FixtureSpace>();
	let disposed = false;

	const fixture: DisposableCompanyFixture = {
		company: { id: companyId, name: companyName },
		actors,
		spaces,
		databaseName: `autopilot_test_${companyId.replaceAll("-", "_")}`,
		get disposed() {
			return disposed;
		},
		addActor(input) {
			if (disposed) throw new Error("Cannot mutate a disposed Company fixture");
			const actor = { ...input, id: ids.next("actor") };
			actors.set(actor.id, actor);
			return actor;
		},
		addSpace(input) {
			if (disposed) throw new Error("Cannot mutate a disposed Company fixture");
			const space = { ...input, id: ids.next("space") };
			spaces.set(space.id, space);
			return space;
		},
		dispose() {
			actors.clear();
			spaces.clear();
			disposed = true;
		},
	};

	return fixture;
}
