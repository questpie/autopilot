ALTER TABLE `messages` ADD `session_id` text;
--> statement-breakpoint
UPDATE `messages`
SET `session_id` = json_extract(`metadata`, '$.sessionId')
WHERE `session_id` IS NULL
  AND json_extract(`metadata`, '$.sessionId') IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_messages_session_created` ON `messages` (`session_id`, `created_at`);
--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `summary` text;
--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `summary_updated_at` text;
--> statement-breakpoint
ALTER TABLE `agent_sessions` ADD `last_summarized_message_id` text;
