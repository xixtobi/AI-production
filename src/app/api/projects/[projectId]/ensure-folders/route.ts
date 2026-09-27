import { NextResponse } from "next/server";
import { ensureProjectFolders } from "@/lib/filesystem/directory-service";
import { DomainError } from "@/lib/projects/domain-error";
export const runtime = "nodejs";
export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) { try { return NextResponse.json(await ensureProjectFolders((await context.params).projectId)); } catch (error) { return NextResponse.json({ error: error instanceof DomainError ? error.message : "Folder gagal disiapkan." }, { status: 400 }); } }
