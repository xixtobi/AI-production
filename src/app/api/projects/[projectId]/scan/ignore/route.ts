import { NextResponse } from "next/server";
import { z } from "zod";
import { ignoreScanResult } from "@/lib/filesystem/scanner-service";
const schema=z.object({relativePath:z.string().min(1),category:z.enum(["MISSING","CHANGED","DUPLICATE"]),ignoredSha256:z.string().nullable().optional()});
export async function POST(request:Request,context:{params:Promise<{projectId:string}>}) { const data=schema.safeParse(await request.json().catch(()=>null)); if(!data.success)return NextResponse.json({error:"Data pengabaian tidak valid."},{status:400}); try { ignoreScanResult((await context.params).projectId,data.data.relativePath,data.data.category,data.data.ignoredSha256??null); return NextResponse.json({ok:true}); } catch{return NextResponse.json({error:"Hasil scan gagal diabaikan."},{status:400});} }
