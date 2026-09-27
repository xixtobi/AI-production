import { redirect } from "next/navigation";

export const runtime = "nodejs";

export default async function ContentShotPromptPage({
  params,
}: {
  params: Promise<{ projectId: string; contentId: string; shotId: string }>;
}) {
  const { projectId, shotId } = await params;
  redirect(`/projects/${projectId}/shots/${shotId}/prompts`);
}
