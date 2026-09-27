import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getProject } from "@/lib/projects/service";
import { getShotDetail } from "@/lib/shots/service";
import { getPromptForShot } from "@/lib/prompts/prompt-service";
import { listPromptTemplates } from "@/lib/prompts/template-service";
import { buildShotContext } from "@/lib/gemini/context-builder";
import { PromptStudioWorkspace } from "@/components/prompt-studio-workspace";

export const runtime = "nodejs";

export default async function PromptStudioPage({
  params,
}: {
  params: Promise<{ projectId: string; shotId: string }>;
}) {
  const { projectId, shotId } = await params;
  const project = getProject(projectId);
  const shotDetail = getShotDetail(projectId, shotId);

  if (!project || !shotDetail) {
    notFound();
  }

  const promptData = getPromptForShot(projectId, shotId);
  const templates = listPromptTemplates();

  let contextData;
  try {
    contextData = buildShotContext(projectId, shotId);
  } catch {
    contextData = null;
  }

  return (
    <AppShell active="Proyek" projectId={projectId} projectSection="Shot">
      <div className="breadcrumb shot-breadcrumb">
        <Link href={`/projects/${projectId}`}>Proyek</Link>
        <b>/</b>
        <Link href={`/projects/${projectId}/content/${shotDetail.content.id}`}>
          {shotDetail.content.code}
        </Link>
        {shotDetail.scene && (
          <>
            <b>/</b>
            <span>{shotDetail.scene.code}</span>
          </>
        )}
        <b>/</b>
        <Link href={`/projects/${projectId}/shots/${shotId}`}>
          {shotDetail.shot.shotCode}
        </Link>
        <b>/</b>
        <strong>Prompt Studio</strong>
      </div>

      <div className="shot-page-head" style={{ marginBottom: "14px" }}>
        <div>
          <span className="shot-id">{shotDetail.shot.shotCode}</span>
          <h1 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            Prompt Studio
            <span style={{ fontSize: "14px", fontWeight: "normal", color: "#6e7e73" }}>
              — {shotDetail.shot.title}
            </span>
          </h1>
          <div className="shot-meta">
            <span className="subheading">
              {project.name} ({project.code}) · {shotDetail.content.code}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <Link className="button button-secondary" href={`/projects/${projectId}/shots/${shotId}`}>
            ← Kembali ke Detail Shot
          </Link>
        </div>
      </div>

      <PromptStudioWorkspace
        projectId={projectId}
        shotId={shotId}
        initialDocument={promptData.document}
        initialVersions={promptData.versions}
        shotContext={contextData}
        templates={templates}
      />
    </AppShell>
  );
}
