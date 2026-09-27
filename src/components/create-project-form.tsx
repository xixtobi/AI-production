"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createProjectAction } from "@/app/actions";
import { projectTypes } from "@/lib/db/enums";
import { getDefaultProjectRoot } from "@/lib/projects/default-root";

const typeLabels: Record<(typeof projectTypes)[number], string> = {
  ANIMATION_SERIES: "Serial Animasi", UGC_SERIES: "Serial UGC", YOUTUBE: "Konten YouTube",
  SHORT_FILM: "Film Pendek", ADVERTISEMENT: "Iklan", DOCUMENTARY: "Dokumenter", OTHER: "Lainnya",
};

export function CreateProjectForm() {
  const [state, action, pending] = useActionState(createProjectAction, {});
  const [code, setCode] = useState("");
  const rootPath = getDefaultProjectRoot(code);

  return (
    <form action={action} className="form-card">
      <div className="form-grid">
        <label className="field field-wide"><span>Nama proyek <b>*</b></span><input name="name" required minLength={2} maxLength={120} placeholder="Contoh: Petualangan di Lembah Awan" /></label>
        <label className="field"><span>Kode proyek <b>*</b></span><input name="code" required minLength={2} maxLength={32} pattern="[A-Za-z0-9_-]+" value={code} onChange={event => setCode(event.target.value)} placeholder="LEMBah-AWAN" /><small>Unik untuk identifikasi proyek.</small></label>
        <label className="field"><span>Jenis proyek <b>*</b></span><select name="projectType" required defaultValue="ANIMATION_SERIES">{projectTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></label>
        <div className="field field-wide"><span>Folder proyek</span><output className="path-value">{rootPath}</output><small>Folder ini dibuat otomatis saat proyek disimpan.</small></div>
        <label className="field field-wide"><span>Deskripsi</span><textarea name="description" rows={3} maxLength={1000} placeholder="Ringkasan singkat proyek…" /></label>
        <label className="field"><span>Rasio aspek default</span><select name="defaultAspectRatio" defaultValue="16:9"><option>16:9</option><option>9:16</option><option>1:1</option><option>4:3</option></select></label>
        <label className="field"><span>Bahasa default</span><input name="defaultLanguage" defaultValue="Indonesian" maxLength={60} /></label>
      </div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <div className="form-actions"><Link href="/" className="button button-quiet">Batal</Link><button type="submit" className="button button-primary" disabled={pending}>{pending ? "Menyimpan…" : <><span>＋</span> Buat proyek</>}</button></div>
    </form>
  );
}
