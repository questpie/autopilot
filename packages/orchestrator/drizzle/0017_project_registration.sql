CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`git_remote` text,
	`default_branch` text,
	`registered_at` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_projects_path` ON `projects` (`path`);
--> statement-breakpoint
CREATE INDEX `idx_projects_name` ON `projects` (`name`);
--> statement-breakpoint
CREATE INDEX `idx_projects_registered_at` ON `projects` (`registered_at`);
