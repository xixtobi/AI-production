import { NextResponse } from "next/server";
import { reorderScenes } from "@/lib/script/script-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { versionId, orderedSceneIds } = body;
    if (!versionId || !Array.isArray(orderedSceneIds)) {
      return NextResponse.json({ success: false, error: "versionId dan orderedSceneIds wajib disertakan." }, { status: 400 });
    }

    reorderScenes(versionId, orderedSceneIds);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal mengubah urutan adegan.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
