import { z } from "zod";
import { projectStatuses } from "@/lib/db/schema";

const durationField = z.preprocess((value) => value === "" || value === null ? null : value, z.coerce.number().positive().max(86400).nullable());

export const sceneSchema = z.object({
  code: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/),
  sceneNumber: z.coerce.number().int().positive().max(99999),
  title: z.string().trim().min(1).max(160),
  location: z.string().trim().max(160).default(""),
  description: z.string().trim().max(4000).default(""),
  durationTarget: durationField.default(null),
  status: z.enum(projectStatuses).default("NOT_STARTED"),
});
export type SceneInput = z.infer<typeof sceneSchema>;
