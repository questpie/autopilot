CREATE TABLE `chunks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`content` text NOT NULL,
	`content_hash` text NOT NULL,
	`metadata` text DEFAULT '{}',
	`indexed_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_chunks_entity` ON `chunks` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_chunks_entity_chunk` ON `chunks` (`entity_type`,`entity_id`,`chunk_index`);--> statement-breakpoint
CREATE INDEX `idx_chunks_hash` ON `chunks` (`content_hash`);