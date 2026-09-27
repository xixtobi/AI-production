import { NextResponse } from "next/server";
import { addScene } from "@/lib/script/script-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const versionId = body.versionId;
    if (!versionId) {
      return NextResponse.json({ success: false, error: "versionId wajib disertakan." }, { status: 400 });
    }

    const scene = addScene(versionId, {
      sceneNumber: body.sceneNumber,
      sceneCode: body.sceneCode,
      heading: body.heading || "SCENE BARU",
      location: body.location,
      timeOfDay: body.timeOfDay,
      description: body.description,
      sortOrder: body.sortOrder,
      linkedSceneId: body.linkedSceneId,
      blocks: body.blocks,
    });

    return NextResponse.json({ success: true, scene }, { status: 201 });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal menambahkan adegan.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
