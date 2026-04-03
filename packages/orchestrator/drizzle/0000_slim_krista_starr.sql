CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor` text NOT NULL,
	`type` text NOT NULL,
	`summary` text NOT NULL,
	`details` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_activity_actor_time` ON `activity` (`actor`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_activity_type` ON `activity` (`type`);--> statement-breakpoint
CREATE INDEX `idx_activity_time` ON `activity` (`created_at`);--> statement-breakpoint
CREATE TABLE `apikey` (
	`id` text PRIMARY KEY NOT NULL,
	`config_id` text DEFAULT 'default' NOT NULL,
	`name` text,
	`start` text,
	`reference_id` text NOT NULL,
	`prefix` text,
	`key` text NOT NULL,
	`refill_interval` integer,
	`refill_amount` integer,
	`last_refill_at` integer,
	`enabled` integer DEFAULT true,
	`rate_limit_enabled` integer DEFAULT true,
	`rate_limit_time_window` integer,
	`rate_limit_max` integer,
	`request_count` integer DEFAULT 0,
	`remaining` integer,
	`last_request` integer,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`permissions` text,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `apikey_config_id_idx` ON `apikey` (`config_id`);--> statement-breakpoint
CREATE INDEX `apikey_reference_id_idx` ON `apikey` (`reference_id`);--> statement-breakpoint
CREATE INDEX `apikey_key_idx` ON `apikey` (`key`);--> statement-breakpoint
CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`task_id` text,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`ref_kind` text NOT NULL,
	`ref_value` text NOT NULL,
	`mime_type` text,
	`metadata` text DEFAULT '{}',
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_artifacts_run` ON `artifacts` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_artifacts_task` ON `artifacts` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_artifacts_kind` ON `artifacts` (`kind`);--> statement-breakpoint
CREATE TABLE `channel_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`role` text DEFAULT 'member',
	`joined_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_members_channel` ON `channel_members` (`channel_id`);--> statement-breakpoint
CREATE INDEX `idx_members_actor` ON `channel_members` (`actor_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_channel_member` ON `channel_members` (`channel_id`,`actor_id`);--> statement-breakpoint
CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`metadata` text DEFAULT '{}'
);
--> statement-breakpoint
CREATE INDEX `idx_channels_type` ON `channels` (`type`);--> statement-breakpoint
CREATE INDEX `idx_channels_created` ON `channels` (`created_at`);--> statement-breakpoint
CREATE TABLE `invite` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`token` text NOT NULL,
	`invited_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer,
	`accepted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invite_email_unique` ON `invite` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `invite_token_unique` ON `invite` (`token`);--> statement-breakpoint
CREATE INDEX `invite_token_idx` ON `invite` (`token`);--> statement-breakpoint
CREATE TABLE `join_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`secret_hash` text NOT NULL,
	`description` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`used_by_worker_id` text
);
--> statement-breakpoint
CREATE INDEX `idx_join_tokens_expires` ON `join_tokens` (`expires_at`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`from_id` text NOT NULL,
	`channel_id` text,
	`run_id` text,
	`content` text NOT NULL,
	`mentions` text DEFAULT '[]',
	`attachments` text DEFAULT '[]',
	`thread_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_messages_channel` ON `messages` (`channel_id`);--> statement-breakpoint
CREATE INDEX `idx_messages_run_created` ON `messages` (`run_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_messages_from` ON `messages` (`from_id`);--> statement-breakpoint
CREATE INDEX `idx_messages_created` ON `messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_messages_thread_id` ON `messages` (`thread_id`);--> statement-breakpoint
CREATE TABLE `rate_limit` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limit_key_unique` ON `rate_limit` (`key`);--> statement-breakpoint
CREATE TABLE `run_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`type` text NOT NULL,
	`summary` text,
	`metadata` text DEFAULT '{}',
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_run_events_run_created` ON `run_events` (`run_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`task_id` text,
	`worker_id` text,
	`runtime` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`initiated_by` text,
	`instructions` text,
	`summary` text,
	`tokens_input` integer DEFAULT 0,
	`tokens_output` integer DEFAULT 0,
	`error` text,
	`started_at` text,
	`ended_at` text,
	`created_at` text NOT NULL,
	`runtime_session_ref` text,
	`resumed_from_run_id` text,
	`preferred_worker_id` text,
	`resumable` integer DEFAULT false,
	`targeting` text
);
--> statement-breakpoint
CREATE INDEX `idx_runs_status` ON `runs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_runs_agent` ON `runs` (`agent_id`);--> statement-breakpoint
CREATE INDEX `idx_runs_task` ON `runs` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_runs_worker` ON `runs` (`worker_id`);--> statement-breakpoint
CREATE INDEX `idx_runs_resumed_from` ON `runs` (`resumed_from_run_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '',
	`type` text NOT NULL,
	`status` text NOT NULL,
	`priority` text DEFAULT 'medium',
	`assigned_to` text,
	`workflow_id` text,
	`workflow_step` text,
	`context` text DEFAULT '{}',
	`metadata` text DEFAULT '{}',
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tasks_assigned` ON `tasks` (`assigned_to`);--> statement-breakpoint
CREATE INDEX `idx_tasks_workflow` ON `tasks` (`workflow_id`,`workflow_step`);--> statement-breakpoint
CREATE INDEX `idx_tasks_created` ON `tasks` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tasks_priority` ON `tasks` (`priority`,`status`);--> statement-breakpoint
CREATE TABLE `two_factor` (
	`id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `two_factor_secret_idx` ON `two_factor` (`secret`);--> statement-breakpoint
CREATE INDEX `two_factor_user_id_idx` ON `two_factor` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`role` text,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer,
	`two_factor_enabled` integer DEFAULT false
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `worker_leases` (
	`id` text PRIMARY KEY NOT NULL,
	`worker_id` text NOT NULL,
	`run_id` text NOT NULL,
	`claimed_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_leases_worker` ON `worker_leases` (`worker_id`);--> statement-breakpoint
CREATE INDEX `idx_leases_run` ON `worker_leases` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_leases_status` ON `worker_leases` (`status`);--> statement-breakpoint
CREATE TABLE `workers` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text,
	`name` text,
	`status` text DEFAULT 'offline' NOT NULL,
	`capabilities` text DEFAULT '[]',
	`registered_at` text NOT NULL,
	`last_heartbeat` text,
	`machine_secret_hash` text
);
--> statement-breakpoint
CREATE INDEX `idx_workers_device` ON `workers` (`device_id`);--> statement-breakpoint
CREATE INDEX `idx_workers_status` ON `workers` (`status`);--> statement-breakpoint
CREATE TABLE `chunks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`content` text NOT NULL,
	`content_hash` text NOT NULL,
	`metadata` text DEFAULT '{}',
	`indexed_at` text NOT NULL,
	`embedding` blob
);
--> statement-breakpoint
CREATE INDEX `idx_chunks_entity` ON `chunks` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_chunks_entity_chunk` ON `chunks` (`entity_type`,`entity_id`,`chunk_index`);--> statement-breakpoint
CREATE INDEX `idx_chunks_hash` ON `chunks` (`content_hash`);--> statement-breakpoint
CREATE TABLE `search_index` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`title` text,
	`content` text NOT NULL,
	`content_hash` text NOT NULL,
	`indexed_at` text NOT NULL,
	`embedding` blob
);
--> statement-breakpoint
CREATE INDEX `idx_search_entity_type` ON `search_index` (`entity_type`);--> statement-breakpoint
CREATE INDEX `idx_search_entity_id` ON `search_index` (`entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_search_entity` ON `search_index` (`entity_type`,`entity_id`);