import { collection } from "#questpie/factories";
import { index, uniqueIndex } from "questpie/drizzle-pg-core";

export default collection("projects")
	.fields(({ f }) => ({
		company: f.relation("companies").required().onDelete("restrict"),
		space: f.relation("spaces").required().onDelete("restrict"),
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
		ownerActor: f.relation("actors").required().onDelete("restrict"),
		version: f.number().required().default(1).min(1),
		archivedAt: f.datetime({ withTimezone: true }),
	}))
	.title(({ f }) => f.name)
	.indexes(({ table }) => [
		uniqueIndex("projects_space_slug_unique").on(table.space, table.slug),
		index("projects_company_space_status_idx").on(table.company, table.space, table.status),
	])
	.access({
		read: ({ organizationScope }) =>
			organizationScope?.spaceIds.length ? { space: { in: organizationScope.spaceIds } } : false,
		create: false,
		update: false,
		delete: false,
	})
	.options({ timestamps: true });
