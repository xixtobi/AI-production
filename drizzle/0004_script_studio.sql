ALTER TABLE `ai_requests` ADD COLUMN `script_version_id` text;
--> statement-breakpoint
ALTER TABLE `ai_requests` ADD COLUMN `script_scene_id` text;
--> statement-breakpoint
ALTER TABLE `ai_requests` ADD COLUMN `script_block_id` text;
--> statement-breakpoint
ALTER TABLE `ai_requests` ADD COLUMN `action_type` text;
--> statement-breakpoint
ALTER TABLE `ai_requests` ADD COLUMN `metadata_json` text;
--> statement-breakpoint
CREATE TABLE `story_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`content_item_id` text,
	`doc_type` text NOT NULL,
	`title` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `story_docs_project_idx` ON `story_documents` (`project_id`);
--> statement-breakpoint
CREATE INDEX `story_docs_content_idx` ON `story_documents` (`content_item_id`);
--> statement-breakpoint
CREATE TABLE `story_document_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`story_document_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`is_current` integer DEFAULT true NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`story_document_id`) REFERENCES `story_documents`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `story_doc_versions_doc_idx` ON `story_document_versions` (`story_document_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `story_doc_version_unique` ON `story_document_versions` (`story_document_id`,`version_number`);
--> statement-breakpoint
CREATE TABLE `script_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`content_item_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `script_docs_project_idx` ON `script_documents` (`project_id`);
--> statement-breakpoint
CREATE INDEX `script_docs_content_idx` ON `script_documents` (`content_item_id`);
--> statement-breakpoint
CREATE TABLE `script_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`script_document_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`version_label` text NOT NULL,
	`is_locked` integer DEFAULT false NOT NULL,
	`is_current` integer DEFAULT true NOT NULL,
	`snapshot_json` text,
	`notes` text DEFAULT '' NOT NULL,
	`locked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`script_document_id`) REFERENCES `script_documents`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `script_versions_doc_idx` ON `script_versions` (`script_document_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `script_version_doc_num_unique` ON `script_versions` (`script_document_id`,`version_number`);
--> statement-breakpoint
CREATE TABLE `script_scenes` (
	`id` text PRIMARY KEY NOT NULL,
	`script_version_id` text NOT NULL,
	`scene_number` integer NOT NULL,
	`scene_code` text NOT NULL,
	`heading` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`time_of_day` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`linked_scene_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`script_version_id`) REFERENCES `script_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `script_scenes_version_idx` ON `script_scenes` (`script_version_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `script_scenes_version_code_unique` ON `script_scenes` (`script_version_id`,`scene_code`);
--> statement-breakpoint
CREATE TABLE `script_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`script_scene_id` text NOT NULL,
	`block_type` text NOT NULL,
	`character` text,
	`content` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`script_scene_id`) REFERENCES `script_scenes`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `script_blocks_scene_idx` ON `script_blocks` (`script_scene_id`);
--> statement-breakpoint
CREATE TABLE `story_bibles` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`version_number` integer DEFAULT 1 NOT NULL,
	`version_label` text DEFAULT 'V01' NOT NULL,
	`premise` text DEFAULT '' NOT NULL,
	`world_rules` text DEFAULT '' NOT NULL,
	`mystery` text DEFAULT '' NOT NULL,
	`themes` text DEFAULT '' NOT NULL,
	`story_engine` text DEFAULT '' NOT NULL,
	`tone` text DEFAULT '' NOT NULL,
	`constraints` text DEFAULT '' NOT NULL,
	`is_current` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `story_bibles_project_idx` ON `story_bibles` (`project_id`);
--> statement-breakpoint
CREATE TABLE `characters` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`age` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`personality` text DEFAULT '' NOT NULL,
	`appearance` text DEFAULT '' NOT NULL,
	`costume` text DEFAULT '' NOT NULL,
	`signature_props` text DEFAULT '' NOT NULL,
	`story_function` text DEFAULT '' NOT NULL,
	`rules` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `characters_project_idx` ON `characters` (`project_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `characters_project_name_unique` ON `characters` (`project_id`,`name`);
--> statement-breakpoint
CREATE TABLE `environments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`visual_characteristics` text DEFAULT '' NOT NULL,
	`tone` text DEFAULT '' NOT NULL,
	`time_of_day_notes` text DEFAULT '' NOT NULL,
	`rules` text DEFAULT '' NOT NULL,
	`reference_assets` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `environments_project_idx` ON `environments` (`project_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `environments_project_name_unique` ON `environments` (`project_id`,`name`);
--> statement-breakpoint
CREATE TABLE `style_bibles` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`visual_style` text DEFAULT '' NOT NULL,
	`audience` text DEFAULT '' NOT NULL,
	`tone` text DEFAULT '' NOT NULL,
	`camera_language` text DEFAULT '' NOT NULL,
	`lighting` text DEFAULT '' NOT NULL,
	`palette_notes` text DEFAULT '' NOT NULL,
	`forbidden_visuals` text DEFAULT '' NOT NULL,
	`continuity_rules` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `style_bibles_project_idx` ON `style_bibles` (`project_id`);
