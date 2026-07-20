import { withTransaction } from "questpie";
import { ApiError } from "questpie/errors";
import { assertExpectedVersion } from "../organization-policy";
import {
	hashValue,
	systemAccess,
	type CommandEnvelope,
	type OrganizationCommandContext,
} from "./command-context";

type OrganizationServiceContext = Pick<Questpie.ServiceCreateContext, "collections" | "db">;

export function createSpaceMemberships(
	serviceContext: OrganizationServiceContext,
	commandContext: OrganizationCommandContext,
) {
	const { collections, db } = serviceContext;
	const { audit, createBinding, createReceipt, fixedRole, replayReceipt, requireSpacePermission } =
		commandContext;

	async function mutateSpaceMembership(
		input: {
			userId: string;
			spaceId: string;
			actorId: string;
			roleSystemKey?: "lead" | "space-member" | "viewer";
			expectedVersion?: number;
			kind: "add" | "change" | "remove";
		} & CommandEnvelope,
	) {
		const space = await collections.spaces.findOne(
			{ where: { id: input.spaceId, status: "active" } },
			systemAccess,
		);
		if (!space) throw ApiError.notFound("Space");
		const initiator = await requireSpacePermission(
			input.userId,
			space.company,
			space.id,
			"space.members.manage",
		);
		const target = await collections.actors.findOne(
			{ where: { id: input.actorId, company: space.company } },
			systemAccess,
		);
		if (!target || target.membershipStatus !== "active")
			throw ApiError.conflict("Target must be an active Company Actor");
		const membership = await collections.space_memberships.findOne(
			{ where: { space: space.id, actor: target.id } },
			systemAccess,
		);
		if (input.kind === "add" && membership?.status === "active")
			throw ApiError.conflict("Actor is already an active Space member");
		if (input.kind !== "add") {
			if (!membership) throw ApiError.notFound("Space Membership");
			if (input.expectedVersion === undefined)
				throw ApiError.badRequest("expectedVersion is required");
			assertExpectedVersion(membership.version, input.expectedVersion);
		}
		if (input.kind === "remove" && space.isWholeCompany)
			throw ApiError.conflict("Active Company Actors cannot leave Whole Company");
		if (input.kind !== "remove" && !input.roleSystemKey)
			throw ApiError.badRequest("roleSystemKey is required");

		const commandKind = `spaceMemberships.${input.kind}`;
		const principalKey = `actor:${initiator.id}`;
		const payloadHash = hashValue({
			spaceId: space.id,
			actorId: target.id,
			roleSystemKey: input.roleSystemKey,
			expectedVersion: input.expectedVersion,
			kind: input.kind,
		});
		const receiptKey = {
			scopeKey: space.company,
			commandKind,
			principalKey,
			idempotencyKey: input.idempotencyKey,
		};
		const replay = await replayReceipt(receiptKey, payloadHash);
		if (replay) return { membershipId: replay.resultId!, replayed: true };

		return withTransaction(db, async (tx) => {
			const access = { ...systemAccess, db: tx };
			let membershipId: string;
			let nextVersion: number;
			if (!membership) {
				const created = await collections.space_memberships.create(
					{
						company: space.company,
						space: space.id,
						actor: target.id,
						status: "active",
						version: 1,
					},
					access,
				);
				membershipId = created.id;
				nextVersion = 1;
			} else {
				const status = input.kind === "remove" ? ("left" as const) : ("active" as const);
				const winners = await collections.space_memberships.updateMany(
					{
						where: { id: membership.id, version: membership.version },
						data: { status, version: membership.version + 1 },
					},
					access,
				);
				if (winners.length !== 1)
					throw ApiError.conflict("Space Membership was changed concurrently");
				membershipId = membership.id;
				nextVersion = membership.version + 1;
			}
			const priorBindings = await collections.actor_role_bindings.find(
				{
					where: {
						actor: target.id,
						company: space.company,
						space: space.id,
						scopeType: "space",
						status: "active",
					},
					limit: 100,
				},
				access,
			);
			for (const binding of priorBindings.docs) {
				await collections.actor_role_bindings.updateMany(
					{
						where: { id: binding.id, version: binding.version, status: "active" },
						data: { status: "revoked", activeKey: null, version: binding.version + 1 },
					},
					access,
				);
			}
			if (input.kind !== "remove") {
				const role = await fixedRole(space.company, input.roleSystemKey!, access);
				if (role.scopeType !== "space")
					throw ApiError.conflict("Space Membership requires a Space role");
				await createBinding(
					{
						companyId: space.company,
						actorId: target.id,
						roleId: role.id,
						scopeType: "space",
						spaceId: space.id,
					},
					access,
				);
			}
			await audit(
				{
					companyId: space.company,
					actorId: initiator.id,
					command: commandKind,
					targetType: "space_membership",
					targetId: membershipId,
					correlationId: input.correlationId,
					facts: {
						targetActorId: target.id,
						status: input.kind === "remove" ? "left" : "active",
					},
				},
				access,
			);
			await createReceipt(
				{
					companyId: space.company,
					actorId: initiator.id,
					principalKey,
					scopeKey: space.company,
					commandKind,
					idempotencyKey: input.idempotencyKey,
					payloadHash,
					resultType: "space_membership",
					resultId: membershipId,
					correlationId: input.correlationId,
				},
				access,
			);
			return { membershipId, version: nextVersion, replayed: false };
		});
	}

	return {
		addSpaceMembership: (input: Omit<Parameters<typeof mutateSpaceMembership>[0], "kind">) =>
			mutateSpaceMembership({ ...input, kind: "add" }),
		changeSpaceMembership: (input: Omit<Parameters<typeof mutateSpaceMembership>[0], "kind">) =>
			mutateSpaceMembership({ ...input, kind: "change" }),
		removeSpaceMembership: (input: Omit<Parameters<typeof mutateSpaceMembership>[0], "kind">) =>
			mutateSpaceMembership({ ...input, kind: "remove" }),
	};
}
