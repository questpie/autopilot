import { collection } from "#questpie/factories";
import { index, uniqueIndex } from "questpie/drizzle-pg-core";

export default collection("channels")
	.fields(({ f }) => ({
		company: f.relation("companies").required().onDelete("restrict"),
		space: f.relation("spaces").required().onDelete("restrict"),
		name: f.text(160).required(),
		slug: f.text(120).required(),
		kind: f
			.select([
				{ value: "system_default", label: "System Default" },
				{ value: "standard", label: "Standard" },
			])
			.required()
			.default("standard"),
		systemKey: f.text(80),
		status: f
			.select([
				{ value: "active", label: "Active" },
				{ value: "archived", label: "Archived" },
			])
			.required()
			.default("active"),
		createdBy: f.relation("actors").required().onDelete("restrict"),
		version: f.number().required().default(1).min(1),
		archivedAt: f.datetime({ withTimezone: true }),
	}))
	.title(({ f }) => f.name)
	.indexes(({ table }) => [
		uniqueIndex("channels_space_slug_unique").on(table.space, table.slug),
		index("channels_company_space_status_idx").on(table.company, table.space, table.status),
	])
	.access({
		read: ({ organizationScope }) =>
			organizationScope?.spaceIds.length ? { space: { in: organizationScope.spaceIds } } : false,
		create: false,
		update: false,
		delete: false,
	})
	.options({ timestamps: true });
