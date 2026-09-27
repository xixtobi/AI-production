"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";

export interface ProjectBackupWorkspaceProps {
  projectId: string;
}

export function ProjectBackupWorkspace({ projectId }: ProjectBackupWorkspaceProps) {
  const [backups, setBackups] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [storage, setStorage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Restore Modal
  const [restoreModalData, setRestoreModalData] = useState<{ isOpen: boolean; backupPath: string; backupName: string }>({
    isOpen: false,
    backupPath: "",
    backupName: "",
  });
  const [confirmInput, setConfirmInput] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);

  // Export State
  const [includeAssetsInExport, setIncludeAssetsInExport] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Import State
  const [importPath, setImportPath] = useState("");
  const [importDestRoot, setImportDestRoot] = useState("");
  const [importConflict, setImportConflict] = useState<"RENAME" | "OVERWRITE" | "FAIL">("RENAME");
  const [isImporting, setIsImporting] = useState(false);

  // Migrate Root State
  const [newRootPath, setNewRootPath] = useState("");
  const [isMigratingRoot, setIsMigratingRoot] = useState(false);

  useEffect(() => {
    loadAll();
  }, [projectId]);

  async function loadAll() {
    setIsLoading(true);
    await Promise.all([loadBackups(), loadHealth(), loadStorage()]);
    setIsLoading(false);
  }

  async function loadBackups() {
    try {
      const res = await fetch(`/api/projects/${projectId}/backup`);
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
      }
    } catch {
      // ignore
    }
  }

  async function loadHealth() {
    try {
      const res = await fetch(`/api/projects/${projectId}/health`);
      if (res.ok) {
        const data = await res.json();
        setHealth(data.health);
      }
    } catch {
      // ignore
    }
  }

  async function loadStorage() {
    try {
      const res = await fetch(`/api/projects/${projectId}/storage`);
      if (res.ok) {
        const data = await res.json();
        setStorage(data.storage);
      }
    } catch {
      // ignore
    }
  }

  async function handleCreateBackup(type: "METADATA_BACKUP" | "FULL_PROJECT_BACKUP") {
    setActionMessage({ text: `Membuat ${type === "METADATA_BACKUP" ? "cadangan metadata" : "cadangan lengkap"}...` });
    try {
      const res = await fetch(`/api/projects/${projectId}/backup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupType: type }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ text: `✓ Cadangan berhasil dibuat: ${data.backup.filename}` });
        await loadBackups();
      } else {
        setActionMessage({ text: `Gagal: ${data.error || "Gagal membuat cadangan"}`, isError: true });
      }
    } catch {
      setActionMessage({ text: "Gagal menghubungi server untuk pencadangan.", isError: true });
    }
  }

  async function handleValidateBackup(backupPath: string) {
    setActionMessage({ text: "Memvalidasi cadangan..." });
    try {
      const res = await fetch(`/api/projects/${projectId}/backup/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupPath }),
      });
      const data = await res.json();
      if (data.isValid) {
        setActionMessage({ text: `✓ Cadangan valid (${data.manifest?.totalFiles || 0} berkas, checksum cocok).` });
      } else {
        setActionMessage({ text: `⚠ Cadangan tidak valid:\n${data.errors?.join("\n")}`, isError: true });
      }
    } catch {
      setActionMessage({ text: "Gagal memvalidasi cadangan.", isError: true });
    }
  }

  async function handleConfirmRestore() {
    if (!confirmInput.trim()) {
      alert("Masukkan kode konfirmasi.");
      return;
    }

    setIsRestoring(true);
    setActionMessage({ text: "Membuat safety backup dan memulihkan proyek..." });
    try {
      const res = await fetch(`/api/projects/${projectId}/backup/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backupPath: restoreModalData.backupPath,
          confirmCode: confirmInput.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ text: `✓ ${data.message || "Proyek berhasil dipulihkan."}` });
        setRestoreModalData({ isOpen: false, backupPath: "", backupName: "" });
        setConfirmInput("");
        await loadAll();
      } else {
        setActionMessage({ text: `Gagal: ${data.error || "Gagal memulihkan cadangan"}`, isError: true });
      }
    } catch {
      setActionMessage({ text: "Gagal memulihkan cadangan.", isError: true });
    } finally {
      setIsRestoring(false);
    }
  }

  async function handleExportProject() {
    setIsExporting(true);
    setActionMessage({ text: "Mengekspor proyek portabel..." });
    try {
      const res = await fetch(`/api/projects/${projectId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeAssets: includeAssetsInExport }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ text: `✓ Ekspor berhasil disimpan di: ${data.exportPath} (${data.totalFiles} berkas)` });
      } else {
        setActionMessage({ text: `Gagal: ${data.error || "Gagal mengekspor proyek"}`, isError: true });
      }
    } catch {
      setActionMessage({ text: "Gagal mengekspor proyek.", isError: true });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImportProject(e: React.FormEvent) {
    e.preventDefault();
    if (!importPath.trim() || !importDestRoot.trim()) {
      alert("Folder sumber ekspor dan folder tujuan wajib diisi.");
      return;
    }

    setIsImporting(true);
    setActionMessage({ text: "Mengimpor paket proyek..." });
    try {
      const res = await fetch("/api/projects/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exportPath: importPath.trim(),
          destinationRootPath: importDestRoot.trim(),
          conflictResolution: importConflict,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({ text: `✓ ${data.message}` });
        setImportPath("");
        setImportDestRoot("");
      } else {
        setActionMessage({ text: `Gagal: ${data.error || "Gagal mengimpor proyek"}`, isError: true });
      }
    } catch {
      setActionMessage({ text: "Gagal menghubungi server untuk impor.", isError: true });
    } finally {
      setIsImporting(false);
    }
  }

  async function handleMigrateRoot(e: React.FormEvent) {
    e.preventDefault();
    if (!newRootPath.trim()) return;

    setIsMigratingRoot(true);
    setActionMessage({ text: "Memindahkan lokasi root proyek..." });
    try {
      const res = await fetch(`/api/projects/${projectId}/migrate-root`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newRootPath: newRootPath.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({
          text: `✓ Root proyek berhasil dipindahkan ke: ${data.rootPath}.${
            data.missingFilesCount > 0 ? ` Catatan: ${data.missingFilesCount} berkas tidak ditemukan di lokasi baru.` : ""
          }`,
        });
        setNewRootPath("");
        await loadAll();
      } else {
        setActionMessage({ text: `Gagal: ${data.error || "Gagal memindahkan root proyek"}`, isError: true });
      }
    } catch {
      setActionMessage({ text: "Gagal memindahkan root proyek.", isError: true });
    } finally {
      setIsMigratingRoot(false);
    }
  }

  function formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  return (
    <AppShell active="Cadangan" projectId={projectId} projectSection="Cadangan">
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px 16px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 6px 0", color: "#f4f4f5" }}>
              Cadangan, Pemulihan, Ekspor & Rilis Proyek
            </h1>
            <p style={{ margin: 0, color: "#a1a1aa", fontSize: "13px" }}>
              Manajemen keutuhan data produksi: pencadangan deterministik, restore aman, ekspor portabel, dan pemantauan ruang penyimpanan.
            </p>
          </div>
          <span style={{ background: "#059669", color: "#fff", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>
            v1.0.0
          </span>
        </div>

        {/* Global Action Message */}
        {actionMessage && (
          <div
            style={{
              padding: "12px 16px",
              marginBottom: "20px",
              borderRadius: "8px",
              background: actionMessage.isError ? "#7f1d1d" : "#064e3b",
              color: "#fff",
              fontSize: "13px",
              whiteSpace: "pre-line",
            }}
          >
            {actionMessage.text}
          </div>
        )}

        {/* GRID: HEALTH & STORAGE CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
          {/* Card 1: Factual Health */}
          <div style={{ background: "#18181b", padding: "20px", borderRadius: "10px", border: "1px solid #27272a" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#fff", marginTop: 0, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🏥</span> Pemeriksaan Kesehatan Faktual Proyek
            </h2>
            {health ? (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "12px" }}>
                  <div style={{ background: "#09090b", padding: "10px", borderRadius: "6px", border: "1px solid #27272a", textAlign: "center" }}>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: health.missingFilesCount === 0 ? "#10b981" : "#ef4444" }}>
                      {health.missingFilesCount}
                    </div>
                    <div style={{ fontSize: "11px", color: "#a1a1aa" }}>Berkas Hilang</div>
                  </div>
                  <div style={{ background: "#09090b", padding: "10px", borderRadius: "6px", border: "1px solid #27272a", textAlign: "center" }}>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: health.unlinkedFilesCount === 0 ? "#10b981" : "#f59e0b" }}>
                      {health.unlinkedFilesCount}
                    </div>
                    <div style={{ fontSize: "11px", color: "#a1a1aa" }}>Berkas Belum Dilink</div>
                  </div>
                  <div style={{ background: "#09090b", padding: "10px", borderRadius: "6px", border: "1px solid #27272a", textAlign: "center" }}>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: health.brokenReferenceLinksCount === 0 ? "#10b981" : "#ef4444" }}>
                      {health.brokenReferenceLinksCount}
                    </div>
                    <div style={{ fontSize: "11px", color: "#a1a1aa" }}>Referensi Rusak</div>
                  </div>
                </div>
                <div style={{ fontSize: "12px", color: "#71717a" }}>
                  Status Evaluasi: <strong>{health.summary}</strong>
                </div>
              </div>
            ) : (
              <div style={{ color: "#71717a", fontSize: "12px" }}>Memuat status kesehatan...</div>
            )}
          </div>

          {/* Card 2: Storage Breakdown */}
          <div style={{ background: "#18181b", padding: "20px", borderRadius: "10px", border: "1px solid #27272a" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#fff", marginTop: 0, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>💾</span> Penggunaan Ruang Penyimpanan
            </h2>
            {storage ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "12px" }}>
                  <span style={{ color: "#a1a1aa" }}>Total Ukuran Aset Proyek:</span>
                  <strong style={{ color: "#fff" }}>{formatBytes(storage.totalBytes)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "12px" }}>
                  <span style={{ color: "#a1a1aa" }}>Sisa Ruang Drive Bebas:</span>
                  <strong style={{ color: storage.isLowStorageWarning ? "#ef4444" : "#10b981" }}>
                    {formatBytes(storage.diskFreeBytes)}
                  </strong>
                </div>

                {storage.isLowStorageWarning && (
                  <div style={{ padding: "6px 10px", borderRadius: "4px", background: "#7f1d1d", color: "#fff", fontSize: "11px", marginBottom: "12px" }}>
                    ⚠ Peringatan: Ruang drive tersisa kurang dari 5 GB atau terpakai lebih dari 90%.
                  </div>
                )}

                {/* Categories Breakdown */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", fontSize: "11px" }}>
                  {Object.entries(storage.categories || {}).map(([cat, val]: [string, any]) => (
                    <span key={cat} style={{ background: "#09090b", padding: "3px 8px", borderRadius: "4px", border: "1px solid #27272a", color: "#d4d4d8" }}>
                      {cat}: {formatBytes(val.bytes)}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ color: "#71717a", fontSize: "12px" }}>Memuat status penyimpanan...</div>
            )}
          </div>
        </div>

        {/* SECTION: BACKUPS */}
        <div style={{ background: "#18181b", padding: "24px", borderRadius: "10px", border: "1px solid #27272a", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#fff", margin: "0 0 4px 0" }}>
                Daftar Cadangan Proyek
              </h2>
              <p style={{ margin: 0, color: "#a1a1aa", fontSize: "12px" }}>
                Setiap cadangan menghasilkan manifest bertanggal unik dan checksum sha256 lengkap.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => handleCreateBackup("METADATA_BACKUP")}
                style={{
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Cadangan Metadata
              </button>
              <button
                onClick={() => handleCreateBackup("FULL_PROJECT_BACKUP")}
                style={{
                  background: "#059669",
                  color: "#fff",
                  border: "none",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Cadangan Lengkap (Full)
              </button>
            </div>
          </div>

          {backups.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #27272a", color: "#a1a1aa" }}>
                    <th style={{ padding: "8px" }}>NAMA CADANGAN</th>
                    <th style={{ padding: "8px" }}>TIPE</th>
                    <th style={{ padding: "8px" }}>TANGGAL</th>
                    <th style={{ padding: "8px" }}>UKURAN</th>
                    <th style={{ padding: "8px" }}>BERKAS</th>
                    <th style={{ padding: "8px", textAlign: "right" }}>AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b) => (
                    <tr key={b.id} style={{ borderBottom: "1px solid #1f1f23" }}>
                      <td style={{ padding: "8px", fontWeight: 600, color: "#f4f4f5" }}>
                        {b.filename}
                      </td>
                      <td style={{ padding: "8px" }}>
                        <span
                          style={{
                            background: b.backupType === "METADATA_BACKUP" ? "#1e3a8a" : "#064e3b",
                            color: "#fff",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "10px",
                          }}
                        >
                          {b.backupType === "METADATA_BACKUP" ? "METADATA" : "FULL"}
                        </span>
                      </td>
                      <td style={{ padding: "8px", color: "#71717a", whiteSpace: "nowrap" }}>
                        {new Date(b.createdAt).toLocaleString("id-ID")}
                      </td>
                      <td style={{ padding: "8px", color: "#d4d4d8" }}>{formatBytes(b.fileSizeBytes)}</td>
                      <td style={{ padding: "8px", color: "#d4d4d8" }}>{b.fileCount}</td>
                      <td style={{ padding: "8px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          onClick={() => handleValidateBackup(b.backupPath)}
                          style={{
                            background: "#27272a",
                            color: "#d4d4d8",
                            border: "1px solid #3f3f46",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            marginRight: "6px",
                            cursor: "pointer",
                          }}
                        >
                          Validasi
                        </button>
                        <button
                          onClick={() => setRestoreModalData({ isOpen: true, backupPath: b.backupPath, backupName: b.filename })}
                          style={{
                            background: "#7f1d1d",
                            color: "#fff",
                            border: "none",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >
                          Pulihkan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: "32px", textAlign: "center", color: "#71717a", fontSize: "13px" }}>
              Belum ada cadangan dibuat untuk proyek ini. Klik tombol di atas untuk membuat cadangan pertama.
            </div>
          )}
        </div>

        {/* SECTION: PORTABLE EXPORT & IMPORT */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
          {/* Export Card */}
          <div style={{ background: "#18181b", padding: "20px", borderRadius: "10px", border: "1px solid #27272a" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#fff", marginTop: 0, marginBottom: "8px" }}>
              Ekspor Proyek Portabel
            </h2>
            <p style={{ color: "#a1a1aa", fontSize: "12px", marginBottom: "16px" }}>
              Menghasilkan paket mandiri berisi manifest.json, project.json, database-export.json, naskah, dan prompt untuk dipindahkan ke mesin lain.
            </p>

            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#f4f4f5", marginBottom: "16px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={includeAssetsInExport}
                onChange={(e) => setIncludeAssetsInExport(e.target.checked)}
              />
              Sertakan seluruh berkas aset fisik (WITH_ASSETS)
            </label>

            <button
              onClick={handleExportProject}
              disabled={isExporting}
              style={{
                background: "#3b82f6",
                color: "#fff",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {isExporting ? "Mengekspor..." : "Ekspor Proyek Sekarang"}
            </button>
          </div>

          {/* Import Card */}
          <form onSubmit={handleImportProject} style={{ background: "#18181b", padding: "20px", borderRadius: "10px", border: "1px solid #27272a" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#fff", marginTop: 0, marginBottom: "8px" }}>
              Impor Proyek Portabel
            </h2>
            <p style={{ color: "#a1a1aa", fontSize: "12px", marginBottom: "16px" }}>
              Memulihkan paket ekspor ke direktori tujuan dengan pemetaan ID baru dan resolusi konflik.
            </p>

            <div style={{ marginBottom: "10px" }}>
              <input
                type="text"
                placeholder="Path folder ekspor (berisi manifest.json)"
                value={importPath}
                onChange={(e) => setImportPath(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "12px" }}
              />
            </div>

            <div style={{ marginBottom: "10px" }}>
              <input
                type="text"
                placeholder="Folder tujuan root proyek baru (absolut)"
                value={importDestRoot}
                onChange={(e) => setImportDestRoot(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "12px" }}
              />
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "14px" }}>
              <span style={{ fontSize: "11px", color: "#a1a1aa" }}>Resolusi Konflik:</span>
              <select
                value={importConflict}
                onChange={(e) => setImportConflict(e.target.value as any)}
                style={{ padding: "4px 8px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "4px", color: "#d4d4d8", fontSize: "11px" }}
              >
                <option value="RENAME">RENAME (Beri nama baru jika kode bentrok)</option>
                <option value="OVERWRITE">OVERWRITE (Timpa proyek lama)</option>
                <option value="FAIL">FAIL (Batalkan jika kode bentrok)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isImporting}
              style={{
                background: "#059669",
                color: "#fff",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {isImporting ? "Mengimpor..." : "Mulai Impor Proyek"}
            </button>
          </form>
        </div>

        {/* SECTION: MIGRATE PROJECT ROOT */}
        <div style={{ background: "#18181b", padding: "20px", borderRadius: "10px", border: "1px solid #27272a" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#fff", marginTop: 0, marginBottom: "8px" }}>
            Migrasi Lokasi Root Proyek (Project Root Relocation)
          </h2>
          <p style={{ color: "#a1a1aa", fontSize: "12px", marginBottom: "16px" }}>
            Gunakan fitur ini jika drive external dilepas/dipasang kembali pada huruf drive berbeda di Windows, atau proyek dipindahkan ke NAS. Seluruh path relatif di database tetap dipertahankan.
          </p>

          <form onSubmit={handleMigrateRoot} style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              placeholder="Path root baru (contoh: E:\PRODUKSI\LEMBAH-AWAN)"
              value={newRootPath}
              onChange={(e) => setNewRootPath(e.target.value)}
              style={{ flex: 1, padding: "8px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "12px" }}
            />
            <button
              type="submit"
              disabled={isMigratingRoot}
              style={{
                background: "#27272a",
                color: "#fff",
                border: "1px solid #3f3f46",
                padding: "8px 18px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {isMigratingRoot ? "Memindahkan..." : "Perbarui Root Path"}
            </button>
          </form>
        </div>

        {/* RESTORE CONFIRMATION MODAL */}
        {restoreModalData.isOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.75)",
              backdropFilter: "blur(4px)",
              zIndex: 10000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
            }}
          >
            <div
              style={{
                width: "500px",
                background: "#18181b",
                border: "1px solid #7f1d1d",
                borderRadius: "10px",
                padding: "24px",
                color: "#f4f4f5",
              }}
            >
              <h3 style={{ margin: "0 0 12px 0", color: "#ef4444", fontSize: "16px" }}>
                Konfirmasi Pemulihan Cadangan
              </h3>
              <p style={{ fontSize: "13px", color: "#d4d4d8", lineHeight: "1.5", marginBottom: "16px" }}>
                Anda akan memulihkan proyek dari berkas cadangan:
                <br />
                <strong>{restoreModalData.backupName}</strong>
              </p>
              <div style={{ background: "#27272a", padding: "10px 14px", borderRadius: "6px", fontSize: "12px", color: "#10b981", marginBottom: "16px" }}>
                ✓ Safety backup otomatis akan dibuat sebelum pemulihan dijalankan untuk menjamin data tidak pernah hilang secara permanen.
              </div>
              <p style={{ fontSize: "12px", color: "#a1a1aa", marginBottom: "8px" }}>
                Ketik <strong>RESTORE</strong> di bawah untuk mengonfirmasi:
              </p>
              <input
                type="text"
                placeholder="Ketik RESTORE"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fff", fontSize: "13px", marginBottom: "16px" }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setRestoreModalData({ isOpen: false, backupPath: "", backupName: "" })}
                  disabled={isRestoring}
                  style={{
                    background: "#27272a",
                    color: "#d4d4d8",
                    border: "none",
                    padding: "8px 14px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={isRestoring || confirmInput.trim() !== "RESTORE"}
                  style={{
                    background: confirmInput.trim() === "RESTORE" ? "#dc2626" : "#451a1a",
                    color: "#fff",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: confirmInput.trim() === "RESTORE" ? "pointer" : "not-allowed",
                  }}
                >
                  {isRestoring ? "Memulihkan..." : "Konfirmasi & Pulihkan"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
