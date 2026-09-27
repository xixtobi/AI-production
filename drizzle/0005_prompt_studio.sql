CREATE TABLE `prompt_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`content_item_id` text,
	`scene_id` text,
	`shot_id` text,
	`prompt_type` text DEFAULT 'VIDEO' NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shot_id`) REFERENCES `shots`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `prompt_docs_project_idx` ON `prompt_documents` (`project_id`);
--> statement-breakpoint
CREATE INDEX `prompt_docs_shot_idx` ON `prompt_documents` (`shot_id`);
--> statement-breakpoint
CREATE INDEX `prompt_docs_content_idx` ON `prompt_documents` (`content_item_id`);
--> statement-breakpoint
CREATE TABLE `prompt_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt_document_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`version_label` text NOT NULL,
	`prompt_text` text NOT NULL,
	`negative_prompt` text,
	`parameters_json` text,
	`source` text DEFAULT 'MANUAL' NOT NULL,
	`is_current` integer DEFAULT true NOT NULL,
	`is_locked` integer DEFAULT false NOT NULL,
	`local_file_path` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`prompt_document_id`) REFERENCES `prompt_documents`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `prompt_versions_doc_idx` ON `prompt_versions` (`prompt_document_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_versions_doc_num_unique` ON `prompt_versions` (`prompt_document_id`,`version_number`);
--> statement-breakpoint
CREATE TABLE `prompt_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`prompt_type` text DEFAULT 'VIDEO' NOT NULL,
	`template_text` text NOT NULL,
	`negative_prompt` text DEFAULT '',
	`default_parameters_json` text,
	`is_system` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_templates_code_unique` ON `prompt_templates` (`code`);
--> statement-breakpoint
CREATE TABLE `flow_queue_items` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`content_item_id` text,
	`shot_id` text NOT NULL,
	`prompt_version_id` text NOT NULL,
	`engine` text DEFAULT 'VEO' NOT NULL,
	`status` text DEFAULT 'STAGED' NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`shot_id`) REFERENCES `shots`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`prompt_version_id`) REFERENCES `prompt_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `flow_queue_project_idx` ON `flow_queue_items` (`project_id`);
--> statement-breakpoint
CREATE INDEX `flow_queue_shot_idx` ON `flow_queue_items` (`shot_id`);
--> statement-breakpoint
CREATE INDEX `flow_queue_prompt_ver_idx` ON `flow_queue_items` (`prompt_version_id`);
