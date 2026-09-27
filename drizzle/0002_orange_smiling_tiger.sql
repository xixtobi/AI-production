CREATE TABLE `asset_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`source_asset_id` text NOT NULL,
	`target_asset_id` text NOT NULL,
	`relationship_type` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`source_asset_id`,`project_id`) REFERENCES `assets`(`id`,`project_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`target_asset_id`,`project_id`) REFERENCES `assets`(`id`,`project_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_relationships_unique` ON `asset_relationships` (`source_asset_id`,`target_asset_id`,`relationship_type`);--> statement-breakpoint
CREATE INDEX `asset_relationships_project_idx` ON `asset_relationships` (`project_id`);--> statement-breakpoint
CREATE INDEX `asset_relationships_source_idx` ON `asset_relationships` (`source_asset_id`);--> statement-breakpoint
CREATE INDEX `asset_relationships_target_idx` ON `asset_relationships` (`target_asset_id`);--> statement-breakpoint
CREATE TABLE `asset_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`version_label` text NOT NULL,
	`filename` text NOT NULL,
	`relative_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`width` integer,
	`height` integer,
	`duration_seconds` real,
	`sha256` text NOT NULL,
	`is_current` integer DEFAULT true NOT NULL,
	`is_locked` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`asset_id`,`project_id`) REFERENCES `assets`(`id`,`project_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_versions_asset_number_unique` ON `asset_versions` (`asset_id`,`version_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `asset_versions_project_current_path_unique` ON `asset_versions` (`project_id`,`relative_path`) WHERE "asset_versions"."is_current" = 1;--> statement-breakpoint
CREATE INDEX `asset_versions_project_idx` ON `asset_versions` (`project_id`);--> statement-breakpoint
CREATE INDEX `asset_versions_asset_idx` ON `asset_versions` (`asset_id`);--> statement-breakpoint
CREATE INDEX `asset_versions_sha_idx` ON `asset_versions` (`sha256`);--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`asset_code` text NOT NULL,
	`asset_type` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'NOT_STARTED' NOT NULL,
	`is_shared` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_project_code_unique` ON `assets` (`project_id`,`asset_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `assets_id_project_unique` ON `assets` (`id`,`project_id`);--> statement-breakpoint
CREATE INDEX `assets_project_idx` ON `assets` (`project_id`);--> statement-breakpoint
CREATE INDEX `assets_type_idx` ON `assets` (`asset_type`);--> statement-breakpoint
CREATE TABLE `scanner_ignores` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`relative_path` text NOT NULL,
	`category` text NOT NULL,
	`ignored_sha256` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scanner_ignores_project_path_category_unique` ON `scanner_ignores` (`project_id`,`relative_path`,`category`);--> statement-breakpoint
CREATE INDEX `scanner_ignores_project_idx` ON `scanner_ignores` (`project_id`);--> statement-breakpoint
CREATE TABLE `shot_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`shot_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`role` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`shot_id`,`project_id`) REFERENCES `shots`(`id`,`project_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`asset_id`,`project_id`) REFERENCES `assets`(`id`,`project_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shot_assets_shot_asset_role_unique` ON `shot_assets` (`shot_id`,`asset_id`,`role`);--> statement-breakpoint
CREATE INDEX `shot_assets_project_idx` ON `shot_assets` (`project_id`);--> statement-breakpoint
CREATE INDEX `shot_assets_shot_idx` ON `shot_assets` (`shot_id`);--> statement-breakpoint
CREATE INDEX `shot_assets_asset_idx` ON `shot_assets` (`asset_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `shots_id_project_unique` ON `shots` (`id`,`project_id`);