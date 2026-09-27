import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { ShotForm } from "@/components/shot-form";
import { getProject } from "@/lib/projects/service";
import { listContent } from "@/lib/content/service";
import { listProjectScenes } from "@/lib/scenes/service";
import { getShotDetail } from "@/lib/shots/service";
import { listAssets, listShotAssets } from "@/lib/assets/service";
import { ShotAssets } from "@/components/shot-assets";
import { VersionActions } from "@/components/asset-controls";
import { ShotAiWorkspace } from "@/components/shot-ai-workspace";
import { listAiTasks } from "@/lib/gemini/task-service";
import { getPromptForShot } from "@/lib/prompts";
import { listFlowQueueItems, listVideoOutputsForShot } from "@/lib/flow";
import { ShotFlowWorkspace } from "@/components/shot-flow-workspace";
import {
  detectAssetChangeImpact,
  detectScriptChangeImpact,
  listContinuityChecks,
  listQcChecklistItems,
  listQcReviews,
} from "@/lib/qc";
import { ShotQcWorkspace } from "@/components/shot-qc-workspace";
import { listShots } from "@/lib/shots/service";

export default async function ShotDetailPage({params}:{params:Promise<{projectId:string;shotId:string}>}){
  const {projectId,shotId}=await params;
  const project=getProject(projectId);
  const data=getShotDetail(projectId,shotId);
  if(!project||!data)notFound();
  const contents=listContent(projectId).map(({item})=>({id:item.id,code:item.code,title:item.title}));
  const scenes=listProjectScenes(projectId).map(({scene,content})=>({id:scene.id,contentItemId:content.id,code:scene.code,title:scene.title,location:scene.location}));
  const availableAssets=listAssets(projectId).map(({asset})=>asset);
  const linkedAssets=listShotAssets(shotId);
  const aiTasks=listAiTasks().map((t) => ({ code: t.code, name: t.name, defaultThinkingLevel: t.defaultThinkingLevel }));

  const promptDoc = getPromptForShot(projectId, shotId);
  const startFrameLink = linkedAssets.find((a) => a.link.role === "START_FRAME" && a.version);
  const startFrame = startFrameLink && startFrameLink.version ? { asset: startFrameLink.asset, version: startFrameLink.version } : null;
  const rawQueueItems = listFlowQueueItems({ projectId, shotId });
  const queueItems = rawQueueItems.map((q) => ({ item: q.item, attempts: q.attempts }));
  const videoOutputs = listVideoOutputsForShot(shotId);

  // Phase 8: QC & Continuity Data
  const siblingShots = listShots(projectId).filter((s) => s.shot.contentItemId === data.content.id).map((s) => s.shot);
  const qcReviews = listQcReviews({ projectId, shotId });
  const continuityChecks = listContinuityChecks({ projectId, shotId });
  const checklistItems = listQcChecklistItems(projectId);

  // Change impacts
  const scriptImpacts = detectScriptChangeImpact(projectId, data.content.id);
  const matchingScriptImpact = scriptImpacts.find((imp) => imp.affectedShotIds.includes(shotId));
  const scriptChangeWarning = matchingScriptImpact ? matchingScriptImpact.description : null;

  let assetChangeWarning: string | null = null;
  for (const la of linkedAssets) {
    const assetImpact = detectAssetChangeImpact(projectId, la.asset.assetCode);
    if (assetImpact && assetImpact.affectedShotIds.includes(shotId)) {
      assetChangeWarning = assetImpact.description;
      break;
    }
  }

  return <AppShell active="Proyek" projectId={projectId} projectSection="Shot">
    <div className="breadcrumb shot-breadcrumb"><Link href={`/projects/${projectId}`}>Proyek</Link><b>/</b><Link href={`/projects/${projectId}/content/${data.content.id}`}>{data.content.code}</Link>{data.scene&&<><b>/</b><span>{data.scene.code}</span></>}<b>/</b><strong>{data.shot.shotCode}</strong></div>
    <div className="shot-page-head"><div><span className="shot-id">{data.shot.shotCode}</span><h1>{data.shot.title}</h1><div className="shot-meta"><StatusBadge status={data.shot.status}/><PriorityBadge priority={data.shot.priority}/><span className="subheading">{data.content.code} · {data.content.title}</span></div></div><div style={{ display: "flex", gap: "8px" }}><Link className="button button-primary" href={`/projects/${projectId}/shots/${shotId}/prompts`}>🎨 Prompt Studio</Link><Link className="button button-secondary" href={`/projects/${projectId}/content/${data.content.id}`}>Kembali ke konten</Link></div></div>
    {data.scene?<div className="shot-context"><small>KONTEKS ADEGAN · {data.scene.code}</small><strong>{data.scene.title}</strong><span> · {data.scene.location||"Lokasi belum diisi"}</span></div>:<div className="shot-context"><small>KONTEKS ADEGAN</small><strong>Shot ini belum ditautkan ke adegan.</strong></div>}
    <div className="editor-panel"><div className="panel-heading"><div><p className="eyebrow">INFORMASI SHOT</p><h2>Edit detail produksi</h2></div><span className="seed-note">Perubahan disimpan saat tombol disimpan ditekan.</span></div><ShotForm projectId={projectId} contents={contents} scenes={scenes} initial={data.shot}/></div>
    
    <ShotFlowWorkspace
      projectId={projectId}
      shotId={shotId}
      shotCode={data.shot.shotCode}
      activePromptVersion={promptDoc.currentVersion}
      startFrame={startFrame}
      queueItems={queueItems}
      initialVideoOutputs={videoOutputs}
    />

    <ShotQcWorkspace
      projectId={projectId}
      shotId={shotId}
      shotCode={data.shot.shotCode}
      contentItemId={data.content.id}
      initialQcReviews={qcReviews}
      initialContinuityChecks={continuityChecks}
      checklistItems={checklistItems}
      siblingShots={siblingShots}
      currentKeyframe={startFrame}
      currentVideo={videoOutputs[0] || null}
      scriptChangeWarning={scriptChangeWarning}
      assetChangeWarning={assetChangeWarning}
    />

    <ShotAiWorkspace projectId={projectId} shotId={shotId} shotCode={data.shot.shotCode} tasks={aiTasks} />
    <section className="panel shot-assets-panel"><div className="panel-heading"><div><p className="eyebrow">FILE TERKAIT</p><h2>Aset shot</h2></div></div>{linkedAssets.length===0?<p className="empty-inline">Belum ada aset yang ditautkan. Tidak ada relasi yang ditebak otomatis.</p>:linkedAssets.map(({link,asset,version})=><div className="version-row" key={link.id}><div><strong>{asset.assetCode} · {asset.name} · {link.role}</strong><small>{version?.filename??"Versi belum tersedia"}</small></div>{version&&<VersionActions versionId={version.id}/>}</div>)}{availableAssets.length>0?<ShotAssets projectId={projectId} shotId={shotId} assets={availableAssets}/>:<p className="seed-note">Daftarkan file pada halaman Aset & file terlebih dahulu.</p>}</section>
    <nav className="shot-nav" aria-label="Navigasi shot sebelumnya dan berikutnya"><Link aria-disabled={!data.previous} href={data.previous?`/projects/${projectId}/shots/${data.previous.id}`:"#"}>← Sebelumnya {data.previous?.shotCode??""}</Link><Link href={`/projects/${projectId}/content/${data.content.id}`}>Daftar {data.content.code}</Link><Link aria-disabled={!data.next} href={data.next?`/projects/${projectId}/shots/${data.next.id}`:"#"}>Berikutnya {data.next?.shotCode??""} →</Link></nav>
  </AppShell>;
}

