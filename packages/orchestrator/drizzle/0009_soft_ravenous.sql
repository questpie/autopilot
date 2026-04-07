ALTER TABLE `tasks` ADD `queue` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `start_after` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `scheduled_by` text;--> statement-breakpoint
CREATE INDEX `idx_tasks_queue_status` ON `tasks` (`queue`,`status`);