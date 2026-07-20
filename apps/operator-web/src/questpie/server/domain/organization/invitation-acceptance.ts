import { withTransaction } from "questpie";
import { ApiError } from "questpie/errors";
import { normalizeInvitationEmail, transitionInvitation } from "../organization-policy";
import {
	hashSecret,
	hashValue,
	systemAccess,
	translateDomainError,
	type CommandEnvelope,
	type InvitationBindingInput,
	type OrganizationCommandContext,
} from "./command-context";

const activeInvitationKey = "active";
type OrganizationServiceContext = Pick<Questpie.ServiceCreateContext, "collections" | "db">;

export function createInvitationAcceptance(
	serviceContext: OrganizationServiceContext,
	commandContext: OrganizationCommandContext,
) {
	const { collections, db } = serviceContext;
	const { audit, createBinding, createReceipt, fixedRole, replayReceipt } = commandContext;

	async function acceptInvitation(
		input: {
			userId: string;
			userName: string;
			verifiedEmail: string;
			emailVerified: boolean;
			challenge: string;
			expectedVersion: number;
		} & CommandEnvelope,
	) {
		if (!input.emailVerified)
			throw ApiError.forbidden({
				operation: "update",
				resource: "actor_invitation",
				reason: "Email must be verified",
			});
		const challengeHash = hashSecret(input.challenge);
		const challenge = await collections.invitation_challenges.findOne(
			{ where: { challengeHash, status: "pending" } },
			systemAccess,
		);
		if (!challenge || challenge.expiresAt.getTime() <= Date.now())
			throw ApiError.conflict("Invitation challenge is invalid or expired");
		const invitation = await collections.actor_invitations.findOne(
			{ where: { id: challenge.invitation } },
			systemAccess,
		);
		if (!invitation) throw ApiError.notFound("Invitation");
		if (normalizeInvitationEmail(input.verifiedEmail) !== invitation.normalizedEmail)
			throw ApiError.forbidden({
				operation: "update",
				resource: "actor_invitation",
				reason: "Signed-in verified email does not match invitation",
			});
		const commandKind = "invitations.accept";
		const principalKey = `user:${input.userId}`;
		const payloadHash = hashValue({
			invitationId: invitation.id,
			verifiedEmail: invitation.normalizedEmail,
			expectedVersion: input.expectedVersion,
		});
		const receiptKey = {
			scopeKey: invitation.company,
			commandKind,
			principalKey,
			idempotencyKey: input.idempotencyKey,
		};
		const replay = await replayReceipt(receiptKey, payloadHash);
		if (replay) return { actorId: replay.resultId!, replayed: true };
		try {
			const transition = transitionInvitation(invitation, {
				kind: "accept",
				expectedVersion: input.expectedVersion,
				now: new Date(),
			});
			if (transition.status === "expired") throw ApiError.conflict("Invitation has expired");
			return await withTransaction(db, async (tx) => {
				const access = { ...systemAccess, db: tx };
				const claimedInvitation = await collections.actor_invitations.updateMany(
					{
						where: {
							id: invitation.id,
							version: input.expectedVersion,
							status: "pending",
							activeKey: activeInvitationKey,
						},
						data: { status: "accepted", activeKey: null, version: transition.version },
					},
					access,
				);
				const claimedChallenge = await collections.invitation_challenges.updateMany(
					{
						where: { id: challenge.id, version: challenge.version, status: "pending" },
						data: { status: "consumed", version: challenge.version + 1 },
					},
					access,
				);
				if (claimedInvitation.length !== 1 || claimedChallenge.length !== 1)
					throw ApiError.conflict("Invitation was changed concurrently");
				let actor = await collections.actors.findOne(
					{ where: { company: invitation.company, user: input.userId, kind: "human" } },
					access,
				);
				if (actor && actor.membershipStatus === "active")
					throw ApiError.conflict("This account is already an active Company Actor");
				if (actor) {
					const reactivated = await collections.actors.updateMany(
						{
							where: { id: actor.id, version: actor.version },
							data: { membershipStatus: "active", archivedAt: null, version: actor.version + 1 },
						},
						access,
					);
					if (reactivated.length !== 1) throw ApiError.conflict("Actor was changed concurrently");
					actor = reactivated[0]!;
				} else {
					actor = await collections.actors.create(
						{
							company: invitation.company,
							kind: "human",
							name: input.userName.trim(),
							user: input.userId,
							membershipStatus: "active",
							setupStatus: "not_applicable",
							version: 1,
						},
						access,
					);
				}
				const companySpaces = await collections.spaces.find(
					{ where: { company: invitation.company, status: "active" }, limit: 500 },
					access,
				);
				const wholeCompany = companySpaces.docs.find(
					(space) => space.systemKey === "whole-company",
				);
				if (!wholeCompany) throw ApiError.conflict("Whole Company Space is missing");
				const bindings = invitation.intendedBindings as InvitationBindingInput[];
				const targetSpaceIds = new Set([
					wholeCompany.id,
					...bindings.flatMap((binding) =>
						binding.scopeType === "space" && binding.spaceId ? [binding.spaceId] : [],
					),
				]);
				for (const spaceId of targetSpaceIds) {
					const membership = await collections.space_memberships.findOne(
						{ where: { space: spaceId, actor: actor.id } },
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
								company: invitation.company,
								space: spaceId,
								actor: actor.id,
								status: "active",
								version: 1,
							},
							access,
						);
				}
				for (const intended of bindings) {
					const role = await fixedRole(invitation.company, intended.roleSystemKey, access);
					await createBinding(
						{
							companyId: invitation.company,
							actorId: actor.id,
							roleId: role.id,
							scopeType: intended.scopeType,
							spaceId: intended.spaceId ?? undefined,
						},
						access,
					);
				}
				await collections.actor_invitations.updateById(
					{ id: invitation.id, data: { acceptedByActor: actor.id } },
					access,
				);
				await audit(
					{
						companyId: invitation.company,
						actorId: actor.id,
						command: commandKind,
						targetType: "actor",
						targetId: actor.id,
						correlationId: input.correlationId,
						facts: { invitationId: invitation.id },
					},
					access,
				);
				await createReceipt(
					{
						companyId: invitation.company,
						actorId: actor.id,
						userId: input.userId,
						principalKey,
						scopeKey: invitation.company,
						commandKind,
						idempotencyKey: input.idempotencyKey,
						payloadHash,
						resultType: "actor",
						resultId: actor.id,
						correlationId: input.correlationId,
					},
					access,
				);
				return { actorId: actor.id, companyId: invitation.company, replayed: false };
			});
		} catch (error) {
			translateDomainError(error);
		}
	}

	return { acceptInvitation };
}
