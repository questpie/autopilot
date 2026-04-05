CREATE TABLE `shared_secrets` (
	`name` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`encrypted_value` text NOT NULL,
	`iv` text NOT NULL,
	`auth_tag` text NOT NULL,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_shared_secrets_scope` ON `shared_secrets` (`scope`);