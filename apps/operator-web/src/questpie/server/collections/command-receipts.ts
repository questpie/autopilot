import { collection } from "#questpie/factories";
import { index, uniqueIndex } from "questpie/drizzle-pg-core";
import { z } from "zod";

export default collection("command_receipts")
	.fields(({ f }) => ({
		company: f.relation("companies").onDelete("restrict"),
		actor: f.relation("actors").onDelete("set null"),
		principalUser: f.relation("user").onDelete("set null"),
		principalKey: f.text(255).required(),
		scopeKey: f.text(255).required(),
		commandKind: f.text(160).required(),
		idempotencyKey: f.text(255).required(),
		payloadHash: f.text(128).required(),
		status: f
			.select([
				{ value: "succeeded", label: "Succeeded" },
				{ value: "failed", label: "Failed" },
			])
			.required(),
		resultType: f.text(80),
		resultId: f.text(255),
		result: f
			.json()
			.zod(() => z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])))
			.required()
			.default({}),
		correlationId: f.text(160),
	}))
	.indexes(({ table }) => [
		uniqueIndex("command_receipts_scope_key_unique").on(
			table.scopeKey,
			table.commandKind,
			table.principalKey,
			table.idempotencyKey,
		),
		index("command_receipts_company_created_idx").on(table.company, table.createdAt),
	])
	.access({
		read: ({ organizationScope }) => {
			if (!organizationScope) return false;
			return {
				OR: [
					{ actor: { in: organizationScope.actorIds } },
					{ company: { in: organizationScope.auditCompanyIds } },
				],
			};
		},
		create: false,
		update: false,
		delete: false,
	})
	.options({ timestamps: true });
