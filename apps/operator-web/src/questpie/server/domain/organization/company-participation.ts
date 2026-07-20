import { withTransaction } from "questpie";
import { ApiError } from "questpie/errors";
import { assertExpectedVersion, assertHumanOwnerCanBeRemoved } from "../organization-policy";
import {
	hashValue,
	systemAccess,
	type CommandEnvelope,
	type InvitationBindingInput,
	type OrganizationCommandContext,
} from "./command-context";

type OrganizationServiceContext = Pick<Questpie.ServiceCreateContext, "collections" | "db">;

export function createCompanyParticipation(
	serviceContext: OrganizationServiceContext,
	commandContext: OrganizationCommandContext,
) {
	const { collections, db } = serviceContext;
	const {
		audit,
		createBinding,
		createReceipt,
		fixedRole,
		replayReceipt,
		requireCompanyPermission,
	} = commandContext;

	async function validateInvitationBindings(
		companyId: string,
		bindings: readonly InvitationBindingInput[],
	) {
		const normalized = [...bindings].sort((left, right) =>
			`${left.scopeType}:${left.spaceId ?? ""}:${left.roleSystemKey}`.localeCompare(
				`${right.scopeType}:${right.spaceId ?? ""}:${right.roleSystemKey}`,
			),
		);
		for (const binding of normalized) {
			const role = await fixedRole(companyId, binding.roleSystemKey);
			if (role.scopeType !== binding.scopeType)
				throw ApiError.conflict("Role scope does not match binding scope");
			if (binding.scopeType === "company" && binding.spaceId)
				throw ApiError.conflict("Company binding cannot name a Space");
			if (binding.scopeType === "space") {
				if (!binding.spaceId) throw ApiError.conflict("Space binding requires a Space");
				const space = await collections.spaces.findOne(
					{ where: { id: binding.spaceId, company: companyId, status: "active" } },
					systemAccess,
				);
				if (!space) throw ApiError.conflict("Space binding must target an active Space in Company");
			}
		}
		return normalized;
	}

	async function countActiveHumanOwners(
		companyId: string,
		access: typeof systemAccess = systemAccess,
	) {
		const owner = await fixedRole(companyId, "owner", access);
		const bindings = await collections.actor_role_bindings.find(
			{
				where: { company: companyId, role: owner.id, scopeType: "company", status: "active" },
				limit: 500,
			},
			access,
		);
		if (!bindings.docs.length) return 0;
		return collections.actors.count(
			{
				where: {
					id: { in: bindings.docs.map((binding) => binding.actor) },
					company: companyId,
					kind: "human",
					membershipStatus: "active",
				},
			},
			access,
		);
	}

	async function lockCompanyParticipationAggregate(companyId: string, access: typeof systemAccess) {
		const lockedCompanyIds = await collections.companies.lockMany({ ids: [companyId] }, access);
		if (lockedCompanyIds.length !== 1) {
			throw ApiError.conflict("Company participation aggregate is unavailable");
		}
	}

	async function replaceRoleBindings(
		input: {
			userId: string;
			actorId: string;
			expectedVersion: number;
			bindings: readonly InvitationBindingInput[];
		} & CommandEnvelope,
	) {
		const target = await collections.actors.findOne({ where: { id: input.actorId } }, systemAccess);
		if (!target) throw ApiError.notFound("Actor");
		const initiator = await requireCompanyPermission(input.userId, target.company, "roles.manage");
		assertExpectedVersion(target.version, input.expectedVersion);
		const bindings = await validateInvitationBindings(target.company, input.bindings);
		if (
			target.kind === "agent" &&
			bindings.some(
				(binding) =>
					binding.scopeType === "company" &&
					(binding.roleSystemKey === "owner" || binding.roleSystemKey === "admin"),
			)
		) {
			throw ApiError.conflict("Company Owner and Admin roles are Human-only in Phase 0");
		}
		const remainsOwner = bindings.some(
			(binding) => binding.scopeType === "company" && binding.roleSystemKey === "owner",
		);

		const commandKind = "roleBindings.replace";
		const principalKey = `actor:${initiator.id}`;
		const payloadHash = hashValue({
			actorId: target.id,
			expectedVersion: input.expectedVersion,
			bindings,
		});
		const receiptKey = {
			scopeKey: target.company,
			commandKind,
			principalKey,
			idempotencyKey: input.idempotencyKey,
		};
		const replay = await replayReceipt(receiptKey, payloadHash);
		if (replay) return { actorId: replay.resultId!, replayed: true };

		return withTransaction(db, async (tx) => {
			const access = { ...systemAccess, db: tx };
			if (!remainsOwner) {
				await lockCompanyParticipationAggregate(target.company, access);
				const ownerRole = await fixedRole(target.company, "owner", access);
				const currentOwner = await collections.actor_role_bindings.findOne(
					{
						where: {
							actor: target.id,
							role: ownerRole.id,
							scopeType: "company",
							status: "active",
						},
					},
					access,
				);
				if (currentOwner) {
					assertHumanOwnerCanBeRemoved({
						targetKind: target.kind,
						targetIsOwner: true,
						activeHumanOwnerCount: await countActiveHumanOwners(target.company, access),
					});
				}
			}
			const bumped = await collections.actors.updateMany(
				{
					where: { id: target.id, version: input.expectedVersion },
					data: { version: target.version + 1 },
				},
				access,
			);
			if (bumped.length !== 1) throw ApiError.conflict("Actor was changed concurrently");
			const current = await collections.actor_role_bindings.find(
				{ where: { actor: target.id, company: target.company, status: "active" }, limit: 500 },
				access,
			);
			for (const binding of current.docs) {
				await collections.actor_role_bindings.updateMany(
					{
						where: { id: binding.id, version: binding.version, status: "active" },
						data: { status: "revoked", activeKey: null, version: binding.version + 1 },
					},
					access,
				);
			}
			for (const intended of bindings) {
				const role = await fixedRole(target.company, intended.roleSystemKey, access);
				await createBinding(
					{
						companyId: target.company,
						actorId: target.id,
						roleId: role.id,
						scopeType: intended.scopeType,
						spaceId: intended.spaceId ?? undefined,
					},
					access,
				);
				if (intended.scopeType === "space" && intended.spaceId) {
					const membership = await collections.space_memberships.findOne(
						{ where: { actor: target.id, space: intended.spaceId } },
						access,
					);
					if (!membership)
						await collections.space_memberships.create(
							{
								company: target.company,
								space: intended.spaceId,
								actor: target.id,
								status: "active",
								version: 1,
							},
							access,
						);
					else if (membership.status !== "active")
						await collections.space_memberships.updateMany(
							{
								where: { id: membership.id, version: membership.version },
								data: { status: "active", version: membership.version + 1 },
							},
							access,
						);
				}
			}
			await audit(
				{
					companyId: target.company,
					actorId: initiator.id,
					command: commandKind,
					targetType: "actor",
					targetId: target.id,
					correlationId: input.correlationId,
					facts: { bindingCount: bindings.length },
				},
				access,
			);
			await createReceipt(
				{
					companyId: target.company,
					actorId: initiator.id,
					principalKey,
					scopeKey: target.company,
					commandKind,
					idempotencyKey: input.idempotencyKey,
					payloadHash,
					resultType: "actor",
					resultId: target.id,
					correlationId: input.correlationId,
				},
				access,
			);
			return { actorId: target.id, version: target.version + 1, replayed: false };
		});
	}

	return {
		countActiveHumanOwners,
		lockCompanyParticipationAggregate,
		replaceRoleBindings,
		validateInvitationBindings,
	};
}

export type CompanyParticipation = ReturnType<typeof createCompanyParticipation>;
