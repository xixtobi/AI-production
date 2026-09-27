"use client";

import { useState } from "react";
import type {
  QcReview,
  ContinuityCheck,
  ContinuityCheckStatus,
  QcChecklistItem,
  AssetVersion,
  VideoOutput,
  Shot,
  Asset,
} from "@/lib/db/schema";
import type { ContinuityAiFinding } from "@/lib/qc/types";

interface ShotQcWorkspaceProps {
  projectId: string;
  shotId: string;
  shotCode: string;
  contentItemId: string;
  initialQcReviews: QcReview[];
  initialContinuityChecks: Array<ContinuityCheck & { ruleName: string; ruleType: string; refShotCode: string }>;
  checklistItems: QcChecklistItem[];
  siblingShots: Shot[];
  currentKeyframe?: { asset: Asset; version: AssetVersion } | null;
  currentVideo?: VideoOutput | null;
  scriptChangeWarning?: string | null;
  assetChangeWarning?: string | null;
}

export function ShotQcWorkspace({
  projectId,
  shotId,
  shotCode,
  contentItemId,
  initialQcReviews,
  initialContinuityChecks,
  checklistItems,
  siblingShots,
  currentKeyframe,
  currentVideo,
  scriptChangeWarning,
  assetChangeWarning,
}: ShotQcWorkspaceProps) {
  const [qcReviews, setQcReviews] = useState<QcReview[]>(initialQcReviews);
  const [continuityChecks, setContinuityChecks] = useState(initialContinuityChecks);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // New QC Modal
  const [isNewQcOpen, setIsNewQcOpen] = useState(false);
  const [reviewType, setReviewType] = useState<string>("VISUAL");
  const [severity, setSeverity] = useState<string>("MAJOR");
  const [issue, setIssue] = useState("");
  const [action, setAction] = useState("");
  const [reviewer, setReviewer] = useState("User");
  const [notes, setNotes] = useState("");

  // Gemini Continuity State
  const [aiFindings, setAiFindings] = useState<ContinuityAiFinding[] | null>(null);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Side-by-side Visual Comparison
  const otherShots = siblingShots.filter((s) => s.id !== shotId);
  const [referenceShotId, setReferenceShotId] = useState<string>(otherShots[0]?.id || "");
  const selectedRefShot = siblingShots.find((s) => s.id === referenceShotId);

  const refreshReviews = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/qc?shotId=${shotId}`);
      const data = await res.json();
      if (res.ok && data.reviews) setQcReviews(data.reviews);
    } catch {
      // Ignore
    }
  };

  const refreshChecks = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/continuity/checks?shotId=${shotId}`);
      const data = await res.json();
      if (res.ok && data.checks) setContinuityChecks(data.checks);
    } catch {
      // Ignore
    }
  };

  const handleUpdateCheckStatus = async (checkId: string, status: ContinuityCheckStatus) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/continuity/checks/${checkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setNotice({ message: `Status kontinuitas diperbarui ke ${status}.`, type: "success" });
        await refreshChecks();
      }
    } catch {
      // Ignore
    }
  };

  const handleCreateQc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue.trim()) return;
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/qc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId,
          contentItemId,
          reviewType,
          severity,
          issue,
          action,
          reviewer,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat QC issue.");
      setNotice({ message: "Issue QC berhasil dicatat.", type: "success" });
      setIsNewQcOpen(false);
      setIssue("");
      setAction("");
      setNotes("");
      await refreshReviews();
    } catch (err: unknown) {
      setNotice({ message: err instanceof Error ? err.message : "Gagal membuat QC issue.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleResolveQc = async (reviewId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/qc/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType: "resolve", notes: "Resolved oleh reviewer." }),
      });
      if (res.ok) {
        setNotice({ message: "Issue QC telah di-resolve.", type: "success" });
        await refreshReviews();
      }
    } catch {
      // Ignore
    }
  };

  const handleWaiveQc = async (reviewId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/qc/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType: "waive", notes: "Di-waive atas pertimbangan tim kreatif." }),
      });
      if (res.ok) {
        setNotice({ message: "Issue QC telah di-waive.", type: "success" });
        await refreshReviews();
      }
    } catch {
      // Ignore
    }
  };

  const handleDeleteQc = async (reviewId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/qc/${reviewId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setNotice({ message: "Issue QC telah dihapus.", type: "success" });
        await refreshReviews();
      }
    } catch {
      // Ignore
    }
  };

  const handleRunGeminiContinuity = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/continuity/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shotId, referenceShotId: referenceShotId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menjalankan analisis kontinuitas AI.");
      setAiFindings(data.findings || []);
      setAiSummary(data.summary || "");
      setIsAiModalOpen(true);
    } catch (err: unknown) {
      setNotice({
        message: err instanceof Error ? err.message : "Gagal menjalankan analisis kontinuitas.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQcFromAiFinding = async (finding: ContinuityAiFinding) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/qc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId,
          contentItemId,
          reviewType: "CONTINUITY",
          severity: finding.severity,
          issue: `[AI Continuity] ${finding.finding} (Ref: ${finding.referenceShotCode})`,
          action: finding.proposedAction,
          reviewer: "Gemini AI",
        }),
      });
      if (res.ok) {
        setNotice({ message: `Issue QC dibuat untuk temuan: ${finding.ruleType}`, type: "success" });
        await refreshReviews();
      }
    } catch {
      // Ignore
    }
  };

  const handleApplyChecklistItem = (item: QcChecklistItem) => {
    setReviewType(item.category === "VISUAL" ? "VISUAL" : item.category === "TECHNICAL" ? "TECHNICAL" : "DIALOGUE");
    setSeverity(item.defaultSeverity);
    setIssue(`Pemeriksaan ${item.label}: `);
    setAction(item.description);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Notice Banner */}
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

      {/* Change Impact Warning Banners */}
      {(scriptChangeWarning || assetChangeWarning) && (
        <div
          style={{
            padding: "12px 16px",
            background: "#fffaf0",
            border: "1px solid #f6e5be",
            borderRadius: "8px",
            fontSize: "11px",
            color: "#846016",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <strong style={{ fontSize: "12px", color: "#6e4f10" }}>
            ⚠️ Peringatan Dampak Perubahan (Change Impact)
          </strong>
          {scriptChangeWarning && <p style={{ margin: 0 }}>• {scriptChangeWarning}</p>}
          {assetChangeWarning && <p style={{ margin: 0 }}>• {assetChangeWarning}</p>}
          <span style={{ fontSize: "10px", color: "#9f7c32" }}>
            * Sistem tidak melakukan regenerasi otomatis. Tinjau kembali prompt atau render bila diperlukan.
          </span>
        </div>
      )}

      {/* 1. VISUAL COMPARISON SIDE-BY-SIDE */}
      <section className="panel" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <p className="eyebrow">VISUAL CONTINUITY COMPARISON</p>
            <h2 style={{ margin: 0, fontSize: "15px" }}>Perbandingan Visual Side-by-Side</h2>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "#77857c" }}>Bandingkan dengan:</span>
            <select
              value={referenceShotId}
              onChange={(e) => setReferenceShotId(e.target.value)}
              style={{
                fontSize: "11px",
                padding: "4px 8px",
                borderRadius: "5px",
                border: "1px solid #cbd5cf",
                background: "#fff",
              }}
            >
              {otherShots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shotCode} — {s.title}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="button button-primary"
              onClick={handleRunGeminiContinuity}
              disabled={loading}
              style={{ fontSize: "11px", padding: "0 10px" }}
            >
              {loading ? "Menganalisis..." : "✨ [ Check Continuity ]"}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {/* Current Shot Column */}
          <div style={{ background: "#f8faf9", border: "1px solid #e2e8e4", borderRadius: "8px", padding: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <strong style={{ fontSize: "12px", color: "#2d5236" }}>Current Shot: {shotCode}</strong>
              <span style={{ fontSize: "10px", color: "#7c8b82" }}>{currentVideo ? `Video ${currentVideo.versionLabel}` : "Keyframe Only"}</span>
            </div>

            <div style={{ minHeight: "180px", background: "#edf2ee", borderRadius: "6px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {currentVideo ? (
                <video
                  controls
                  preload="metadata"
                  style={{ width: "100%", maxHeight: "200px", objectFit: "contain" }}
                  src={`/api/projects/${projectId}/shots/${shotId}/video-outputs/${currentVideo.id}/preview`}
                />
              ) : currentKeyframe ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/api/asset-versions/${currentKeyframe.version.id}/preview`}
                  alt={shotCode}
                  style={{ width: "100%", maxHeight: "200px", objectFit: "contain" }}
                />
              ) : (
                <span style={{ fontSize: "10px", color: "#9ca8a1" }}>Tidak ada media visual</span>
              )}
            </div>
          </div>

          {/* Reference Shot Column */}
          <div style={{ background: "#f8faf9", border: "1px solid #e2e8e4", borderRadius: "8px", padding: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <strong style={{ fontSize: "12px", color: "#374f63" }}>
                Reference Shot: {selectedRefShot ? selectedRefShot.shotCode : "None"}
              </strong>
              <span style={{ fontSize: "10px", color: "#7c8b82" }}>{selectedRefShot?.title || ""}</span>
            </div>

            <div style={{ minHeight: "180px", background: "#edf2ee", borderRadius: "6px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "10px", color: "#9ca8a1" }}>
                {selectedRefShot ? `Tampilan acuan shot ${selectedRefShot.shotCode}` : "Pilih shot pembanding"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. QC ISSUES & CHECKLIST SECTION */}
      <section className="panel" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div>
            <p className="eyebrow">QUALITY CONTROL & REVIEWS</p>
            <h2 style={{ margin: 0, fontSize: "15px" }}>QC Issues ({qcReviews.length})</h2>
          </div>

          <button
            type="button"
            className="button button-primary"
            onClick={() => setIsNewQcOpen(true)}
          >
            + Catat Issue QC
          </button>
        </div>

        {qcReviews.length === 0 ? (
          <p className="empty-inline" style={{ margin: 0 }}>
            Belum ada catatan issue QC untuk shot ini. Semua pengujian visual dan teknis berstatus bersih.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {qcReviews.map((review) => {
              const isResolved = review.status === "RESOLVED";
              const isWaived = review.status === "WAIVED";
              const isOpen = review.status === "OPEN" || review.status === "IN_REVIEW";

              return (
                <div
                  key={review.id}
                  style={{
                    background: isResolved ? "#fbfdfb" : isWaived ? "#fafbfb" : "#fff",
                    border: `1px solid ${review.severity === "CRITICAL" && isOpen ? "#f7c7c3" : review.severity === "MAJOR" && isOpen ? "#fde2b3" : "#e2e8e4"}`,
                    borderRadius: "8px",
                    padding: "12px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: review.severity === "CRITICAL" ? "#fbeae9" : review.severity === "MAJOR" ? "#fef3dd" : "#f1f3f2",
                          color: review.severity === "CRITICAL" ? "#b4382e" : review.severity === "MAJOR" ? "#9e6912" : "#606d65",
                        }}
                      >
                        {review.severity}
                      </span>
                      <span style={{ fontSize: "9px", background: "#f0f4f1", color: "#47594d", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>
                        {review.reviewType}
                      </span>
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: isResolved ? "#eaf5e9" : isWaived ? "#f0effa" : "#fdf2f1",
                          color: isResolved ? "#3a7a35" : isWaived ? "#60479b" : "#b1382e",
                        }}
                      >
                        {review.status}
                      </span>
                    </div>

                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#314237", marginTop: "2px" }}>
                      {review.issue}
                    </div>

                    {review.action && (
                      <div style={{ fontSize: "10px", color: "#546459", marginTop: "2px" }}>
                        <strong>Rekomendasi Tindakan:</strong> {review.action}
                      </div>
                    )}

                    <div style={{ fontSize: "9px", color: "#8a968f", marginTop: "3px" }}>
                      Reviewer: {review.reviewer} · Dibuat: {new Date(review.createdAt).toLocaleString("id-ID")}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "6px" }}>
                    {isOpen && (
                      <>
                        <button
                          type="button"
                          className="button button-quiet"
                          style={{ height: "24px", fontSize: "10px", padding: "0 8px" }}
                          onClick={() => handleResolveQc(review.id)}
                        >
                          ✓ Resolve
                        </button>
                        <button
                          type="button"
                          className="button button-quiet"
                          style={{ height: "24px", fontSize: "10px", padding: "0 8px" }}
                          onClick={() => handleWaiveQc(review.id)}
                        >
                          Waive
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="button button-quiet"
                      style={{ height: "24px", fontSize: "10px", padding: "0 6px", color: "#b94a40" }}
                      onClick={() => handleDeleteQc(review.id)}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. CONTINUITY CHECKS LOG */}
      <section className="panel" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div>
            <p className="eyebrow">CONTINUITY RECORDS</p>
            <h2 style={{ margin: 0, fontSize: "15px" }}>Catatan Aturan Kontinuitas ({continuityChecks.length})</h2>
          </div>
          <button
            type="button"
            className="button button-quiet"
            style={{ fontSize: "11px", height: "28px" }}
            onClick={refreshChecks}
          >
            ↻ Segarkan
          </button>
        </div>

        {continuityChecks.length === 0 ? (
          <div style={{ padding: "16px", textAlign: "center", background: "#f8faf9", borderRadius: "6px", color: "#607065", fontSize: "11px" }}>
            Belum ada catatan aturan kontinuitas tersimpan untuk shot ini. Klik &quot;✨ [ Check Continuity ]&quot; di atas untuk menganalisis via AI.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {continuityChecks.map((check) => (
              <div
                key={check.id}
                style={{
                  padding: "10px 14px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8e4",
                  background: check.status === "RESOLVED" ? "#f9fcf9" : check.status === "OPEN" ? "#fffdfa" : "#f8f9f8",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "3px" }}>
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: "4px",
                        fontSize: "9px",
                        fontWeight: 700,
                        background: check.status === "RESOLVED" ? "#daf0d8" : check.status === "OPEN" ? "#fde5d2" : check.status === "WAIVED" ? "#e0e5e2" : "#d0e2f5",
                        color: check.status === "RESOLVED" ? "#225c20" : check.status === "OPEN" ? "#8a3d14" : check.status === "WAIVED" ? "#4a5850" : "#1a4674",
                      }}
                    >
                      {check.status}
                    </span>
                    <strong style={{ fontSize: "12px", color: "#1b2a20" }}>{check.ruleName}</strong>
                    <span style={{ fontSize: "10px", color: "#7a8a80" }}>({check.ruleType})</span>
                    {check.refShotCode && (
                      <span style={{ fontSize: "10px", color: "#486284" }}>Ref: {check.refShotCode}</span>
                    )}
                  </div>
                  {check.finding && (
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#44554b" }}>
                      {check.finding}
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                  {check.status !== "RESOLVED" && (
                    <button
                      type="button"
                      className="button button-quiet"
                      style={{ height: "24px", fontSize: "10px", padding: "0 8px" }}
                      onClick={() => handleUpdateCheckStatus(check.id, "RESOLVED")}
                    >
                      ✓ Resolve
                    </button>
                  )}
                  {check.status !== "WAIVED" && (
                    <button
                      type="button"
                      className="button button-quiet"
                      style={{ height: "24px", fontSize: "10px", padding: "0 8px" }}
                      onClick={() => handleUpdateCheckStatus(check.id, "WAIVED")}
                    >
                      Waive
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* AI Continuity Findings Modal */}
      {isAiModalOpen && aiFindings && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "650px", width: "95%" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: "16px" }}>Hasil Analisis Kontinuitas AI</h2>
            <p style={{ fontSize: "11px", color: "#607065", margin: "0 0 14px", lineHeight: 1.5 }}>
              {aiSummary}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "350px", overflowY: "auto" }}>
              {aiFindings.map((finding, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#fbfcfb",
                    border: "1px solid #e2e8e4",
                    borderRadius: "6px",
                    padding: "10px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 5px", background: finding.severity === "CRITICAL" ? "#fde9e8" : finding.severity === "MAJOR" ? "#fef4dc" : "#f1f3f2", color: finding.severity === "CRITICAL" ? "#ba3d32" : finding.severity === "MAJOR" ? "#a36e16" : "#606d65", borderRadius: "3px" }}>
                        {finding.severity}
                      </span>
                      <span style={{ fontSize: "9px", fontWeight: 600, color: "#47594d" }}>
                        [{finding.ruleType}] Ref: {finding.referenceShotCode}
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#344439", fontWeight: 500 }}>
                      {finding.finding}
                    </div>
                    <div style={{ fontSize: "10px", color: "#6b7a70" }}>
                      Saran: {finding.proposedAction}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      type="button"
                      className="button button-primary"
                      style={{ height: "24px", fontSize: "9px", padding: "0 8px" }}
                      onClick={() => handleCreateQcFromAiFinding(finding)}
                    >
                      [ Create QC Issue ]
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "14px" }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setIsAiModalOpen(false)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New QC Review Modal */}
      {isNewQcOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "600px", width: "95%" }}>
            <h2 style={{ margin: "0 0 12px", fontSize: "16px" }}>Catat Issue QC Baru</h2>

            {/* Checklist Quick Pickers */}
            <div style={{ marginBottom: "12px", borderBottom: "1px solid #edf1ee", paddingBottom: "10px" }}>
              <span style={{ fontSize: "10px", color: "#77857c", fontWeight: 700 }}>PILIH DARI CHECKLIST STANDAR:</span>
              <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "6px" }}>
                {checklistItems.slice(0, 10).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="button button-quiet"
                    style={{ height: "20px", fontSize: "9px", padding: "0 6px" }}
                    onClick={() => handleApplyChecklistItem(item)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateQc} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "10px", fontWeight: 600, color: "#546459", display: "block", marginBottom: "4px" }}>
                    Kategori Review:
                  </label>
                  <select
                    value={reviewType}
                    onChange={(e) => setReviewType(e.target.value)}
                    style={{ width: "100%", height: "32px", fontSize: "11px", borderRadius: "5px", border: "1px solid #c9d8ce", background: "#fff" }}
                  >
                    <option value="VISUAL">VISUAL</option>
                    <option value="CHARACTER">CHARACTER</option>
                    <option value="ENVIRONMENT">ENVIRONMENT</option>
                    <option value="CONTINUITY">CONTINUITY</option>
                    <option value="CAMERA">CAMERA</option>
                    <option value="MOTION">MOTION</option>
                    <option value="DIALOGUE">DIALOGUE</option>
                    <option value="AUDIO">AUDIO</option>
                    <option value="PROMPT">PROMPT</option>
                    <option value="TECHNICAL">TECHNICAL</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "10px", fontWeight: 600, color: "#546459", display: "block", marginBottom: "4px" }}>
                    Severity (Tingkat Keparahan):
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    style={{ width: "100%", height: "32px", fontSize: "11px", borderRadius: "5px", border: "1px solid #c9d8ce", background: "#fff" }}
                  >
                    <option value="MINOR">MINOR (Tidak memblokir produksi/final)</option>
                    <option value="MAJOR">MAJOR (Memblokir final kecuali di-waive)</option>
                    <option value="CRITICAL">CRITICAL (Wajib di-resolve/di-waive)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "10px", fontWeight: 600, color: "#546459", display: "block", marginBottom: "4px" }}>
                  Deskripsi Issue *:
                </label>
                <textarea
                  required
                  rows={3}
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  placeholder="Jelaskan temuan issue QC secara spesifik..."
                  style={{ width: "100%", fontSize: "11px", padding: "8px", borderRadius: "5px", border: "1px solid #c9d8ce", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "10px", fontWeight: 600, color: "#546459", display: "block", marginBottom: "4px" }}>
                  Rekomendasi Tindakan (Action):
                </label>
                <input
                  type="text"
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  placeholder="Contoh: Sesuaikan prompt pakaian atau gunakan start frame KF-B08..."
                  style={{ width: "100%", height: "32px", fontSize: "11px", padding: "0 8px", borderRadius: "5px", border: "1px solid #c9d8ce", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "10px", fontWeight: 600, color: "#546459", display: "block", marginBottom: "4px" }}>
                    Reviewer:
                  </label>
                  <input
                    type="text"
                    value={reviewer}
                    onChange={(e) => setReviewer(e.target.value)}
                    style={{ width: "100%", height: "32px", fontSize: "11px", padding: "0 8px", borderRadius: "5px", border: "1px solid #c9d8ce", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "10px", fontWeight: 600, color: "#546459", display: "block", marginBottom: "4px" }}>
                    Catatan Tambahan:
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{ width: "100%", height: "32px", fontSize: "11px", padding: "0 8px", borderRadius: "5px", border: "1px solid #c9d8ce", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setIsNewQcOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={loading}
                >
                  {loading ? "Menyimpan..." : "Simpan Issue QC"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
