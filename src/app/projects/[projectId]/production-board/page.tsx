import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { AppShell } from "@/components/app-shell";
import { ProductionBoardWorkspace } from "@/components/production-board-workspace";

export const dynamic = "force-dynamic";

interface ProductionBoardPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProductionBoardPage({ params }: ProductionBoardPageProps) {
  ensureDatabaseReady();
  const { projectId } = await params;

  const project = db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .get();

  if (!project) notFound();

  const contents = db
    .select()
    .from(schema.contentItems)
    .where(eq(schema.contentItems.projectId, projectId))
    .all();

  const allShots = db
    .select()
    .from(schema.shots)
    .where(eq(schema.shots.projectId, projectId))
    .all();

  const allVideos = db
    .select()
    .from(schema.videoOutputs)
    .where(eq(schema.videoOutputs.projectId, projectId))
    .orderBy(desc(schema.videoOutputs.versionNumber))
    .all();

  const allQc = db
    .select()
    .from(schema.qcReviews)
    .where(eq(schema.qcReviews.projectId, projectId))
    .all();

  const shotCards = allShots.map((shot) => {
    const content = contents.find((c) => c.id === shot.contentItemId);
    const shotVideos = allVideos.filter((v) => v.shotId === shot.id);
    const openQc = allQc.filter(
      (q) => q.shotId === shot.id && (q.status === "OPEN" || q.status === "IN_REVIEW")
    );
    const hasCriticalOrMajor = openQc.some((q) => q.severity === "CRITICAL" || q.severity === "MAJOR");

    return {
      shot,
      contentCode: content?.code || "EP01",
      latestVideo: shotVideos[0],
      openQcCount: openQc.length,
      hasCriticalOrMajorQc: hasCriticalOrMajor,
    };
  });

  return (
    <AppShell
      projectId={project.id}
      projectName={project.name}
      projectSection="Production Board"
    >
      <ProductionBoardWorkspace
        projectId={project.id}
        projectName={project.name}
        shots={shotCards}
        contents={contents}
      />
    </AppShell>
  );
}
