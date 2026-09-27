import { NextResponse } from "next/server";
import { getAsset, getAssetVersions } from "@/lib/assets/service";
export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) { const { assetId } = await context.params; const asset = getAsset(assetId); return asset ? NextResponse.json({ asset, versions: getAssetVersions(assetId) }) : NextResponse.json({ error: "Aset tidak ditemukan." }, { status: 404 }); }
