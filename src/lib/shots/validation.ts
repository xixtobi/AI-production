import { z } from "zod";
import { projectStatuses, priorities } from "@/lib/db/schema";

const durationField = z.preprocess((value) => value === "" || value === null ? null : value, z.coerce.number().positive().max(86400).nullable());

export const shotCreateSchema = z.object({
  contentItemId: z.string().uuid(),
  sceneId: z.preprocess((value) => value === "" || value === null ? null : value, z.string().uuid().nullable()).default(null),
  shotCode: z.string().trim().min(1).max(32).regex(/^SH\d{3,5}$/i, "Gunakan format SH001.").transform((value) => value.toUpperCase()),
  shotNumber: z.coerce.number().int().positive().max(99999),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).default(""),
  durationTarget: durationField.default(null),
  cameraType: z.string().trim().max(160).default(""),
  action: z.string().trim().max(4000).default(""),
  dialogue: z.string().trim().max(4000).default(""),
  notes: z.string().trim().max(4000).default(""),
  status: z.enum(projectStatuses).default("NOT_STARTED"),
  priority: z.enum(priorities).default("NORMAL"),
});

export const shotUpdateSchema = shotCreateSchema.omit({ contentItemId: true, sceneId: true, shotCode: true, shotNumber: true });
export type ShotCreateInput = z.infer<typeof shotCreateSchema>;
export type ShotUpdateInput = z.infer<typeof shotUpdateSchema>;
