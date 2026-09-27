import { NextResponse } from "next/server";
import { getSystemSettings, updateSystemSettings } from "@/lib/system";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function GET() {
  const settings = getSystemSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const updated = updateSystemSettings(body);
    return NextResponse.json({ settings: updated });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
