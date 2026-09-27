import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getProject } from "@/lib/projects/service";
import { projectTypes } from "@/lib/db/schema";
import { listContent } from "@/lib/content/service";
import { listSeasons } from "@/lib/seasons/service";
import { getProjectProductionSummary } from "@/lib/shots/service";
import { projectStatuses } from "@/lib/db/enums";
import { StatusBadge } from "@/components/badges";
import { FolderButtons } from "@/components/asset-controls";
import { listAssets } from "@/lib/assets/service";
import { EditRootPath } from "@/components/edit-root-path";
import { getDefaultProjectRoot } from "@/lib/projects/default-root";
import { getFlowQueueSummary } from "@/lib/flow";
import { getProductionDashboardMetrics } from "@/lib/qc";

const typeLabels: Record<(typeof projectTypes)[number], string> = {
  ANIMATION_SERIES: "Serial Animasi", UGC_SERIES: "Serial UGC", YOUTUBE: "Konten YouTube",
  SHORT_FILM: "Film Pendek", ADVERTISEMENT: "Iklan", DOCUMENTARY: "Dokumenter", OTHER: "Lainnya",
};

export default async function ProjectDashboard({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId: id } = await params;
  const project = getProject(id);
  if (!project) notFound();
  const summary = getProjectProductionSummary(id);
  const flowSummary = getFlowQueueSummary(id);
  const qcMetrics = getProductionDashboardMetrics(id);
  const content = listContent(id);
  const seasons = listSeasons(id);
  const assets = listAssets(id);
  const completed = (summary.statusCounts.APPROVED ?? 0) + (summary.statusCounts.FINAL ?? 0);
  const progress = summary.totalShots ? Math.round(completed / summary.totalShots * 100) : 0;

  return (
    <AppShell active="Proyek" projectId={id} projectSection="Dashboard">
      <div className="project-topline"><Link href="/" className="back-link">← Semua proyek</Link><StatusBadge status={project.status}/></div>
      <div className="dashboard-heading">
        <div><p className="eyebrow">{project.code} <span className="dot-sep">·</span> {typeLabels[project.projectType]}</p><h1>{project.name}</h1><p className="subheading">{project.description || "Belum ada deskripsi untuk proyek ini."}</p></div>
        <Link className="button button-outline" href={`/projects/${id}/content`}>Buka konten →</Link>
      </div>
      <section className="stats-grid" aria-label="Ringkasan produksi">
        <article className="stat-card"><span className="stat-icon purple">◫</span><div><small>KONTEN</small><strong>{summary.contentCount}</strong><span>{seasons.length} musim</span></div></article>
        <article className="stat-card"><span className="stat-icon blue">◇</span><div><small>SHOT</small><strong>{summary.totalShots}</strong><span>Unit produksi</span></div></article>
        <article className="stat-card"><span className="stat-icon green">▧</span><div><small>ASSET</small><strong>{assets.length}</strong><Link href={`/projects/${id}/assets`}>Kelola file →</Link></div></article>
        <article className="stat-card"><span className="stat-icon amber">◷</span><div><small>PROGRES</small><strong>{progress}%</strong><span>{completed} shot disetujui/final</span></div></article>
      </section>
      <section className="dashboard-grid">
        <article className="panel next-panel">
          <div className="panel-heading"><div><p className="eyebrow">STRUKTUR PRODUKSI</p><h2>Konten proyek</h2></div><span className="panel-mark">{content.length}</span></div>
          {content.length===0?<p>Belum ada konten. Tambahkan konten untuk mulai menyusun shot.</p>:<div className="project-content-list">{content.map(({item,season})=><Link className="project-content-row" key={item.id} href={`/projects/${id}/content/${item.id}`}><strong>{item.code}</strong><span>{item.title}</span><em>{season?.name??"Tanpa musim"}</em></Link>)}</div>}
          <Link href={`/projects/${id}/content`} className="text-link">Kelola konten →</Link>
        </article>
        <article className="panel details-panel">
          <div className="panel-heading"><div><p className="eyebrow">PENGATURAN DASAR</p><h2>Detail proyek</h2></div><span className="details-dots">•••</span></div>
          <dl><div><dt>Folder root</dt><dd className="path-value">{project.rootPath}</dd></div><div><dt>Rasio aspek</dt><dd>{project.defaultAspectRatio}</dd></div><div><dt>Bahasa</dt><dd>{project.defaultLanguage}</dd></div><div><dt>Dibuat</dt><dd>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(project.createdAt)}</dd></div></dl><div className="folder-controls"><EditRootPath projectId={id} defaultPath={getDefaultProjectRoot(project.code)}/><FolderButtons projectId={id}/></div>
        </article>
      </section>
      <section className="panel project-dashboard-summary"><div className="panel-heading"><div><p className="eyebrow">STATUS PRODUKSI</p><h2>Shot per status</h2></div><Link href={`/projects/${id}/shots`} className="text-link">Lihat semua shot →</Link></div><div className="shot-summary">{projectStatuses.map((status)=><span key={status}>{status.replaceAll("_"," ")} <b>{summary.statusCounts[status]??0}</b></span>)}</div></section>
      <section className="panel project-dashboard-summary" style={{ marginTop: "14px" }}>
        <div className="panel-heading">
          <div><p className="eyebrow">GOOGLE FLOW VIDEO PRODUCTION</p><h2>Flow Queue per Status</h2></div>
          <Link href={`/projects/${id}/flow`} className="text-link">Buka Flow Queue →</Link>
        </div>
        <div className="shot-summary">
          <span>READY <b style={{ color: "#457a32" }}>{flowSummary.ready}</b></span>
          <span>GENERATING <b style={{ color: "#2d6da3" }}>{flowSummary.generating}</b></span>
          <span>COMPLETED <b style={{ color: "#546e40" }}>{flowSummary.completed}</b></span>
          <span>NEEDS REVIEW <b style={{ color: "#b37b19" }}>{flowSummary.needsReview}</b></span>
          <span>BLOCKED <b style={{ color: "#ba3932" }}>{flowSummary.blocked}</b></span>
          <span>FAILED <b style={{ color: "#ba3932" }}>{flowSummary.failed}</b></span>
        </div>
      </section>

      {/* QC & CONTINUITY HEALTH */}
      <section className="panel project-dashboard-summary" style={{ marginTop: "14px" }}>
        <div className="panel-heading">
          <div><p className="eyebrow">QUALITY CONTROL & CONTINUITY HEALTH</p><h2>Kesehatan QC & Kontinuitas</h2></div>
          <Link href={`/projects/${id}/production-board`} className="button button-secondary" style={{ fontSize: "10px", height: "28px" }}>
            📋 Buka Production Board →
          </Link>
        </div>
        <div className="shot-summary">
          <span>CRITICAL QC <b style={{ color: qcMetrics.qcHealth.openCritical > 0 ? "#ba3932" : "#546e40" }}>{qcMetrics.qcHealth.openCritical}</b></span>
          <span>MAJOR QC <b style={{ color: qcMetrics.qcHealth.openMajor > 0 ? "#b37b19" : "#546e40" }}>{qcMetrics.qcHealth.openMajor}</b></span>
          <span>MINOR QC <b>{qcMetrics.qcHealth.openMinor}</b></span>
          <span>RESOLVED <b style={{ color: "#457a32" }}>{qcMetrics.qcHealth.resolved}</b></span>
          <span>WAIVED <b>{qcMetrics.qcHealth.waived}</b></span>
          <span>CONTINUITY OPEN <b style={{ color: qcMetrics.continuityHealth.open > 0 ? "#b37b19" : "#546e40" }}>{qcMetrics.continuityHealth.open}</b></span>
          <span>VIDEO APPROVED <b style={{ color: "#457a32" }}>{qcMetrics.videoCounts.approved}</b></span>
          <span>MISSING ON DISK <b style={{ color: qcMetrics.assetHealth.missingOnDisk > 0 ? "#ba3932" : "#546e40" }}>{qcMetrics.assetHealth.missingOnDisk}</b></span>
        </div>
      </section>

      {/* ATTENTION LIST (OBJECTIVE WORK QUEUE) */}
      <section className="panel" style={{ marginTop: "14px", padding: "18px 20px" }}>
        <div className="panel-heading" style={{ marginBottom: "12px" }}>
          <div>
            <p className="eyebrow">OBJECTIVE WORK QUEUE</p>
            <h2 style={{ margin: 0, fontSize: "15px" }}>Daftar Perhatian ({qcMetrics.attentionItems.length})</h2>
          </div>
        </div>

        {qcMetrics.attentionItems.length === 0 ? (
          <p className="empty-inline" style={{ margin: 0 }}>
            Tidak ada item perhatian aktif. Seluruh berkas lengkap, tidak ada issue QC kritis/major terbuka, dan tidak ada kegagalan job.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {qcMetrics.attentionItems.map((item) => (
              <div
                key={item.id}
                style={{
                  background: item.severity === "CRITICAL" ? "#fff6f5" : item.severity === "MAJOR" ? "#fffcf4" : "#fbfcfb",
                  border: `1px solid ${item.severity === "CRITICAL" ? "#f8d5d1" : item.severity === "MAJOR" ? "#f8e8c8" : "#e3e8e4"}`,
                  borderRadius: "6px",
                  padding: "10px 12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        padding: "1px 5px",
                        borderRadius: "3px",
                        background: item.severity === "CRITICAL" ? "#fae2e0" : item.severity === "MAJOR" ? "#fdf1d5" : "#edf1ee",
                        color: item.severity === "CRITICAL" ? "#ad3227" : item.severity === "MAJOR" ? "#966512" : "#57665c",
                      }}
                    >
                      {item.severity}
                    </span>
                    <strong style={{ fontSize: "11px", color: "#2d3a32" }}>{item.title}</strong>
                  </div>
                  <span style={{ fontSize: "10px", color: "#66756c" }}>{item.description}</span>
                </div>

                {item.linkHref && (
                  <Link
                    href={item.linkHref}
                    className="button button-quiet"
                    style={{ height: "24px", fontSize: "10px", padding: "0 8px", whiteSpace: "nowrap" }}
                  >
                    Buka →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
