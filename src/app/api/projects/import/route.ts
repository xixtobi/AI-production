import { NextResponse } from "next/server";
import { importProject } from "@/lib/export-import";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.exportPath || !body.destinationRootPath) {
      return NextResponse.json(
        { error: "exportPath dan destinationRootPath wajib diisi." },
        { status: 400 }
      );
    }

    const result = await importProject({
      exportPath: body.exportPath,
      destinationRootPath: body.destinationRootPath,
      newProjectCode: body.newProjectCode,
      newProjectName: body.newProjectName,
      conflictResolution: body.conflictResolution,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
