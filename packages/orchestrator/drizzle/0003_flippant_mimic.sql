CREATE TABLE `channel_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`role` text DEFAULT 'member',
	`joined_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_members_channel` ON `channel_members` (`channel_id`);--> statement-breakpoint
CREATE INDEX `idx_members_actor` ON `channel_members` (`actor_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_channel_member` ON `channel_members` (`channel_id`,`actor_id`);--> statement-breakpoint
CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`metadata` text DEFAULT '{}'
);
--> statement-breakpoint
CREATE INDEX `idx_channels_type` ON `channels` (`type`);--> statement-breakpoint
CREATE INDEX `idx_channels_created` ON `channels` (`created_at`);