import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getProject } from "@/lib/projects/service";
import { getContent } from "@/lib/content/service";
import { listScenes } from "@/lib/scenes/service";
import { listShots } from "@/lib/shots/service";
import {
  getOrCreateScriptDocument,
  listStoryDocuments,
  listCharacters,
  listEnvironments,
  getOrCreateStoryBible,
  getOrCreateStyleBible,
} from "@/lib/script";
import { ScriptStudioView } from "@/components/script/script-studio-view";

export default async function ScriptStudioPage({
  params,
}: {
  params: Promise<{ projectId: string; contentId: string }>;
}) {
  const { projectId, contentId } = await params;
  const project = getProject(projectId);
  const content = getContent(projectId, contentId);

  if (!project || !content) notFound();

  // Load initial Script Studio data
  const scriptDetail = getOrCreateScriptDocument(projectId, contentId);
  const storyDocs = listStoryDocuments(projectId, contentId);
  const characters = listCharacters(projectId);
  const environments = listEnvironments(projectId);
  const storyBible = getOrCreateStoryBible(projectId);
  const styleBible = getOrCreateStyleBible(projectId);

  // Production scenes and shots for linkage
  const rawScenes = listScenes(projectId, contentId);
  const prodScenes = rawScenes.map(({ scene }) => ({
    id: scene.id,
    code: scene.code,
    sceneNumber: scene.sceneNumber,
    title: scene.title,
  }));

  const rawShots = listShots(projectId).filter(({ shot }) => shot.contentItemId === contentId);
  const prodShots = rawShots.map(({ shot }) => ({
    id: shot.id,
    shotCode: shot.shotCode,
    shotNumber: shot.shotNumber,
    title: shot.title,
    sceneId: shot.sceneId,
  }));

  return (
    <AppShell active="Proyek" projectId={projectId} projectSection="Konten">
      <ScriptStudioView
        projectId={projectId}
        contentItemId={contentId}
        projectCode={project.code}
        projectName={project.name}
        contentTitle={content.item.title}
        initialScript={scriptDetail}
        initialStoryDocs={storyDocs}
        initialCharacters={characters}
        initialEnvironments={environments}
        initialStoryBible={storyBible}
        initialStyleBible={styleBible}
        prodScenes={prodScenes}
        prodShots={prodShots}
      />
    </AppShell>
  );
}
