import { migration } from "questpie/services"
import type { OperationSnapshot } from "questpie/migration"
import { sql } from "drizzle-orm"
import snapshotJson from "./snapshots/20260720T225858_phase-0-channels.json"

const snapshot = snapshotJson as OperationSnapshot

export default migration({
	id: "phase0Channels20260720T225858",
	async up({ db }) {
		await db.execute(sql`CREATE TABLE "channels" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"company" varchar(36) NOT NULL,
	"space" varchar(36) NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"kind" varchar(50) DEFAULT 'standard' NOT NULL,
	"systemKey" varchar(80),
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"createdBy" varchar(36) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archivedAt" timestamp(3) with time zone,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`)
		await db.execute(sql`CREATE UNIQUE INDEX "channels_space_slug_unique" ON "channels" ("space","slug");`)
		await db.execute(sql`CREATE INDEX "channels_company_space_status_idx" ON "channels" ("company","space","status");`)
	},
	async down({ db }) {
		await db.execute(sql`DROP TABLE "channels";`)
	},
	snapshot,
})
