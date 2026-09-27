import { z } from "zod";
import { projectTypes } from "@/lib/db/schema";

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Nama proyek minimal 2 karakter.").max(120, "Nama proyek maksimal 120 karakter."),
  code: z.string().trim().min(2, "Kode proyek minimal 2 karakter.").max(32, "Kode proyek maksimal 32 karakter.").regex(/^[A-Za-z0-9_-]+$/, "Gunakan huruf, angka, tanda hubung, atau garis bawah."),
  projectType: z.enum(projectTypes),
  description: z.string().trim().max(1000, "Deskripsi maksimal 1000 karakter.").default(""),
  rootPath: z.string().trim().min(1, "Folder root proyek wajib diisi.").max(500, "Path terlalu panjang.").refine((value) => /^(?:[A-Za-z]:[\\/]|\\\\[^\\]+\\[^\\]+|\/)/.test(value), "Folder root harus berupa path absolut."),
  defaultAspectRatio: z.string().trim().min(1).max(20).default("16:9"),
  defaultLanguage: z.string().trim().min(1).max(60).default("Indonesian"),
});
