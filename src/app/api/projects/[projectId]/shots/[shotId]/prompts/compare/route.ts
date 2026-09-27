import { NextResponse } from "next/server";
import { comparePromptVersions } from "@/lib/prompts/prompt-service";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const versionA = url.searchParams.get("versionA");
    const versionB = url.searchParams.get("versionB");

    if (!versionA || !versionB) {
      return NextResponse.json(
        { success: false, error: "Parameter 'versionA' dan 'versionB' diperlukan untuk komparasi." },
        { status: 400 }
      );
    }

    const comparison = comparePromptVersions(versionA, versionB);
    return NextResponse.json({
      success: true,
      comparison,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = (error as Error)?.message || "Gagal membandingkan versi prompt.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
