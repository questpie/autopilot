import { collection } from "#questpie/factories";
import { uniqueIndex } from "questpie/drizzle-pg-core";

export default collection("companies")
	.fields(({ f }) => ({
		name: f.text(160).required(),
		slug: f.text(120).required(),
		status: f
			.select([
				{ value: "active", label: "Active" },
				{ value: "archived", label: "Archived" },
			])
			.required()
			.default("active"),
		locale: f.text(16).required().default("sk"),
		timezone: f.text(80).required().default("Europe/Bratislava"),
		createdByUser: f.relation("user").required().onDelete("restrict"),
		createdByActor: f.relation("actors").onDelete("set null"),
		version: f.number().required().default(1).min(1),
		archivedAt: f.datetime({ withTimezone: true }),
	}))
	.title(({ f }) => f.name)
	.indexes(({ table }) => [uniqueIndex("companies_slug_unique").on(table.slug)])
	.access({
		read: ({ organizationScope }) =>
			organizationScope?.companyIds.length ? { id: { in: organizationScope.companyIds } } : false,
		create: false,
		update: false,
		delete: false,
	})
	.options({ timestamps: true });
