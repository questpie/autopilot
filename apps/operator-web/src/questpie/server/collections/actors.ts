import { collection } from "#questpie/factories";
import { index, uniqueIndex } from "questpie/drizzle-pg-core";

export default collection("actors")
	.fields(({ f }) => ({
		company: f.relation("companies").required().onDelete("restrict"),
		kind: f
			.select([
				{ value: "human", label: "Human" },
				{ value: "agent", label: "Agent" },
			])
			.required(),
		name: f.text(160).required(),
		avatar: f.url(),
		user: f.relation("user").onDelete("restrict"),
		membershipStatus: f
			.select([
				{ value: "invited", label: "Invited" },
				{ value: "active", label: "Active" },
				{ value: "suspended", label: "Suspended" },
				{ value: "deactivated", label: "Deactivated" },
			])
			.required()
			.default("invited"),
		setupStatus: f
			.select([
				{ value: "not_applicable", label: "Not applicable" },
				{ value: "pending_setup", label: "Pending setup" },
				{ value: "ready", label: "Ready" },
				{ value: "invalid", label: "Invalid" },
			])
			.required()
			.default("not_applicable"),
		systemKey: f.text(80),
		version: f.number().required().default(1).min(1),
		archivedAt: f.datetime({ withTimezone: true }),
	}))
	.title(({ f }) => f.name)
	.indexes(({ table }) => [
		uniqueIndex("actors_company_user_unique").on(table.company, table.user),
		uniqueIndex("actors_company_system_key_unique").on(table.company, table.systemKey),
		index("actors_company_status_idx").on(table.company, table.membershipStatus),
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
