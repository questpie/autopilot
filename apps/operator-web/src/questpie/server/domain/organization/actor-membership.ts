import { withTransaction } from "questpie";
import { ApiError } from "questpie/errors";
import { assertExpectedVersion, assertHumanOwnerCanBeRemoved } from "../organization-policy";
import {
	hashValue,
	systemAccess,
	type CommandEnvelope,
	type OrganizationCommandContext,
} from "./command-context";
import type { CompanyParticipation } from "./company-participation";

type OrganizationServiceContext = Pick<Questpie.ServiceCreateContext, "collections" | "db">;

export function createActorMembership(
	serviceContext: OrganizationServiceContext,
	commandContext: OrganizationCommandContext,
	companyParticipation: CompanyParticipation,
) {
	const { collections, db } = serviceContext;
	const { audit, createReceipt, fixedRole, replayReceipt, requireCompanyPermission } =
		commandContext;
	const { countActiveHumanOwners, lockCompanyParticipationAggregate } = companyParticipation;

	async function setActorMembership(
		input: {
			userId: string;
			actorId: string;
			expectedVersion: number;
			status: "active" | "suspended" | "deactivated";
			reason?: string;
		} & CommandEnvelope,
	) {
		const target = await collections.actors.findOne({ where: { id: input.actorId } }, systemAccess);
		if (!target) throw ApiError.notFound("Actor");
		const initiator = await requireCompanyPermission(
			input.userId,
			target.company,
			"members.invite_suspend",
		);
		assertExpectedVersion(target.version, input.expectedVersion);
		const commandKind =
			input.status === "active"
				? "actors.reactivate"
				: input.status === "suspended"
					? "actors.suspend"
					: "actors.archive";
		const principalKey = `actor:${initiator.id}`;
		const payloadHash = hashValue({
			actorId: target.id,
			expectedVersion: input.expectedVersion,
			status: input.status,
			reason: input.reason,
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
			if (input.status !== "active") {
				await lockCompanyParticipationAggregate(target.company, access);
				const owner = await fixedRole(target.company, "owner", access);
				const ownerBinding = await collections.actor_role_bindings.findOne(
					{
						where: {
							actor: target.id,
							role: owner.id,
							scopeType: "company",
							status: "active",
						},
					},
					access,
				);
				assertHumanOwnerCanBeRemoved({
					targetKind: target.kind,
					targetIsOwner: Boolean(ownerBinding),
					activeHumanOwnerCount: await countActiveHumanOwners(target.company, access),
				});
			}
			const winners = await collections.actors.updateMany(
				{
					where: { id: target.id, version: input.expectedVersion },
					data: {
						membershipStatus: input.status,
						archivedAt: input.status === "deactivated" ? new Date() : null,
						version: target.version + 1,
					},
				},
				access,
			);
			if (winners.length !== 1) throw ApiError.conflict("Actor was changed concurrently");
			if (input.status !== "active")
				await collections.space_memberships.updateMany(
					{ where: { actor: target.id, status: "active" }, data: { status: "suspended" } },
					access,
				);
			else {
				const whole = await collections.spaces.findOne(
					{ where: { company: target.company, systemKey: "whole-company", status: "active" } },
					access,
				);
				if (whole) {
					const membership = await collections.space_memberships.findOne(
						{ where: { actor: target.id, space: whole.id } },
						access,
					);
					if (membership)
						await collections.space_memberships.updateMany(
							{
								where: { id: membership.id, version: membership.version },
								data: { status: "active", version: membership.version + 1 },
							},
							access,
						);
					else
						await collections.space_memberships.create(
							{
								company: target.company,
								space: whole.id,
								actor: target.id,
								status: "active",
								version: 1,
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
					reason: input.reason,
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
		suspendActor: (input: Omit<Parameters<typeof setActorMembership>[0], "status">) =>
			setActorMembership({ ...input, status: "suspended" }),
		reactivateActor: (input: Omit<Parameters<typeof setActorMembership>[0], "status">) =>
			setActorMembership({ ...input, status: "active" }),
		archiveActor: (input: Omit<Parameters<typeof setActorMembership>[0], "status">) =>
			setActorMembership({ ...input, status: "deactivated" }),
	};
}
