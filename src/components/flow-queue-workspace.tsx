"use client";

import { useState } from "react";
import Link from "next/link";
import type { FlowModelCapability, FlowQueueItemDetail, FlowQueueStatus } from "@/lib/flow/types";

interface FlowQueueWorkspaceProps {
  projectId: string;
  initialItems: FlowQueueItemDetail[];
  availableModels: FlowModelCapability[];
  contents: Array<{ id: string; code: string; title: string }>;
  summary: {
    total: number;
    ready: number;
    generating: number;
    completed: number;
    needsReview: number;
    failed: number;
    blocked: number;
  };
}

export function FlowQueueWorkspace({
  projectId,
  initialItems,
  availableModels,
  contents,
  summary: initialSummary,
}: FlowQueueWorkspaceProps) {
  const [items, setItems] = useState<FlowQueueItemDetail[]>(initialItems);
  const [summary, setSummary] = useState(initialSummary);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filters
  const [search, setSearch] = useState("");
  const [contentFilter, setContentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [readyStateFilter, setReadyStateFilter] = useState<"" | "READY" | "NOT_READY">("");

  // Modals & UI States
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Register Video Modal
  const [registerModalItem, setRegisterModalItem] = useState<FlowQueueItemDetail | null>(null);
  const [videoFilePath, setVideoFilePath] = useState("");
  const [videoNotes, setVideoNotes] = useState("");
  const [videoCredits, setVideoCredits] = useState<number | "">("");
  const [registering, setRegistering] = useState(false);

  // Recipe Snapshot Modal
  const [recipeModalItem, setRecipeModalItem] = useState<FlowQueueItemDetail | null>(null);

  const refreshItems = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/flow`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
      const sumRes = await fetch(`/api/projects/${projectId}/flow/summary`);
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData.summary);
      }
    } catch {
      // Ignore background refresh errors
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const readyIds = filteredItems.filter((i) => i.item.status === "READY").map((i) => i.item.id);
      setSelectedIds(new Set(readyIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handlePrepareJob = async (itemId: string, createPackage = false) => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/flow/${itemId}/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createPackage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyiapkan Flow job.");
      setNotice({ message: `Job berhasil disiapkan di: ${data.jobDirectory}`, type: "success" });
      await refreshItems();
    } catch (err: unknown) {
      setNotice({ message: err instanceof Error ? err.message : String(err), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleBatchPrepare = async (createPackage = false) => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/flow/batch-prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: Array.from(selectedIds), createPackage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal batch prepare.");
      const successCount = (data.results as Array<{ success: boolean }>).filter((r) => r.success).length;
      setNotice({
        message: `${successCount} dari ${selectedIds.size} job berhasil disiapkan di folder lokal masing-masing.`,
        type: "success",
      });
      setSelectedIds(new Set());
      await refreshItems();
    } catch (err: unknown) {
      setNotice({ message: err instanceof Error ? err.message : String(err), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGoogleFlow = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/flow/open-browser`, { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch {
      window.open("https://flow.google.com/", "_blank");
    }
  };

  const handleCopyPrompt = async (item: FlowQueueItemDetail) => {
    const text = item.promptVersion.promptText;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        await fetch(`/api/projects/${projectId}/flow/${item.item.id}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "copy-prompt" }),
        });
      }
      setNotice({ message: `Prompt ${item.shot.shotCode} disalin ke clipboard!`, type: "success" });
    } catch {
      setNotice({ message: "Gagal menyalin prompt.", type: "error" });
    }
  };

  const handleCopyRecipe = async (item: FlowQueueItemDetail) => {
    const text = item.item.recipeSnapshotJson;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        await fetch(`/api/projects/${projectId}/flow/${item.item.id}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "copy-recipe" }),
        });
      }
      setNotice({ message: `Recipe snapshot ${item.shot.shotCode} disalin!`, type: "success" });
    } catch {
      setNotice({ message: "Gagal menyalin recipe.", type: "error" });
    }
  };

  const handleRevealStartFrame = async (itemId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/flow/${itemId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reveal-start-frame" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (err: unknown) {
      setNotice({ message: err instanceof Error ? err.message : String(err), type: "error" });
    }
  };

  const handleRevealEndFrame = async (itemId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/flow/${itemId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reveal-end-frame" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (err: unknown) {
      setNotice({ message: err instanceof Error ? err.message : String(err), type: "error" });
    }
  };

  const handleRevealReference = async (itemId: string, assetVersionId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/flow/${itemId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reveal-reference", assetVersionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (err: unknown) {
      setNotice({ message: err instanceof Error ? err.message : String(err), type: "error" });
    }
  };

  const handleStatusChange = async (itemId: string, newStatus: FlowQueueStatus) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/flow/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await refreshItems();
      }
    } catch {
      // Ignore error
    }
  };

  const handleRegisterVideoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerModalItem || !videoFilePath.trim()) return;
    setRegistering(true);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/shots/${registerModalItem.shot.id}/video-outputs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filePath: videoFilePath.trim(),
            flowQueueItemId: registerModalItem.item.id,
            model: registerModalItem.item.model,
            notes: videoNotes.trim(),
            creditsUsed: videoCredits !== "" ? Number(videoCredits) : null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mendaftarkan video output.");
      setNotice({
        message: `Video output ${data.videoOutput.versionLabel} (${data.videoOutput.fileName}) berhasil didaftarkan ke shot ${registerModalItem.shot.shotCode}!`,
        type: "success",
      });
      setRegisterModalItem(null);
      setVideoFilePath("");
      setVideoNotes("");
      setVideoCredits("");
      await refreshItems();
    } catch (err: unknown) {
      setNotice({ message: err instanceof Error ? err.message : String(err), type: "error" });
    } finally {
      setRegistering(false);
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    if (contentFilter && item.item.contentItemId !== contentFilter) return false;
    if (statusFilter && item.item.status !== statusFilter) return false;
    if (modelFilter && item.item.model !== modelFilter) return false;
    if (readyStateFilter === "READY" && item.item.status !== "READY") return false;
    if (readyStateFilter === "NOT_READY" && item.item.status === "READY") return false;
    if (search) {
      const q = search.toLowerCase();
      const matchShot = item.shot.shotCode.toLowerCase().includes(q) || item.shot.title.toLowerCase().includes(q);
      const matchPrompt = item.promptVersion.promptText.toLowerCase().includes(q);
      const matchModel = item.item.model.toLowerCase().includes(q);
      if (!matchShot && !matchPrompt && !matchModel) return false;
    }
    return true;
  });

  return (
    <div>
      {/* Notice Banner */}
      {notice && (
        <div
          className={notice.type === "success" ? "ai-review-banner" : "form-error"}
          style={{ marginBottom: "16px" }}
        >
          <strong>{notice.type === "success" ? "✓ Informasi" : "⚠ Terjadi Kesalahan"}</strong>
          <p style={{ margin: "4px 0 0" }}>{notice.message}</p>
        </div>
      )}

      {/* Production Summary Bar */}
      <div className="flow-summary-bar">
        <div className="flow-stat-card">
          <small>Total Jobs</small>
          <strong>{summary.total}</strong>
        </div>
        <div className="flow-stat-card">
          <small style={{ color: "#457a32" }}>Ready</small>
          <strong style={{ color: "#457a32" }}>{summary.ready}</strong>
        </div>
        <div className="flow-stat-card">
          <small style={{ color: "#2d6da3" }}>Generating</small>
          <strong style={{ color: "#2d6da3" }}>{summary.generating}</strong>
        </div>
        <div className="flow-stat-card">
          <small style={{ color: "#546e40" }}>Completed</small>
          <strong>{summary.completed}</strong>
        </div>
        <div className="flow-stat-card">
          <small style={{ color: "#b37b19" }}>Needs Review</small>
          <strong style={{ color: "#b37b19" }}>{summary.needsReview}</strong>
        </div>
        <div className="flow-stat-card">
          <small style={{ color: "#ba3932" }}>Blocked / Failed</small>
          <strong style={{ color: "#ba3932" }}>{summary.blocked + summary.failed}</strong>
        </div>
      </div>

      {/* Filter and Global Action Bar */}
      <div className="flow-filter-panel">
        <div className="flow-filter-inputs">
          <input
            type="search"
            placeholder="Cari shot, prompt, atau model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={contentFilter} onChange={(e) => setContentFilter(e.target.value)}>
            <option value="">Semua Konten</option>
            {contents.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.title}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Semua Status</option>
            <option value="READY">READY</option>
            <option value="QUEUED">QUEUED</option>
            <option value="GENERATING">GENERATING</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
            <option value="BLOCKED">BLOCKED</option>
            <option value="FAILED">FAILED</option>
          </select>
          <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}>
            <option value="">Semua Model</option>
            {availableModels.map((m) => (
              <option key={m.code} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            value={readyStateFilter}
            onChange={(e) => setReadyStateFilter(e.target.value as "" | "READY" | "NOT_READY")}
          >
            <option value="">Semua Kesiapan</option>
            <option value="READY">Hanya READY</option>
            <option value="NOT_READY">Belum READY</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            className="button button-primary"
            onClick={handleOpenGoogleFlow}
            title="Buka platform Google Flow di browser"
          >
            🌐 Open Google Flow
          </button>
          {selectedIds.size > 0 && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => handleBatchPrepare(false)}
              disabled={loading}
            >
              📦 Prepare Selected ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Main Flow Queue Table */}
      <div className="flow-table-wrap">
        <table className="flow-table">
          <thead>
            <tr>
              <th style={{ width: "36px", textAlign: "center" }}>
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={
                    selectedIds.size > 0 &&
                    filteredItems.filter((i) => i.item.status === "READY").length === selectedIds.size
                  }
                />
              </th>
              <th>Shot & Konten</th>
              <th>Prompt & Versi</th>
              <th>Model & Spek</th>
              <th>Status</th>
              <th>Referensi Visual</th>
              <th>Aksi Eksekusi</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "40px" }}>
                  <p className="empty-inline" style={{ margin: 0 }}>
                    Tidak ada item Flow Queue yang cocok dengan filter. Tambahkan shot dari Prompt Studio!
                  </p>
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selectedIds.has(item.item.id);
                const isReady = item.item.status === "READY";
                return (
                  <tr key={item.item.id} style={{ background: isSelected ? "#f6faf3" : undefined }}>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(item.item.id)}
                        disabled={!isReady}
                        title={isReady ? "Pilih untuk batch prepare" : "Hanya job READY yang dapat dipilih"}
                      />
                    </td>
                    <td>
                      <div>
                        <Link
                          href={`/projects/${projectId}/shots/${item.shot.id}`}
                          className="table-code"
                          style={{ fontSize: "12px", textDecoration: "underline" }}
                        >
                          {item.shot.shotCode}
                        </Link>
                        <div style={{ fontSize: "10px", color: "#66776e", marginTop: "2px" }}>
                          {item.content.code} · {item.shot.title}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ maxWidth: "280px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span className="version-chip active" style={{ fontSize: "9px", padding: "1px 5px" }}>
                            {item.promptVersion.versionLabel}
                          </span>
                          <button
                            type="button"
                            className="button button-quiet"
                            style={{ height: "22px", padding: "0 6px", fontSize: "9px" }}
                            onClick={() => handleCopyPrompt(item)}
                          >
                            📋 Copy Prompt
                          </button>
                        </div>
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: "10px",
                            color: "#4a5951",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={item.promptVersion.promptText}
                        >
                          {item.promptVersion.promptText}
                        </p>
                      </div>
                    </td>
                    <td>
                      <div>
                        <span className="model-tag">{item.item.model}</span>
                        <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                          <span className="param-pill">{item.item.durationSeconds}s</span>
                          <span className="param-pill">{item.item.aspectRatio}</span>
                          <span className="param-pill">{item.item.resolution}</span>
                          {item.item.audioEnabled && <span className="param-pill">Audio</span>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <select
                          value={item.item.status}
                          onChange={(e) => handleStatusChange(item.item.id, e.target.value as FlowQueueStatus)}
                          style={{
                            fontSize: "10px",
                            padding: "3px 6px",
                            borderRadius: "4px",
                            border: "1px solid #d0dcd4",
                            background: "#fff",
                            fontWeight: 600,
                          }}
                        >
                          <option value="QUEUED">QUEUED</option>
                          <option value="READY">READY</option>
                          <option value="GENERATING">GENERATING</option>
                          <option value="COMPLETED">COMPLETED</option>
                          <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                          <option value="BLOCKED">BLOCKED</option>
                          <option value="FAILED">FAILED</option>
                          <option value="CANCELLED">CANCELLED</option>
                        </select>
                        {item.attempts.length > 0 && (
                          <div style={{ fontSize: "9px", color: "#77857c", marginTop: "3px" }}>
                            {item.attempts.length} Attempt
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {item.startFrameVersion ? (
                          <button
                            type="button"
                            className="button button-quiet"
                            style={{ height: "20px", padding: "0 5px", fontSize: "9px", width: "fit-content" }}
                            onClick={() => handleRevealStartFrame(item.item.id)}
                            title="Reveal Start Frame di Windows Explorer"
                          >
                            👁 Start: {item.startFrameVersion.filename.slice(0, 14)}...
                          </button>
                        ) : (
                          <span style={{ fontSize: "9px", color: "#9ca8a1" }}>No Start Frame</span>
                        )}
                        {item.endFrameVersion && (
                          <button
                            type="button"
                            className="button button-quiet"
                            style={{ height: "20px", padding: "0 5px", fontSize: "9px", width: "fit-content" }}
                            onClick={() => handleRevealEndFrame(item.item.id)}
                            title="Reveal End Frame di Windows Explorer"
                          >
                            👁 End: {item.endFrameVersion.filename.slice(0, 14)}...
                          </button>
                        )}
                        {item.references.length > 0 && (
                          <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                            {item.references.map((ref) => (
                              <button
                                key={ref.link.id}
                                type="button"
                                className="button button-quiet"
                                style={{ height: "18px", padding: "0 4px", fontSize: "8px" }}
                                onClick={() => handleRevealReference(item.item.id, ref.version.id)}
                                title={`Reveal ${ref.asset.name} (${ref.link.role})`}
                              >
                                {ref.asset.assetCode}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="button button-secondary"
                          style={{ height: "26px", padding: "0 8px", fontSize: "10px" }}
                          onClick={() => handlePrepareJob(item.item.id, false)}
                          disabled={loading}
                          title="Buat folder JOB di disk dengan manifest.json & prompt.txt"
                        >
                          📦 Prepare
                        </button>
                        <button
                          type="button"
                          className="button button-primary"
                          style={{ height: "26px", padding: "0 8px", fontSize: "10px" }}
                          onClick={() => {
                            setRegisterModalItem(item);
                            setVideoFilePath("");
                            setVideoNotes("");
                            setVideoCredits("");
                          }}
                          title="Daftarkan file video hasil generasi dari Google Flow"
                        >
                          🎬 Register Video
                        </button>
                        <button
                          type="button"
                          className="button button-quiet"
                          style={{ height: "26px", padding: "0 6px", fontSize: "10px" }}
                          onClick={() => setRecipeModalItem(item)}
                          title="Lihat Immutable Recipe Snapshot"
                        >
                          📜 Recipe
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Register Video Modal */}
      {registerModalItem && (
        <div className="studio-modal-backdrop">
          <div className="studio-modal" style={{ maxWidth: "560px" }}>
            <div className="panel-heading" style={{ marginBottom: "14px" }}>
              <div>
                <p className="eyebrow">GOOGLE FLOW OUTPUT REGISTRATION</p>
                <h2>Daftarkan Video Output: {registerModalItem.shot.shotCode}</h2>
              </div>
              <button
                type="button"
                className="button button-quiet"
                onClick={() => setRegisterModalItem(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterVideoSubmit}>
              <div style={{ display: "grid", gap: "12px" }}>
                <div className="field">
                  <span>File Video Lokal (.mp4, .mov, .webm) <b>*</b></span>
                  <input
                    type="text"
                    required
                    placeholder="misal: EP01/SH016/VIDEO/EP01_SH016_VID_V01.mp4 atau path absolut"
                    value={videoFilePath}
                    onChange={(e) => setVideoFilePath(e.target.value)}
                  />
                  <small>
                    File harus berada di dalam root project. SHA-256 dan metadata teknis akan dibaca secara otomatis.
                  </small>
                </div>

                <div className="form-grid">
                  <div className="field">
                    <span>Model Generasi</span>
                    <input type="text" readOnly value={registerModalItem.item.model} />
                  </div>
                  <div className="field">
                    <span>Actual Credits Used (Opsional)</span>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="misal: 10"
                      value={videoCredits}
                      onChange={(e) => setVideoCredits(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="field">
                  <span>Catatan Generasi</span>
                  <textarea
                    rows={2}
                    placeholder="Catatan hasil generasi Flow (motion, lighting, lip-sync...)"
                    value={videoNotes}
                    onChange={(e) => setVideoNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-actions" style={{ marginTop: "18px" }}>
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => setRegisterModalItem(null)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={registering || !videoFilePath.trim()}
                >
                  {registering ? "Memverifikasi & Mendaftarkan..." : "Daftarkan Video Output"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recipe Snapshot Modal */}
      {recipeModalItem && (
        <div className="studio-modal-backdrop">
          <div className="studio-modal" style={{ maxWidth: "700px" }}>
            <div className="panel-heading" style={{ marginBottom: "14px" }}>
              <div>
                <p className="eyebrow">IMMUTABLE RECIPE SNAPSHOT</p>
                <h2>{recipeModalItem.shot.shotCode} · Recipe Snapshot</h2>
              </div>
              <button
                type="button"
                className="button button-quiet"
                onClick={() => setRecipeModalItem(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginBottom: "10px" }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => handleCopyRecipe(recipeModalItem)}
              >
                📋 Copy Recipe JSON
              </button>
            </div>

            <pre
              style={{
                background: "#f7f9f7",
                border: "1px solid #e1e9e3",
                padding: "14px",
                borderRadius: "8px",
                fontSize: "11px",
                lineHeight: "1.5",
                maxHeight: "450px",
                overflow: "auto",
                fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
              }}
            >
              {recipeModalItem.item.recipeSnapshotJson}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
