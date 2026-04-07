CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`external_conversation_id` text NOT NULL,
	`external_thread_id` text NOT NULL,
	`mode` text NOT NULL,
	`task_id` text,
	`last_query_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`metadata` text DEFAULT '{}'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_session_provider_conv` ON `sessions` (`provider_id`,`external_conversation_id`,`external_thread_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_provider` ON `sessions` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_task` ON `sessions` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_status` ON `sessions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sessions_mode` ON `sessions` (`mode`);