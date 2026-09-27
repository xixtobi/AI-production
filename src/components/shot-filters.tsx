"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { priorities, projectStatuses } from "@/lib/db/enums";

type ShotRow = { shot: { id: string; shotCode: string; shotNumber: number; title: string; durationTarget: number | null; status: (typeof projectStatuses)[number]; priority: (typeof priorities)[number] }; content: { id: string; code: string; title: string }; season: { code: string } | null; scene: { id: string; code: string; title: string; location: string } | null };
const statusLabels: Record<(typeof projectStatuses)[number], string> = { NOT_STARTED: "Belum dimulai", IN_PROGRESS: "Berjalan", APPROVED: "Disetujui", NEEDS_REVISION: "Perlu revisi", BLOCKED: "Terhambat", FINAL: "Final" };

export function ShotFilters({ projectId, rows }: { projectId: string; rows: ShotRow[] }) {
  const [search, setSearch] = useState("");
  const [content, setContent] = useState("");
  const [scene, setScene] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("number");
  const contents = useMemo(()=>Array.from(new Map(rows.map((row)=>[row.content.id,row.content])).values()),[rows]);
  const scenes = useMemo(()=>Array.from(new Map(rows.filter((row)=>row.scene).map((row)=>[row.scene!.id,row.scene!])).values()),[rows]);
  const filtered = useMemo(()=>rows.filter((row)=>{
    const text=`${row.shot.shotCode} ${row.shot.title} ${row.content.code} ${row.content.title} ${row.scene?.code??""} ${row.scene?.title??""}`.toLowerCase();
    return text.includes(search.toLowerCase())&&(!content||row.content.id===content)&&(!scene||row.scene?.id===scene)&&(!status||row.shot.status===status);
  }).sort((a,b)=>sort==="priority"?priorities.indexOf(b.shot.priority)-priorities.indexOf(a.shot.priority)||a.shot.shotNumber-b.shot.shotNumber:a.shot.shotNumber-b.shot.shotNumber),[rows,search,content,scene,status,sort]);
  return <>
    <div className="filter-bar"><input aria-label="Cari shot" placeholder="Cari kode atau judul…" value={search} onChange={(event)=>setSearch(event.target.value)}/><select aria-label="Filter konten" value={content} onChange={(event)=>setContent(event.target.value)}><option value="">Semua konten</option>{contents.map((item)=><option key={item.id} value={item.id}>{item.code} · {item.title}</option>)}</select><select aria-label="Filter adegan" value={scene} onChange={(event)=>setScene(event.target.value)}><option value="">Semua adegan</option>{scenes.map((item)=><option key={item.id} value={item.id}>{item.code} · {item.title}</option>)}</select><select aria-label="Filter status" value={status} onChange={(event)=>setStatus(event.target.value)}><option value="">Semua status</option>{projectStatuses.map((value)=><option key={value} value={value}>{statusLabels[value]}</option>)}</select><select aria-label="Urutkan shot" value={sort} onChange={(event)=>setSort(event.target.value)}><option value="number">Nomor shot</option><option value="priority">Prioritas</option></select></div>
    {filtered.length===0?<div className="empty-inline">Tidak ada shot yang cocok dengan filter.</div>:<div className="project-table-wrap"><table className="project-table"><thead><tr><th>Shot</th><th>Konten</th><th>Adegan</th><th>Judul</th><th>Durasi</th><th>Status</th><th>Prioritas</th></tr></thead><tbody>{filtered.map((row)=><tr key={row.shot.id}><td><Link className="table-code" href={`/projects/${projectId}/shots/${row.shot.id}`}>{row.shot.shotCode}</Link></td><td><Link href={`/projects/${projectId}/content/${row.content.id}`}>{row.content.code}</Link></td><td>{row.scene?.code??"—"}</td><td className="table-title">{row.shot.title}</td><td>{row.shot.durationTarget?`${row.shot.durationTarget}s`:"—"}</td><td><StatusBadge status={row.shot.status}/></td><td><PriorityBadge priority={row.shot.priority}/></td></tr>)}</tbody></table></div>}
    <p className="seed-note">Menampilkan {filtered.length} dari {rows.length} shot.</p>
  </>;
}
