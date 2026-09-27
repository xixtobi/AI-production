"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createProjectSchema } from "@/lib/projects/validation";
import { createProject } from "@/lib/projects/service";
import { seasonSchema } from "@/lib/seasons/validation";
import { createSeason, updateSeason } from "@/lib/seasons/service";
import { contentSchema } from "@/lib/content/validation";
import { createContent, updateContent } from "@/lib/content/service";
import { sceneSchema } from "@/lib/scenes/validation";
import { createScene, deleteScene, updateScene } from "@/lib/scenes/service";
import { shotCreateSchema, shotUpdateSchema } from "@/lib/shots/validation";
import { createShot, updateShot } from "@/lib/shots/service";
import { DomainError } from "@/lib/projects/domain-error";
import { ensureProjectFolders } from "@/lib/filesystem/directory-service";
import { getDefaultProjectRoot } from "@/lib/projects/default-root";

export type ProjectFormState = { error?: string };

export type FormState = { error?: string };

function readId(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function validationError(error: { issues: { message: string }[] }) {
  return { error: error.issues[0]?.message ?? "Periksa kembali data yang dimasukkan." };
}

function serviceError(error: unknown) {
  return { error: error instanceof DomainError ? error.message : "Data belum dapat disimpan. Coba lagi." };
}

export async function createSeasonAction(_state: FormState, formData: FormData): Promise<FormState> {
  const projectId = readId(formData, "projectId");
  const parsed = seasonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  try { createSeason(projectId, parsed.data); }
  catch (error) { return serviceError(error); }
  revalidatePath(`/projects/${projectId}/content`);
  return {};
}

export async function updateSeasonAction(_state: FormState, formData: FormData): Promise<FormState> {
  const projectId = readId(formData, "projectId");
  const seasonId = readId(formData, "seasonId");
  const parsed = seasonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  try { updateSeason(projectId, seasonId, parsed.data); }
  catch (error) { return serviceError(error); }
  revalidatePath(`/projects/${projectId}/content`);
  return {};
}

export async function createContentAction(_state: FormState, formData: FormData): Promise<FormState> {
  const projectId = readId(formData, "projectId");
  const parsed = contentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  let contentId: string;
  try { contentId = createContent(projectId, parsed.data).id; }
  catch (error) { return serviceError(error); }
  redirect(`/projects/${projectId}/content/${contentId}`);
}

export async function updateContentAction(_state: FormState, formData: FormData): Promise<FormState> {
  const projectId = readId(formData, "projectId");
  const contentId = readId(formData, "contentId");
  const parsed = contentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  try { updateContent(projectId, contentId, parsed.data); }
  catch (error) { return serviceError(error); }
  revalidatePath(`/projects/${projectId}/content/${contentId}`);
  revalidatePath(`/projects/${projectId}/content`);
  return {};
}

export async function createSceneAction(_state: FormState, formData: FormData): Promise<FormState> {
  const projectId = readId(formData, "projectId");
  const contentId = readId(formData, "contentId");
  const parsed = sceneSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  try { createScene(projectId, contentId, parsed.data); }
  catch (error) { return serviceError(error); }
  revalidatePath(`/projects/${projectId}/content/${contentId}`);
  return {};
}

export async function updateSceneAction(_state: FormState, formData: FormData): Promise<FormState> {
  const projectId = readId(formData, "projectId");
  const contentId = readId(formData, "contentId");
  const sceneId = readId(formData, "sceneId");
  const parsed = sceneSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  try { updateScene(projectId, contentId, sceneId, parsed.data); }
  catch (error) { return serviceError(error); }
  revalidatePath(`/projects/${projectId}/content/${contentId}`);
  revalidatePath(`/projects/${projectId}/shots`);
  return {};
}

export async function deleteSceneAction(_state: FormState, formData: FormData): Promise<FormState> {
  const projectId = readId(formData, "projectId");
  const contentId = readId(formData, "contentId");
  const sceneId = readId(formData, "sceneId");
  const confirmWithShots = formData.get("confirmWithShots") === "on";
  try { deleteScene(projectId, contentId, sceneId, confirmWithShots); }
  catch (error) { return serviceError(error); }
  revalidatePath(`/projects/${projectId}/content/${contentId}`);
  revalidatePath(`/projects/${projectId}/shots`);
  return {};
}

export async function createShotAction(_state: FormState, formData: FormData): Promise<FormState> {
  const projectId = readId(formData, "projectId");
  const parsed = shotCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  let shotId: string;
  try { shotId = createShot(projectId, parsed.data).id; }
  catch (error) { return serviceError(error); }
  redirect(`/projects/${projectId}/shots/${shotId}`);
}

export async function updateShotAction(_state: FormState, formData: FormData): Promise<FormState> {
  const projectId = readId(formData, "projectId");
  const shotId = readId(formData, "shotId");
  const parsed = shotUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  try { updateShot(projectId, shotId, parsed.data); }
  catch (error) { return serviceError(error); }
  revalidatePath(`/projects/${projectId}/shots/${shotId}`);
  revalidatePath(`/projects/${projectId}/shots`);
  return {};
}

export async function createProjectAction(_previousState: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  const code = formData.get("code");
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    code,
    projectType: formData.get("projectType"),
    description: formData.get("description") ?? "",
    rootPath: getDefaultProjectRoot(typeof code === "string" ? code : ""),
    defaultAspectRatio: formData.get("defaultAspectRatio") ?? "16:9",
    defaultLanguage: formData.get("defaultLanguage") ?? "Indonesian",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Periksa kembali data proyek." };
  }

  let projectId: string;
  try {
    const project = createProject(parsed.data);
    projectId = project.id;
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return { error: "Kode proyek sudah digunakan. Pilih kode lain." };
    }
    return { error: "Proyek belum dapat disimpan. Periksa folder data aplikasi." };
  }

  try { await ensureProjectFolders(projectId); }
  catch (error) { redirect(`/projects/${projectId}?folders=error&message=${encodeURIComponent(error instanceof DomainError ? error.message : "Folder belum dapat disiapkan.")}`); }

  redirect(`/projects/${projectId}`);
}
