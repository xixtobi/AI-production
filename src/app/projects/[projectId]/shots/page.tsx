import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ShotFilters } from "@/components/shot-filters";
import { getProject } from "@/lib/projects/service";
import { listShots } from "@/lib/shots/service";

export default async function ShotListPage({params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params;
  const project=getProject(projectId);
  if(!project)notFound();
  const rows=listShots(projectId);
  const contents=new Set(rows.map(({content})=>content.id));
  return <AppShell active="Proyek" projectId={projectId} projectSection="Shot"><div className="section-heading"><div><p className="eyebrow">{project.code}</p><h2>Shot</h2><p className="subheading">{rows.length} shot di {contents.size} konten.</p></div><Link className="button button-primary" href={`/projects/${projectId}/shots/new`}>＋ Shot baru</Link></div>{rows.length===0?<div className="empty-inline">Belum ada shot. Buat konten terlebih dahulu, lalu tambahkan shot.</div>:<ShotFilters projectId={projectId} rows={rows}/>}</AppShell>;
}
