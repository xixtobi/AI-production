import { ProjectBackupWorkspace } from "@/components/project-backup-workspace";

export const dynamic = "force-dynamic";

export default async function ProjectBackupsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectBackupWorkspace projectId={projectId} />;
}
