export type FixtureScope =
	| { readonly kind: "company"; readonly companyId: string }
	| { readonly kind: "space"; readonly companyId: string; readonly spaceId: string };

export interface FixtureGrant {
	readonly actorId: string;
	readonly permission: string;
	readonly scope: FixtureScope;
}

export class RbacFixture {
	readonly #grants: FixtureGrant[] = [];

	grant(input: FixtureGrant): void {
		this.#grants.push(input);
	}

	revoke(predicate: (grant: FixtureGrant) => boolean): void {
		for (let index = this.#grants.length - 1; index >= 0; index -= 1) {
			const grant = this.#grants[index];
			if (grant && predicate(grant)) this.#grants.splice(index, 1);
		}
	}

	allows(actorId: string, permission: string, target: FixtureScope): boolean {
		return this.#grants.some(
			(grant) =>
				grant.actorId === actorId &&
				grant.permission === permission &&
				grant.scope.kind === target.kind &&
				grant.scope.companyId === target.companyId &&
				(grant.scope.kind !== "space" ||
					(target.kind === "space" && grant.scope.spaceId === target.spaceId)),
		);
	}
}
