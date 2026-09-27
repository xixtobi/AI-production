import { NextResponse } from "next/server";
import { testGeminiConnection } from "@/lib/gemini/client";

export const runtime = "nodejs";

export async function POST() {
  const result = await testGeminiConnection();
  return NextResponse.json(result);
}
