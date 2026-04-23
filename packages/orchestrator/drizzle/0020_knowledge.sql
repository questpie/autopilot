CREATE TABLE `knowledge` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`title` text NOT NULL,
	`content_hash` text NOT NULL,
	`blob_id` text NOT NULL,
	`mime_type` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_knowledge_scope_path` ON `knowledge` (`scope_type`,`scope_id`,`path`);
--> statement-breakpoint
CREATE INDEX `idx_knowledge_path` ON `knowledge` (`path`);
--> statement-breakpoint
CREATE INDEX `idx_knowledge_scope` ON `knowledge` (`scope_type`,`scope_id`);
--> statement-breakpoint
CREATE INDEX `idx_knowledge_blob` ON `knowledge` (`blob_id`);
--> statement-breakpoint
CREATE INDEX `idx_knowledge_content_hash` ON `knowledge` (`content_hash`);
