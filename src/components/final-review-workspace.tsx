"use client";

import { useState } from "react";
import Link from "next/link";
import type { FinalReviewEvaluation } from "@/lib/qc/types";
import type { ProductionMilestoneStatus } from "@/lib/db/schema";

interface FinalReviewWorkspaceProps {
  projectId: string;
  projectName: string;
  initialEvaluation: FinalReviewEvaluation;
}

export function FinalReviewWorkspace({
  projectId,
  projectName,
  initialEvaluation,
}: FinalReviewWorkspaceProps) {
  const [evaluation, setEvaluation] = useState<FinalReviewEvaluation>(initialEvaluation);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const refreshEvaluation = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/content/${evaluation.contentItemId}/final-review`);
      const data = await res.json();
      if (res.ok && data.evaluation) {
        setEvaluation(data.evaluation);
      }
    } catch {
      // Ignore
    }
  };

  const handleMilestoneChange = async (
    field: "audioStatus" | "editStatus",
    value: ProductionMilestoneStatus
  ) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/content/${evaluation.contentItemId}/milestones`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNotice({ message: `Milestone ${field} diperbarui ke ${value}.`, type: "success" });
      await refreshEvaluation();
    } catch (err: unknown) {
      setNotice({ message: err instanceof Error ? err.message : "Gagal memperbarui milestone.", type: "error" });
    }
  };

  const handleApproveFinal = async () => {
    if (!evaluation.canApprove) return;
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/content/${evaluation.contentItemId}/final-review`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyetujui final konten.");
      setNotice({
        message: `Selamat! Episode ${evaluation.contentCode} (${evaluation.contentTitle}) telah resmi disetujui sebagai FINAL!`,
        type: "success",
      });
      await refreshEvaluation();
    } catch (err: unknown) {
      setNotice({ message: err instanceof Error ? err.message : "Gagal menyetujui final.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const isFinal = evaluation.currentStatus === "FINAL";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "1000px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "14px" }}>
        <div>
          <p className="eyebrow">QUALITY GATE & FINAL APPROVAL</p>
          <h1 style={{ margin: "2px 0 0", fontSize: "24px" }}>
            Final Review: {evaluation.contentCode} — {evaluation.contentTitle}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#6c7a72" }}>
            Tinjauan objektif kesiapan rilis episode ({projectName}). Persetujuan final membutuhkan verifikasi manusia.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Link
            href={`/projects/${projectId}/content/${evaluation.contentItemId}`}
            className="button button-secondary"
          >
            ← Detail Episode
          </Link>
          <Link
            href={`/projects/${projectId}/production-board`}
            className="button button-secondary"
          >
            📋 Production Board
          </Link>
        </div>
      </div>

      {notice && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            fontSize: "12px",
            background: notice.type === "success" ? "#eaf5e9" : "#fdf0ee",
            color: notice.type === "success" ? "#2e6829" : "#a83227",
            border: `1px solid ${notice.type === "success" ? "#c7e4c5" : "#f6cac5"}`,
            fontWeight: 500,
          }}
        >
          {notice.message}
        </div>
      )}

      {/* Final Status Banner */}
      {isFinal ? (
        <div
          style={{
            background: "#f3effa",
            border: "1px solid #dcd0f3",
            borderRadius: "10px",
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#60479b", letterSpacing: "1px" }}>
              STATUS EPISODE
            </div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#452d7e", marginTop: "2px" }}>
              🎉 FINAL — Resmi Disetujui
            </div>
            <p style={{ fontSize: "11px", color: "#74629f", margin: "4px 0 0" }}>
              Seluruh kriteria kelayakan QC, video render, dan integritas naskah telah terpenuhi secara objektif.
            </p>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: evaluation.canApprove ? "#f1f8ee" : "#fff8f7",
            border: `1px solid ${evaluation.canApprove ? "#cbe5c3" : "#f8d5d1"}`,
            borderRadius: "10px",
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.8px", color: evaluation.canApprove ? "#3d7335" : "#ad382e" }}>
              KESIAPAN APPROVAL FINAL
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: evaluation.canApprove ? "#275b20" : "#8e271e", marginTop: "2px" }}>
              {evaluation.canApprove
                ? "Siap Disetujui sebagai FINAL"
                : `Belum Siap: ${evaluation.blockingReasons.length} Halangan Terdeteksi`}
            </div>
            <p style={{ fontSize: "11px", color: evaluation.canApprove ? "#4f7547" : "#8a4843", margin: "4px 0 0" }}>
              {evaluation.canApprove
                ? "Semua kriteria wajib terpenuhi. Klik tombol di kanan untuk menyetujui secara eksplisit."
                : "Harap selesaikan seluruh issue QC Kritis/Major dan lengkapi video render yang disetujui."}
            </p>
          </div>

          <button
            type="button"
            className="button button-primary"
            style={{
              padding: "10px 20px",
              fontSize: "12px",
              fontWeight: 700,
              opacity: !evaluation.canApprove || loading ? 0.6 : 1,
              cursor: !evaluation.canApprove || loading ? "not-allowed" : "pointer",
            }}
            disabled={!evaluation.canApprove || loading}
            onClick={handleApproveFinal}
          >
            {loading ? "Menyetujui..." : "✓ Setujui Episode sebagai FINAL"}
          </button>
        </div>
      )}

      {/* Production Milestones Box */}
      <section className="panel" style={{ padding: "18px 20px" }}>
        <h2 style={{ fontSize: "14px", margin: "0 0 12px" }}>Tahapan Produksi Tambahan (Milestones)</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div style={{ background: "#f8faf9", padding: "12px 14px", borderRadius: "8px", border: "1px solid #e2e8e4" }}>
            <span style={{ fontSize: "10px", color: "#67756d", fontWeight: 700 }}>AUDIO MILESTONE</span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px" }}>
              <select
                value={evaluation.audioStatus}
                onChange={(e) => handleMilestoneChange("audioStatus", e.target.value as ProductionMilestoneStatus)}
                style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "5px", border: "1px solid #c9d8ce", background: "#fff", fontWeight: 600 }}
              >
                <option value="NOT_STARTED">NOT_STARTED</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="APPROVED">APPROVED</option>
                <option value="FINAL">FINAL</option>
              </select>
              <span style={{ fontSize: "10px", color: "#8a968f" }}>Sinkronisasi dialog, SFX, dan musik</span>
            </div>
          </div>

          <div style={{ background: "#f8faf9", padding: "12px 14px", borderRadius: "8px", border: "1px solid #e2e8e4" }}>
            <span style={{ fontSize: "10px", color: "#67756d", fontWeight: 700 }}>EDIT / CONFORM MILESTONE</span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px" }}>
              <select
                value={evaluation.editStatus}
                onChange={(e) => handleMilestoneChange("editStatus", e.target.value as ProductionMilestoneStatus)}
                style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "5px", border: "1px solid #c9d8ce", background: "#fff", fontWeight: 600 }}
              >
                <option value="NOT_STARTED">NOT_STARTED</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="APPROVED">APPROVED</option>
                <option value="FINAL">FINAL</option>
              </select>
              <span style={{ fontSize: "10px", color: "#8a968f" }}>Assembly timeline & color grading</span>
            </div>
          </div>
        </div>
      </section>

      {/* Objective Checklist Grid */}
      <section className="panel" style={{ padding: "20px" }}>
        <h2 style={{ fontSize: "14px", margin: "0 0 14px" }}>Daftar Verifikasi Objektif (Objective Quality Gate)</h2>

        <div style={{ display: "grid", gap: "10px" }}>
          {/* 1. Critical QC */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: evaluation.checks.noOpenCriticalQc ? "#f7fbf6" : "#fff5f4", borderRadius: "8px", border: `1px solid ${evaluation.checks.noOpenCriticalQc ? "#e1f0df" : "#fbd8d5"}` }}>
            <div>
              <strong style={{ fontSize: "12px", color: evaluation.checks.noOpenCriticalQc ? "#2e6027" : "#aa342a" }}>
                {evaluation.checks.noOpenCriticalQc ? "✓" : "✗"} Issue QC Kritis (Critical QC)
              </strong>
              <p style={{ margin: "2px 0 0", fontSize: "10px", color: "#77857c" }}>
                Semua temuan kritis wajib di-resolve atau di-waive secara eksplisit.
              </p>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: evaluation.checks.noOpenCriticalQc ? "#2e6027" : "#aa342a" }}>
              {evaluation.stats.openCriticalQcCount} Terbuka
            </span>
          </div>

          {/* 2. Major QC */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: evaluation.checks.noOpenMajorQc ? "#f7fbf6" : "#fff5f4", borderRadius: "8px", border: `1px solid ${evaluation.checks.noOpenMajorQc ? "#e1f0df" : "#fbd8d5"}` }}>
            <div>
              <strong style={{ fontSize: "12px", color: evaluation.checks.noOpenMajorQc ? "#2e6027" : "#aa342a" }}>
                {evaluation.checks.noOpenMajorQc ? "✓" : "✗"} Issue QC Major (Major QC)
              </strong>
              <p style={{ margin: "2px 0 0", fontSize: "10px", color: "#77857c" }}>
                Issue major menghambat rilis final kecuali di-waive oleh tim.
              </p>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: evaluation.checks.noOpenMajorQc ? "#2e6027" : "#aa342a" }}>
              {evaluation.stats.openMajorQcCount} Terbuka
            </span>
          </div>

          {/* 3. Missing Assets */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: evaluation.checks.noMissingAssets ? "#f7fbf6" : "#fff5f4", borderRadius: "8px", border: `1px solid ${evaluation.checks.noMissingAssets ? "#e1f0df" : "#fbd8d5"}` }}>
            <div>
              <strong style={{ fontSize: "12px", color: evaluation.checks.noMissingAssets ? "#2e6027" : "#aa342a" }}>
                {evaluation.checks.noMissingAssets ? "✓" : "✗"} Keberadaan Berkas Fisik Aset
              </strong>
              <p style={{ margin: "2px 0 0", fontSize: "10px", color: "#77857c" }}>
                Seluruh aset terhubung harus ada di storage lokal proyek tanpa berkas hilang.
              </p>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: evaluation.checks.noMissingAssets ? "#2e6027" : "#aa342a" }}>
              {evaluation.stats.missingAssetsCount} Hilang
            </span>
          </div>

          {/* 4. Registered Videos */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: evaluation.checks.allVideosRegistered ? "#f7fbf6" : "#fff5f4", borderRadius: "8px", border: `1px solid ${evaluation.checks.allVideosRegistered ? "#e1f0df" : "#fbd8d5"}` }}>
            <div>
              <strong style={{ fontSize: "12px", color: evaluation.checks.allVideosRegistered ? "#2e6027" : "#aa342a" }}>
                {evaluation.checks.allVideosRegistered ? "✓" : "✗"} Kelengkapan Video Output Approved
              </strong>
              <p style={{ margin: "2px 0 0", fontSize: "10px", color: "#77857c" }}>
                Setiap shot harus memiliki video output final yang terdaftar dan disetujui.
              </p>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: evaluation.checks.allVideosRegistered ? "#2e6027" : "#aa342a" }}>
              {evaluation.stats.totalVideos} Video Terdaftar
            </span>
          </div>

          {/* 5. Shot Statuses */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: evaluation.checks.allShotsApprovedOrFinal ? "#f7fbf6" : "#fff5f4", borderRadius: "8px", border: `1px solid ${evaluation.checks.allShotsApprovedOrFinal ? "#e1f0df" : "#fbd8d5"}` }}>
            <div>
              <strong style={{ fontSize: "12px", color: evaluation.checks.allShotsApprovedOrFinal ? "#2e6027" : "#aa342a" }}>
                {evaluation.checks.allShotsApprovedOrFinal ? "✓" : "✗"} Status Shot Approved / Final
              </strong>
              <p style={{ margin: "2px 0 0", fontSize: "10px", color: "#77857c" }}>
                Semua shot harus berstatus APPROVED atau FINAL pada papan produksi.
              </p>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: evaluation.checks.allShotsApprovedOrFinal ? "#2e6027" : "#aa342a" }}>
              {evaluation.stats.approvedOrFinalShots} / {evaluation.stats.totalShots} Shot
            </span>
          </div>

          {/* 6. Script Status (Warning Only) */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: evaluation.checks.scriptLocked ? "#f7fbf6" : "#fefbf0", borderRadius: "8px", border: `1px solid ${evaluation.checks.scriptLocked ? "#e1f0df" : "#faecc2"}` }}>
            <div>
              <strong style={{ fontSize: "12px", color: evaluation.checks.scriptLocked ? "#2e6027" : "#9e6f14" }}>
                {evaluation.checks.scriptLocked ? "✓" : "⚠"} Kuncian Naskah (Script Lock)
              </strong>
              <p style={{ margin: "2px 0 0", fontSize: "10px", color: "#77857c" }}>
                Naskah yang di-lock menjamin tidak ada perubahan cerita pasca produksi. (Hanya peringatan, tidak memblokir).
              </p>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: evaluation.checks.scriptLocked ? "#2e6027" : "#9e6f14" }}>
              {evaluation.checks.scriptLocked ? "LOCKED" : "UNLOCKED"}
            </span>
          </div>
        </div>
      </section>

      {/* Blocking Reasons Breakdown */}
      {evaluation.blockingReasons.length > 0 && (
        <section className="panel" style={{ padding: "18px 20px", background: "#fffaf9", border: "1px solid #f6dcd8" }}>
          <h2 style={{ fontSize: "13px", color: "#a8342a", margin: "0 0 10px" }}>
            Halangan Approval Final ({evaluation.blockingReasons.length})
          </h2>
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "11px", color: "#5a2520", lineHeight: 1.6 }}>
            {evaluation.blockingReasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Warnings Breakdown */}
      {evaluation.warnings.length > 0 && (
        <section className="panel" style={{ padding: "18px 20px", background: "#fefdfa", border: "1px solid #f7eed3" }}>
          <h2 style={{ fontSize: "13px", color: "#926919", margin: "0 0 10px" }}>
            Catatan & Peringatan ({evaluation.warnings.length})
          </h2>
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "11px", color: "#614d1f", lineHeight: 1.6 }}>
            {evaluation.warnings.map((warn, idx) => (
              <li key={idx}>{warn}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
