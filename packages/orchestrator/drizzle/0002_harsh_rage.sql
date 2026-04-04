CREATE TABLE `task_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`source_task_id` text NOT NULL,
	`target_task_id` text NOT NULL,
	`relation_type` text NOT NULL,
	`dedupe_key` text,
	`origin_run_id` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`metadata` text DEFAULT '{}'
);
--> statement-breakpoint
CREATE INDEX `idx_task_relations_source` ON `task_relations` (`source_task_id`,`relation_type`);--> statement-breakpoint
CREATE INDEX `idx_task_relations_target` ON `task_relations` (`target_task_id`,`relation_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_task_relation` ON `task_relations` (`source_task_id`,`target_task_id`,`relation_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_task_relation_dedupe` ON `task_relations` (`source_task_id`,`relation_type`,`dedupe_key`);