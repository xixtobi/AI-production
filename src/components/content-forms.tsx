"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createContentAction, createSeasonAction, updateContentAction, updateSeasonAction } from "@/app/actions";
import { projectStatuses, priorities } from "@/lib/db/enums";
import type { Project } from "@/lib/db/schema";

type Season = { id: string; code: string; seasonNumber: number; name: string; description: string; status: (typeof projectStatuses)[number] };
type ContentValue = { id: string; seasonId: string | null; code: string; contentNumber: number; title: string; contentType: string; description: string; durationTarget: number | null; status: (typeof projectStatuses)[number]; priority: (typeof priorities)[number] };

const statusLabels: Record<(typeof projectStatuses)[number], string> = { NOT_STARTED: "Belum dimulai", IN_PROGRESS: "Berjalan", APPROVED: "Disetujui", NEEDS_REVISION: "Perlu revisi", BLOCKED: "Terhambat", FINAL: "Final" };
const priorityLabels: Record<(typeof priorities)[number], string> = { LOW: "Rendah", NORMAL: "Normal", HIGH: "Tinggi", URGENT: "Mendesak" };

export function SeasonManager({ projectId, seasons }: { projectId: string; seasons: Season[] }) {
  const [createState, createAction, creating] = useActionState(createSeasonAction, {});
  return <div className="subsection">
    <div className="subsection-heading"><div><p className="eyebrow">PENGELOMPOKAN OPSIONAL</p><h2>Musim</h2></div><details><summary className="button button-secondary">＋ Musim baru</summary><form action={createAction} className="inline-form mini-card"><input type="hidden" name="projectId" value={projectId}/><div className="small-form-grid"><label className="field"><span>Kode</span><input name="code" defaultValue={`SEASON_${String(seasons.length + 1).padStart(2,"0")}`} required/></label><label className="field"><span>Nomor</span><input name="seasonNumber" type="number" min="1" defaultValue={seasons.length + 1} required/></label><label className="field field-wide"><span>Nama musim</span><input name="name" defaultValue={`Season ${seasons.length + 1}`} required/></label><label className="field field-wide"><span>Deskripsi</span><input name="description"/></label><input type="hidden" name="status" value="NOT_STARTED"/></div>{createState.error&&<p className="form-error">{createState.error}</p>}<button className="button button-primary" disabled={creating}>{creating?"Menyimpan…":"Simpan musim"}</button></form></details></div>
    {seasons.length===0?<div className="empty-inline">Belum ada musim. Konten tetap dapat dibuat tanpa musim.</div>:<div className="season-list">{seasons.map((season)=><SeasonCard key={season.id} projectId={projectId} season={season}/>)}</div>}
  </div>;
}

function SeasonCard({ projectId, season }: { projectId: string; season: Season }) {
  const [state, action, pending] = useActionState(updateSeasonAction, {});
  return <article className="season-card"><div className="season-card-top"><div><h3>{season.name}</h3><p>{season.code} · {statusLabels[season.status]}</p></div><Link href={`/projects/${projectId}/content?season=${encodeURIComponent(season.id)}`} className="text-link">Lihat konten →</Link></div><details className="season-edit"><summary className="text-link">Edit musim</summary><form action={action} className="inline-form"><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="seasonId" value={season.id}/><div className="small-form-grid"><label className="field"><span>Kode</span><input name="code" defaultValue={season.code} required/></label><label className="field"><span>Nomor</span><input name="seasonNumber" type="number" min="1" defaultValue={season.seasonNumber} required/></label><label className="field field-wide"><span>Nama</span><input name="name" defaultValue={season.name} required/></label><label className="field field-wide"><span>Deskripsi</span><input name="description" defaultValue={season.description}/></label><label className="field field-wide"><span>Status</span><select name="status" defaultValue={season.status}>{projectStatuses.map((status)=><option key={status} value={status}>{statusLabels[status]}</option>)}</select></label></div>{state.error&&<p className="form-error">{state.error}</p>}<button className="button button-primary" disabled={pending}>{pending?"Menyimpan…":"Simpan"}</button></form></details></article>;
}

export function ContentForm({ project, seasons, initial, nextNumber, defaultSeasonId }: { project: Project; seasons: Season[]; initial?: ContentValue; nextNumber: number; defaultSeasonId?: string }) {
  const actionToUse = initial ? updateContentAction : createContentAction;
  const [state, action, pending] = useActionState(actionToUse, {});
  const animation = project.projectType === "ANIMATION_SERIES";
  const kindLabel = animation ? "Episode" : ["UGC_SERIES", "YOUTUBE"].includes(project.projectType) ? "Video" : "Konten";
  const suggested = `${animation?"EP":["UGC_SERIES","YOUTUBE"].includes(project.projectType)?"VID":"CNT"}${String(initial?.contentNumber??nextNumber).padStart(2,"0")}`;
  return <form action={action} className="form-card">{initial&&<input type="hidden" name="contentId" value={initial.id}/>}<input type="hidden" name="projectId" value={project.id}/>
    <div className="form-grid">
      <label className="field"><span>Kode {kindLabel.toLowerCase()} <b>*</b></span><input name="code" defaultValue={initial?.code??suggested} required maxLength={32}/></label>
      <label className="field"><span>Nomor <b>*</b></span><input name="contentNumber" type="number" min="1" max="99999" defaultValue={initial?.contentNumber??nextNumber} required/></label>
      <label className="field field-wide"><span>Judul <b>*</b></span><input name="title" defaultValue={initial?.title} required maxLength={160} placeholder={`Judul ${kindLabel.toLowerCase()}`}/></label>
      <label className="field"><span>Jenis konten <b>*</b></span><input name="contentType" defaultValue={initial?.contentType??(animation?"EPISODE":["UGC_SERIES","YOUTUBE"].includes(project.projectType)?"VIDEO":"CONTENT")} required maxLength={60}/></label>
      <label className="field"><span>Musim</span><select name="seasonId" defaultValue={initial?.seasonId??defaultSeasonId??""}><option value="">Tanpa musim</option>{seasons.map((season)=><option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
      <label className="field"><span>Durasi target (detik)</span><input name="durationTarget" type="number" min="0.1" step="0.1" defaultValue={initial?.durationTarget??""}/></label>
      <label className="field"><span>Prioritas</span><select name="priority" defaultValue={initial?.priority??"NORMAL"}>{priorities.map((priority)=><option key={priority} value={priority}>{priorityLabels[priority]}</option>)}</select></label>
      <label className="field"><span>Status</span><select name="status" defaultValue={initial?.status??"NOT_STARTED"}>{projectStatuses.map((status)=><option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
      <label className="field field-wide"><span>Deskripsi</span><textarea name="description" rows={4} maxLength={4000} defaultValue={initial?.description}/></label>
    </div>{state.error&&<p className="form-error" role="alert">{state.error}</p>}<div className="form-actions"><Link href={`/projects/${project.id}/content${initial?`/${initial.id}`:""}`} className="button button-quiet">Batal</Link><button type="submit" className="button button-primary" disabled={pending}>{pending?"Menyimpan…":"Simpan konten"}</button></div>
  </form>;
}
