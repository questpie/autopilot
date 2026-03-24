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
	`external` integer DEFAULT false
);
--> statement-breakpoint
CREATE INDEX `idx_messages_channel` ON `messages` (`channel`);--> statement-breakpoint
CREATE INDEX `idx_messages_from` ON `messages` (`from_id`);--> statement-breakpoint
CREATE INDEX `idx_messages_to` ON `messages` (`to_id`);--> statement-breakpoint
CREATE INDEX `idx_messages_thread` ON `messages` (`thread`);--> statement-breakpoint
CREATE INDEX `idx_messages_created` ON `messages` (`created_at`);--> statement-breakpoint
CREATE TABLE `search_index` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`title` text,
	`content` text NOT NULL,
	`content_hash` text NOT NULL,
	`indexed_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_search_entity_type` ON `search_index` (`entity_type`);--> statement-breakpoint
CREATE INDEX `idx_search_entity_id` ON `search_index` (`entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_search_entity` ON `search_index` (`entity_type`,`entity_id`);--> statement-breakpoint
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
CREATE INDEX `idx_tasks_milestone` ON `tasks` (`milestone`);