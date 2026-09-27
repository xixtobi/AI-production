import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { AppShell } from "@/components/app-shell";
import { evaluateContentFinalReadiness } from "@/lib/qc";
import { FinalReviewWorkspace } from "@/components/final-review-workspace";

export const dynamic = "force-dynamic";

interface FinalReviewPageProps {
  params: Promise<{ projectId: string; contentId: string }>;
}

export default async function FinalReviewPage({ params }: FinalReviewPageProps) {
  ensureDatabaseReady();
  const { projectId, contentId } = await params;

  const project = db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .get();

  if (!project) notFound();

  const content = db
    .select()
    .from(schema.contentItems)
    .where(and(eq(schema.contentItems.id, contentId), eq(schema.contentItems.projectId, projectId)))
    .get();

  if (!content) notFound();

  const evaluation = evaluateContentFinalReadiness(projectId, contentId);

  return (
    <AppShell
      projectId={project.id}
      projectName={project.name}
      projectSection="Konten"
    >
      <FinalReviewWorkspace
        projectId={project.id}
        projectName={project.name}
        initialEvaluation={evaluation}
      />
    </AppShell>
  );
}
