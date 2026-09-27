import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { listProjects } from "@/lib/projects/service";
import { projectTypes } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const typeLabels: Record<(typeof projectTypes)[number], string> = {
  ANIMATION_SERIES: "Serial Animasi", UGC_SERIES: "Serial UGC", YOUTUBE: "YouTube",
  SHORT_FILM: "Film Pendek", ADVERTISEMENT: "Iklan", DOCUMENTARY: "Dokumenter", OTHER: "Lainnya",
};

const projectColors = ["tile-violet", "tile-blue", "tile-orange", "tile-green"];

export default function ProjectsPage() {
  const projects = listProjects();

  return (
    <AppShell active="Proyek">
      <div className="welcome-band"><div><span className="welcome-tag"><i /> RUANG KERJA LOKAL</span><h1>Produksi, <em>terkendali.</em></h1><p>Semua proyek video dan animasi, tertata di satu tempat.</p></div><div className="welcome-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-core">▶</div><span className="art-star">✳</span><span className="art-dot dot-one"/><span className="art-dot dot-two"/></div></div>
      <div className="section-heading"><div><p className="eyebrow">RUANG KERJA</p><h2>Proyek Anda <span className="count-chip">{projects.length}</span></h2></div><Link href="/projects/new" className="button button-primary"><span className="plus">＋</span> Proyek baru</Link></div>

      {projects.length === 0 ? (
        <section className="empty-state"><div className="empty-illustration"><span className="empty-sheet sheet-back"/><span className="empty-sheet sheet-front"><i/><i/><i/></span><span className="empty-spark">✳</span></div><p className="eyebrow">MULAI DARI SINI</p><h3>Belum ada proyek</h3><p>Buat proyek pertama untuk mulai mengatur produksi video Anda.</p><Link href="/projects/new" className="button button-primary">＋ Buat proyek pertama</Link></section>
      ) : (
        <div className="project-grid">{projects.map((project, index) => <Link href={`/projects/${project.id}`} className="project-card" key={project.id}><div className={`project-card-art ${projectColors[index % projectColors.length]}`}><span className="card-code">{project.code}</span><span className="card-glyph">{project.projectType === "ANIMATION_SERIES" ? "◌" : project.projectType === "UGC_SERIES" ? "◉" : "▧"}</span><span className="card-art-label">LOCAL PROJECT</span></div><div className="project-card-body"><div className="project-card-title"><h3>{project.name}</h3><span className="card-menu">•••</span></div><div className="project-card-meta"><span>{typeLabels[project.projectType]}</span><span className="tiny-dot"/><span>{project.defaultAspectRatio}</span></div><div className="project-card-bottom"><span className="status-pill compact"><i/> Belum dimulai</span><span className="project-arrow">↗</span></div></div></Link>)}<Link href="/projects/new" className="add-project-card"><span className="add-project-icon">＋</span><strong>Tambah proyek</strong><span>Atur ruang kerja baru</span></Link></div>
      )}
      <div className="storage-note"><span className="storage-icon">▣</span><span>Semua data proyek tersimpan di komputer ini.</span><span className="storage-path">DATABASE LOKAL <i/></span></div>
    </AppShell>
  );
}
