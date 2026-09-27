ALTER TABLE `flow_queue_items` ADD COLUMN `scene_id` text REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE `flow_queue_items` ADD COLUMN `model` text DEFAULT 'Veo 3.1 Fast' NOT NULL;
--> statement-breakpoint
ALTER TABLE `flow_queue_items` ADD COLUMN `duration_seconds` real DEFAULT 5 NOT NULL;
--> statement-breakpoint
ALTER TABLE `flow_queue_items` ADD COLUMN `aspect_ratio` text DEFAULT '16:9' NOT NULL;
--> statement-breakpoint
ALTER TABLE `flow_queue_items` ADD COLUMN `resolution` text DEFAULT '1080p' NOT NULL;
--> statement-breakpoint
ALTER TABLE `flow_queue_items` ADD COLUMN `audio_enabled` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `flow_queue_items` ADD COLUMN `start_frame_asset_version_id` text REFERENCES `asset_versions`(`id`) ON UPDATE no action ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE `flow_queue_items` ADD COLUMN `end_frame_asset_version_id` text REFERENCES `asset_versions`(`id`) ON UPDATE no action ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE `flow_queue_items` ADD COLUMN `recipe_snapshot_json` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE `flow_queue_items` ADD COLUMN `notes` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `flow_queue_items` ADD COLUMN `estimated_credits` real;
--> statement-breakpoint
CREATE INDEX `flow_queue_status_idx` ON `flow_queue_items` (`status`);
--> statement-breakpoint
CREATE TABLE `flow_queue_references` (
	`id` text PRIMARY KEY NOT NULL,
	`flow_queue_item_id` text NOT NULL,
	`asset_version_id` text NOT NULL,
	`role` text DEFAULT 'OTHER' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`flow_queue_item_id`) REFERENCES `flow_queue_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_version_id`) REFERENCES `asset_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `flow_queue_ref_item_idx` ON `flow_queue_references` (`flow_queue_item_id`);
--> statement-breakpoint
CREATE INDEX `flow_queue_ref_asset_idx` ON `flow_queue_references` (`asset_version_id`);
--> statement-breakpoint
CREATE TABLE `generation_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`flow_queue_item_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`model` text NOT NULL,
	`prompt_version_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`status` text DEFAULT 'STARTED' NOT NULL,
	`output_video_id` text,
	`failure_reason` text,
	`notes` text,
	FOREIGN KEY (`flow_queue_item_id`) REFERENCES `flow_queue_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prompt_version_id`) REFERENCES `prompt_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `gen_attempts_item_idx` ON `generation_attempts` (`flow_queue_item_id`);
--> statement-breakpoint
CREATE INDEX `gen_attempts_prompt_idx` ON `generation_attempts` (`prompt_version_id`);
--> statement-breakpoint
CREATE TABLE `video_outputs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`content_item_id` text NOT NULL,
	`scene_id` text,
	`shot_id` text NOT NULL,
	`flow_queue_item_id` text,
	`generation_attempt_id` text,
	`version_number` integer NOT NULL,
	`version_label` text NOT NULL,
	`file_path` text NOT NULL,
	`file_name` text NOT NULL,
	`file_size_bytes` integer NOT NULL,
	`duration_seconds` real,
	`resolution` text,
	`mime_type` text DEFAULT 'video/mp4' NOT NULL,
	`sha256` text NOT NULL,
	`model` text,
	`status` text DEFAULT 'APPROVED' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`credits_used` real,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shot_id`) REFERENCES `shots`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`flow_queue_item_id`) REFERENCES `flow_queue_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`generation_attempt_id`) REFERENCES `generation_attempts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `video_outputs_project_idx` ON `video_outputs` (`project_id`);
--> statement-breakpoint
CREATE INDEX `video_outputs_shot_idx` ON `video_outputs` (`shot_id`);
--> statement-breakpoint
CREATE INDEX `video_outputs_queue_idx` ON `video_outputs` (`flow_queue_item_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_outputs_shot_version_unique` ON `video_outputs` (`shot_id`, `version_number`);
