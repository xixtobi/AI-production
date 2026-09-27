import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { getVersion } from "@/lib/assets/service";
import { resolveExistingProjectFile } from "@/lib/filesystem/path-service";
import { imageExtensions } from "@/lib/filesystem/config";
import { sha256File } from "@/lib/filesystem/metadata-service";
export const runtime="nodejs";
export async function GET(_request:Request,context:{params:Promise<{versionId:string}>}) { const row=getVersion((await context.params).versionId);if(!row)return new NextResponse("Versi tidak ditemukan.",{status:404});const ext=path.extname(row.version.filename).toLowerCase();if(!imageExtensions.has(ext))return new NextResponse("Thumbnail tidak didukung.",{status:415});try{const file=await resolveExistingProjectFile(row.project.rootPath,row.version.relativePath);if(await sha256File(file.absolutePath)!==row.version.sha256)return new NextResponse("File berubah sejak versi ini didaftarkan.",{status:409});const cacheRoot=path.join(process.env.PRODUCTION_CONTROL_DATA_DIR?path.resolve(process.env.PRODUCTION_CONTROL_DATA_DIR):path.join(process.cwd(),".local-production-control"),".cache","thumbs");await mkdir(cacheRoot,{recursive:true});const target=path.join(cacheRoot,`${row.version.id}-${row.version.sha256}.webp`);let data:Buffer;try{data=await readFile(target);}catch{data=await sharp(file.absolutePath,{limitInputPixels:100_000_000}).resize(600,600,{fit:"inside",withoutEnlargement:true}).webp({quality:80}).toBuffer();await writeFile(target,data,{flag:"wx"}).catch(()=>undefined);}return new NextResponse(new Uint8Array(data),{headers:{"Content-Type":"image/webp","Cache-Control":"private, max-age=3600","X-Content-Type-Options":"nosniff"}});}catch{return new NextResponse("Thumbnail gagal dibuat.",{status:404});}}
