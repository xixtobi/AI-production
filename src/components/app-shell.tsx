"use client";

import Link from "next/link";
import { CommandPaletteModal } from "./command-palette-modal";

type AppShellProps = {
  children: React.ReactNode;
  active?: "Proyek" | "Pengaturan" | "AI Riwayat" | "Cadangan";
  projectId?: string;
  projectName?: string;
  projectSection?:
    | "Dashboard"
    | "Konten"
    | "Shot"
    | "Production Board"
    | "Flow Queue"
    | "Asset"
    | "Story Bible"
    | "Cadangan";
};

export function AppShell({ children, active = "Proyek", projectId, projectSection }: AppShellProps) {
  return (
    <div className="app-frame">
      <CommandPaletteModal />
      <aside className="sidebar">
        <Link href="/" className="brand-lockup">
          <span className="brand-icon">
            <span />
          </span>
          <span className="brand-text">
            LOCAL<span>PRODUCTION CONTROL</span>
          </span>
        </Link>
        <div className="workspace-label">
          WORKSPACE <button aria-label="Pilihan workspace">⌄</button>
        </div>
        <nav className="main-nav" aria-label="Navigasi utama">
          <Link href="/" className={active === "Proyek" ? "nav-link selected" : "nav-link"}>
            <span className="nav-symbol">▦</span>Proyek
            <span className="nav-count">⌘1</span>
          </Link>
          <Link href="/ai/history" className={active === "AI Riwayat" ? "nav-link selected" : "nav-link"}>
            <span className="nav-symbol">◷</span>AI Riwayat
          </Link>
          <Link href="/settings" className={active === "Pengaturan" ? "nav-link selected" : "nav-link"}>
            <span className="nav-symbol">⚙</span>Pengaturan Sistem
          </Link>
        </nav>
        {projectId && (
          <div className="project-nav">
            <span>NAVIGASI PROYEK</span>
            <Link
              className={projectSection === "Dashboard" ? "project-nav-link current" : "project-nav-link"}
              href={`/projects/${projectId}`}
            >
              ▤ <span>Dashboard</span>
            </Link>
            <Link
              className={projectSection === "Production Board" ? "project-nav-link current" : "project-nav-link"}
              href={`/projects/${projectId}/production-board`}
            >
              📋 <span>Production Board</span>
            </Link>
            <Link
              className={projectSection === "Konten" ? "project-nav-link current" : "project-nav-link"}
              href={`/projects/${projectId}/content`}
            >
              ▣ <span>Konten</span>
            </Link>
            <Link
              className={projectSection === "Shot" ? "project-nav-link current" : "project-nav-link"}
              href={`/projects/${projectId}/shots`}
            >
              ◫ <span>Shot</span>
            </Link>
            <Link
              className={projectSection === "Flow Queue" ? "project-nav-link current" : "project-nav-link"}
              href={`/projects/${projectId}/flow`}
            >
              ⚡ <span>Flow Queue</span>
            </Link>
            <Link
              className={projectSection === "Asset" ? "project-nav-link current" : "project-nav-link"}
              href={`/projects/${projectId}/assets`}
            >
              ▧ <span>Aset & file</span>
            </Link>
            <Link
              className={projectSection === "Story Bible" ? "project-nav-link current" : "project-nav-link"}
              href={`/projects/${projectId}/story-bible`}
            >
              📖 <span>Story Bible</span>
            </Link>
            <Link
              className={projectSection === "Cadangan" ? "project-nav-link current" : "project-nav-link"}
              href={`/projects/${projectId}/backups`}
            >
              🛡 <span>Cadangan & Rilis</span>
            </Link>
          </div>
        )}

        <div className="sidebar-bottom">
          <span className="avatar">L</span>
          <div>
            <strong>Produksi Lokal</strong>
            <small>v1.0.0 Siap Produksi</small>
          </div>
          <button aria-label="Menu pengguna">•••</button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <b>/</b>
            <strong>{active}</strong>
          </div>
          <div className="topbar-right" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => {
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
              }}
              style={{
                background: "#27272a",
                border: "1px solid #3f3f46",
                color: "#a1a1aa",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
              }}
            >
              <span>🔍</span>
              <span>Cari / Perintah</span>
              <kbd style={{ background: "#18181b", padding: "1px 5px", borderRadius: "3px", fontSize: "10px" }}>
                Ctrl+K
              </kbd>
            </button>
            <span
              style={{
                background: "#059669",
                color: "#ffffff",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.5px",
              }}
            >
              v1.0.0
            </span>
            <span className="local-indicator">
              <i /> Tersimpan lokal
            </span>
            <Link href="/settings" className="help-button" aria-label="Pengaturan Sistem" title="Pengaturan Sistem">
              ⚙
            </Link>
          </div>
        </header>
        <div className="page-content">{children}</div>
        <footer className="app-footer">
          <span>LOCAL PRODUCTION CONTROL • v1.0.0</span>
          <span>LOKAL • PRIBADI • SIAP PRODUKSI</span>
        </footer>
      </main>
    </div>
  );
}
