DROP INDEX `idx_queries_continue_from`;--> statement-breakpoint
ALTER TABLE `queries` DROP COLUMN `continue_from`;--> statement-breakpoint
ALTER TABLE `queries` DROP COLUMN `carryover_summary`;--> statement-breakpoint
ALTER TABLE `sessions` DROP COLUMN `last_query_id`;