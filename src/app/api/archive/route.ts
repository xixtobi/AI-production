import { NextResponse } from "next/server";
import {
  archiveProject,
  unarchiveProject,
  archiveContentItem,
  unarchiveContentItem,
  archiveAsset,
  unarchiveAsset,
} from "@/lib/archive";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, id, action } = body;

    if (!type || !id) {
      return NextResponse.json({ error: "type dan id diperlukan." }, { status: 400 });
    }

    let result: any;
    const isUnarchive = action === "UNARCHIVE";

    switch (type) {
      case "PROJECT":
        result = isUnarchive ? unarchiveProject(id) : archiveProject(id);
        break;
      case "CONTENT":
        result = isUnarchive ? unarchiveContentItem(id) : archiveContentItem(id);
        break;
      case "ASSET":
        result = isUnarchive ? unarchiveAsset(id) : archiveAsset(id);
        break;
      default:
        return NextResponse.json({ error: `Tipe tidak valid: ${type}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, item: result });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
