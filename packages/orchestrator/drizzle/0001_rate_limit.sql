CREATE TABLE `rate_limit_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limit_key_window` ON `rate_limit_entries` (`key`,`window_start`);
--> statement-breakpoint
CREATE INDEX `idx_rate_limit_expires` ON `rate_limit_entries` (`expires_at`);
