ALTER TABLE `queries` ADD `promoted_task_id` text;--> statement-breakpoint
CREATE INDEX `idx_queries_promoted` ON `queries` (`promoted_task_id`);