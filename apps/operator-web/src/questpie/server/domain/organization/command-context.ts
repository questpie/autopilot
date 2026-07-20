import { createHash, randomBytes } from "node:crypto";
import { ApiError } from "questpie/errors";
import {
	OrganizationDomainError,
	evaluateReceipt,
	resolveExactScopePermissions,
} from "../organization-policy";

export const systemAccess = { accessMode: "system" as const };

export interface CommandEnvelope {
	readonly idempotencyKey: string;
	readonly correlationId?: string;
}

export interface InvitationBindingInput {
	readonly roleSystemKey: string;
	readonly scopeType: "company" | "space";
	readonly spaceId?: string | null;
}

function stableSerialize(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
	if (value && typeof value === "object") {
		return `{${Object.entries(value)
			.filter(([, item]) => item !== undefined)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

export function hashValue(value: unknown): string {
	return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

export function hashSecret(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

export function createSecret(): string {
	return randomBytes(32).toString("base64url");
}

export function slugify(value: string): string {
	const slug = value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLocaleLowerCase("en-US")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 120);
	if (!slug) throw ApiError.badRequest("Name must contain a slug-compatible character");
	return slug;
}

export function translateDomainError(error: unknown): never {
	if (!(error instanceof OrganizationDomainError)) throw error;
	if (error.code === "access_denied")
		throw ApiError.forbidden({
			operation: "update",
			resource: "organization",
			reason: error.message,
		});
	if (error.code === "email_mismatch")
		throw ApiError.forbidden({
			operation: "update",
			resource: "actor_invitation",
			reason: error.message,
		});
	throw ApiError.conflict(error.message);
}

type OrganizationServiceContext = Pick<Questpie.ServiceCreateContext, "collections" | "db">;

export function createOrganizationCommandContext({ collections }: OrganizationServiceContext) {
	async function findReceipt(
		input: {
			scopeKey: string;
			commandKind: string;
			principalKey: string;
			idempotencyKey: string;
		},
		access: typeof systemAccess = systemAccess,
	) {
		return collections.command_receipts.findOne({ where: input }, access);
	}

	async function replayReceipt(
		input: {
			scopeKey: string;
			commandKind: string;
			principalKey: string;
			idempotencyKey: string;
		},
		payloadHash: string,
		access: typeof systemAccess = systemAccess,
	) {
		const receipt = await findReceipt(input, access);
		if (!receipt) return null;
		try {
			evaluateReceipt(
				{ payloadHash: receipt.payloadHash, resultId: receipt.resultId ?? null },
				payloadHash,
			);
		} catch (error) {
			translateDomainError(error);
		}
		return receipt;
	}

	async function createReceipt(
		input: {
			companyId?: string;
			actorId?: string;
			userId?: string;
			principalKey: string;
			scopeKey: string;
			commandKind: string;
			idempotencyKey: string;
			payloadHash: string;
			resultType?: string;
			resultId?: string;
			result?: Record<string, string | number | boolean | null>;
			correlationId?: string;
		},
		access: typeof systemAccess = systemAccess,
	) {
		return collections.command_receipts.create(
			{
				company: input.companyId,
				actor: input.actorId,
				principalUser: input.userId,
				principalKey: input.principalKey,
				scopeKey: input.scopeKey,
				commandKind: input.commandKind,
				idempotencyKey: input.idempotencyKey,
				payloadHash: input.payloadHash,
				status: "succeeded",
				resultType: input.resultType,
				resultId: input.resultId,
				result: input.result ?? {},
				correlationId: input.correlationId,
			},
			access,
		);
	}

	async function currentHumanActor(userId: string, companyId: string) {
		const actor = await collections.actors.findOne(
			{
				where: {
					company: companyId,
					user: userId,
					kind: "human",
					membershipStatus: "active",
				},
			},
			systemAccess,
		);
		if (!actor)
			throw ApiError.forbidden({
				operation: "update",
				resource: "company",
				reason: "No active Human Actor in Company",
			});
		return actor;
	}

	async function actorPermissions(actorId: string, companyId: string, spaceId?: string) {
		const bindings = await collections.actor_role_bindings.find(
			{
				where: { actor: actorId, company: companyId, status: "active" },
				limit: 500,
			},
			systemAccess,
		);
		const roleIds = [...new Set(bindings.docs.map((binding) => binding.role))];
		const roles = roleIds.length
			? await collections.roles.find(
					{ where: { id: { in: roleIds }, company: companyId, status: "active" }, limit: 100 },
					systemAccess,
				)
			: { docs: [] };
		const rolesById = new Map(roles.docs.map((role) => [role.id, role]));
		return resolveExactScopePermissions({
			companyId,
			spaceId,
			bindings: bindings.docs.flatMap((binding) => {
				const role = rolesById.get(binding.role);
				if (!role || role.scopeType !== binding.scopeType) return [];
				return [
					{
						companyId: binding.company,
						scopeType: binding.scopeType,
						spaceId: binding.space ?? null,
						permissions: role.permissions,
					},
				];
			}),
		});
	}

	async function requireCompanyPermission(userId: string, companyId: string, permission: string) {
		const actor = await currentHumanActor(userId, companyId);
		const permissions = await actorPermissions(actor.id, companyId);
		if (!permissions.company.includes(permission)) {
			throw ApiError.forbidden({
				operation: "update",
				resource: "company",
				reason: `Missing Company permission ${permission}`,
			});
		}
		return actor;
	}

	async function requireSpacePermission(
		userId: string,
		companyId: string,
		spaceId: string,
		permission: string,
	) {
		const actor = await currentHumanActor(userId, companyId);
		const membership = await collections.space_memberships.findOne(
			{ where: { company: companyId, space: spaceId, actor: actor.id, status: "active" } },
			systemAccess,
		);
		const permissions = await actorPermissions(actor.id, companyId, spaceId);
		if (!membership || !permissions.space.includes(permission)) {
			throw ApiError.forbidden({
				operation: "update",
				resource: "space",
				reason: `Missing Space permission ${permission}`,
			});
		}
		return actor;
	}

	async function fixedRole(
		companyId: string,
		systemKey: string,
		access: typeof systemAccess = systemAccess,
	) {
		const role = await collections.roles.findOne(
			{ where: { company: companyId, systemKey, status: "active" } },
			access,
		);
		if (!role) throw ApiError.conflict(`Required role ${systemKey} is missing`);
		return role;
	}

	async function createBinding(
		input: {
			companyId: string;
			actorId: string;
			roleId: string;
			scopeType: "company" | "space";
			spaceId?: string;
		},
		access: typeof systemAccess = systemAccess,
	) {
		return collections.actor_role_bindings.create(
			{
				company: input.companyId,
				actor: input.actorId,
				role: input.roleId,
				scopeType: input.scopeType,
				space: input.spaceId,
				status: "active",
				activeKey: `${input.scopeType}:${input.spaceId ?? input.companyId}:${input.roleId}`,
				version: 1,
			},
			access,
		);
	}

	async function audit(
		input: {
			companyId: string;
			actorId?: string;
			principalType?: "human" | "agent" | "system";
			command: string;
			targetType: string;
			targetId: string;
			correlationId?: string;
			reason?: string;
			facts?: Record<string, string | number | boolean | null>;
		},
		access: typeof systemAccess = systemAccess,
	) {
		await collections.audit_events.create(
			{
				company: input.companyId,
				actor: input.actorId,
				principalType: input.principalType ?? "human",
				command: input.command,
				targetType: input.targetType,
				targetId: input.targetId,
				correlationId: input.correlationId,
				reason: input.reason,
				facts: input.facts ?? {},
			},
			access,
		);
	}

	return {
		audit,
		createBinding,
		createReceipt,
		fixedRole,
		replayReceipt,
		requireCompanyPermission,
		requireSpacePermission,
	};
}

export type OrganizationCommandContext = ReturnType<typeof createOrganizationCommandContext>;
