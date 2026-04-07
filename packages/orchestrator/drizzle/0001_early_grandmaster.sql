CREATE TABLE `conversation_bindings` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`external_conversation_id` text NOT NULL,
	`external_thread_id` text,
	`mode` text NOT NULL,
	`task_id` text,
	`metadata` text DEFAULT '{}',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_binding_provider_conv` ON `conversation_bindings` (`provider_id`,`external_conversation_id`,`external_thread_id`);--> statement-breakpoint
CREATE INDEX `idx_bindings_task` ON `conversation_bindings` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_bindings_provider` ON `conversation_bindings` (`provider_id`);