import { randomBytes } from "node:crypto";
import { withTransaction } from "questpie";
import { ApiError } from "questpie/errors";
import { FIXED_ROLE_DEFINITIONS } from "../fixed-roles";
import {
	hashValue,
	slugify,
	systemAccess,
	type CommandEnvelope,
	type OrganizationCommandContext,
} from "./command-context";

type OrganizationServiceContext = Pick<Questpie.ServiceCreateContext, "collections" | "db">;

export function createCompanyBootstrap(
	serviceContext: OrganizationServiceContext,
	commandContext: OrganizationCommandContext,
) {
	const { collections, db } = serviceContext;
	const { audit, createBinding, createReceipt, replayReceipt } = commandContext;

	async function bootstrap(
		input: {
			userId: string;
			userName: string;
			name: string;
			locale?: string;
			timezone?: string;
		} & CommandEnvelope,
	) {
		const commandKind = "companies.bootstrap";
		const principalKey = `user:${input.userId}`;
		const scopeKey = `bootstrap:${input.userId}`;
		const payloadHash = hashValue({
			name: input.name,
			locale: input.locale ?? "sk",
			timezone: input.timezone ?? "Europe/Bratislava",
		});
		const receiptKey = {
			scopeKey,
			commandKind,
			principalKey,
			idempotencyKey: input.idempotencyKey,
		};
		const existing = await replayReceipt(receiptKey, payloadHash);
		if (existing) return { companyId: existing.resultId!, replayed: true };

		try {
			return await withTransaction(db, async (tx) => {
				const access = { ...systemAccess, db: tx };
				const replay = await replayReceipt(receiptKey, payloadHash, access);
				if (replay) return { companyId: replay.resultId!, replayed: true };
				const company = await collections.companies.create(
					{
						name: input.name.trim(),
						slug: `${slugify(input.name)}-${randomBytes(3).toString("hex")}`,
						status: "active",
						locale: input.locale ?? "sk",
						timezone: input.timezone ?? "Europe/Bratislava",
						createdByUser: input.userId,
						version: 1,
					},
					access,
				);
				const ownerActor = await collections.actors.create(
					{
						company: company.id,
						kind: "human",
						name: input.userName.trim(),
						user: input.userId,
						membershipStatus: "active",
						setupStatus: "not_applicable",
						version: 1,
					},
					access,
				);
				const backfilledCompany = await collections.companies.updateMany(
					{ where: { id: company.id }, data: { createdByActor: ownerActor.id } },
					access,
				);
				if (backfilledCompany.length !== 1) {
					throw ApiError.conflict("Company owner Actor backfill lost its bootstrap transaction");
				}
				const roles = new Map<string, string>();
				for (const definition of FIXED_ROLE_DEFINITIONS) {
					const role = await collections.roles.create(
						{
							company: company.id,
							systemKey: definition.systemKey,
							name: definition.name,
							kind: "system",
							scopeType: definition.scopeType,
							permissions: [...definition.permissions],
							status: "active",
							version: 1,
						},
						access,
					);
					roles.set(definition.systemKey, role.id);
				}
				await createBinding(
					{
						companyId: company.id,
						actorId: ownerActor.id,
						roleId: roles.get("owner")!,
						scopeType: "company",
					},
					access,
				);
				const wholeCompany = await collections.spaces.create(
					{
						company: company.id,
						name: "Whole Company",
						slug: "whole-company",
						status: "active",
						isWholeCompany: true,
						systemKey: "whole-company",
						createdBy: ownerActor.id,
						version: 1,
					},
					access,
				);
				await collections.channels.create(
					{
						company: company.id,
						space: wholeCompany.id,
						name: "general",
						slug: "general",
						kind: "system_default",
						systemKey: "general",
						status: "active",
						createdBy: ownerActor.id,
						version: 1,
					},
					access,
				);
				await collections.space_memberships.create(
					{
						company: company.id,
						space: wholeCompany.id,
						actor: ownerActor.id,
						status: "active",
						version: 1,
					},
					access,
				);
				await createBinding(
					{
						companyId: company.id,
						actorId: ownerActor.id,
						roleId: roles.get("lead")!,
						scopeType: "space",
						spaceId: wholeCompany.id,
					},
					access,
				);
				const autopilot = await collections.actors.create(
					{
						company: company.id,
						kind: "agent",
						name: "Autopilot",
						membershipStatus: "invited",
						setupStatus: "pending_setup",
						systemKey: "autopilot",
						version: 1,
					},
					access,
				);
				await collections.space_memberships.create(
					{
						company: company.id,
						space: wholeCompany.id,
						actor: autopilot.id,
						status: "pending",
						version: 1,
					},
					access,
				);
				await collections.activity_events.create(
					{
						company: company.id,
						space: wholeCompany.id,
						actor: ownerActor.id,
						verb: "company.bootstrapped",
						subjectType: "company",
						subjectId: company.id,
						displayMetadata: { systemSpaceKey: "whole-company", defaultChannelKey: "general" },
					},
					access,
				);
				await audit(
					{
						companyId: company.id,
						actorId: ownerActor.id,
						command: commandKind,
						targetType: "company",
						targetId: company.id,
						correlationId: input.correlationId,
						facts: { wholeCompanySpaceId: wholeCompany.id, autopilotActorId: autopilot.id },
					},
					access,
				);
				await createReceipt(
					{
						companyId: company.id,
						actorId: ownerActor.id,
						userId: input.userId,
						principalKey,
						scopeKey,
						commandKind,
						idempotencyKey: input.idempotencyKey,
						payloadHash,
						resultType: "company",
						resultId: company.id,
						result: {
							ownerActorId: ownerActor.id,
							wholeCompanySpaceId: wholeCompany.id,
							autopilotActorId: autopilot.id,
							defaultChannelKey: "general",
						},
						correlationId: input.correlationId,
					},
					access,
				);
				return {
					companyId: company.id,
					ownerActorId: ownerActor.id,
					wholeCompanySpaceId: wholeCompany.id,
					autopilotActorId: autopilot.id,
					defaultChannelKey: "general",
					replayed: false,
				};
			});
		} catch (error) {
			const raced = await replayReceipt(receiptKey, payloadHash);
			if (raced) return { companyId: raced.resultId!, replayed: true };
			throw error;
		}
	}

	return { bootstrap };
}
