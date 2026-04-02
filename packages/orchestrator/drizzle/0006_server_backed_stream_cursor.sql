ALTER TABLE `agent_sessions` ADD `stream_offset` text DEFAULT '-1';
--> statement-breakpoint
UPDATE `agent_sessions`
SET `stream_offset` = '-1'
WHERE `stream_offset` IS NULL OR trim(`stream_offset`) = '';
