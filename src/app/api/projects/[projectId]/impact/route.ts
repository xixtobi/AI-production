import { NextResponse } from "next/server";
import {
  detectAssetChangeImpact,
  detectPromptChangeImpact,
  detectScriptChangeImpact,
} from "@/lib/qc";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  if (type === "script") {
    const contentItemId = url.searchParams.get("contentItemId");
    if (!contentItemId) {
      return NextResponse.json({ error: "contentItemId wajib disertakan." }, { status: 400 });
    }
    const impacts = detectScriptChangeImpact(projectId, contentItemId);
    return NextResponse.json({ impacts });
  }

  if (type === "asset") {
    const assetCode = url.searchParams.get("assetCode") || url.searchParams.get("assetId");
    if (!assetCode) {
      return NextResponse.json({ error: "assetCode atau assetId wajib disertakan." }, { status: 400 });
    }
    const impact = detectAssetChangeImpact(projectId, assetCode);
    return NextResponse.json({ impact });
  }

  if (type === "prompt") {
    const promptVersionId = url.searchParams.get("promptVersionId");
    if (!promptVersionId) {
      return NextResponse.json({ error: "promptVersionId wajib disertakan." }, { status: 400 });
    }
    const impact = detectPromptChangeImpact(projectId, promptVersionId);
    return NextResponse.json({ impact });
  }

  return NextResponse.json({ error: "Parameter type harus salah satu dari: script, asset, prompt." }, { status: 400 });
}
