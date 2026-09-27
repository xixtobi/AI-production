import { z } from "zod";
import { projectStatuses } from "@/lib/db/schema";

export const seasonSchema = z.object({
  code: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/, "Kode musim hanya boleh berisi huruf, angka, tanda hubung, atau garis bawah."),
  seasonNumber: z.coerce.number().int().positive().max(999),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(""),
  status: z.enum(projectStatuses).default("NOT_STARTED"),
});
export type SeasonInput = z.infer<typeof seasonSchema>;
