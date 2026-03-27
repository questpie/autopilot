CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`priority` text NOT NULL,
	`title` text NOT NULL,
	`message` text,
	`url` text,
	`task_id` text,
	`agent_id` text,
	`read_at` integer,
	`dismissed_at` integer,
	`delivered_via` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user` ON `notifications` (`user_id`, `read_at`, `created_at`);
--> statement-breakpoint
CREATE INDEX `idx_notifications_type` ON `notifications` (`type`);
--> statement-breakpoint
CREATE INDEX `idx_notifications_created` ON `notifications` (`created_at`);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`keys_p256dh` text NOT NULL,
	`keys_auth` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_push_subs_user` ON `push_subscriptions` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_push_subs_endpoint` ON `push_subscriptions` (`endpoint`);
--> statement-breakpoint
CREATE TABLE `notification_throttle` (
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`transport` text NOT NULL,
	`last_sent_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_throttle_pk` ON `notification_throttle` (`user_id`, `type`, `transport`);
