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
	`agent` text NOT NULL,
	`type` text NOT NULL,
	`summary` text NOT NULL,
	`details` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_activity_agent_time` ON `activity` (`agent`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_activity_type` ON `activity` (`type`);--> statement-breakpoint
CREATE INDEX `idx_activity_time` ON `activity` (`created_at`);--> statement-breakpoint
CREATE TABLE `agent_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`task_id` text,
	`trigger_type` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`tool_calls` integer DEFAULT 0,
	`tokens_used` integer DEFAULT 0,
	`error` text,
	`log_path` text
);
--> statement-breakpoint
CREATE INDEX `idx_agent_sessions_agent` ON `agent_sessions` (`agent_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_sessions_task` ON `agent_sessions` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_sessions_status` ON `agent_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_agent_sessions_started` ON `agent_sessions` (`started_at`);--> statement-breakpoint
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
CREATE TABLE `bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`message_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_bookmarks_user` ON `bookmarks` (`user_id`);--> statement-breakpoint
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
CREATE TABLE `chunks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`content` text NOT NULL,
	`content_hash` text NOT NULL,
	`metadata` text DEFAULT '{}',
	`indexed_at` text NOT NULL,
	`embedding` F32_BLOB(768)
);
--> statement-breakpoint
CREATE INDEX `idx_chunks_entity` ON `chunks` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_chunks_entity_chunk` ON `chunks` (`entity_type`,`entity_id`,`chunk_index`);--> statement-breakpoint
CREATE INDEX `idx_chunks_hash` ON `chunks` (`content_hash`);--> statement-breakpoint
CREATE TABLE `file_locks` (
	`path` text PRIMARY KEY NOT NULL,
	`locked_by` text NOT NULL,
	`locked_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_file_locks_expires` ON `file_locks` (`expires_at`);--> statement-breakpoint
CREATE TABLE `message_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`emoji` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reactions_message` ON `message_reactions` (`message_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_reaction` ON `message_reactions` (`message_id`,`emoji`,`user_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text,
	`from_id` text NOT NULL,
	`to_id` text,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	`mentions` text DEFAULT '[]',
	`references_ids` text DEFAULT '[]',
	`reactions` text DEFAULT '[]',
	`thread` text,
	`transport` text,
	`external` integer DEFAULT false,
	`metadata` text DEFAULT '{}',
	`attachments` text DEFAULT '[]',
	`thread_id` text,
	`edited_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_messages_channel` ON `messages` (`channel`);--> statement-breakpoint
CREATE INDEX `idx_messages_from` ON `messages` (`from_id`);--> statement-breakpoint
CREATE INDEX `idx_messages_to` ON `messages` (`to_id`);--> statement-breakpoint
CREATE INDEX `idx_messages_thread` ON `messages` (`thread`);--> statement-breakpoint
CREATE INDEX `idx_messages_created` ON `messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_messages_thread_id` ON `messages` (`thread_id`);--> statement-breakpoint
CREATE TABLE `notification_throttle` (
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`transport` text NOT NULL,
	`last_sent_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_throttle_pk` ON `notification_throttle` (`user_id`,`type`,`transport`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`priority` text NOT NULL,
	`title` text NOT NULL,
	`message` text,
	`url` text,
	`task_id` text,
	`agent_id` text,
	`read_at` integer,
	`dismissed_at` integer,
	`delivered_via` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user` ON `notifications` (`user_id`,`read_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_notifications_type` ON `notifications` (`type`);--> statement-breakpoint
CREATE INDEX `idx_notifications_created` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE TABLE `pinned_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`message_id` text NOT NULL,
	`pinned_by` text NOT NULL,
	`pinned_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_pinned_channel` ON `pinned_messages` (`channel_id`);--> statement-breakpoint
CREATE TABLE `pins` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`type` text DEFAULT 'info' NOT NULL,
	`group_id` text DEFAULT 'overview',
	`metadata` text DEFAULT '{}',
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_pins_group` ON `pins` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_pins_type` ON `pins` (`type`);--> statement-breakpoint
CREATE INDEX `idx_pins_expires` ON `pins` (`expires_at`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`keys_p256dh` text NOT NULL,
	`keys_auth` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_push_subs_user` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_push_subs_endpoint` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE TABLE `rate_limit` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limit_key_unique` ON `rate_limit` (`key`);--> statement-breakpoint
CREATE TABLE `rate_limit_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limit_key_window` ON `rate_limit_entries` (`key`,`window_start`);--> statement-breakpoint
CREATE INDEX `idx_rate_limit_expires` ON `rate_limit_entries` (`expires_at`);--> statement-breakpoint
CREATE TABLE `search_index` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`title` text,
	`content` text NOT NULL,
	`content_hash` text NOT NULL,
	`indexed_at` text NOT NULL,
	`embedding` F32_BLOB(768)
);
--> statement-breakpoint
CREATE INDEX `idx_search_entity_type` ON `search_index` (`entity_type`);--> statement-breakpoint
CREATE INDEX `idx_search_entity_id` ON `search_index` (`entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_search_entity` ON `search_index` (`entity_type`,`entity_id`);--> statement-breakpoint
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
	`created_by` text NOT NULL,
	`assigned_to` text,
	`reviewers` text DEFAULT '[]',
	`approver` text,
	`project` text,
	`parent` text,
	`depends_on` text DEFAULT '[]',
	`blocks` text DEFAULT '[]',
	`related` text DEFAULT '[]',
	`workflow` text,
	`workflow_step` text,
	`context` text DEFAULT '{}',
	`blockers` text DEFAULT '[]',
	`resources` text DEFAULT '[]',
	`labels` text DEFAULT '[]',
	`milestone` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	`deadline` text,
	`history` text DEFAULT '[]',
	`metadata` text DEFAULT '{}'
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tasks_assigned` ON `tasks` (`assigned_to`);--> statement-breakpoint
CREATE INDEX `idx_tasks_workflow` ON `tasks` (`workflow`,`workflow_step`);--> statement-breakpoint
CREATE INDEX `idx_tasks_project` ON `tasks` (`project`);--> statement-breakpoint
CREATE INDEX `idx_tasks_parent` ON `tasks` (`parent`);--> statement-breakpoint
CREATE INDEX `idx_tasks_created` ON `tasks` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tasks_priority` ON `tasks` (`priority`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tasks_milestone` ON `tasks` (`milestone`);--> statement-breakpoint
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
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);