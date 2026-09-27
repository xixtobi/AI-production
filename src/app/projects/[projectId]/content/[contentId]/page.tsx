import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { SceneManager } from "@/components/scene-manager";
import { projectStatuses } from "@/lib/db/enums";
import { getProject } from "@/lib/projects/service";
import { getContentProductionData } from "@/lib/content/service";
import { listScenes, suggestSceneDetails } from "@/lib/scenes/service";
import { listShots } from "@/lib/shots/service";
import { getFlowQueueSummary } from "@/lib/flow";

const labels: Record<(typeof projectStatuses)[number],string>={NOT_STARTED:"Belum dimulai",IN_PROGRESS:"Berjalan",APPROVED:"Disetujui",NEEDS_REVISION:"Perlu revisi",BLOCKED:"Terhambat",FINAL:"Final"};

export default async function ContentDetailPage({params}:{params:Promise<{projectId:string;contentId:string}>}){
  const {projectId,contentId}=await params;
  const project=getProject(projectId);
  const data=getContentProductionData(projectId,contentId);
  if(!project||!data)notFound();
  const flowSummary = getFlowQueueSummary(projectId, contentId);
  const sceneRows=listScenes(projectId,contentId);
  const shotRows=listShots(projectId).filter(({shot})=>shot.contentItemId===contentId);
  const suggestedScene=suggestSceneDetails(contentId);
  const statuses=projectStatuses.map((status)=>({status,count:data.statusCounts[status]??0}));
  return <AppShell active="Proyek" projectId={projectId} projectSection="Konten">
    <div className="project-topline"><Link href={`/projects/${projectId}/content`} className="back-link">← Semua konten</Link><StatusBadge status={data.item.status}/></div>
    <div className="dashboard-heading"><div><p className="eyebrow">{data.season?.name??"Tanpa musim"} <span className="dot-sep">·</span> {data.item.code}</p><div className="content-head"><h1>{data.item.title}</h1><PriorityBadge priority={data.item.priority}/></div><div className="content-meta"><span>{data.item.contentType}</span><span>·</span><span>{data.item.durationTarget?`${data.item.durationTarget} detik`:"Durasi belum ditentukan"}</span></div></div><div className="heading-actions"><Link href={`/projects/${projectId}/content/${contentId}/final-review`} className="button button-primary">🎯 Final Review</Link><Link href={`/projects/${projectId}/content/${contentId}/script`} className="button button-secondary">📝 Script Studio</Link><Link href={`/projects/${projectId}/flow?contentItemId=${contentId}`} className="button button-secondary">⚡ Flow Queue</Link><Link href={`/projects/${projectId}/content/${contentId}/edit`} className="button button-secondary">Edit konten</Link><Link href={`/projects/${projectId}/shots/new?contentId=${contentId}`} className="button button-secondary">＋ Shot baru</Link></div></div>
    <section className="content-detail-grid"><article className="detail-panel"><div className="panel-heading"><h2>Ringkasan konten</h2><Link href={`/projects/${projectId}/content/${contentId}/edit`} className="text-link">Edit</Link></div><dl><div><dt>Deskripsi</dt><dd>{data.item.description||"Belum ada deskripsi."}</dd></div><div><dt>Jenis konten</dt><dd>{data.item.contentType}</dd></div><div><dt>Durasi target</dt><dd>{data.item.durationTarget?`${data.item.durationTarget} detik`:"Belum ditentukan"}</dd></div><div><dt>Prioritas</dt><dd><PriorityBadge priority={data.item.priority}/></dd></div></dl></article>
      <article className="detail-panel"><div className="panel-heading"><h2>Ringkasan shot & Flow</h2><strong>{data.totalShots} Shot</strong></div><div className="status-summary">{statuses.map(({status,count})=><div className="summary-chip" key={status}><span>{labels[status]}</span><strong>{count}</strong></div>)}</div><div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #eff2ef", display: "flex", gap: "6px", flexWrap: "wrap", fontSize: "10px" }}><span>Flow:</span><span style={{ color: "#457a32", fontWeight: 600 }}>{flowSummary.ready} Ready</span><span>·</span><span style={{ color: "#2d6da3", fontWeight: 600 }}>{flowSummary.generating} Generating</span><span>·</span><span style={{ color: "#546e40", fontWeight: 600 }}>{flowSummary.completed} Completed</span><span>·</span><span style={{ color: "#ba3932", fontWeight: 600 }}>{flowSummary.blocked} Blocked</span></div></article></section>
    <section className="subsection"><div className="subsection-heading"><div><p className="eyebrow">STRUKTUR OPSIONAL</p><h2>Adegan <span className="count-chip">{sceneRows.length}</span></h2></div><Link href={`/projects/${projectId}/shots/new?contentId=${contentId}`} className="text-link">+ Tambah shot</Link></div><SceneManager projectId={projectId} contentId={contentId} scenes={sceneRows.map(({scene,shotCount})=>({...scene,shotCount}))} suggested={suggestedScene}/></section>
    <section className="subsection"><div className="subsection-heading"><div><p className="eyebrow">UNIT PRODUKSI</p><h2>Shot <span className="count-chip">{shotRows.length}</span></h2></div><Link href={`/projects/${projectId}/shots/new?contentId=${contentId}`} className="button button-primary">＋ Shot baru</Link></div>
      {shotRows.length===0?<div className="empty-inline">Belum ada shot untuk konten ini.</div>:<div className="project-table-wrap"><table className="project-table"><thead><tr><th>Shot</th><th>Judul</th><th>Adegan</th><th>Durasi</th><th>Status</th><th>Prioritas</th></tr></thead><tbody>{shotRows.map(({shot,scene})=><tr key={shot.id}><td><Link href={`/projects/${projectId}/shots/${shot.id}`} className="table-code">{shot.shotCode}</Link></td><td className="table-title">{shot.title}</td><td>{scene?.code??"—"}</td><td>{shot.durationTarget?`${shot.durationTarget}s`:"—"}</td><td><StatusBadge status={shot.status}/></td><td><PriorityBadge priority={shot.priority}/></td></tr>)}</tbody></table></div>}
    </section>
  </AppShell>;
}
