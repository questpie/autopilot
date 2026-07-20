import { collection } from "#questpie/factories";
import { index } from "questpie/drizzle-pg-core";
import { z } from "zod";

export default collection("activity_events")
	.fields(({ f }) => ({
		company: f.relation("companies").required().onDelete("restrict"),
		space: f.relation("spaces").onDelete("restrict"),
		actor: f.relation("actors").required().onDelete("restrict"),
		verb: f.text(120).required(),
		subjectType: f.text(80).required(),
		subjectId: f.text(255).required(),
		runRef: f.text(255),
		displayMetadata: f
			.json()
			.zod(() => z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])))
			.required()
			.default({}),
	}))
	.indexes(({ table }) => [
		index("activity_events_company_created_idx").on(table.company, table.createdAt),
		index("activity_events_space_created_idx").on(table.space, table.createdAt),
	])
	.access({
		read: ({ organizationScope }) =>
			organizationScope?.spaceIds.length ? { space: { in: organizationScope.spaceIds } } : false,
		create: false,
		update: false,
		delete: false,
	})
	.options({ timestamps: true });
