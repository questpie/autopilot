-- Add F32_BLOB embedding columns to search_index and chunks tables
-- libSQL native vector type — works locally and on Turso
ALTER TABLE `search_index` ADD `embedding` F32_BLOB(768);--> statement-breakpoint
ALTER TABLE `chunks` ADD `embedding` F32_BLOB(768);