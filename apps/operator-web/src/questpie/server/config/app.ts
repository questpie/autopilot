import { appConfig } from "#questpie/factories";

export interface OrganizationScope {
	readonly actorIds: string[];
	readonly companyIds: string[];
	readonly invitationCompanyIds: string[];
	readonly roleCompanyIds: string[];
	readonly auditCompanyIds: string[];
	readonly spaceIds: string[];
	readonly companyPermissions: Record<string, string[]>;
	readonly spacePermissions: Record<string, string[]>;
}

const emptyScope = (): OrganizationScope => ({
	actorIds: [],
	companyIds: [],
	invitationCompanyIds: [],
	roleCompanyIds: [],
	auditCompanyIds: [],
	spaceIds: [],
	companyPermissions: {},
	spacePermissions: {},
});

function appendPermissions(
	target: Record<string, Set<string>>,
	key: string,
	permissions: readonly string[],
): void {
	const values = target[key] ?? new Set<string>();
	for (const permission of permissions) values.add(permission);
	target[key] = values;
}

function serializePermissions(input: Record<string, Set<string>>): Record<string, string[]> {
	return Object.fromEntries(
		Object.entries(input).map(([key, values]) => [key, [...values].sort()]),
	);
}

export default appConfig({
	access: {
		read: false,
		create: false,
		update: false,
		delete: false,
		transition: false,
		serve: false,
		introspect: false,
	},
	context: async ({ session, collections }): Promise<{ organizationScope: OrganizationScope }> => {
		if (!session?.user) return { organizationScope: emptyScope() };

		const actors = await collections.actors.find({
			where: { user: session.user.id, membershipStatus: "active", kind: "human" },
			limit: 500,
		});
		if (actors.docs.length === 0) return { organizationScope: emptyScope() };

		const actorIds = actors.docs.map((actor) => actor.id);
		const actorCompany = new Map(actors.docs.map((actor) => [actor.id, actor.company]));
		const bindings = await collections.actor_role_bindings.find({
			where: { actor: { in: actorIds }, status: "active" },
			limit: 2_000,
		});
		const roleIds = [...new Set(bindings.docs.map((binding) => binding.role))];
		const roles = roleIds.length
			? await collections.roles.find({
					where: { id: { in: roleIds }, status: "active" },
					limit: 500,
				})
			: { docs: [] };
		const rolesById = new Map(roles.docs.map((role) => [role.id, role]));
		const companyPermissionSets: Record<string, Set<string>> = {};
		const spacePermissionSets: Record<string, Set<string>> = {};

		for (const binding of bindings.docs) {
			const role = rolesById.get(binding.role);
			const companyId = actorCompany.get(binding.actor);
			if (!role || !companyId || binding.company !== companyId || role.company !== companyId)
				continue;
			if (binding.scopeType !== role.scopeType) continue;

			if (binding.scopeType === "company" && !binding.space) {
				appendPermissions(companyPermissionSets, companyId, role.permissions);
			}
			if (binding.scopeType === "space" && binding.space) {
				appendPermissions(spacePermissionSets, binding.space, role.permissions);
			}
		}

		const memberships = await collections.space_memberships.find({
			where: { actor: { in: actorIds }, status: "active" },
			limit: 2_000,
		});
		const activeMembershipSpaceIds = new Set(
			memberships.docs
				.filter((membership) => actorCompany.get(membership.actor) === membership.company)
				.map((membership) => membership.space),
		);
		const companyPermissions = serializePermissions(companyPermissionSets);
		const spacePermissions = serializePermissions(spacePermissionSets);
		const companyIds = Object.entries(companyPermissions)
			.filter(([, permissions]) => permissions.includes("company.read"))
			.map(([companyId]) => companyId);
		const spaceIds = Object.entries(spacePermissions)
			.filter(
				([spaceId, permissions]) =>
					activeMembershipSpaceIds.has(spaceId) && permissions.includes("space.read"),
			)
			.map(([spaceId]) => spaceId);

		return {
			organizationScope: {
				actorIds: actors.docs
					.filter((actor) => companyIds.includes(actor.company))
					.map((actor) => actor.id),
				companyIds,
				invitationCompanyIds: companyIds.filter((companyId) =>
					companyPermissions[companyId]?.includes("members.invite_suspend"),
				),
				roleCompanyIds: companyIds.filter((companyId) =>
					companyPermissions[companyId]?.includes("roles.read"),
				),
				auditCompanyIds: companyIds.filter((companyId) =>
					companyPermissions[companyId]?.includes("audit.read"),
				),
				spaceIds,
				companyPermissions,
				spacePermissions,
			},
		};
	},
});
