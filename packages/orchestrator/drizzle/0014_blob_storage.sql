CREATE TABLE `artifact_blobs` (
	`id` text PRIMARY KEY NOT NULL,
	`content_hash` text NOT NULL,
	`storage_key` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `artifact_blobs_content_hash_unique` ON `artifact_blobs` (`content_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `artifact_blobs_storage_key_unique` ON `artifact_blobs` (`storage_key`);--> statement-breakpoint
ALTER TABLE `artifacts` ADD `blob_id` text;--> statement-breakpoint
CREATE INDEX `idx_artifacts_blob_id` ON `artifacts` (`blob_id`);
