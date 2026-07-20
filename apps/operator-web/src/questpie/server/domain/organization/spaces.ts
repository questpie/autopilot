import { withTransaction } from "questpie";
import { ApiError } from "questpie/errors";
import { assertExpectedVersion } from "../organization-policy";
import {
	hashValue,
	slugify,
	systemAccess,
	type CommandEnvelope,
	type OrganizationCommandContext,
} from "./command-context";

type OrganizationServiceContext = Pick<Questpie.ServiceCreateContext, "collections" | "db">;

export function createSpaces(
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
		requireSpacePermission,
	} = commandContext;

	async function createSpace(
		input: {
			userId: string;
			companyId: string;
			name: string;
			description?: string;
		} & CommandEnvelope,
	) {
		const actor = await requireCompanyPermission(
			input.userId,
			input.companyId,
			"spaces.create_archive",
		);
		const commandKind = "spaces.create";
		const principalKey = `actor:${actor.id}`;
		const payloadHash = hashValue({
			name: input.name.trim(),
			description: input.description ?? null,
		});
		const receiptKey = {
			scopeKey: input.companyId,
			commandKind,
			principalKey,
			idempotencyKey: input.idempotencyKey,
		};
		const replay = await replayReceipt(receiptKey, payloadHash);
		if (replay) return { spaceId: replay.resultId!, replayed: true };
		return withTransaction(db, async (tx) => {
			const access = { ...systemAccess, db: tx };
			const space = await collections.spaces.create(
				{
					company: input.companyId,
					name: input.name.trim(),
					slug: slugify(input.name),
					description: input.description,
					status: "active",
					isWholeCompany: false,
					createdBy: actor.id,
					version: 1,
				},
				access,
			);
			await collections.space_memberships.create(
				{
					company: input.companyId,
					space: space.id,
					actor: actor.id,
					status: "active",
					version: 1,
				},
				access,
			);
			const lead = await fixedRole(input.companyId, "lead", access);
			await createBinding(
				{
					companyId: input.companyId,
					actorId: actor.id,
					roleId: lead.id,
					scopeType: "space",
					spaceId: space.id,
				},
				access,
			);
			await collections.activity_events.create(
				{
					company: input.companyId,
					space: space.id,
					actor: actor.id,
					verb: "space.created",
					subjectType: "space",
					subjectId: space.id,
					displayMetadata: { defaultChannelKey: "general" },
				},
				access,
			);
			await audit(
				{
					companyId: input.companyId,
					actorId: actor.id,
					command: commandKind,
					targetType: "space",
					targetId: space.id,
					correlationId: input.correlationId,
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
					resultType: "space",
					resultId: space.id,
					result: { defaultChannelKey: "general" },
					correlationId: input.correlationId,
				},
				access,
			);
			return { spaceId: space.id, defaultChannelKey: "general", replayed: false };
		});
	}

	async function mutateSpace(
		input: {
			userId: string;
			spaceId: string;
			expectedVersion: number;
			kind: "update" | "archive" | "restore";
			name?: string;
			description?: string;
		} & CommandEnvelope,
	) {
		const space = await collections.spaces.findOne({ where: { id: input.spaceId } }, systemAccess);
		if (!space) throw ApiError.notFound("Space");
		const actor =
			input.kind === "update"
				? await requireSpacePermission(input.userId, space.company, space.id, "space.update")
				: await requireCompanyPermission(input.userId, space.company, "spaces.create_archive");
		assertExpectedVersion(space.version, input.expectedVersion);
		if (space.isWholeCompany && input.kind === "archive")
			throw ApiError.conflict("Whole Company Space cannot be archived");
		const commandKind = `spaces.${input.kind}`;
		const principalKey = `actor:${actor.id}`;
		const payloadHash = hashValue({
			spaceId: space.id,
			expectedVersion: input.expectedVersion,
			kind: input.kind,
			name: input.name,
			description: input.description,
		});
		const receiptKey = {
			scopeKey: space.company,
			commandKind,
			principalKey,
			idempotencyKey: input.idempotencyKey,
		};
		const replay = await replayReceipt(receiptKey, payloadHash);
		if (replay) return { spaceId: replay.resultId!, replayed: true };
		const data =
			input.kind === "archive"
				? { status: "archived" as const, archivedAt: new Date(), version: space.version + 1 }
				: input.kind === "restore"
					? { status: "active" as const, archivedAt: null, version: space.version + 1 }
					: {
							name: input.name?.trim() ?? space.name,
							slug: input.name ? slugify(input.name) : space.slug,
							description: input.description ?? space.description,
							version: space.version + 1,
						};
		return withTransaction(db, async (tx) => {
			const access = { ...systemAccess, db: tx };
			const winners = await collections.spaces.updateMany(
				{ where: { id: space.id, version: input.expectedVersion }, data },
				access,
			);
			if (winners.length !== 1) throw ApiError.conflict("Space was changed concurrently");
			await audit(
				{
					companyId: space.company,
					actorId: actor.id,
					command: commandKind,
					targetType: "space",
					targetId: space.id,
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
					resultType: "space",
					resultId: space.id,
					correlationId: input.correlationId,
				},
				access,
			);
			return { spaceId: space.id, version: space.version + 1, replayed: false };
		});
	}

	return {
		createSpace,
		updateSpace: (input: Omit<Parameters<typeof mutateSpace>[0], "kind">) =>
			mutateSpace({ ...input, kind: "update" }),
		archiveSpace: (input: Omit<Parameters<typeof mutateSpace>[0], "kind">) =>
			mutateSpace({ ...input, kind: "archive" }),
		restoreSpace: (input: Omit<Parameters<typeof mutateSpace>[0], "kind">) =>
			mutateSpace({ ...input, kind: "restore" }),
	};
}
