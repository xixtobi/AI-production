import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { VersionActions } from "@/components/asset-controls";
import { getAsset, getAssetVersions } from "@/lib/assets/service";
import { AssetVersionForm } from "@/components/asset-version-form";
import Image from "next/image";
export default async function AssetDetail({ params }: { params: Promise<{ projectId: string; assetId: string }> }) {
  const { projectId, assetId } = await params; const asset = getAsset(assetId); if (!asset || asset.projectId !== projectId) notFound(); const versions = getAssetVersions(assetId);
  return <AppShell active="Proyek" projectId={projectId} projectSection="Asset"><Link className="back-link" href={`/projects/${projectId}/assets`}>← Semua aset</Link><div className="shot-page-head"><div><span className="shot-id">{asset.assetCode} · {asset.assetType}</span><h1>{asset.name}</h1><p className="subheading">{asset.description||"Belum ada deskripsi."}</p></div></div><section className="panel"><div className="panel-heading"><div><p className="eyebrow">RIWAYAT</p><h2>Versi file</h2></div></div>{versions.map(v=><article className="version-row" key={v.id}><div><strong>{v.versionLabel}{v.isCurrent?" · Saat ini":""}</strong><small>{v.filename} · {v.width&&v.height?`${v.width} × ${v.height} · `:""}{(v.sizeBytes/1024/1024).toFixed(2)} MB</small><code>{v.relativePath}</code>{v.mimeType.startsWith("image/")&&<Image unoptimized width={600} height={400} className="asset-preview" src={`/api/asset-versions/${v.id}/thumbnail`} alt={v.filename}/ >}{v.mimeType.startsWith("video/")&&<video className="asset-preview" controls preload="metadata" src={`/api/asset-versions/${v.id}/preview`}/ >}{v.mimeType.startsWith("audio/")&&<audio controls preload="metadata" src={`/api/asset-versions/${v.id}/preview`}/ >}</div><VersionActions versionId={v.id}/></article>)}</section><AssetVersionForm assetId={asset.id}/></AppShell>;
}
