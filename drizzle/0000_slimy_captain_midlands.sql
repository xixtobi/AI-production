CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`project_type` text NOT NULL,
	`status` text DEFAULT 'NOT_STARTED' NOT NULL,
	`root_path` text NOT NULL,
	`default_aspect_ratio` text DEFAULT '16:9' NOT NULL,
	`default_language` text DEFAULT 'Indonesian' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_code_unique` ON `projects` (`code`);