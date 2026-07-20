import { collection } from "#questpie/factories";
import { index } from "questpie/drizzle-pg-core";
import { z } from "zod";

const auditFactsSchema = z.record(
	z.string(),
	z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

export default collection("audit_events")
	.fields(({ f }) => ({
		company: f.relation("companies").required().onDelete("restrict"),
		actor: f.relation("actors").onDelete("set null"),
		principalType: f
			.select([
				{ value: "human", label: "Human" },
				{ value: "agent", label: "Agent" },
				{ value: "system", label: "System" },
			])
			.required(),
		command: f.text(160).required(),
		targetType: f.text(80).required(),
		targetId: f.text(255).required(),
		beforeHash: f.text(128),
		afterHash: f.text(128),
		correlationId: f.text(160),
		reason: f.textarea(),
		facts: f
			.json()
			.zod(() => auditFactsSchema)
			.required()
			.default({}),
		runRef: f.text(255),
	}))
	.indexes(({ table }) => [
		index("audit_events_company_created_idx").on(table.company, table.createdAt),
		index("audit_events_target_idx").on(table.targetType, table.targetId),
	])
	.access({
		read: ({ organizationScope }) =>
			organizationScope?.auditCompanyIds.length
				? { company: { in: organizationScope.auditCompanyIds } }
				: false,
		create: false,
		update: false,
		delete: false,
	})
	.options({ timestamps: true });
