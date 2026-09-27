import { NextResponse } from "next/server";
import { readSystemLogs } from "@/lib/system";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lines = url.searchParams.get("lines") ? parseInt(url.searchParams.get("lines")!, 10) : 100;
  const type = (url.searchParams.get("type") as "combined" | "error") || "combined";

  const logs = readSystemLogs(lines, type);

  return NextResponse.json({ logs });
}
