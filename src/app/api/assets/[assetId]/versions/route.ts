import { NextResponse } from "next/server";
import { z } from "zod";
import { getAssetVersions, registerAssetVersion } from "@/lib/assets/service";
import { DomainError } from "@/lib/projects/domain-error";
const schema = z.object({ relativePath: z.string().min(1), notes: z.string().max(2000).optional() });
export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) { return NextResponse.json({ versions: getAssetVersions((await context.params).assetId) }); }
export async function POST(request: Request, context: { params: Promise<{ assetId: string }> }) { const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Path versi tidak valid." }, { status: 400 }); try { return NextResponse.json(await registerAssetVersion((await context.params).assetId, parsed.data.relativePath, parsed.data.notes), { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof DomainError ? error.message : "Versi gagal didaftarkan." }, { status: 400 }); } }
