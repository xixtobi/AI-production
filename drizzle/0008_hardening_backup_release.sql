ALTER TABLE `projects` ADD COLUMN `is_archived` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `archived_at` integer;
--> statement-breakpoint
ALTER TABLE `content_items` ADD COLUMN `is_archived` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `content_items` ADD COLUMN `archived_at` integer;
--> statement-breakpoint
ALTER TABLE `assets` ADD COLUMN `is_archived` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `assets` ADD COLUMN `archived_at` integer;
--> statement-breakpoint
CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text REFERENCES projects(id) ON DELETE cascade,
	`action_type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`metadata_json` text,
	`actor` text DEFAULT 'User' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activity_logs_project_idx` ON `activity_logs` (`project_id`);
--> statement-breakpoint
CREATE INDEX `activity_logs_created_idx` ON `activity_logs` (`created_at`);
--> statement-breakpoint
CREATE INDEX `activity_logs_action_idx` ON `activity_logs` (`action_type`);
--> statement-breakpoint
CREATE TABLE `favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES projects(id) ON DELETE cascade,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `favorites_project_idx` ON `favorites` (`project_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `favorites_project_entity_unique` ON `favorites` (`project_id`, `entity_type`, `entity_id`);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`language` text DEFAULT 'Indonesian' NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`default_project_id` text,
	`default_aspect_ratio` text DEFAULT '16:9' NOT NULL,
	`backup_root_path` text DEFAULT '' NOT NULL,
	`backup_retention_count` integer DEFAULT 5 NOT NULL,
	`ignored_directories_json` text DEFAULT '[]' NOT NULL,
	`auto_scan_on_load` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `backups` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES projects(id) ON DELETE cascade,
	`backup_type` text NOT NULL,
	`status` text DEFAULT 'COMPLETED' NOT NULL,
	`backup_path` text NOT NULL,
	`filename` text NOT NULL,
	`file_size_bytes` integer DEFAULT 0 NOT NULL,
	`file_count` integer DEFAULT 0 NOT NULL,
	`manifest_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `backups_project_idx` ON `backups` (`project_id`);
--> statement-breakpoint
CREATE INDEX `backups_created_idx` ON `backups` (`created_at`);
