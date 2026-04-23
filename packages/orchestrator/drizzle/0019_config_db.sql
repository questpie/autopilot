CREATE TABLE `config_company_scopes` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `config_project_scopes` (
	`project_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `config_project_scopes_updated_idx` ON `config_project_scopes` (`updated_at`);
--> statement-breakpoint
CREATE TABLE `config_agents` (
	`scope_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`project_id` text,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `config_agents_id_idx` ON `config_agents` (`id`);
--> statement-breakpoint
CREATE INDEX `config_agents_project_idx` ON `config_agents` (`project_id`);
--> statement-breakpoint
CREATE TABLE `config_workflows` (
	`scope_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`project_id` text,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `config_workflows_id_idx` ON `config_workflows` (`id`);
--> statement-breakpoint
CREATE INDEX `config_workflows_project_idx` ON `config_workflows` (`project_id`);
--> statement-breakpoint
CREATE TABLE `config_environments` (
	`scope_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`project_id` text,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `config_environments_id_idx` ON `config_environments` (`id`);
--> statement-breakpoint
CREATE INDEX `config_environments_project_idx` ON `config_environments` (`project_id`);
--> statement-breakpoint
CREATE TABLE `config_providers` (
	`scope_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`project_id` text,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `config_providers_id_idx` ON `config_providers` (`id`);
--> statement-breakpoint
CREATE INDEX `config_providers_project_idx` ON `config_providers` (`project_id`);
--> statement-breakpoint
CREATE TABLE `config_capabilities` (
	`scope_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`project_id` text,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `config_capabilities_id_idx` ON `config_capabilities` (`id`);
--> statement-breakpoint
CREATE INDEX `config_capabilities_project_idx` ON `config_capabilities` (`project_id`);
--> statement-breakpoint
CREATE TABLE `config_skills` (
	`scope_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`project_id` text,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `config_skills_id_idx` ON `config_skills` (`id`);
--> statement-breakpoint
CREATE INDEX `config_skills_project_idx` ON `config_skills` (`project_id`);
--> statement-breakpoint
CREATE TABLE `config_scripts` (
	`scope_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`project_id` text,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `config_scripts_id_idx` ON `config_scripts` (`id`);
--> statement-breakpoint
CREATE INDEX `config_scripts_project_idx` ON `config_scripts` (`project_id`);
--> statement-breakpoint
CREATE TABLE `config_contexts` (
	`scope_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`project_id` text,
	`content` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `config_contexts_id_idx` ON `config_contexts` (`id`);
--> statement-breakpoint
CREATE INDEX `config_contexts_project_idx` ON `config_contexts` (`project_id`);
