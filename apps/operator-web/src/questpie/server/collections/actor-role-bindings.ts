import { collection } from "#questpie/factories";
import { index, uniqueIndex } from "questpie/drizzle-pg-core";

export default collection("actor_role_bindings")
	.fields(({ f }) => ({
		company: f.relation("companies").required().onDelete("restrict"),
		actor: f.relation("actors").required().onDelete("restrict"),
		role: f.relation("roles").required().onDelete("restrict"),
		scopeType: f
			.select([
				{ value: "company", label: "Company" },
				{ value: "space", label: "Space" },
			])
			.required(),
		space: f.relation("spaces").onDelete("restrict"),
		status: f
			.select([
				{ value: "active", label: "Active" },
				{ value: "revoked", label: "Revoked" },
			])
			.required()
			.default("active"),
		activeKey: f.text(255),
		version: f.number().required().default(1).min(1),
	}))
	.indexes(({ table }) => [
		uniqueIndex("actor_role_bindings_active_unique").on(table.actor, table.activeKey),
		index("actor_role_bindings_company_actor_idx").on(table.company, table.actor),
		index("actor_role_bindings_space_actor_idx").on(table.space, table.actor),
	])
	.access({
		read: ({ organizationScope }) =>
			organizationScope?.companyIds.length
				? { company: { in: organizationScope.companyIds } }
				: false,
		create: false,
		update: false,
		delete: false,
	})
	.options({ timestamps: true });
