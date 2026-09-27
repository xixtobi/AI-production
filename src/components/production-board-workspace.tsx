"use client";

import { useState } from "react";
import Link from "next/link";
import type { Shot, ContentItem, VideoOutput } from "@/lib/db/schema";

interface ShotCardData {
  shot: Shot;
  contentCode: string;
  latestVideo?: VideoOutput;
  openQcCount: number;
  hasCriticalOrMajorQc: boolean;
}

interface ProductionBoardWorkspaceProps {
  projectId: string;
  projectName: string;
  shots: ShotCardData[];
  contents: ContentItem[];
}

const COLUMNS: Array<{ key: string; label: string; bg: string; border: string }> = [
  { key: "NOT_STARTED", label: "NOT STARTED", bg: "#f7f9f8", border: "#e1e7e3" },
  { key: "IN_PROGRESS", label: "IN PROGRESS", bg: "#f0f6fc", border: "#d0e2f5" },
  { key: "NEEDS_REVISION", label: "NEEDS REVISION", bg: "#fffcf0", border: "#faeec2" },
  { key: "APPROVED", label: "APPROVED", bg: "#f2f9f2", border: "#d4edd4" },
  { key: "FINAL", label: "FINAL", bg: "#f5f2fa", border: "#e3daf5" },
  { key: "BLOCKED", label: "BLOCKED", bg: "#fdf3f2", border: "#f7d5d2" },
];

export function ProductionBoardWorkspace({
  projectId,
  projectName,
  shots: initialShots,
  contents,
}: ProductionBoardWorkspaceProps) {
  const [shots, setShots] = useState<ShotCardData[]>(initialShots);
  const [contentFilter, setContentFilter] = useState<string>("");
  const [updatingShotId, setUpdatingShotId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const filteredShots = shots.filter((s) => {
    if (contentFilter && s.shot.contentItemId !== contentFilter) return false;
    return true;
  });

  const handleStatusChange = async (shotId: string, newStatus: string) => {
    setUpdatingShotId(shotId);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/shots/${shotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal memperbarui status shot.");
      }

      setShots((prev) =>
        prev.map((item) =>
          item.shot.id === shotId
            ? { ...item, shot: { ...item.shot, status: newStatus as Shot["status"] } }
            : item
        )
      );
      setNotice({ message: `Status shot berhasil diubah ke ${newStatus}.`, type: "success" });
    } catch (err: unknown) {
      setNotice({
        message: err instanceof Error ? err.message : "Gagal memindahkan shot.",
        type: "error",
      });
    } finally {
      setUpdatingShotId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Header & Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
        <div>
          <p className="eyebrow">PRODUCTION WORKFLOW BOARD</p>
          <h1 style={{ margin: "2px 0 0", fontSize: "24px" }}>Production Board</h1>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#6c7a72" }}>
            Papan status produksi shot ({projectName}) — Pantau progres per kolom status dari Not Started hingga Final.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <select
            value={contentFilter}
            onChange={(e) => setContentFilter(e.target.value)}
            style={{
              height: "36px",
              padding: "0 10px",
              borderRadius: "6px",
              border: "1px solid #d2ddd6",
              fontSize: "11px",
              background: "#fff",
            }}
          >
            <option value="">Semua Konten / Episode ({shots.length} Shot)</option>
            {contents.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>

          <Link
            href={`/projects/${projectId}`}
            className="button button-secondary"
            style={{ height: "36px" }}
          >
            ← Kembali ke Dashboard
          </Link>
        </div>
      </div>

      {notice && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "6px",
            fontSize: "11px",
            background: notice.type === "success" ? "#eaf5e9" : "#fdf0ee",
            color: notice.type === "success" ? "#2e6829" : "#a83227",
            border: `1px solid ${notice.type === "success" ? "#c7e4c5" : "#f6cac5"}`,
          }}
        >
          {notice.message}
        </div>
      )}

      {/* Kanban Columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(220px, 1fr))",
          gap: "14px",
          overflowX: "auto",
          paddingBottom: "16px",
        }}
      >
        {COLUMNS.map((col) => {
          const columnShots = filteredShots.filter((s) => s.shot.status === col.key);

          return (
            <div
              key={col.key}
              style={{
                background: col.bg,
                border: `1px solid ${col.border}`,
                borderRadius: "10px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                minHeight: "500px",
              }}
            >
              {/* Column Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid rgba(0,0,0,0.06)",
                  paddingBottom: "8px",
                }}
              >
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px" }}>
                  {col.label}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    background: "rgba(0,0,0,0.06)",
                    padding: "2px 7px",
                    borderRadius: "12px",
                  }}
                >
                  {columnShots.length}
                </span>
              </div>

              {/* Cards List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                {columnShots.map(({ shot, contentCode, latestVideo, openQcCount, hasCriticalOrMajorQc }) => (
                  <div
                    key={shot.id}
                    style={{
                      background: "#fff",
                      border: "1px solid #e2e8e4",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                      opacity: updatingShotId === shot.id ? 0.6 : 1,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Link
                        href={`/projects/${projectId}/shots/${shot.id}`}
                        style={{
                          fontFamily: "Consolas, monospace",
                          fontWeight: 700,
                          fontSize: "11px",
                          color: "#2c5b36",
                          textDecoration: "none",
                        }}
                      >
                        {shot.shotCode} ↗
                      </Link>
                      <span style={{ fontSize: "9px", color: "#8a968f", fontWeight: 600 }}>
                        {contentCode}
                      </span>
                    </div>

                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#36453c", lineHeight: 1.3 }}>
                      {shot.title || "Belum diberi judul"}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "9px", color: "#839088" }}>
                      <span>Target: {shot.durationTarget ? `${shot.durationTarget}s` : "-"}</span>
                      {latestVideo && (
                        <span
                          style={{
                            background: "#eaf2fb",
                            color: "#3d6c97",
                            padding: "1px 5px",
                            borderRadius: "4px",
                            fontWeight: 600,
                          }}
                        >
                          🎬 {latestVideo.versionLabel}
                        </span>
                      )}
                    </div>

                    {/* Open QC Indicator */}
                    {openQcCount > 0 && (
                      <div
                        style={{
                          fontSize: "9px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontWeight: 700,
                          background: hasCriticalOrMajorQc ? "#fde8e7" : "#fef8e7",
                          color: hasCriticalOrMajorQc ? "#ba3f35" : "#946a16",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          width: "fit-content",
                        }}
                      >
                        ⚠️ {openQcCount} Issue QC Terbuka
                      </div>
                    )}

                    {/* Status Mover Selector */}
                    <div style={{ marginTop: "4px", borderTop: "1px solid #f2f5f3", paddingTop: "6px" }}>
                      <select
                        value={shot.status}
                        onChange={(e) => handleStatusChange(shot.id, e.target.value)}
                        disabled={updatingShotId === shot.id}
                        style={{
                          width: "100%",
                          fontSize: "9px",
                          padding: "3px 5px",
                          borderRadius: "4px",
                          border: "1px solid #d2ded5",
                          background: "#fbfcfb",
                          fontWeight: 600,
                          color: "#4e5e54",
                        }}
                      >
                        {COLUMNS.map((c) => (
                          <option key={c.key} value={c.key}>
                            Pindah: {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}

                {columnShots.length === 0 && (
                  <div
                    style={{
                      padding: "20px 10px",
                      textAlign: "center",
                      color: "#a4b0a8",
                      fontSize: "10px",
                      border: "1px dashed rgba(0,0,0,0.08)",
                      borderRadius: "6px",
                      marginTop: "4px",
                    }}
                  >
                    Kosong
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
