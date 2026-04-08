CREATE TABLE `session_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`query_id` text,
	`metadata` text DEFAULT '{}',
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_session_messages_session_created` ON `session_messages` (`session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_session_messages_session_query` ON `session_messages` (`session_id`,`query_id`);--> statement-breakpoint
ALTER TABLE `queries` ADD `session_id` text;--> statement-breakpoint
CREATE INDEX `idx_queries_session` ON `queries` (`session_id`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `runtime_session_ref` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `preferred_worker_id` text;