import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { FlowQueueWorkspace } from "@/components/flow-queue-workspace";
import { getProject } from "@/lib/projects/service";
import { listContent } from "@/lib/content/service";
import {
  getFlowQueueSummary,
  listAvailableFlowModels,
  listFlowQueueItems,
} from "@/lib/flow";

export const runtime = "nodejs";

export default async function FlowQueuePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) notFound();

  const contents = listContent(projectId).map(({ item }) => ({
    id: item.id,
    code: item.code,
    title: item.title,
  }));

  const items = listFlowQueueItems({ projectId });
  const availableModels = listAvailableFlowModels();
  const summary = getFlowQueueSummary(projectId);

  return (
    <AppShell active="Proyek" projectId={projectId} projectSection="Flow Queue">
      <div className="breadcrumb" style={{ marginBottom: "16px" }}>
        <Link href={`/projects/${projectId}`}>Proyek</Link>
        <b>/</b>
        <span>{project.name}</span>
        <b>/</b>
        <strong>Flow Queue</strong>
      </div>

      <div className="dashboard-heading" style={{ marginBottom: "20px" }}>
        <div>
          <p className="eyebrow">VIDEO PRODUCTION CONTROL</p>
          <h1>Google Flow Queue</h1>
          <p className="subheading">
            Kelola, siapkan paket job, lacak attempt generasi video, dan daftarkan output video lokal.
          </p>
        </div>
      </div>

      <FlowQueueWorkspace
        projectId={projectId}
        initialItems={items}
        availableModels={availableModels}
        contents={contents}
        summary={summary}
      />
    </AppShell>
  );
}
