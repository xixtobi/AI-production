import { NextResponse } from "next/server";
import { z } from "zod";
import { useDefaultProjectRootPath as applyDefaultProjectRootPath } from "@/lib/projects/service";
import { DomainError } from "@/lib/projects/domain-error";
const input = z.object({ useDefaultRoot: z.literal(true) });
export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Permintaan folder default tidak valid." }, { status: 400 });
  try { const result = applyDefaultProjectRootPath((await context.params).projectId); return NextResponse.json({ rootPath: result.rootPath }); }
  catch (error) { return NextResponse.json({ error: error instanceof DomainError ? error.message : "Folder root gagal diperbarui." }, { status: 400 }); }
}

