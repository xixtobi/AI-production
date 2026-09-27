"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { shotAssetRoles } from "@/lib/db/enums";
export function ShotAssets({projectId,shotId,assets}:{projectId:string;shotId:string;assets:{id:string;assetCode:string;name:string}[]}) {
  const [assetId,setAssetId]=useState(assets[0]?.id??"");const [role,setRole]=useState<typeof shotAssetRoles[number]>("REFERENCE");const [message,setMessage]=useState("");const router=useRouter();
  async function link(){const r=await fetch(`/api/projects/${projectId}/shots/${shotId}/assets`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({assetId,role})});const d=await r.json();setMessage(r.ok?"Aset ditautkan.":d.error);if(r.ok)router.refresh();}
  return <div className="folder-controls"><select value={assetId} onChange={e=>setAssetId(e.target.value)}>{assets.map(a=><option key={a.id} value={a.id}>{a.assetCode} · {a.name}</option>)}</select><select value={role} onChange={e=>setRole(e.target.value as typeof role)}>{shotAssetRoles.map(r=><option key={r}>{r}</option>)}</select><button className="button button-secondary" disabled={!assetId} onClick={link}>Tautkan aset</button>{message&&<small role="status">{message}</small>}</div>;
}
