ALTER TABLE `agent_sessions` ADD `initiated_by` text;
--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `channel_id` text;
--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `first_message` text;
--> statement-breakpoint
CREATE INDEX `idx_agent_sessions_initiated_by` ON `agent_sessions` (`initiated_by`);
--> statement-breakpoint
CREATE INDEX `idx_agent_sessions_channel` ON `agent_sessions` (`channel_id`);
