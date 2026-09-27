import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { SeasonManager } from "@/components/content-forms";
import { getProject } from "@/lib/projects/service";
import { listContent } from "@/lib/content/service";
import { listSeasons } from "@/lib/seasons/service";

export default async function ContentListPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ season?: string }> }) {
  const [{ projectId }, query] = await Promise.all([params, searchParams]);
  const project = getProject(projectId);
  if (!project) notFound();
  const seasons = listSeasons(projectId);
  const allContent = listContent(projectId);
  const content = query.season ? allContent.filter(({item})=>item.seasonId===query.season) : allContent;
  const typeLabel = project.projectType === "ANIMATION_SERIES" ? "Episode" : project.projectType === "UGC_SERIES" || project.projectType === "YOUTUBE" ? "Video" : "Konten";

  return <AppShell active="Proyek" projectId={projectId} projectSection="Konten">
    <div className="section-heading"><div><p className="eyebrow">{project.code}</p><h2>Konten</h2><p className="subheading">{allContent.length} {typeLabel.toLowerCase()} dalam proyek ini.</p></div><div className="heading-actions"><Link className="button button-secondary" href={`/projects/${projectId}/shots/new`}>＋ Shot</Link><Link className="button button-primary" href={`/projects/${projectId}/content/new`}>＋ Konten baru</Link></div></div>
    {project.projectType==="ANIMATION_SERIES"&&<SeasonManager projectId={projectId} seasons={seasons}/>}
    <div className="subsection-heading"><h2>{query.season?seasons.find((season)=>season.id===query.season)?.name??"Konten musim":"Semua konten"}</h2>{query.season&&<Link href={`/projects/${projectId}/content`} className="text-link">Tampilkan semua</Link>}</div>
    {content.length===0?<div className="empty-inline">Belum ada konten. Buat {typeLabel.toLowerCase()} pertama untuk mulai mengatur shot.</div>:<div className="project-table-wrap"><table className="project-table"><thead><tr><th>Kode</th><th>Judul</th><th>Jenis</th><th>Durasi</th><th>Status</th><th>Prioritas</th><th>Aksi</th></tr></thead><tbody>{content.map(({item,season})=><tr key={item.id}><td className="table-code">{item.code}</td><td className="table-title"><Link href={`/projects/${projectId}/content/${item.id}`}>{item.title}</Link>{season&&<small className="seed-note">{season.name}</small>}</td><td>{item.contentType}</td><td>{item.durationTarget?`${item.durationTarget}s`:"—"}</td><td><StatusBadge status={item.status}/></td><td><PriorityBadge priority={item.priority}/></td><td className="table-actions"><Link href={`/projects/${projectId}/content/${item.id}`}>Buka</Link><span> · </span><Link href={`/projects/${projectId}/content/${item.id}/edit`}>Edit</Link></td></tr>)}</tbody></table></div>}
  </AppShell>;
}
