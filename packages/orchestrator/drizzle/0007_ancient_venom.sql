CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`cron` text NOT NULL,
	`timezone` text DEFAULT 'UTC',
	`agent_id` text NOT NULL,
	`workflow_id` text,
	`task_template` text DEFAULT '{}',
	`enabled` integer DEFAULT true,
	`last_run_at` text,
	`next_run_at` text,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_schedules_enabled` ON `schedules` (`enabled`);--> statement-breakpoint
CREATE INDEX `idx_schedules_next_run` ON `schedules` (`next_run_at`);--> statement-breakpoint
CREATE INDEX `idx_schedules_agent` ON `schedules` (`agent_id`);