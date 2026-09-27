import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ContentForm } from "@/components/content-forms";
import { getProject } from "@/lib/projects/service";
import { getContent } from "@/lib/content/service";
import { listSeasons } from "@/lib/seasons/service";

export default async function EditContentPage({ params }: { params: Promise<{projectId:string;contentId:string}> }) {
  const {projectId,contentId}=await params;
  const project=getProject(projectId);
  const content=getContent(projectId,contentId);
  if(!project||!content) notFound();
  const items=listSeasons(projectId);
  return <AppShell active="Proyek" projectId={projectId} projectSection="Konten"><div className="page-heading"><Link className="back-link" href={`/projects/${projectId}/content/${contentId}`}>← Kembali ke detail</Link><p className="eyebrow">{content.item.code}</p><h1>Edit konten</h1></div><ContentForm project={project} seasons={items} initial={content.item} nextNumber={content.item.contentNumber}/></AppShell>;
}
