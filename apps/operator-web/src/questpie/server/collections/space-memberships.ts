import { collection } from "#questpie/factories";
import { index, uniqueIndex } from "questpie/drizzle-pg-core";

export default collection("space_memberships")
	.fields(({ f }) => ({
		company: f.relation("companies").required().onDelete("restrict"),
		space: f.relation("spaces").required().onDelete("restrict"),
		actor: f.relation("actors").required().onDelete("restrict"),
		status: f
			.select([
				{ value: "pending", label: "Pending" },
				{ value: "active", label: "Active" },
				{ value: "suspended", label: "Suspended" },
				{ value: "left", label: "Left" },
			])
			.required()
			.default("pending"),
		version: f.number().required().default(1).min(1),
	}))
	.indexes(({ table }) => [
		uniqueIndex("space_memberships_space_actor_unique").on(table.space, table.actor),
		index("space_memberships_actor_status_idx").on(table.actor, table.status),
	])
	.access({
		read: ({ organizationScope }) =>
			organizationScope?.spaceIds.length ? { space: { in: organizationScope.spaceIds } } : false,
		create: false,
		update: false,
		delete: false,
	})
	.options({ timestamps: true });
