"use client";

import { useState } from "react";
import Link from "next/link";
import type { VideoOutput, FlowQueueItem, PromptVersion, AssetVersion, Asset, GenerationAttempt, VideoOutputStatus } from "@/lib/db/schema";

interface ShotFlowWorkspaceProps {
  projectId: string;
  shotId: string;
  shotCode: string;
  activePromptVersion: PromptVersion | null;
  startFrame: { asset: Asset; version: AssetVersion } | null;
  queueItems: Array<{
    item: FlowQueueItem;
    attempts: GenerationAttempt[];
  }>;
  initialVideoOutputs: VideoOutput[];
}

export function ShotFlowWorkspace({
  projectId,
  shotId,
  shotCode,
  activePromptVersion,
  startFrame,
  queueItems,
  initialVideoOutputs,
}: ShotFlowWorkspaceProps) {
  const [videoOutputs, setVideoOutputs] = useState<VideoOutput[]>(initialVideoOutputs);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [videoPath, setVideoPath] = useState("");
  const [selectedQueueItemId, setSelectedQueueItemId] = useState<string>(
    queueItems.length > 0 ? queueItems[0].item.id : ""
  );
  const [videoNotes, setVideoNotes] = useState("");
  const [creditsUsed, setCreditsUsed] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const refreshOutputs = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/shots/${shotId}/video-outputs`);
      if (res.ok) {
        const data = await res.json();
        setVideoOutputs(data.outputs || []);
      }
    } catch {
      // Ignore
    }
  };

  const handleRegisterVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoPath.trim()) return;
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/shots/${shotId}/video-outputs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: videoPath.trim(),
          flowQueueItemId: selectedQueueItemId || null,
          notes: videoNotes.trim(),
          creditsUsed: creditsUsed !== "" ? Number(creditsUsed) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mendaftarkan video output.");
      setNotice({
        message: `Video output ${data.videoOutput.versionLabel} (${data.videoOutput.fileName}) berhasil didaftarkan!`,
        type: "success",
      });
      setIsRegisterOpen(false);
      setVideoPath("");
      setVideoNotes("");
      setCreditsUsed("");
      await refreshOutputs();
    } catch (err: unknown) {
      setNotice({ message: err instanceof Error ? err.message : String(err), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleVideoAction = async (outputId: string, action: "reveal" | "open" | "copy-path") => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/shots/${shotId}/video-outputs/${outputId}/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (action === "copy-path") {
        setNotice({ message: "Path video disalin ke clipboard Windows!", type: "success" });
      }
    } catch (err: unknown) {
      setNotice({ message: err instanceof Error ? err.message : String(err), type: "error" });
    }
  };

  const handleOutputStatusChange = async (outputId: string, status: VideoOutputStatus) => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/shots/${shotId}/video-outputs/${outputId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      if (res.ok) {
        await refreshOutputs();
      }
    } catch {
      // Ignore
    }
  };

  const handlePrepareQueueItem = async (itemId: string) => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/flow/${itemId}/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createPackage: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyiapkan Flow job.");
      setNotice({ message: `Job berhasil disiapkan di folder: ${data.jobDirectory}`, type: "success" });
    } catch (err: unknown) {
      setNotice({ message: err instanceof Error ? err.message : String(err), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGoogleFlow = () => {
    window.open("https://flow.google.com/", "_blank");
  };

  return (
    <div style={{ marginTop: "24px" }}>
      {notice && (
        <div
          className={notice.type === "success" ? "ai-review-banner" : "form-error"}
          style={{ marginBottom: "16px" }}
        >
          <strong>{notice.type === "success" ? "✓ Informasi" : "⚠ Terjadi Kesalahan"}</strong>
          <p style={{ margin: "4px 0 0" }}>{notice.message}</p>
        </div>
      )}

      {/* Grid: PROMPT, KEYFRAME, FLOW QUEUE */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginBottom: "20px" }}>
        
        {/* 1. PROMPT */}
        <section className="panel">
          <div className="panel-heading" style={{ marginBottom: "12px" }}>
            <div>
              <p className="eyebrow">PRODUCTION PROMPT</p>
              <h2>Prompt Aktif</h2>
            </div>
            <Link
              href={`/projects/${projectId}/shots/${shotId}/prompts`}
              className="button button-quiet"
              style={{ height: "26px", fontSize: "10px" }}
            >
              🎨 Prompt Studio →
            </Link>
          </div>
          {activePromptVersion ? (
            <div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "8px" }}>
                <span className="version-chip active">{activePromptVersion.versionLabel}</span>
                <span className="param-pill">{activePromptVersion.source}</span>
                {activePromptVersion.isLocked && <span className="version-tag-locked">LOCKED</span>}
              </div>
              <p
                style={{
                  fontSize: "11px",
                  lineHeight: "1.5",
                  color: "#35443c",
                  background: "#f9fbf9",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8e3",
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  maxHeight: "120px",
                  overflowY: "auto",
                }}
              >
                {activePromptVersion.promptText}
              </p>
            </div>
          ) : (
            <p className="empty-inline" style={{ margin: 0, padding: "14px" }}>
              Belum ada prompt untuk shot ini. Buka Prompt Studio untuk menyusunnya.
            </p>
          )}
        </section>

        {/* 2. KEYFRAME */}
        <section className="panel">
          <div className="panel-heading" style={{ marginBottom: "12px" }}>
            <div>
              <p className="eyebrow">VISUAL KEYFRAME</p>
              <h2>Start Frame Reference</h2>
            </div>
          </div>
          {startFrame ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "6px",
                    background: "#e8f4fc",
                    color: "#28638c",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                    fontSize: "12px",
                  }}
                >
                  KF
                </div>
                <div>
                  <strong style={{ fontSize: "12px" }}>{startFrame.asset.assetCode} · {startFrame.asset.name}</strong>
                  <div style={{ fontSize: "10px", color: "#74847b", marginTop: "2px" }}>
                    {startFrame.version.filename}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: "10px", color: "#6b7d73" }}>
                <code>{startFrame.version.relativePath}</code>
              </div>
            </div>
          ) : (
            <p className="empty-inline" style={{ margin: 0, padding: "14px" }}>
              Belum ada start frame keyframe yang ditautkan ke shot ini.
            </p>
          )}
        </section>

        {/* 3. FLOW QUEUE SUMMARY */}
        <section className="panel">
          <div className="panel-heading" style={{ marginBottom: "12px" }}>
            <div>
              <p className="eyebrow">FLOW INTEGRATION</p>
              <h2>Flow Queue ({queueItems.length})</h2>
            </div>
            <Link
              href={`/projects/${projectId}/flow?shotId=${shotId}`}
              className="button button-quiet"
              style={{ height: "26px", fontSize: "10px" }}
            >
              Lihat di Queue →
            </Link>
          </div>
          {queueItems.length > 0 ? (
            <div style={{ display: "grid", gap: "8px" }}>
              {queueItems.map(({ item, attempts }) => (
                <div
                  key={item.id}
                  style={{
                    padding: "9px 11px",
                    background: "#f9fbf9",
                    border: "1px solid #e5ede7",
                    borderRadius: "7px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span className="model-tag" style={{ fontSize: "8px" }}>{item.model}</span>
                      <span className="queue-status-tag" style={{ fontSize: "8px", fontWeight: 700 }}>{item.status}</span>
                    </div>
                    <div style={{ fontSize: "9px", color: "#75857c", marginTop: "3px" }}>
                      {item.durationSeconds}s · {item.aspectRatio} · {attempts.length} Attempt
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      type="button"
                      className="button button-secondary"
                      style={{ height: "24px", padding: "0 6px", fontSize: "9px" }}
                      onClick={() => handlePrepareQueueItem(item.id)}
                    >
                      📦 Prepare
                    </button>
                    <button
                      type="button"
                      className="button button-primary"
                      style={{ height: "24px", padding: "0 6px", fontSize: "9px" }}
                      onClick={handleOpenGoogleFlow}
                    >
                      🌐 Flow
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-inline" style={{ margin: 0, padding: "14px" }}>
              Belum ada job Flow Queue untuk shot ini. Tambahkan melalui Prompt Studio.
            </p>
          )}
        </section>

      </div>

      {/* 4. VIDEO OUTPUTS */}
      <section className="panel">
        <div className="panel-heading" style={{ marginBottom: "14px" }}>
          <div>
            <p className="eyebrow">FINAL VIDEO RENDERS</p>
            <h2>Video Outputs ({videoOutputs.length})</h2>
          </div>
          <button
            type="button"
            className="button button-primary"
            onClick={() => setIsRegisterOpen(true)}
          >
            🎬 Register Video Output
          </button>
        </div>

        {videoOutputs.length === 0 ? (
          <p className="empty-inline">
            Belum ada file video output yang didaftarkan untuk shot ini. Setelah selesai men-generate video di Google Flow, unduh file video ke project folder dan daftarkan di sini.
          </p>
        ) : (
          <div className="video-outputs-grid">
            {videoOutputs.map((output) => (
              <div className="video-output-card" key={output.id}>
                {/* HTML5 Video Player Preview */}
                <div className="video-player-wrap">
                  <video
                    controls
                    preload="metadata"
                    src={`/api/projects/${projectId}/shots/${shotId}/video-outputs/${output.id}/preview`}
                  />
                </div>

                {/* Metadata & Controls */}
                <div className="video-meta-body">
                  <div className="video-header-row">
                    <span className="video-version-tag">{output.versionLabel}</span>
                    <select
                      value={output.status}
                      onChange={(e) => handleOutputStatusChange(output.id, e.target.value as VideoOutputStatus)}
                      style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        border: "1px solid #c9d8ce",
                        background: "#fff",
                        fontWeight: 600,
                      }}
                    >
                      <option value="NOT_STARTED">NOT_STARTED</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="NEEDS_REVISION">NEEDS_REVISION</option>
                      <option value="BLOCKED">BLOCKED</option>
                      <option value="FINAL">FINAL</option>
                    </select>
                  </div>

                  <strong style={{ fontSize: "12px", display: "block", color: "#223328", marginBottom: "4px" }}>
                    {output.fileName}
                  </strong>

                  <div className="video-specs">
                    {output.durationSeconds != null && (
                      <span className="param-pill">⏱ {output.durationSeconds}s</span>
                    )}
                    {output.resolution && <span className="param-pill">📐 {output.resolution}</span>}
                    {output.model && <span className="model-tag" style={{ fontSize: "8px" }}>{output.model}</span>}
                    {output.creditsUsed != null && (
                      <span className="param-pill">💳 {output.creditsUsed} credits</span>
                    )}
                  </div>

                  {output.notes && (
                    <p style={{ fontSize: "10px", color: "#5a6860", margin: "6px 0", lineHeight: "1.4" }}>
                      {output.notes}
                    </p>
                  )}

                  <div style={{ fontSize: "9px", color: "#8a9990", marginTop: "4px" }}>
                    <code>{output.filePath}</code>
                  </div>

                  {/* Actions */}
                  <div className="video-actions-row">
                    <button
                      type="button"
                      className="button button-secondary"
                      style={{ height: "24px", padding: "0 8px", fontSize: "9px" }}
                      onClick={() => handleVideoAction(output.id, "reveal")}
                      title="Tampilkan di Windows Explorer"
                    >
                      👁 Reveal
                    </button>
                    <button
                      type="button"
                      className="button button-quiet"
                      style={{ height: "24px", padding: "0 8px", fontSize: "9px" }}
                      onClick={() => handleVideoAction(output.id, "open")}
                      title="Buka file dengan aplikasi pemutar video bawaan"
                    >
                      ↗ Open File
                    </button>
                    <button
                      type="button"
                      className="button button-quiet"
                      style={{ height: "24px", padding: "0 8px", fontSize: "9px" }}
                      onClick={() => handleVideoAction(output.id, "copy-path")}
                      title="Salin path Windows ke clipboard"
                    >
                      📋 Copy Path
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal: Register Video Output */}
      {isRegisterOpen && (
        <div className="studio-modal-backdrop">
          <div className="studio-modal" style={{ maxWidth: "560px" }}>
            <div className="panel-heading" style={{ marginBottom: "14px" }}>
              <div>
                <p className="eyebrow">OUTPUT REGISTRATION</p>
                <h2>Daftarkan Video Output untuk {shotCode}</h2>
              </div>
              <button
                type="button"
                className="button button-quiet"
                onClick={() => setIsRegisterOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterVideo}>
              <div style={{ display: "grid", gap: "12px" }}>
                <div className="field">
                  <span>File Path Video (.mp4, .mov, .webm) <b>*</b></span>
                  <input
                    type="text"
                    required
                    placeholder="misal: EP01/SH016/VIDEO/EP01_SH016_VID_V01.mp4 atau path absolut"
                    value={videoPath}
                    onChange={(e) => setVideoPath(e.target.value)}
                  />
                  <small>
                    File harus berada di dalam folder project root. File tidak akan diubah atau dipindahkan.
                  </small>
                </div>

                <div className="form-grid">
                  <div className="field">
                    <span>Hubungkan ke Job Flow Queue</span>
                    <select
                      value={selectedQueueItemId}
                      onChange={(e) => setSelectedQueueItemId(e.target.value)}
                    >
                      <option value="">Tidak ditautkan (Manual)</option>
                      {queueItems.map(({ item }) => (
                        <option key={item.id} value={item.id}>
                          {item.model} · {item.durationSeconds}s ({item.status})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <span>Kredit yang Digunakan (Opsional)</span>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="misal: 10"
                      value={creditsUsed}
                      onChange={(e) => setCreditsUsed(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="field">
                  <span>Catatan Produksi</span>
                  <textarea
                    rows={2}
                    placeholder="Catatan hasil generasi..."
                    value={videoNotes}
                    onChange={(e) => setVideoNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-actions" style={{ marginTop: "18px" }}>
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setIsRegisterOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={loading || !videoPath.trim()}
                >
                  {loading ? "Mendaftarkan..." : "Daftarkan Video"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
