import { collection } from "#questpie/factories";
import { uniqueIndex } from "questpie/drizzle-pg-core";

export default collection("invitation_challenges")
	.fields(({ f }) => ({
		invitation: f.relation("actor_invitations").required().onDelete("cascade"),
		challengeHash: f.text(128).required().access({ read: false }),
		status: f
			.select([
				{ value: "pending", label: "Pending" },
				{ value: "consumed", label: "Consumed" },
				{ value: "expired", label: "Expired" },
				{ value: "revoked", label: "Revoked" },
			])
			.required()
			.default("pending"),
		expiresAt: f.datetime({ withTimezone: true }).required(),
		version: f.number().required().default(1).min(1),
	}))
	.indexes(({ table }) => [
		uniqueIndex("invitation_challenges_hash_unique").on(table.challengeHash),
	])
	.access({ read: false, create: false, update: false, delete: false })
	.options({ timestamps: true });
