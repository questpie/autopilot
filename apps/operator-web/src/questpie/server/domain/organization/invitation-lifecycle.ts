import { withTransaction } from "questpie";
import { ApiError } from "questpie/errors";
import { normalizeInvitationEmail, transitionInvitation } from "../organization-policy";
import {
	createSecret,
	hashSecret,
	hashValue,
	systemAccess,
	translateDomainError,
	type CommandEnvelope,
	type InvitationBindingInput,
	type OrganizationCommandContext,
} from "./command-context";
import type { CompanyParticipation } from "./company-participation";

const activeInvitationKey = "active";
type OrganizationServiceContext = Pick<Questpie.ServiceCreateContext, "collections" | "db">;

/** Slovak role labels for the invited bindings; unknown keys fall back to the key. */
const ROLE_LABELS: Record<string, string> = {
	owner: "Vlastník",
	admin: "Správca",
	member: "Člen spoločnosti",
	viewer: "Pozorovateľ",
};

const roleLabelFor = (bindings: readonly InvitationBindingInput[]): string => {
	const first = bindings[0];
	if (!first) return "Člen spoločnosti";
	return ROLE_LABELS[first.roleSystemKey] ?? first.roleSystemKey;
};

/**
 * Masks an invited address to bullets, keeping only the first and last local
 * character and the domain (e.g. lucia@firma.sk -> l•••a@firma.sk). The raw
 * address is never surfaced to the anonymous continuation.
 */
const maskInvitationEmail = (email: string): string => {
	const at = email.indexOf("@");
	if (at <= 0) return "•••";
	const local = email.slice(0, at);
	const domain = email.slice(at);
	const first = local[0] ?? "•";
	const last = local.length > 1 ? local[local.length - 1] : "";
	return `${first}•••${last}${domain}`;
};

/** Masked, presentational continuation state — never echoes the raw token or address. */
export type InvitationChallengeDescription =
	| {
			status: "eligible";
			companyName: string;
			maskedEmail: string;
			roleLabel: string;
			expectedVersion: number;
	  }
	| { status: "expired" | "revoked" | "already-used"; companyName: string; maskedEmail: string }
	| { status: "invalid" };

export function createInvitationLifecycle(
	serviceContext: OrganizationServiceContext,
	commandContext: OrganizationCommandContext,
	companyParticipation: CompanyParticipation,
) {
	const { collections, db } = serviceContext;
	const { audit, createReceipt, replayReceipt, requireCompanyPermission } = commandContext;

	async function issueInvitation(
		input: {
			userId: string;
			companyId: string;
			email: string;
			bindings: readonly InvitationBindingInput[];
			expiresInHours?: number;
		} & CommandEnvelope,
	) {
		const actor = await requireCompanyPermission(
			input.userId,
			input.companyId,
			"members.invite_suspend",
		);
		const normalizedEmail = normalizeInvitationEmail(input.email);
		const bindings = await companyParticipation.validateInvitationBindings(
			input.companyId,
			input.bindings,
		);
		const commandKind = "invitations.issue";
		const principalKey = `actor:${actor.id}`;
		const payloadHash = hashValue({
			email: normalizedEmail,
			bindings,
			expiresInHours: input.expiresInHours ?? 72,
		});
		const receiptKey = {
			scopeKey: input.companyId,
			commandKind,
			principalKey,
			idempotencyKey: input.idempotencyKey,
		};
		const replay = await replayReceipt(receiptKey, payloadHash);
		if (replay) return { invitationId: replay.resultId!, replayed: true };
		const token = createSecret();
		return withTransaction(db, async (tx) => {
			const access = { ...systemAccess, db: tx };
			const active = await collections.actor_invitations.findOne(
				{ where: { company: input.companyId, normalizedEmail, activeKey: activeInvitationKey } },
				access,
			);
			if (active) throw ApiError.conflict("An active invitation already exists for this email");
			const invitation = await collections.actor_invitations.create(
				{
					company: input.companyId,
					email: input.email.trim(),
					normalizedEmail,
					inviterActor: actor.id,
					intendedBindings: bindings.map((binding) => ({
						...binding,
						spaceId: binding.spaceId ?? null,
					})),
					status: "pending",
					expiresAt: new Date(Date.now() + (input.expiresInHours ?? 72) * 60 * 60 * 1000),
					tokenHash: hashSecret(token),
					activeKey: activeInvitationKey,
					version: 1,
				},
				access,
			);
			await audit(
				{
					companyId: input.companyId,
					actorId: actor.id,
					command: commandKind,
					targetType: "actor_invitation",
					targetId: invitation.id,
					correlationId: input.correlationId,
					facts: { normalizedEmailHash: hashSecret(normalizedEmail) },
				},
				access,
			);
			await createReceipt(
				{
					companyId: input.companyId,
					actorId: actor.id,
					principalKey,
					scopeKey: input.companyId,
					commandKind,
					idempotencyKey: input.idempotencyKey,
					payloadHash,
					resultType: "actor_invitation",
					resultId: invitation.id,
					correlationId: input.correlationId,
				},
				access,
			);
			return { invitationId: invitation.id, deliveryToken: token, replayed: false };
		});
	}

	async function exchangeInvitationToken(rawToken: string) {
		const tokenHash = hashSecret(rawToken);
		const invitation = await collections.actor_invitations.findOne(
			{ where: { tokenHash, status: "pending", activeKey: activeInvitationKey } },
			systemAccess,
		);
		if (!invitation) throw ApiError.notFound("Invitation");
		if (invitation.expiresAt.getTime() <= Date.now()) {
			await collections.actor_invitations.updateMany(
				{
					where: { id: invitation.id, version: invitation.version, status: "pending" },
					data: { status: "expired", activeKey: null, version: invitation.version + 1 },
				},
				systemAccess,
			);
			throw ApiError.conflict("Invitation has expired");
		}
		const challenge = createSecret();
		await withTransaction(db, async (tx) => {
			const access = { ...systemAccess, db: tx };
			const consumed = await collections.actor_invitations.updateMany(
				{
					where: { id: invitation.id, version: invitation.version, status: "pending", tokenHash },
					data: {
						tokenHash: `exchanged:${hashSecret(createSecret())}`,
						version: invitation.version + 1,
					},
				},
				access,
			);
			if (consumed.length !== 1) throw ApiError.conflict("Invitation token was already exchanged");
			await collections.invitation_challenges.create(
				{
					invitation: invitation.id,
					challengeHash: hashSecret(challenge),
					status: "pending",
					expiresAt: new Date(Date.now() + 15 * 60 * 1000),
					version: 1,
				},
				access,
			);
		});
		return { challenge };
	}

	/**
	 * Resolve a continuation challenge into masked, presentational state for the
	 * public seam. Reads by challenge hash only, never enumerates, and returns a
	 * uniform "invalid" for any unknown or unresolvable challenge.
	 */
	async function describeInvitationChallenge(
		rawChallenge: string,
	): Promise<InvitationChallengeDescription> {
		const challenge = await collections.invitation_challenges.findOne(
			{ where: { challengeHash: hashSecret(rawChallenge) } },
			systemAccess,
		);
		if (!challenge) return { status: "invalid" };
		const invitation = await collections.actor_invitations.findOne(
			{ where: { id: challenge.invitation } },
			systemAccess,
		);
		if (!invitation) return { status: "invalid" };
		const company = await collections.companies.findOne(
			{ where: { id: invitation.company } },
			systemAccess,
		);
		const companyName = company?.name ?? "";
		const maskedEmail = maskInvitationEmail(invitation.email);
		const now = Date.now();
		if (invitation.status === "accepted" || challenge.status === "consumed")
			return { status: "already-used", companyName, maskedEmail };
		if (invitation.status === "revoked" || challenge.status === "revoked")
			return { status: "revoked", companyName, maskedEmail };
		if (
			invitation.status === "expired" ||
			invitation.expiresAt.getTime() <= now ||
			challenge.expiresAt.getTime() <= now
		)
			return { status: "expired", companyName, maskedEmail };
		if (invitation.status === "pending" && challenge.status === "pending")
			return {
				status: "eligible",
				companyName,
				maskedEmail,
				roleLabel: roleLabelFor(invitation.intendedBindings as InvitationBindingInput[]),
				expectedVersion: invitation.version,
			};
		return { status: "invalid" };
	}

	async function mutateInvitation(
		input: {
			userId: string;
			invitationId: string;
			expectedVersion: number;
			kind: "resend" | "revoke";
		} & CommandEnvelope,
	) {
		const invitation = await collections.actor_invitations.findOne(
			{ where: { id: input.invitationId } },
			systemAccess,
		);
		if (!invitation) throw ApiError.notFound("Invitation");
		const actor = await requireCompanyPermission(
			input.userId,
			invitation.company,
			"members.invite_suspend",
		);
		let transition;
		try {
			transition = transitionInvitation(invitation, {
				kind: input.kind,
				expectedVersion: input.expectedVersion,
				now: new Date(),
			});
		} catch (error) {
			translateDomainError(error);
		}
		const commandKind = `invitations.${input.kind}`;
		const principalKey = `actor:${actor.id}`;
		const payloadHash = hashValue({
			invitationId: invitation.id,
			expectedVersion: input.expectedVersion,
		});
		const receiptKey = {
			scopeKey: invitation.company,
			commandKind,
			principalKey,
			idempotencyKey: input.idempotencyKey,
		};
		const replay = await replayReceipt(receiptKey, payloadHash);
		if (replay) return { invitationId: replay.resultId!, replayed: true };
		const token = input.kind === "resend" ? createSecret() : null;
		return withTransaction(db, async (tx) => {
			const access = { ...systemAccess, db: tx };
			const winners = await collections.actor_invitations.updateMany(
				{
					where: { id: invitation.id, status: "pending", version: input.expectedVersion },
					data: { status: transition.status, activeKey: null, version: transition.version },
				},
				access,
			);
			if (winners.length !== 1) throw ApiError.conflict("Invitation was changed concurrently");
			await collections.invitation_challenges.updateMany(
				{ where: { invitation: invitation.id, status: "pending" }, data: { status: "revoked" } },
				access,
			);
			let resultId = invitation.id;
			if (input.kind === "resend" && token) {
				const replacement = await collections.actor_invitations.create(
					{
						company: invitation.company,
						email: invitation.email,
						normalizedEmail: invitation.normalizedEmail,
						inviterActor: actor.id,
						intendedBindings: invitation.intendedBindings,
						status: "pending",
						expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
						tokenHash: hashSecret(token),
						activeKey: activeInvitationKey,
						version: 1,
					},
					access,
				);
				resultId = replacement.id;
			}
			await audit(
				{
					companyId: invitation.company,
					actorId: actor.id,
					command: commandKind,
					targetType: "actor_invitation",
					targetId: resultId,
					correlationId: input.correlationId,
				},
				access,
			);
			await createReceipt(
				{
					companyId: invitation.company,
					actorId: actor.id,
					principalKey,
					scopeKey: invitation.company,
					commandKind,
					idempotencyKey: input.idempotencyKey,
					payloadHash,
					resultType: "actor_invitation",
					resultId,
					correlationId: input.correlationId,
				},
				access,
			);
			return { invitationId: resultId, deliveryToken: token ?? undefined, replayed: false };
		});
	}

	return {
		issueInvitation,
		exchangeInvitationToken,
		describeInvitationChallenge,
		resendInvitation: (input: Omit<Parameters<typeof mutateInvitation>[0], "kind">) =>
			mutateInvitation({ ...input, kind: "resend" }),
		revokeInvitation: (input: Omit<Parameters<typeof mutateInvitation>[0], "kind">) =>
			mutateInvitation({ ...input, kind: "revoke" }),
	};
}
