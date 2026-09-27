"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EditRootPath({ projectId, defaultPath }: { projectId: string; defaultPath: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/projects/${projectId}/root-path`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useDefaultRoot: true }),
      });
      const data = await response.json();
      if (!response.ok) setMessage(data.error);
      else {
        setMessage("Folder proyek diperbarui. File yang ada tidak dipindahkan.");
        setOpen(false);
        router.refresh();
      }
    } catch {
      setMessage("Folder proyek gagal diperbarui.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="root-path-editor">
    <button className="button button-secondary" type="button" onClick={() => { setOpen(!open); setMessage(""); }}>Gunakan folder default</button>
    {open && <form onSubmit={save}>
      <p>Folder proyek akan disetel ke:</p>
      <output className="path-value">{defaultPath}</output>
      <div className="root-path-actions">
        <button className="button button-primary" disabled={busy}>{busy ? "Menyimpan…" : "Terapkan folder default"}</button>
        <button className="button button-quiet" type="button" onClick={() => setOpen(false)}>Batal</button>
      </div>
      <p>File yang ada tidak dipindahkan. Setelah menyimpan, pilih <b>Siapkan folder</b> untuk membuat struktur folder di lokasi baru.</p>
    </form>}
    {message && <small role="status">{message}</small>}
  </div>;
}
