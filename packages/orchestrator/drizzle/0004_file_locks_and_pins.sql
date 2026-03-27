CREATE TABLE `file_locks` (
	`path` text PRIMARY KEY NOT NULL,
	`locked_by` text NOT NULL,
	`locked_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_file_locks_expires` ON `file_locks` (`expires_at`);
--> statement-breakpoint
CREATE TABLE `pins` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`type` text NOT NULL DEFAULT 'info',
	`group_id` text DEFAULT 'overview',
	`metadata` text DEFAULT '{}',
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_pins_group` ON `pins` (`group_id`);
--> statement-breakpoint
CREATE INDEX `idx_pins_type` ON `pins` (`type`);
--> statement-breakpoint
CREATE INDEX `idx_pins_expires` ON `pins` (`expires_at`);
