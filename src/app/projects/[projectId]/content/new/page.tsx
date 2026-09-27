import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ContentForm } from "@/components/content-forms";
import { getProject } from "@/lib/projects/service";
import { listContent } from "@/lib/content/service";
import { listSeasons } from "@/lib/seasons/service";

export default async function NewContentPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ season?: string }> }) {
  const [{projectId}, query] = await Promise.all([params, searchParams]);
  const project=getProject(projectId);
  if(!project) notFound();
  const items=listContent(projectId);
  const seasons=listSeasons(projectId);
  const nextNumber=items.reduce((max,{item})=>Math.max(max,item.contentNumber),0)+1;
  return <AppShell active="Proyek" projectId={projectId} projectSection="Konten"><div className="page-heading"><Link className="back-link" href={`/projects/${projectId}/content`}>← Kembali ke konten</Link><p className="eyebrow">{project.code}</p><h1>Konten baru</h1><p className="subheading">Tambahkan konten produksi tanpa mengikatnya ke struktur episode tertentu.</p></div><ContentForm project={project} seasons={seasons} nextNumber={nextNumber} defaultSeasonId={query.season}/></AppShell>;
}
