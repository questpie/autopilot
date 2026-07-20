import { collection } from "#questpie/factories";
import { uniqueIndex } from "questpie/drizzle-pg-core";
import { z } from "zod";

export default collection("roles")
	.fields(({ f }) => ({
		company: f.relation("companies").required().onDelete("restrict"),
		systemKey: f.text(80).required(),
		name: f.text(120).required(),
		kind: f
			.select([
				{ value: "system", label: "System" },
				{ value: "custom", label: "Custom" },
			])
			.required()
			.default("system"),
		scopeType: f
			.select([
				{ value: "company", label: "Company" },
				{ value: "space", label: "Space" },
			])
			.required(),
		permissions: f
			.json()
			.zod(() => z.array(z.string().min(1)))
			.required(),
		status: f
			.select([
				{ value: "active", label: "Active" },
				{ value: "archived", label: "Archived" },
			])
			.required()
			.default("active"),
		version: f.number().required().default(1).min(1),
	}))
	.title(({ f }) => f.name)
	.indexes(({ table }) => [
		uniqueIndex("roles_company_system_key_unique").on(table.company, table.systemKey),
	])
	.access({
		read: ({ organizationScope }) =>
			organizationScope?.roleCompanyIds.length
				? { company: { in: organizationScope.roleCompanyIds } }
				: false,
		create: false,
		update: false,
		delete: false,
	})
	.options({ timestamps: true });
