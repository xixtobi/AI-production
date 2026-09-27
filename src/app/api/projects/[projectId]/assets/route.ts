import { NextResponse } from "next/server";
import { z } from "zod";
import { assetTypes } from "@/lib/db/schema";
import { listAssets, registerAsset } from "@/lib/assets/service";
import { DomainError } from "@/lib/projects/domain-error";
const schema = z.object({ assetCode: z.string().trim().min(1).max(40), assetType: z.enum(assetTypes), name: z.string().trim().min(1).max(160), description: z.string().max(2000).optional(), relativePath: z.string().min(1), notes: z.string().max(2000).optional() });
export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) { const { projectId } = await context.params; try { return NextResponse.json({ assets: listAssets(projectId) }); } catch (error) { return NextResponse.json({ error: error instanceof DomainError ? error.message : "Gagal mengambil aset." }, { status: 400 }); } }
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) { const { projectId } = await context.params; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Data aset tidak valid." }, { status: 400 }); try { const result = await registerAsset({ ...parsed.data, projectId }); return NextResponse.json(result, { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof DomainError ? error.message : "Aset gagal didaftarkan." }, { status: 400 }); } }
