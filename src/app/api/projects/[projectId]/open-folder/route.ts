import { NextResponse } from "next/server";
import { getProject } from "@/lib/projects/service";
import { openProjectFolder } from "@/lib/filesystem/explorer-service";
import { DomainError } from "@/lib/projects/domain-error";
export const runtime = "nodejs";
export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) { const id = (await context.params).projectId; const project = getProject(id); if (!project) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 }); try { await openProjectFolder(id, project.rootPath); return NextResponse.json({ ok: true }); } catch (error) { return NextResponse.json({ error: error instanceof DomainError ? error.message : "Folder gagal dibuka." }, { status: 400 }); } }
