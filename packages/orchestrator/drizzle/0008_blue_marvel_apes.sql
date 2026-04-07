CREATE TABLE `schedule_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL,
	`task_id` text,
	`query_id` text,
	`status` text DEFAULT 'triggered' NOT NULL,
	`skip_reason` text,
	`error` text,
	`triggered_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_schedule_executions_schedule` ON `schedule_executions` (`schedule_id`);--> statement-breakpoint
CREATE INDEX `idx_schedule_executions_status` ON `schedule_executions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_schedule_executions_triggered` ON `schedule_executions` (`triggered_at`);--> statement-breakpoint
ALTER TABLE `schedules` ADD `mode` text DEFAULT 'task';--> statement-breakpoint
ALTER TABLE `schedules` ADD `query_template` text DEFAULT '{}';--> statement-breakpoint
ALTER TABLE `schedules` ADD `concurrency_policy` text DEFAULT 'skip';