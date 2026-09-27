import { NextResponse } from "next/server";
import { openGoogleFlowInBrowser, getGoogleFlowUrl } from "@/lib/flow";
import { DomainError } from "@/lib/projects/domain-error";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await openGoogleFlowInBrowser();
    return NextResponse.json({ ok: true, url: result.url });
  } catch (error) {
    // If opening host process fails, still return the URL so web frontend can open window
    const fallbackUrl = getGoogleFlowUrl();
    return NextResponse.json({
      ok: false,
      url: fallbackUrl,
      error: error instanceof DomainError ? error.message : "Tidak dapat membuka browser host secara otomatis.",
    });
  }
}
