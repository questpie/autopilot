import { withTransaction } from "questpie";
import { ApiError } from "questpie/errors";
import { assertExpectedVersion } from "../organization-policy";
import {
	hashValue,
	slugify,
	systemAccess,
	translateDomainError,
	type CommandEnvelope,
	type OrganizationCommandContext,
} from "./command-context";

type OrganizationServiceContext = Pick<Questpie.ServiceCreateContext, "collections" | "db">;

export function createChannels(
	serviceContext: OrganizationServiceContext,
	commandContext: OrganizationCommandContext,
) {
	const { collections, db } = serviceContext;
	const { audit, createReceipt, replayReceipt, requireSpacePermission } = commandContext;

	/**
	 * Reject a slug that already belongs to another Channel in the SAME Space.
	 * Mirrors the DB invariant channels_space_slug_unique(space, slug) across every
	 * status, so an archived Channel still reserves its slug — a clean typed conflict
	 * instead of a raw unique violation. The unique index remains the race backstop
	 * (the framework translates 23505 into the same CONFLICT).
	 */
	async function assertSlugAvailable(spaceId: string, slug: string, ownId?: string) {
		const clash = await collections.channels.findOne(
			{ where: { space: spaceId, slug } },
			systemAccess,
		);
		if (clash && clash.id !== ownId)
			throw ApiError.conflict("Channel slug already exists in this Space");
	}

	async function createChannel(
		input: {
			userId: string;
			spaceId: string;
			name: string;
		} & CommandEnvelope,
	) {
		const space = await collections.spaces.findOne(
			{ where: { id: input.spaceId, status: "active" } },
			systemAccess,
		);
		if (!space) throw ApiError.notFound("Space");
		const actor = await requireSpacePermission(
			input.userId,
			space.company,
			space.id,
			"chat.manage",
		);
		const slug = slugify(input.name);
		await assertSlugAvailable(space.id, slug);
		const commandKind = "channels.create";
		const principalKey = `actor:${actor.id}`;
		const payloadHash = hashValue({ spaceId: space.id, name: input.name.trim(), slug });
		const receiptKey = {
			scopeKey: space.company,
			commandKind,
			principalKey,
			idempotencyKey: input.idempotencyKey,
		};
		const replay = await replayReceipt(receiptKey, payloadHash);
		if (replay) return { channelId: replay.resultId!, replayed: true };
		return withTransaction(db, async (tx) => {
			const access = { ...systemAccess, db: tx };
			const channel = await collections.channels.create(
				{
					company: space.company,
					space: space.id,
					name: input.name.trim(),
					slug,
					kind: "standard",
					status: "active",
					createdBy: actor.id,
					version: 1,
				},
				access,
			);
			await audit(
				{
					companyId: space.company,
					actorId: actor.id,
					command: commandKind,
					targetType: "channel",
					targetId: channel.id,
					correlationId: input.correlationId,
				},
				access,
			);
			await createReceipt(
				{
					companyId: space.company,
					actorId: actor.id,
					principalKey,
					scopeKey: space.company,
					commandKind,
					idempotencyKey: input.idempotencyKey,
					payloadHash,
					resultType: "channel",
					resultId: channel.id,
					correlationId: input.correlationId,
				},
				access,
			);
			return { channelId: channel.id, replayed: false };
		});
	}

	async function mutateChannel(
		input: {
			userId: string;
			channelId: string;
			expectedVersion: number;
			kind: "rename" | "archive" | "restore";
			name?: string;
		} & CommandEnvelope,
	) {
		const channel = await collections.channels.findOne(
			{ where: { id: input.channelId } },
			systemAccess,
		);
		if (!channel) throw ApiError.notFound("Channel");
		const actor = await requireSpacePermission(
			input.userId,
			channel.company,
			channel.space,
			"chat.manage",
		);
		// Protected guard: the seeded per-Space #general anchor is immutable — it can
		// never be renamed or archived. Restore stays allowed (a no-op) for parity.
		if (channel.kind === "system_default" && (input.kind === "rename" || input.kind === "archive"))
			throw ApiError.forbidden({
				operation: "update",
				resource: "channel",
				reason: "System default channel is protected",
			});
		// A stale expectedVersion is a client-recoverable optimistic-concurrency
		// conflict, not a server fault: translate the domain error to a 409 (the
		// same seam the invitation commands use) instead of letting it fall through
		// to a 500. See the follow-up task to backfill projects/spaces identically.
		try {
			assertExpectedVersion(channel.version, input.expectedVersion);
		} catch (error) {
			translateDomainError(error);
		}
		const nextSlug = input.kind === "rename" && input.name ? slugify(input.name) : channel.slug;
		if (input.kind === "rename" && input.name)
			await assertSlugAvailable(channel.space, nextSlug, channel.id);
		const commandKind = `channels.${input.kind}`;
		const principalKey = `actor:${actor.id}`;
		const payloadHash = hashValue({
			channelId: channel.id,
			expectedVersion: input.expectedVersion,
			kind: input.kind,
			name: input.name,
		});
		const receiptKey = {
			scopeKey: channel.company,
			commandKind,
			principalKey,
			idempotencyKey: input.idempotencyKey,
		};
		const replay = await replayReceipt(receiptKey, payloadHash);
		if (replay) return { channelId: replay.resultId!, replayed: true };
		const data =
			input.kind === "archive"
				? { status: "archived" as const, archivedAt: new Date(), version: channel.version + 1 }
				: input.kind === "restore"
					? { status: "active" as const, archivedAt: null, version: channel.version + 1 }
					: {
							name: input.name?.trim() ?? channel.name,
							slug: nextSlug,
							version: channel.version + 1,
						};
		return withTransaction(db, async (tx) => {
			const access = { ...systemAccess, db: tx };
			const winners = await collections.channels.updateMany(
				{ where: { id: channel.id, version: input.expectedVersion }, data },
				access,
			);
			if (winners.length !== 1) throw ApiError.conflict("Channel was changed concurrently");
			await audit(
				{
					companyId: channel.company,
					actorId: actor.id,
					command: commandKind,
					targetType: "channel",
					targetId: channel.id,
					correlationId: input.correlationId,
				},
				access,
			);
			await createReceipt(
				{
					companyId: channel.company,
					actorId: actor.id,
					principalKey,
					scopeKey: channel.company,
					commandKind,
					idempotencyKey: input.idempotencyKey,
					payloadHash,
					resultType: "channel",
					resultId: channel.id,
					correlationId: input.correlationId,
				},
				access,
			);
			return { channelId: channel.id, version: channel.version + 1, replayed: false };
		});
	}

	return {
		createChannel,
		renameChannel: (input: Omit<Parameters<typeof mutateChannel>[0], "kind">) =>
			mutateChannel({ ...input, kind: "rename" }),
		archiveChannel: (input: Omit<Parameters<typeof mutateChannel>[0], "kind">) =>
			mutateChannel({ ...input, kind: "archive" }),
		restoreChannel: (input: Omit<Parameters<typeof mutateChannel>[0], "kind">) =>
			mutateChannel({ ...input, kind: "restore" }),
	};
}
