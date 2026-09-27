import { z } from "zod";
import { projectStatuses, priorities } from "@/lib/db/schema";

export const contentSchema = z.object({
  seasonId: z.preprocess((value) => value === "" || value === null ? null : value, z.string().trim().nullable()).default(null),
  code: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/, "Kode konten hanya boleh berisi huruf, angka, tanda hubung, atau garis bawah."),
  contentNumber: z.coerce.number().int().positive().max(99999),
  title: z.string().trim().min(1).max(160),
  contentType: z.string().trim().min(1).max(60),
  description: z.string().trim().max(4000).default(""),
  durationTarget: z.preprocess((value) => value === "" || value === null ? null : value, z.coerce.number().positive().max(86400).nullable()).default(null),
  status: z.enum(projectStatuses).default("NOT_STARTED"),
  priority: z.enum(priorities).default("NORMAL"),
});
export type ContentInput = z.infer<typeof contentSchema>;
