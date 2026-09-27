import { NextResponse } from "next/server";
import { z } from "zod";
import { shotAssetRoles } from "@/lib/db/schema";
import { linkAssetToShot, listShotAssets } from "@/lib/assets/service";
import { db, ensureDatabaseReady } from "@/lib/db";
import { shotAssets } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
const input=z.object({assetId:z.string().uuid(),role:z.enum(shotAssetRoles)});
export async function GET(_request:Request,context:{params:Promise<{shotId:string}>}) { return NextResponse.json({assets:listShotAssets((await context.params).shotId)}); }
export async function POST(request:Request,context:{params:Promise<{projectId:string;shotId:string}>}) { const parsed=input.safeParse(await request.json().catch(()=>null)); if(!parsed.success)return NextResponse.json({error:"Pilih aset dan peran yang valid."},{status:400}); try {const p=await context.params;linkAssetToShot(p.projectId,p.shotId,parsed.data.assetId,parsed.data.role);return NextResponse.json({ok:true},{status:201});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Aset gagal ditautkan."},{status:400});} }
export async function DELETE(request:Request,context:{params:Promise<{projectId:string;shotId:string}>}) {ensureDatabaseReady();const {projectId,shotId}=await context.params;const assetId=new URL(request.url).searchParams.get("assetId");if(!assetId)return NextResponse.json({error:"ID aset tidak valid."},{status:400});db.delete(shotAssets).where(and(eq(shotAssets.projectId,projectId),eq(shotAssets.shotId,shotId),eq(shotAssets.assetId,assetId))).run();return NextResponse.json({ok:true});}
