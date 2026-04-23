ALTER TABLE `tasks` ADD COLUMN `project_id` text;
--> statement-breakpoint
CREATE INDEX `idx_tasks_project` ON `tasks` (`project_id`);
--> statement-breakpoint
ALTER TABLE `runs` ADD COLUMN `project_id` text;
--> statement-breakpoint
CREATE INDEX `idx_runs_project` ON `runs` (`project_id`);
