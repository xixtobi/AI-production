CREATE TABLE `ai_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`default_thinking_level` text DEFAULT 'MEDIUM' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_tasks_code_unique` ON `ai_tasks` (`code`);
--> statement-breakpoint
CREATE TABLE `ai_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`content_item_id` text,
	`scene_id` text,
	`shot_id` text,
	`task_id` text NOT NULL,
	`model` text NOT NULL,
	`thinking_level` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`input_tokens` integer,
	`output_tokens` integer,
	`estimated_cost` real,
	`error_message` text,
	`result_json` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shot_id`) REFERENCES `shots`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`task_id`) REFERENCES `ai_tasks`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `ai_requests_project_idx` ON `ai_requests` (`project_id`);
--> statement-breakpoint
CREATE INDEX `ai_requests_shot_idx` ON `ai_requests` (`shot_id`);
--> statement-breakpoint
CREATE INDEX `ai_requests_task_idx` ON `ai_requests` (`task_id`);
--> statement-breakpoint
CREATE INDEX `ai_requests_created_at_idx` ON `ai_requests` (`created_at`);