"use client";
import { useState } from "react";

export function ScanButton({ projectId }: { projectId: string }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [files, setFiles] = useState<{relativePath:string;status:string;versionId?:string;sha256?:string}[]>([]);
  async function scan() { setBusy(true); setMessage("Memindai folder proyek…"); try { const response = await fetch(`/api/projects/${projectId}/scan`, { method: "POST" }); const data = await response.json(); setMessage(response.ok ? `Selesai — terdaftar ${data.counts.REGISTERED}, belum terdaftar ${data.counts.UNLINKED}, berubah ${data.counts.CHANGED}, hilang ${data.counts.MISSING}, duplikat ${data.counts.DUPLICATE}.` : data.error); if(response.ok)setFiles(data.files); } catch { setMessage("Pemindaian gagal."); } finally { setBusy(false); } }
  async function ignore(file:typeof files[number]) { const r=await fetch(`/api/projects/${projectId}/scan/ignore`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({relativePath:file.relativePath,category:file.status,ignoredSha256:file.status==="CHANGED"?file.sha256:null})});if(r.ok)await scan(); }
  async function accept(file:typeof files[number]) { const r=await fetch(`/api/asset-versions/${file.versionId}/accept-changes`,{method:"POST"});if(r.ok)await scan(); }
  return <div><button className="button button-outline" onClick={scan} disabled={busy}>{busy ? "Memindai…" : "Pindai folder"}</button>{message && <div role="status"><p>{message}</p>{files.length>0&&<div className="scan-results">{files.filter(f=>f.status!=="REGISTERED").map(file=><div key={`${file.relativePath}-${file.status}`}><span className={`scan-${file.status.toLowerCase()}`}>{file.status}</span><code>{file.relativePath}</code>{file.status==="CHANGED"&&<><button onClick={()=>accept(file)}>Terima versi baru</button><button onClick={()=>ignore(file)}>Pertahankan metadata</button></>}{["MISSING","DUPLICATE"].includes(file.status)&&<button onClick={()=>ignore(file)}>Abaikan</button>}</div>)}</div>}</div>}</div>;
}

export function FolderButtons({ projectId }: { projectId: string }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function act(action: string) { setBusy(true); setMessage(""); try { const r = await fetch(`/api/projects/${projectId}/${action}`, { method: "POST" }); const data = await r.json(); setMessage(r.ok ? action === "ensure-folders" ? `Folder siap (${data.created} lokasi).` : "Folder tidak dapat dibuka di lingkungan ini." : data.error); } catch { setMessage("Aksi folder gagal."); } finally { setBusy(false); } }
  return <div className="folder-controls"><button className="button button-outline" disabled={busy} onClick={() => act("open-folder")}>Buka folder</button><button className="button button-secondary" disabled={busy} onClick={() => act("ensure-folders")}>Siapkan folder</button>{message && <small role="status">{message}</small>}</div>;
}

export function VersionActions({ versionId }: { versionId: string }) {
  const [message, setMessage] = useState("");
  async function act(action: string) { const r = await fetch(`/api/asset-versions/${versionId}/${action}`, { method: "POST" }); const data = await r.json(); setMessage(r.ok ? action === "copy-path" ? "Path disalin." : "Perintah dikirim ke Windows." : data.error); }
  return <div className="folder-controls"><button className="button button-secondary" onClick={() => act("reveal")}>Tampilkan di Explorer</button><button className="button button-secondary" onClick={() => act("open")}>Buka file</button><button className="button button-secondary" onClick={() => act("open-folder")}>Buka folder</button><button className="button button-outline" onClick={() => act("copy-path")}>Salin path</button>{message && <small role="status">{message}</small>}</div>;
}
