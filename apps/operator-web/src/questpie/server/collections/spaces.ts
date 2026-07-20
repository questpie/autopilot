import { collection } from "#questpie/factories";
import { index, uniqueIndex } from "questpie/drizzle-pg-core";

export default collection("spaces")
	.fields(({ f }) => ({
		company: f.relation("companies").required().onDelete("restrict"),
		name: f.text(160).required(),
		slug: f.text(120).required(),
		description: f.textarea(),
		status: f
			.select([
				{ value: "active", label: "Active" },
				{ value: "archived", label: "Archived" },
			])
			.required()
			.default("active"),
		isWholeCompany: f.boolean().required().default(false),
		systemKey: f.text(80),
		createdBy: f.relation("actors").required().onDelete("restrict"),
		version: f.number().required().default(1).min(1),
		archivedAt: f.datetime({ withTimezone: true }),
	}))
	.title(({ f }) => f.name)
	.indexes(({ table }) => [
		uniqueIndex("spaces_company_slug_unique").on(table.company, table.slug),
		uniqueIndex("spaces_company_system_key_unique").on(table.company, table.systemKey),
		index("spaces_company_status_idx").on(table.company, table.status),
	])
	.access({
		read: ({ organizationScope }) =>
			organizationScope?.spaceIds.length ? { id: { in: organizationScope.spaceIds } } : false,
		create: false,
		update: false,
		delete: false,
	})
	.options({ timestamps: true });
