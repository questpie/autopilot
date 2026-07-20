import { collection } from "#questpie/factories";
import { index, uniqueIndex } from "questpie/drizzle-pg-core";
import { z } from "zod";

const intendedBindingSchema = z.object({
	roleSystemKey: z.string().min(1),
	scopeType: z.enum(["company", "space"]),
	spaceId: z.string().nullable().optional(),
});

export default collection("actor_invitations")
	.fields(({ f }) => ({
		company: f.relation("companies").required().onDelete("restrict"),
		email: f.email().required(),
		normalizedEmail: f.text(255).required(),
		inviterActor: f.relation("actors").required().onDelete("restrict"),
		intendedBindings: f
			.json()
			.zod(() => z.array(intendedBindingSchema).min(1))
			.required(),
		status: f
			.select([
				{ value: "pending", label: "Pending" },
				{ value: "accepted", label: "Accepted" },
				{ value: "revoked", label: "Revoked" },
				{ value: "expired", label: "Expired" },
				{ value: "superseded", label: "Superseded" },
			])
			.required()
			.default("pending"),
		expiresAt: f.datetime({ withTimezone: true }).required(),
		tokenHash: f.text(128).required().access({ read: false }),
		activeKey: f.text(16),
		acceptedByActor: f.relation("actors").onDelete("set null"),
		version: f.number().required().default(1).min(1),
	}))
	.indexes(({ table }) => [
		uniqueIndex("actor_invitations_token_hash_unique").on(table.tokenHash),
		uniqueIndex("actor_invitations_one_active_email_unique").on(
			table.company,
			table.normalizedEmail,
			table.activeKey,
		),
		index("actor_invitations_company_status_idx").on(table.company, table.status),
	])
	.access({
		read: ({ organizationScope }) =>
			organizationScope?.invitationCompanyIds.length
				? { company: { in: organizationScope.invitationCompanyIds } }
				: false,
		create: false,
		update: false,
		delete: false,
	})
	.options({ timestamps: true });
