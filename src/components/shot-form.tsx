"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createShotAction, updateShotAction } from "@/app/actions";
import { priorities, projectStatuses } from "@/lib/db/enums";
import type { FormState } from "@/app/actions";

type ContentOption = { id: string; code: string; title: string };
type SceneOption = { id: string; contentItemId: string; code: string; title: string; location: string };
type ShotValue = { id: string; contentItemId: string; shotCode: string; shotNumber: number; title: string; description: string; durationTarget: number | null; cameraType: string; action: string; dialogue: string; notes: string; status: (typeof projectStatuses)[number]; priority: (typeof priorities)[number] };

const statusLabels: Record<(typeof projectStatuses)[number], string> = { NOT_STARTED: "Belum dimulai", IN_PROGRESS: "Berjalan", APPROVED: "Disetujui", NEEDS_REVISION: "Perlu revisi", BLOCKED: "Terhambat", FINAL: "Final" };
const priorityLabels: Record<(typeof priorities)[number], string> = { LOW: "Rendah", NORMAL: "Normal", HIGH: "Tinggi", URGENT: "Mendesak" };

export function ShotForm({ projectId, contents, scenes, initial, suggested, defaultContentId }: { projectId: string; contents: ContentOption[]; scenes: SceneOption[]; initial?: ShotValue; suggested?: { shotCode: string; shotNumber: number }; defaultContentId?: string }) {
  const submitAction = initial ? updateShotAction : createShotAction;
  const [state, action, pending] = useActionState<FormState, FormData>(submitAction, {});
  return <form action={action} className="form-card shot-editor">
    <input type="hidden" name="projectId" value={projectId}/>
    {initial ? <input type="hidden" name="shotId" value={initial.id}/> : <>
      <label className="field"><span>Konten <b>*</b></span><select name="contentItemId" defaultValue={defaultContentId??contents[0]?.id} required>{contents.map((content)=><option key={content.id} value={content.id}>{content.code} · {content.title}</option>)}</select></label>
      <label className="field"><span>Adegan</span><select name="sceneId" defaultValue=""><option value="">Tanpa adegan</option>{scenes.map((scene)=><option key={scene.id} value={scene.id}>{scene.code} · {scene.title} — {contents.find((item)=>item.id===scene.contentItemId)?.code}</option>)}</select></label>
      <label className="field"><span>Kode shot <b>*</b></span><input name="shotCode" defaultValue={suggested?.shotCode??"SH001"} pattern="SH[0-9]{3,5}" required/></label>
      <label className="field"><span>Nomor shot <b>*</b></span><input name="shotNumber" type="number" min="1" max="99999" defaultValue={suggested?.shotNumber??1} required/></label>
    </>}
    <label className="field field-wide"><span>Judul <b>*</b></span><input name="title" defaultValue={initial?.title} required maxLength={160}/></label>
    <div className="shot-edit-grid">
      <label className="field"><span>Durasi target (detik)</span><input name="durationTarget" type="number" min="0.1" step="0.1" defaultValue={initial?.durationTarget??""}/></label>
      <label className="field"><span>Tipe kamera</span><input name="cameraType" maxLength={160} defaultValue={initial?.cameraType}/></label>
      <label className="field"><span>Prioritas</span><select name="priority" defaultValue={initial?.priority??"NORMAL"}>{priorities.map((priority)=><option key={priority} value={priority}>{priorityLabels[priority]}</option>)}</select></label>
      <label className="field"><span>Status</span><select name="status" defaultValue={initial?.status??"NOT_STARTED"}>{projectStatuses.map((status)=><option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
      <label className="field field-wide"><span>Deskripsi</span><textarea name="description" rows={3} maxLength={4000} defaultValue={initial?.description}/></label>
      <label className="field field-wide"><span>Aksi</span><textarea name="action" rows={3} maxLength={4000} defaultValue={initial?.action}/></label>
      <label className="field field-wide"><span>Dialog</span><textarea name="dialogue" rows={3} maxLength={4000} defaultValue={initial?.dialogue}/></label>
      <label className="field field-wide"><span>Catatan</span><textarea name="notes" rows={3} maxLength={4000} defaultValue={initial?.notes}/></label>
    </div>
    {state.error&&<p className="form-error" role="alert">{state.error}</p>}
    <div className="form-actions"><Link href={initial?`/projects/${projectId}/shots/${initial.id}`:`/projects/${projectId}/shots`} className="button button-quiet">Batal</Link><button type="submit" className="button button-primary" disabled={pending}>{pending?"Menyimpan…":initial?"Simpan perubahan":"Buat shot"}</button></div>
  </form>;
}
