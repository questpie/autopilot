CREATE TABLE `queries` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt` text NOT NULL,
	`agent_id` text NOT NULL,
	`run_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`allow_repo_mutation` integer DEFAULT false NOT NULL,
	`mutated_repo` integer DEFAULT false NOT NULL,
	`summary` text,
	`continue_from` text,
	`carryover_summary` text,
	`runtime_session_ref` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`ended_at` text,
	`metadata` text DEFAULT '{}'
);
--> statement-breakpoint
CREATE INDEX `idx_queries_status` ON `queries` (`status`);--> statement-breakpoint
CREATE INDEX `idx_queries_agent` ON `queries` (`agent_id`);--> statement-breakpoint
CREATE INDEX `idx_queries_created` ON `queries` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_queries_continue_from` ON `queries` (`continue_from`);