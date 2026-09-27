ALTER TABLE `content_items` ADD COLUMN `audio_status` text DEFAULT 'NOT_STARTED' NOT NULL;
--> statement-breakpoint
ALTER TABLE `content_items` ADD COLUMN `edit_status` text DEFAULT 'NOT_STARTED' NOT NULL;
--> statement-breakpoint
CREATE TABLE `qc_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`content_item_id` text,
	`scene_id` text,
	`shot_id` text,
	`asset_version_id` text,
	`video_output_id` text,
	`review_type` text DEFAULT 'VISUAL' NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`severity` text DEFAULT 'MINOR' NOT NULL,
	`issue` text NOT NULL,
	`action` text DEFAULT '' NOT NULL,
	`reviewer` text DEFAULT 'User' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`shot_id`) REFERENCES `shots`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`asset_version_id`) REFERENCES `asset_versions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`video_output_id`) REFERENCES `video_outputs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `qc_reviews_project_idx` ON `qc_reviews` (`project_id`);
--> statement-breakpoint
CREATE INDEX `qc_reviews_content_idx` ON `qc_reviews` (`content_item_id`);
--> statement-breakpoint
CREATE INDEX `qc_reviews_shot_idx` ON `qc_reviews` (`shot_id`);
--> statement-breakpoint
CREATE INDEX `qc_reviews_status_idx` ON `qc_reviews` (`status`);
--> statement-breakpoint
CREATE INDEX `qc_reviews_severity_idx` ON `qc_reviews` (`severity`);
--> statement-breakpoint
CREATE TABLE `continuity_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`rule_type` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`severity` text DEFAULT 'MAJOR' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `continuity_rules_project_idx` ON `continuity_rules` (`project_id`);
--> statement-breakpoint
CREATE INDEX `continuity_rules_type_idx` ON `continuity_rules` (`rule_type`);
--> statement-breakpoint
CREATE TABLE `continuity_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`content_item_id` text NOT NULL,
	`scene_id` text,
	`shot_id` text NOT NULL,
	`reference_shot_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`severity` text DEFAULT 'MAJOR' NOT NULL,
	`finding` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`shot_id`) REFERENCES `shots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reference_shot_id`) REFERENCES `shots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rule_id`) REFERENCES `continuity_rules`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `continuity_checks_project_idx` ON `continuity_checks` (`project_id`);
--> statement-breakpoint
CREATE INDEX `continuity_checks_content_idx` ON `continuity_checks` (`content_item_id`);
--> statement-breakpoint
CREATE INDEX `continuity_checks_shot_idx` ON `continuity_checks` (`shot_id`);
--> statement-breakpoint
CREATE INDEX `continuity_checks_status_idx` ON `continuity_checks` (`status`);
--> statement-breakpoint
CREATE TABLE `qc_checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`category` text DEFAULT 'VISUAL' NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`default_severity` text DEFAULT 'MINOR' NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `qc_checklist_project_idx` ON `qc_checklist_items` (`project_id`);
--> statement-breakpoint
CREATE INDEX `qc_checklist_category_idx` ON `qc_checklist_items` (`category`);
