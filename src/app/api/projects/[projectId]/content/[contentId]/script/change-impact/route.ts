import { NextResponse } from "next/server";
import { compareScriptVersions } from "@/lib/script/change-impact-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const baseVersionId = url.searchParams.get("baseVersionId");
  const targetVersionId = url.searchParams.get("targetVersionId");

  if (!baseVersionId || !targetVersionId) {
    return NextResponse.json(
      { success: false, error: "baseVersionId dan targetVersionId wajib disertakan pada query params." },
      { status: 400 }
    );
  }

  try {
    const report = compareScriptVersions(baseVersionId, targetVersionId);
    return NextResponse.json({ success: true, impact: report });
  } catch (error) {
    const message = (error as Error)?.message || "Gagal membandingkan versi skrip.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
