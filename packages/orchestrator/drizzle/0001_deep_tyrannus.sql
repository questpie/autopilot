CREATE TABLE `step_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_run_id` text NOT NULL,
	`task_id` text NOT NULL,
	`step_id` text NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`executor_kind` text,
	`executor_ref` text,
	`model_policy` text,
	`validation_mode` text,
	`input_snapshot` text DEFAULT '{}',
	`output_snapshot` text DEFAULT '{}',
	`validation_snapshot` text DEFAULT '{}',
	`failure_action` text,
	`failure_reason` text,
	`child_workflow_id` text,
	`child_task_id` text,
	`idempotency_key` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`archived_at` text,
	`metadata` text DEFAULT '{}'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_step_runs_attempt` ON `step_runs` (`workflow_run_id`,`step_id`,`attempt`);--> statement-breakpoint
CREATE INDEX `idx_step_runs_workflow` ON `step_runs` (`workflow_run_id`,`step_id`);--> statement-breakpoint
CREATE INDEX `idx_step_runs_task` ON `step_runs` (`task_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_step_runs_child_task` ON `step_runs` (`child_task_id`);--> statement-breakpoint
CREATE INDEX `idx_step_runs_updated` ON `step_runs` (`updated_at`);--> statement-breakpoint
CREATE TABLE `workflow_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`workflow_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`current_step_id` text,
	`trigger_source` text,
	`parent_task_id` text,
	`parent_run_id` text,
	`input_snapshot` text DEFAULT '{}',
	`last_event` text,
	`stream_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`archived_at` text,
	`metadata` text DEFAULT '{}'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_workflow_runs_task` ON `workflow_runs` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_workflow_runs_workflow` ON `workflow_runs` (`workflow_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_workflow_runs_parent` ON `workflow_runs` (`parent_task_id`);--> statement-breakpoint
CREATE INDEX `idx_workflow_runs_current_step` ON `workflow_runs` (`current_step_id`);--> statement-breakpoint
CREATE INDEX `idx_workflow_runs_updated` ON `workflow_runs` (`updated_at`);