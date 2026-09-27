import { NextResponse } from "next/server";
import { scanProject } from "@/lib/filesystem/scanner-service";
import { DomainError } from "@/lib/projects/domain-error";
export const runtime = "nodejs";
export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) { try { return NextResponse.json(await scanProject((await context.params).projectId)); } catch (error) { return NextResponse.json({ error: error instanceof DomainError ? error.message : "Pemindaian gagal." }, { status: 400 }); } }
