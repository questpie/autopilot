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

export function createProjects(
	serviceContext: OrganizationServiceContext,
	commandContext: OrganizationCommandContext,
) {
	const { collections, db } = serviceContext;
	const { audit, createReceipt, replayReceipt, requireSpacePermission } = commandContext;

	async function createProject(
		input: {
			userId: string;
			spaceId: string;
			name: string;
			description?: string;
			ownerActorId?: string;
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
			"projects.create_update_archive",
		);
		const ownerActorId = input.ownerActorId ?? actor.id;
		const ownerMembership = await collections.space_memberships.findOne(
			{ where: { space: space.id, actor: ownerActorId, status: "active" } },
			systemAccess,
		);
		if (!ownerMembership) throw ApiError.conflict("Project owner must be an active Space member");
		const commandKind = "projects.create";
		const principalKey = `actor:${actor.id}`;
		const payloadHash = hashValue({
			spaceId: space.id,
			name: input.name.trim(),
			description: input.description ?? null,
			ownerActorId,
		});
		const receiptKey = {
			scopeKey: space.company,
			commandKind,
			principalKey,
			idempotencyKey: input.idempotencyKey,
		};
		const replay = await replayReceipt(receiptKey, payloadHash);
		if (replay) return { projectId: replay.resultId!, replayed: true };
		return withTransaction(db, async (tx) => {
			const access = { ...systemAccess, db: tx };
			const project = await collections.projects.create(
				{
					company: space.company,
					space: space.id,
					name: input.name.trim(),
					slug: slugify(input.name),
					description: input.description,
					status: "active",
					ownerActor: ownerActorId,
					version: 1,
				},
				access,
			);
			await audit(
				{
					companyId: space.company,
					actorId: actor.id,
					command: commandKind,
					targetType: "project",
					targetId: project.id,
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
					resultType: "project",
					resultId: project.id,
					correlationId: input.correlationId,
				},
				access,
			);
			return { projectId: project.id, replayed: false };
		});
	}

	async function mutateProject(
		input: {
			userId: string;
			projectId: string;
			expectedVersion: number;
			kind: "rename" | "archive" | "restore";
			name?: string;
		} & CommandEnvelope,
	) {
		const project = await collections.projects.findOne(
			{ where: { id: input.projectId } },
			systemAccess,
		);
		if (!project) throw ApiError.notFound("Project");
		const actor = await requireSpacePermission(
			input.userId,
			project.company,
			project.space,
			"projects.create_update_archive",
		);
		assertExpectedVersion(project.version, input.expectedVersion);
		const commandKind = `projects.${input.kind}`;
		const principalKey = `actor:${actor.id}`;
		const payloadHash = hashValue({
			projectId: project.id,
			expectedVersion: input.expectedVersion,
			kind: input.kind,
			name: input.name,
		});
		const receiptKey = {
			scopeKey: project.company,
			commandKind,
			principalKey,
			idempotencyKey: input.idempotencyKey,
		};
		const replay = await replayReceipt(receiptKey, payloadHash);
		if (replay) return { projectId: replay.resultId!, replayed: true };
		const data =
			input.kind === "archive"
				? { status: "archived" as const, archivedAt: new Date(), version: project.version + 1 }
				: input.kind === "restore"
					? { status: "active" as const, archivedAt: null, version: project.version + 1 }
					: {
							name: input.name?.trim() ?? project.name,
							slug: input.name ? slugify(input.name) : project.slug,
							version: project.version + 1,
						};
		return withTransaction(db, async (tx) => {
			const access = { ...systemAccess, db: tx };
			const winners = await collections.projects.updateMany(
				{ where: { id: project.id, version: input.expectedVersion }, data },
				access,
			);
			if (winners.length !== 1) throw ApiError.conflict("Project was changed concurrently");
			await audit(
				{
					companyId: project.company,
					actorId: actor.id,
					command: commandKind,
					targetType: "project",
					targetId: project.id,
					correlationId: input.correlationId,
				},
				access,
			);
			await createReceipt(
				{
					companyId: project.company,
					actorId: actor.id,
					principalKey,
					scopeKey: project.company,
					commandKind,
					idempotencyKey: input.idempotencyKey,
					payloadHash,
					resultType: "project",
					resultId: project.id,
					correlationId: input.correlationId,
				},
				access,
			);
			return { projectId: project.id, version: project.version + 1, replayed: false };
		});
	}

	return {
		createProject,
		renameProject: (input: Omit<Parameters<typeof mutateProject>[0], "kind">) =>
			mutateProject({ ...input, kind: "rename" }),
		archiveProject: (input: Omit<Parameters<typeof mutateProject>[0], "kind">) =>
			mutateProject({ ...input, kind: "archive" }),
		restoreProject: (input: Omit<Parameters<typeof mutateProject>[0], "kind">) =>
			mutateProject({ ...input, kind: "restore" }),
	};
}
