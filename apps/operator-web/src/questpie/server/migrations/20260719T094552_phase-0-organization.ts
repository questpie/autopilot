import { migration } from "questpie/services";
import type { OperationSnapshot } from "questpie/migration";
import { sql } from "drizzle-orm";
import snapshotJson from "./snapshots/20260719T094552_phase-0-organization.json";

const snapshot = snapshotJson as OperationSnapshot;

export default migration({
	id: "phase0Organization20260719T094552",
	async up({ db }) {
		await db.execute(sql`CREATE TABLE "jwks" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"publicKey" text NOT NULL,
	"privateKey" text NOT NULL,
	"createdAt" timestamp(3) with time zone NOT NULL,
	"expiresAt" timestamp(3) with time zone
);`);
		await db.execute(sql`CREATE TABLE "oauthAccessToken" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"token" varchar(500),
	"clientId" varchar(255) NOT NULL,
	"sessionId" varchar(255),
	"userId" varchar(255),
	"referenceId" varchar(255),
	"refreshId" varchar(255),
	"expiresAt" timestamp(3) with time zone,
	"createdAt" timestamp(3) with time zone,
	"scopes" jsonb NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "oauthClient" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"clientId" varchar(255) NOT NULL,
	"clientSecret" varchar(500),
	"disabled" boolean DEFAULT false,
	"skipConsent" boolean,
	"enableEndSession" boolean,
	"subjectType" varchar(255),
	"scopes" jsonb,
	"userId" varchar(255),
	"createdAt" timestamp(3) with time zone,
	"updatedAt" timestamp(3) with time zone,
	"name" varchar(255),
	"uri" varchar(500),
	"icon" varchar(500),
	"contacts" jsonb,
	"tos" varchar(500),
	"policy" varchar(500),
	"softwareId" varchar(255),
	"softwareVersion" varchar(255),
	"softwareStatement" text,
	"redirectUris" jsonb NOT NULL,
	"postLogoutRedirectUris" jsonb,
	"tokenEndpointAuthMethod" varchar(255),
	"grantTypes" jsonb,
	"responseTypes" jsonb,
	"public" boolean,
	"type" varchar(255),
	"requirePKCE" boolean,
	"referenceId" varchar(255),
	"metadata" jsonb
);`);
		await db.execute(sql`CREATE TABLE "oauthConsent" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"clientId" varchar(255) NOT NULL,
	"userId" varchar(255),
	"referenceId" varchar(255),
	"scopes" jsonb NOT NULL,
	"createdAt" timestamp(3) with time zone,
	"updatedAt" timestamp(3) with time zone
);`);
		await db.execute(sql`CREATE TABLE "oauthRefreshToken" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"token" varchar(500) NOT NULL,
	"clientId" varchar(255) NOT NULL,
	"sessionId" varchar(255),
	"userId" varchar(255) NOT NULL,
	"referenceId" varchar(255),
	"expiresAt" timestamp(3) with time zone,
	"createdAt" timestamp(3) with time zone,
	"revoked" timestamp(3) with time zone,
	"authTime" timestamp(3) with time zone,
	"scopes" jsonb NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "account" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"userId" varchar(255) NOT NULL,
	"accountId" varchar(255) NOT NULL,
	"providerId" varchar(255) NOT NULL,
	"accessToken" varchar(500),
	"refreshToken" varchar(500),
	"accessTokenExpiresAt" timestamp(3) with time zone,
	"refreshTokenExpiresAt" timestamp(3) with time zone,
	"scope" varchar(255),
	"idToken" varchar(500),
	"password" varchar(255),
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "apikey" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"configId" varchar(255) DEFAULT 'default' NOT NULL,
	"name" varchar(255),
	"start" varchar(255),
	"prefix" varchar(255),
	"key" varchar(500) NOT NULL,
	"userId" varchar(255) NOT NULL,
	"refillInterval" integer,
	"refillAmount" integer,
	"lastRefillAt" timestamp(3) with time zone,
	"enabled" boolean DEFAULT true,
	"rateLimitEnabled" boolean DEFAULT true,
	"rateLimitTimeWindow" integer,
	"rateLimitMax" integer,
	"requestCount" integer DEFAULT 0,
	"remaining" integer,
	"lastRequest" timestamp(3) with time zone,
	"expiresAt" timestamp(3) with time zone,
	"permissions" text,
	"metadata" text,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "assets" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"width" integer,
	"height" integer,
	"alt" varchar(500),
	"caption" text,
	"key" varchar(255),
	"filename" varchar(255),
	"mime_type" varchar(100),
	"size" integer,
	"visibility" varchar(20) DEFAULT 'public' NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "session" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"userId" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expiresAt" timestamp(3) with time zone NOT NULL,
	"ipAddress" varchar(45),
	"userAgent" varchar(500),
	"impersonatedBy" varchar(255),
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "user" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"emailVerified" boolean NOT NULL,
	"image" varchar(500),
	"avatar" varchar(36),
	"role" varchar(50),
	"banned" boolean DEFAULT false,
	"banReason" varchar(255),
	"banExpires" timestamp(3) with time zone,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "verification" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"identifier" varchar(255) NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp(3) with time zone NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "wf_event" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"eventName" varchar(255) NOT NULL,
	"data" jsonb,
	"matchCriteria" jsonb,
	"sourceType" varchar(50) NOT NULL,
	"sourceInstanceId" varchar(255),
	"sourceStepName" varchar(255),
	"consumedCount" integer DEFAULT 0,
	"expiresAt" timestamp(3) with time zone,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "wf_instance" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(255) NOT NULL,
	"status" varchar(50) NOT NULL,
	"input" jsonb DEFAULT '{}',
	"output" jsonb,
	"error" jsonb,
	"attempt" integer DEFAULT 0,
	"parentInstanceId" varchar(255),
	"parentStepName" varchar(255),
	"idempotencyKey" varchar(255),
	"lockOwner" varchar(255),
	"lockedAt" timestamp(3) with time zone,
	"lockExpiresAt" timestamp(3) with time zone,
	"timeoutAt" timestamp(3) with time zone,
	"startedAt" timestamp(3) with time zone,
	"suspendedAt" timestamp(3) with time zone,
	"completedAt" timestamp(3) with time zone,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "wf_log" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"instanceId" varchar(255) NOT NULL,
	"stepName" varchar(255),
	"level" varchar(20) NOT NULL,
	"message" varchar(255) NOT NULL,
	"data" jsonb,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "wf_step" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"instanceId" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"result" jsonb,
	"error" jsonb,
	"attempt" integer DEFAULT 0,
	"maxAttempts" integer DEFAULT 1,
	"scheduledAt" timestamp(3) with time zone,
	"eventName" varchar(255),
	"matchCriteria" jsonb,
	"matchHash" varchar(50),
	"childInstanceId" varchar(255),
	"hasCompensation" boolean DEFAULT false,
	"startedAt" timestamp(3) with time zone,
	"completedAt" timestamp(3) with time zone,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "activity_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"company" varchar(36) NOT NULL,
	"space" varchar(36),
	"actor" varchar(36) NOT NULL,
	"verb" varchar(120) NOT NULL,
	"subjectType" varchar(80) NOT NULL,
	"subjectId" varchar(255) NOT NULL,
	"runRef" varchar(255),
	"displayMetadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "actor_invitations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"company" varchar(36) NOT NULL,
	"email" varchar(255) NOT NULL,
	"normalizedEmail" varchar(255) NOT NULL,
	"inviterActor" varchar(36) NOT NULL,
	"intendedBindings" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"expiresAt" timestamp(3) with time zone NOT NULL,
	"tokenHash" varchar(128) NOT NULL,
	"activeKey" varchar(16),
	"acceptedByActor" varchar(36),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "actor_role_bindings" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"company" varchar(36) NOT NULL,
	"actor" varchar(36) NOT NULL,
	"role" varchar(36) NOT NULL,
	"scopeType" varchar(50) NOT NULL,
	"space" varchar(36),
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"activeKey" varchar(255),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "actors" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"company" varchar(36) NOT NULL,
	"kind" varchar(50) NOT NULL,
	"name" varchar(160) NOT NULL,
	"avatar" varchar(2048),
	"user" varchar(36),
	"membershipStatus" varchar(50) DEFAULT 'invited' NOT NULL,
	"setupStatus" varchar(50) DEFAULT 'not_applicable' NOT NULL,
	"systemKey" varchar(80),
	"version" integer DEFAULT 1 NOT NULL,
	"archivedAt" timestamp(3) with time zone,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"company" varchar(36) NOT NULL,
	"actor" varchar(36),
	"principalType" varchar(50) NOT NULL,
	"command" varchar(160) NOT NULL,
	"targetType" varchar(80) NOT NULL,
	"targetId" varchar(255) NOT NULL,
	"beforeHash" varchar(128),
	"afterHash" varchar(128),
	"correlationId" varchar(160),
	"reason" text,
	"facts" jsonb DEFAULT '{}' NOT NULL,
	"runRef" varchar(255),
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "command_receipts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"company" varchar(36),
	"actor" varchar(36),
	"principalUser" varchar(36),
	"principalKey" varchar(255) NOT NULL,
	"scopeKey" varchar(255) NOT NULL,
	"commandKind" varchar(160) NOT NULL,
	"idempotencyKey" varchar(255) NOT NULL,
	"payloadHash" varchar(128) NOT NULL,
	"status" varchar(50) NOT NULL,
	"resultType" varchar(80),
	"resultId" varchar(255),
	"result" jsonb DEFAULT '{}' NOT NULL,
	"correlationId" varchar(160),
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "companies" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(160) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"locale" varchar(16) DEFAULT 'sk' NOT NULL,
	"timezone" varchar(80) DEFAULT 'Europe/Bratislava' NOT NULL,
	"createdByUser" varchar(36) NOT NULL,
	"createdByActor" varchar(36),
	"version" integer DEFAULT 1 NOT NULL,
	"archivedAt" timestamp(3) with time zone,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "invitation_challenges" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"invitation" varchar(36) NOT NULL,
	"challengeHash" varchar(128) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"expiresAt" timestamp(3) with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "projects" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"company" varchar(36) NOT NULL,
	"space" varchar(36) NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"ownerActor" varchar(36) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archivedAt" timestamp(3) with time zone,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "roles" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"company" varchar(36) NOT NULL,
	"systemKey" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"kind" varchar(50) DEFAULT 'system' NOT NULL,
	"scopeType" varchar(50) NOT NULL,
	"permissions" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "space_memberships" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"company" varchar(36) NOT NULL,
	"space" varchar(36) NOT NULL,
	"actor" varchar(36) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "spaces" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"company" varchar(36) NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"isWholeCompany" boolean DEFAULT false NOT NULL,
	"systemKey" varchar(80),
	"createdBy" varchar(36) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archivedAt" timestamp(3) with time zone,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "questpie_realtime_log" (
	"seq" bigserial PRIMARY KEY,
	"resource_type" text NOT NULL,
	"resource" text NOT NULL,
	"operation" text NOT NULL,
	"record_id" text,
	"locale" text,
	"payload" jsonb DEFAULT '{}',
	"created_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "questpie_channel_head" (
	"channel_hash" text PRIMARY KEY,
	"channel" text NOT NULL,
	"last_seq" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "questpie_channel_event" (
	"channel_hash" text,
	"seq" bigint,
	"event_id" text NOT NULL,
	"channel" text NOT NULL,
	"event" text NOT NULL,
	"schema_identity" text NOT NULL,
	"payload" jsonb NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "questpie_channel_event_pkey" PRIMARY KEY("channel_hash","seq")
);`);
		await db.execute(sql`CREATE TABLE "questpie_channel_dispatch" (
	"channel_hash" text PRIMARY KEY,
	"published_seq" bigint DEFAULT 0 NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "questpie_channel_presence" (
	"channel_hash" text,
	"connection_id" text,
	"principal_id" text NOT NULL,
	"channel" text NOT NULL,
	"data" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "questpie_channel_presence_pkey" PRIMARY KEY("channel_hash","connection_id")
);`);
		await db.execute(sql`CREATE TABLE "questpie_realtime_topology" (
	"session_key" text PRIMARY KEY,
	"owner_id" text NOT NULL,
	"owner_generation" bigserial,
	"protocol_version" integer NOT NULL,
	"token_hash" text NOT NULL,
	"identity_hash" text NOT NULL,
	"lease_expires_at" timestamp with time zone NOT NULL,
	"desired_revision" bigint DEFAULT 0 NOT NULL,
	"applied_revision" bigint DEFAULT 0 NOT NULL,
	"desired_topology" jsonb NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE TABLE "questpie_search" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"collection_name" text NOT NULL,
	"record_id" text NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"metadata" jsonb DEFAULT '{}',
	"fts_vector" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('simple', coalesce(content, '')), 'B')) STORED NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) DEFAULT now() NOT NULL,
	CONSTRAINT "uq_search_entry" UNIQUE("collection_name","record_id","locale")
);`);
		await db.execute(sql`CREATE TABLE "questpie_search_facets" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"search_id" text NOT NULL,
	"collection_name" text NOT NULL,
	"locale" text NOT NULL,
	"facet_name" text NOT NULL,
	"facet_value" text NOT NULL,
	"numeric_value" numeric,
	"created_at" timestamp(3) DEFAULT now() NOT NULL
);`);
		await db.execute(sql`CREATE INDEX "idx_wfe_event_name" ON "wf_event" ("eventName");`);
		await db.execute(sql`CREATE INDEX "idx_wfe_created" ON "wf_event" ("created_at");`);
		await db.execute(sql`CREATE INDEX "idx_wfe_expires" ON "wf_event" ("expiresAt");`);
		await db.execute(sql`CREATE INDEX "idx_wfi_name" ON "wf_instance" ("name");`);
		await db.execute(sql`CREATE INDEX "idx_wfi_status" ON "wf_instance" ("status");`);
		await db.execute(sql`CREATE INDEX "idx_wfi_parent" ON "wf_instance" ("parentInstanceId");`);
		await db.execute(
			sql`CREATE UNIQUE INDEX "idx_wfi_idempotency" ON "wf_instance" ("idempotencyKey");`,
		);
		await db.execute(
			sql`CREATE INDEX "idx_wfi_status_lock" ON "wf_instance" ("status","lockExpiresAt");`,
		);
		await db.execute(sql`CREATE INDEX "idx_wfi_created" ON "wf_instance" ("created_at");`);
		await db.execute(sql`CREATE INDEX "idx_wfl_instance" ON "wf_log" ("instanceId");`);
		await db.execute(
			sql`CREATE UNIQUE INDEX "idx_wfs_instance_name" ON "wf_step" ("instanceId","name");`,
		);
		await db.execute(sql`CREATE INDEX "idx_wfs_instance" ON "wf_step" ("instanceId");`);
		await db.execute(sql`CREATE INDEX "idx_wfs_status" ON "wf_step" ("status");`);
		await db.execute(sql`CREATE INDEX "idx_wfs_scheduled" ON "wf_step" ("scheduledAt");`);
		await db.execute(sql`CREATE INDEX "idx_wfs_event_status" ON "wf_step" ("eventName","status");`);
		await db.execute(sql`CREATE INDEX "idx_wfs_match_hash" ON "wf_step" ("matchHash","status");`);
		await db.execute(
			sql`CREATE INDEX "activity_events_company_created_idx" ON "activity_events" ("company","created_at");`,
		);
		await db.execute(
			sql`CREATE INDEX "activity_events_space_created_idx" ON "activity_events" ("space","created_at");`,
		);
		await db.execute(
			sql`CREATE UNIQUE INDEX "actor_invitations_token_hash_unique" ON "actor_invitations" ("tokenHash");`,
		);
		await db.execute(
			sql`CREATE UNIQUE INDEX "actor_invitations_one_active_email_unique" ON "actor_invitations" ("company","normalizedEmail","activeKey");`,
		);
		await db.execute(
			sql`CREATE INDEX "actor_invitations_company_status_idx" ON "actor_invitations" ("company","status");`,
		);
		await db.execute(
			sql`CREATE UNIQUE INDEX "actor_role_bindings_active_unique" ON "actor_role_bindings" ("actor","activeKey");`,
		);
		await db.execute(
			sql`CREATE INDEX "actor_role_bindings_company_actor_idx" ON "actor_role_bindings" ("company","actor");`,
		);
		await db.execute(
			sql`CREATE INDEX "actor_role_bindings_space_actor_idx" ON "actor_role_bindings" ("space","actor");`,
		);
		await db.execute(
			sql`CREATE UNIQUE INDEX "actors_company_user_unique" ON "actors" ("company","user");`,
		);
		await db.execute(
			sql`CREATE UNIQUE INDEX "actors_company_system_key_unique" ON "actors" ("company","systemKey");`,
		);
		await db.execute(
			sql`CREATE INDEX "actors_company_status_idx" ON "actors" ("company","membershipStatus");`,
		);
		await db.execute(
			sql`CREATE INDEX "audit_events_company_created_idx" ON "audit_events" ("company","created_at");`,
		);
		await db.execute(
			sql`CREATE INDEX "audit_events_target_idx" ON "audit_events" ("targetType","targetId");`,
		);
		await db.execute(
			sql`CREATE UNIQUE INDEX "command_receipts_scope_key_unique" ON "command_receipts" ("scopeKey","commandKind","principalKey","idempotencyKey");`,
		);
		await db.execute(
			sql`CREATE INDEX "command_receipts_company_created_idx" ON "command_receipts" ("company","created_at");`,
		);
		await db.execute(sql`CREATE UNIQUE INDEX "companies_slug_unique" ON "companies" ("slug");`);
		await db.execute(
			sql`CREATE UNIQUE INDEX "invitation_challenges_hash_unique" ON "invitation_challenges" ("challengeHash");`,
		);
		await db.execute(
			sql`CREATE UNIQUE INDEX "projects_space_slug_unique" ON "projects" ("space","slug");`,
		);
		await db.execute(
			sql`CREATE INDEX "projects_company_space_status_idx" ON "projects" ("company","space","status");`,
		);
		await db.execute(
			sql`CREATE UNIQUE INDEX "roles_company_system_key_unique" ON "roles" ("company","systemKey");`,
		);
		await db.execute(
			sql`CREATE UNIQUE INDEX "space_memberships_space_actor_unique" ON "space_memberships" ("space","actor");`,
		);
		await db.execute(
			sql`CREATE INDEX "space_memberships_actor_status_idx" ON "space_memberships" ("actor","status");`,
		);
		await db.execute(
			sql`CREATE UNIQUE INDEX "spaces_company_slug_unique" ON "spaces" ("company","slug");`,
		);
		await db.execute(
			sql`CREATE UNIQUE INDEX "spaces_company_system_key_unique" ON "spaces" ("company","systemKey");`,
		);
		await db.execute(
			sql`CREATE INDEX "spaces_company_status_idx" ON "spaces" ("company","status");`,
		);
		await db.execute(
			sql`CREATE INDEX "idx_realtime_log_created_at" ON "questpie_realtime_log" ("created_at");`,
		);
		await db.execute(
			sql`CREATE UNIQUE INDEX "uq_channel_event_event_id" ON "questpie_channel_event" ("event_id");`,
		);
		await db.execute(
			sql`CREATE INDEX "idx_channel_event_created_at" ON "questpie_channel_event" ("created_at");`,
		);
		await db.execute(
			sql`CREATE INDEX "idx_channel_presence_channel" ON "questpie_channel_presence" ("channel_hash");`,
		);
		await db.execute(
			sql`CREATE INDEX "idx_channel_presence_expiry" ON "questpie_channel_presence" ("expires_at");`,
		);
		await db.execute(
			sql`CREATE INDEX "idx_realtime_topology_owner_lease" ON "questpie_realtime_topology" ("owner_id","lease_expires_at");`,
		);
		await db.execute(
			sql`CREATE INDEX "idx_realtime_topology_lease" ON "questpie_realtime_topology" ("lease_expires_at");`,
		);
		await db.execute(
			sql`CREATE INDEX "idx_search_fts" ON "questpie_search" USING gin ("fts_vector");`,
		);
		await db.execute(
			sql`CREATE INDEX "idx_search_trigram" ON "questpie_search" USING gin ("title" gin_trgm_ops);`,
		);
		await db.execute(
			sql`CREATE INDEX "idx_search_collection_locale" ON "questpie_search" ("collection_name","locale");`,
		);
		await db.execute(sql`CREATE INDEX "idx_search_record_id" ON "questpie_search" ("record_id");`);
		await db.execute(
			sql`CREATE INDEX "idx_facets_agg" ON "questpie_search_facets" ("collection_name","locale","facet_name","facet_value");`,
		);
		await db.execute(
			sql`CREATE INDEX "idx_facets_search_id" ON "questpie_search_facets" ("search_id");`,
		);
		await db.execute(
			sql`CREATE INDEX "idx_facets_collection" ON "questpie_search_facets" ("collection_name");`,
		);
	},
	async down({ db }) {
		await db.execute(sql`DROP TABLE "jwks";`);
		await db.execute(sql`DROP TABLE "oauthAccessToken";`);
		await db.execute(sql`DROP TABLE "oauthClient";`);
		await db.execute(sql`DROP TABLE "oauthConsent";`);
		await db.execute(sql`DROP TABLE "oauthRefreshToken";`);
		await db.execute(sql`DROP TABLE "account";`);
		await db.execute(sql`DROP TABLE "apikey";`);
		await db.execute(sql`DROP TABLE "assets";`);
		await db.execute(sql`DROP TABLE "session";`);
		await db.execute(sql`DROP TABLE "user";`);
		await db.execute(sql`DROP TABLE "verification";`);
		await db.execute(sql`DROP TABLE "wf_event";`);
		await db.execute(sql`DROP TABLE "wf_instance";`);
		await db.execute(sql`DROP TABLE "wf_log";`);
		await db.execute(sql`DROP TABLE "wf_step";`);
		await db.execute(sql`DROP TABLE "activity_events";`);
		await db.execute(sql`DROP TABLE "actor_invitations";`);
		await db.execute(sql`DROP TABLE "actor_role_bindings";`);
		await db.execute(sql`DROP TABLE "actors";`);
		await db.execute(sql`DROP TABLE "audit_events";`);
		await db.execute(sql`DROP TABLE "command_receipts";`);
		await db.execute(sql`DROP TABLE "companies";`);
		await db.execute(sql`DROP TABLE "invitation_challenges";`);
		await db.execute(sql`DROP TABLE "projects";`);
		await db.execute(sql`DROP TABLE "roles";`);
		await db.execute(sql`DROP TABLE "space_memberships";`);
		await db.execute(sql`DROP TABLE "spaces";`);
		await db.execute(sql`DROP TABLE "questpie_realtime_log";`);
		await db.execute(sql`DROP TABLE "questpie_channel_head";`);
		await db.execute(sql`DROP TABLE "questpie_channel_event";`);
		await db.execute(sql`DROP TABLE "questpie_channel_dispatch";`);
		await db.execute(sql`DROP TABLE "questpie_channel_presence";`);
		await db.execute(sql`DROP TABLE "questpie_realtime_topology";`);
		await db.execute(sql`DROP TABLE "questpie_search";`);
		await db.execute(sql`DROP TABLE "questpie_search_facets";`);
	},
	snapshot,
});
