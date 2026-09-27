CREATE TABLE `content_items` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`season_id` text,
	`code` text NOT NULL,
	`content_number` integer NOT NULL,
	`title` text NOT NULL,
	`content_type` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`duration_target` real,
	`status` text DEFAULT 'NOT_STARTED' NOT NULL,
	`priority` text DEFAULT 'NORMAL' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`season_id`,`project_id`) REFERENCES `seasons`(`id`,`project_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_items_project_code_unique` ON `content_items` (`project_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `content_items_project_number_unique` ON `content_items` (`project_id`,`content_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `content_items_id_project_unique` ON `content_items` (`id`,`project_id`);--> statement-breakpoint
CREATE INDEX `content_items_project_idx` ON `content_items` (`project_id`);--> statement-breakpoint
CREATE INDEX `content_items_season_idx` ON `content_items` (`season_id`);--> statement-breakpoint
CREATE TABLE `scenes` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`content_item_id` text NOT NULL,
	`code` text NOT NULL,
	`scene_number` integer NOT NULL,
	`title` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`duration_target` real,
	`status` text DEFAULT 'NOT_STARTED' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`content_item_id`,`project_id`) REFERENCES `content_items`(`id`,`project_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scenes_id_content_unique` ON `scenes` (`id`,`content_item_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `scenes_content_code_unique` ON `scenes` (`content_item_id`,`code`);--> statement-breakpoint
CREATE INDEX `scenes_project_idx` ON `scenes` (`project_id`);--> statement-breakpoint
CREATE INDEX `scenes_content_idx` ON `scenes` (`content_item_id`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`code` text NOT NULL,
	`season_number` integer NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'NOT_STARTED' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seasons_project_code_unique` ON `seasons` (`project_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `seasons_project_number_unique` ON `seasons` (`project_id`,`season_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `seasons_id_project_unique` ON `seasons` (`id`,`project_id`);--> statement-breakpoint
CREATE INDEX `seasons_project_idx` ON `seasons` (`project_id`);--> statement-breakpoint
CREATE TABLE `shots` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`content_item_id` text NOT NULL,
	`scene_id` text,
	`shot_code` text NOT NULL,
	`shot_number` integer NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`duration_target` real,
	`camera_type` text DEFAULT '' NOT NULL,
	`action` text DEFAULT '' NOT NULL,
	`dialogue` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'NOT_STARTED' NOT NULL,
	`priority` text DEFAULT 'NORMAL' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`content_item_id`,`project_id`) REFERENCES `content_items`(`id`,`project_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`scene_id`,`content_item_id`) REFERENCES `scenes`(`id`,`content_item_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shots_content_code_unique` ON `shots` (`content_item_id`,`shot_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `shots_content_number_unique` ON `shots` (`content_item_id`,`shot_number`);--> statement-breakpoint
CREATE INDEX `shots_project_idx` ON `shots` (`project_id`);--> statement-breakpoint
CREATE INDEX `shots_content_idx` ON `shots` (`content_item_id`);--> statement-breakpoint
CREATE INDEX `shots_scene_idx` ON `shots` (`scene_id`);--> statement-breakpoint
CREATE INDEX `shots_code_idx` ON `shots` (`shot_code`);