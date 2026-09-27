import { NextResponse } from "next/server";
import { validateBackup } from "@/lib/backup";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.backupPath) {
      return NextResponse.json({ error: "backupPath diperlukan" }, { status: 400 });
    }

    const validation = validateBackup(body.backupPath);
    return NextResponse.json(validation);
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
