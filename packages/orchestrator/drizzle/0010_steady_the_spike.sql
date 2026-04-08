CREATE TABLE `run_steers` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`delivered_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_run_steers_run_status` ON `run_steers` (`run_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_run_steers_created` ON `run_steers` (`created_at`);