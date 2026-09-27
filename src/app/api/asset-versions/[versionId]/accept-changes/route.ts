import { NextResponse } from "next/server";
import { getVersion, registerAssetVersion } from "@/lib/assets/service";
import { DomainError } from "@/lib/projects/domain-error";
export const runtime = "nodejs";
export async function POST(_request: Request, context: { params: Promise<{ versionId: string }> }) { const row = getVersion((await context.params).versionId); if (!row) return NextResponse.json({ error:"Versi tidak ditemukan." },{status:404}); try { return NextResponse.json(await registerAssetVersion(row.asset.id,row.version.relativePath,"Diterima dari perubahan file eksternal."),{status:201}); } catch(error) { return NextResponse.json({error:error instanceof DomainError?error.message:"Versi baru gagal didaftarkan."},{status:400}); } }
