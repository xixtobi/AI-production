"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/app-shell";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"GENERAL" | "AI" | "FILESYSTEM" | "BACKUP" | "ACTIVITIES" | "LOGS">("GENERAL");
  const [settings, setSettings] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // AI Connection Test
  const [aiTestResult, setAiTestResult] = useState<{ status?: string; message?: string } | null>(null);
  const [isTestingAi, setIsTestingAi] = useState(false);

  // Database Integrity
  const [integrityResult, setIntegrityResult] = useState<any>(null);
  const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(false);

  // Cache Clear
  const [cacheResult, setCacheResult] = useState<string | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Activity Logs
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  // Technical Logs
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [logType, setLogType] = useState<"combined" | "error">("combined");
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings || {});
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaveStatus("Menyimpan...");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setSaveStatus("✓ Pengaturan berhasil disimpan.");
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        setSaveStatus("Gagal menyimpan pengaturan.");
      }
    } catch {
      setSaveStatus("Gagal menghubungi server.");
    }
  }

  async function handleTestAiConnection() {
    setIsTestingAi(true);
    setAiTestResult(null);
    try {
      const res = await fetch("/api/settings/ai/test-connection", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setAiTestResult({ status: "OK", message: data.message || "Koneksi Google Gemini API (gemini-3.8-flash) Berhasil." });
      } else {
        setAiTestResult({ status: "ERROR", message: data.error || "Gagal menghubungi Gemini API." });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAiTestResult({ status: "ERROR", message: `Kesalahan jaringan: ${msg}` });
    } finally {
      setIsTestingAi(false);
    }
  }

  async function handleCheckIntegrity() {
    setIsCheckingIntegrity(true);
    setIntegrityResult(null);
    try {
      const res = await fetch("/api/system/integrity");
      const data = await res.json();
      setIntegrityResult(data);
    } catch {
      setIntegrityResult({ isOk: false, errors: ["Gagal menjalankan integritas database."] });
    } finally {
      setIsCheckingIntegrity(false);
    }
  }

  async function handleClearCache() {
    setIsClearingCache(true);
    setCacheResult(null);
    try {
      const res = await fetch("/api/system/clear-cache", { method: "POST" });
      const data = await res.json();
      setCacheResult(`✓ ${data.message || `Cache dibersihkan (${data.clearedCount || 0} berkas).`}`);
    } catch {
      setCacheResult("Gagal membersihkan cache.");
    } finally {
      setIsClearingCache(false);
    }
  }

  async function loadActivities() {
    setIsLoadingActivities(true);
    try {
      const res = await fetch("/api/activities?limit=40");
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingActivities(false);
    }
  }

  async function loadSystemLogs(type = logType) {
    setIsLoadingLogs(true);
    try {
      const res = await fetch(`/api/logs/system?lines=80&type=${type}`);
      if (res.ok) {
        const data = await res.json();
        setSystemLogs(data.logs || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingLogs(false);
    }
  }

  useEffect(() => {
    if (activeTab === "ACTIVITIES") {
      loadActivities();
    } else if (activeTab === "LOGS") {
      loadSystemLogs(logType);
    }
  }, [activeTab, logType]);

  return (
    <AppShell active="Pengaturan">
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px 16px" }}>
        {/* Workspace Title & Badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "0 0 6px 0", color: "#f4f4f5" }}>
              Pengaturan Sistem Produksi
            </h1>
            <p style={{ margin: 0, color: "#a1a1aa", fontSize: "13px" }}>
              Konfigurasi kontrol lokal, Google Gemini API, integritas database, dan cadangan aman.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                background: "#059669",
                color: "#fff",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              Release v1.0.0
            </span>
          </div>
        </div>

        {/* Tab Buttons */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            borderBottom: "1px solid #27272a",
            marginBottom: "24px",
            overflowX: "auto",
          }}
        >
          {[
            { id: "GENERAL", label: "Umum" },
            { id: "AI", label: "AI (Gemini)" },
            { id: "FILESYSTEM", label: "Filesystem & Integritas" },
            { id: "BACKUP", label: "Cadangan (Backup)" },
            { id: "ACTIVITIES", label: "Audit Aktivitas" },
            { id: "LOGS", label: "Log Sistem" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: activeTab === tab.id ? "#27272a" : "transparent",
                color: activeTab === tab.id ? "#ffffff" : "#a1a1aa",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid #3b82f6" : "2px solid transparent",
                padding: "10px 16px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {saveStatus && (
          <div
            style={{
              padding: "10px 16px",
              marginBottom: "16px",
              borderRadius: "6px",
              background: saveStatus.startsWith("✓") ? "#064e3b" : "#7f1d1d",
              color: "#fff",
              fontSize: "13px",
            }}
          >
            {saveStatus}
          </div>
        )}

        {/* TAB 1: GENERAL */}
        {activeTab === "GENERAL" && (
          <form onSubmit={handleSaveSettings} style={{ background: "#18181b", padding: "24px", borderRadius: "10px", border: "1px solid #27272a" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#fff", marginTop: 0, marginBottom: "16px" }}>
              Preferensi Umum Produksi
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "6px" }}>
                  Bahasa Antarmuka
                </label>
                <input
                  type="text"
                  value={settings.language || "Indonesian"}
                  disabled
                  style={{ width: "100%", padding: "8px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#d4d4d8" }}
                />
                <small style={{ color: "#71717a", fontSize: "11px" }}>Bahasa sistem default adalah Bahasa Indonesia baku.</small>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "6px" }}>
                  Rasio Aspek Default
                </label>
                <select
                  value={settings.defaultAspectRatio || "16:9"}
                  onChange={(e) => setSettings({ ...settings, defaultAspectRatio: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#d4d4d8" }}
                >
                  <option value="16:9">16:9 (Landscape / Serial / Film)</option>
                  <option value="9:16">9:16 (Portrait / TikTok / Reels)</option>
                  <option value="1:1">1:1 (Square)</option>
                  <option value="4:3">4:3 (Classic Academy)</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "6px" }}>
                Auto-Scan Berkas Saat Buka Halaman
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#f4f4f5", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={Boolean(settings.autoScanOnLoad)}
                  onChange={(e) => setSettings({ ...settings, autoScanOnLoad: e.target.checked })}
                />
                Pindai perubahan folder aset fisik secara otomatis setiap kali halaman proyek dibuka
              </label>
            </div>

            <button
              type="submit"
              style={{
                background: "#3b82f6",
                color: "#fff",
                border: "none",
                padding: "8px 20px",
                borderRadius: "6px",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Simpan Pengaturan
            </button>
          </form>
        )}

        {/* TAB 2: AI (GEMINI FOUNDATION) */}
        {activeTab === "AI" && (
          <div style={{ background: "#18181b", padding: "24px", borderRadius: "10px", border: "1px solid #27272a" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#fff", marginTop: 0, marginBottom: "8px" }}>
              Google Gemini AI Foundation
            </h2>
            <p style={{ color: "#a1a1aa", fontSize: "13px", marginBottom: "20px" }}>
              Sistem beroperasi secara eksklusif menggunakan Google GenAI SDK (<code>@google/genai</code>) dan model <strong>gemini-3.8-flash</strong>.
            </p>

            <div style={{ background: "#09090b", padding: "16px", borderRadius: "8px", border: "1px solid #27272a", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#f4f4f5" }}>Model Aktif: gemini-3.8-flash</div>
                  <div style={{ fontSize: "11px", color: "#71717a" }}>Thinking Level disesuaikan otomatis per jenis tugas produksi (LOW / MEDIUM / HIGH).</div>
                </div>
                <button
                  type="button"
                  onClick={handleTestAiConnection}
                  disabled={isTestingAi}
                  style={{
                    background: "#27272a",
                    color: "#fff",
                    border: "1px solid #3f3f46",
                    padding: "6px 14px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {isTestingAi ? "Menguji..." : "Uji Koneksi Gemini API"}
                </button>
              </div>

              {aiTestResult && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "6px",
                    background: aiTestResult.status === "OK" ? "#064e3b" : "#7f1d1d",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                >
                  {aiTestResult.message}
                </div>
              )}
            </div>

            <div style={{ fontSize: "12px", color: "#a1a1aa", lineHeight: "1.6" }}>
              <p>
                <strong>Keamanan Kunci API:</strong> API key disimpan aman pada environment lokal (<code>GEMINI_API_KEY</code>). Kunci tidak pernah dikirim ke browser pengguna dan otomatis disanitasi dari seluruh log teknis produksi.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: FILESYSTEM & INTEGRITY */}
        {activeTab === "FILESYSTEM" && (
          <div style={{ background: "#18181b", padding: "24px", borderRadius: "10px", border: "1px solid #27272a" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#fff", marginTop: 0, marginBottom: "8px" }}>
              Pemeliharaan Filesystem & Diagnosa SQLite
            </h2>
            <p style={{ color: "#a1a1aa", fontSize: "13px", marginBottom: "20px" }}>
              Diagnosa faktual status fisik basis data dan berkas aset lokal tanpa estimasi subjektif.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <div style={{ background: "#09090b", padding: "16px", borderRadius: "8px", border: "1px solid #27272a" }}>
                <h3 style={{ fontSize: "14px", color: "#fff", marginTop: 0, marginBottom: "8px" }}>
                  Integritas Basis Data
                </h3>
                <p style={{ fontSize: "12px", color: "#a1a1aa", marginBottom: "16px" }}>
                  Jalankan <code>PRAGMA integrity_check</code> untuk memastikan seluruh tabel SQLite sehat dan konsisten.
                </p>
                <button
                  onClick={handleCheckIntegrity}
                  disabled={isCheckingIntegrity}
                  style={{
                    background: "#27272a",
                    color: "#fff",
                    border: "1px solid #3f3f46",
                    padding: "6px 14px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {isCheckingIntegrity ? "Memeriksa..." : "Periksa Integritas Database"}
                </button>

                {integrityResult && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      background: integrityResult.isOk ? "#064e3b" : "#7f1d1d",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  >
                    {integrityResult.isOk ? "✓ Integritas database OK. Tidak ada korupsi." : `⚠ Ditemukan masalah: ${JSON.stringify(integrityResult.errors)}`}
                  </div>
                )}
              </div>

              <div style={{ background: "#09090b", padding: "16px", borderRadius: "8px", border: "1px solid #27272a" }}>
                <h3 style={{ fontSize: "14px", color: "#fff", marginTop: 0, marginBottom: "8px" }}>
                  Pembersihan Cache
                </h3>
                <p style={{ fontSize: "12px", color: "#a1a1aa", marginBottom: "16px" }}>
                  Hapus cache thumbnail dan berkas kompilasi sementara untuk membebaskan ruang disk.
                </p>
                <button
                  onClick={handleClearCache}
                  disabled={isClearingCache}
                  style={{
                    background: "#27272a",
                    color: "#fff",
                    border: "1px solid #3f3f46",
                    padding: "6px 14px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {isClearingCache ? "Membersihkan..." : "Bersihkan Cache Thumbnail"}
                </button>

                {cacheResult && (
                  <div style={{ marginTop: "12px", padding: "8px 12px", borderRadius: "6px", background: "#064e3b", color: "#fff", fontSize: "12px" }}>
                    {cacheResult}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BACKUP SETTINGS */}
        {activeTab === "BACKUP" && (
          <form onSubmit={handleSaveSettings} style={{ background: "#18181b", padding: "24px", borderRadius: "10px", border: "1px solid #27272a" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#fff", marginTop: 0, marginBottom: "8px" }}>
              Pengaturan Cadangan Otomatis & Retensi
            </h2>
            <p style={{ color: "#a1a1aa", fontSize: "13px", marginBottom: "20px" }}>
              Cadangan disimpan dalam direktori bertanggal unik tanpa pernah menimpa berkas yang telah ada.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "6px" }}>
                  Folder Cadangan Khusus (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Default: <data-dir>/backups"
                  value={settings.backupRootPath || ""}
                  onChange={(e) => setSettings({ ...settings, backupRootPath: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#d4d4d8" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "6px" }}>
                  Batas Retensi Cadangan Otomatis
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={settings.backupRetentionCount || 5}
                  onChange={(e) => setSettings({ ...settings, backupRetentionCount: parseInt(e.target.value, 10) || 5 })}
                  style={{ width: "100%", padding: "8px 12px", background: "#09090b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#d4d4d8" }}
                />
              </div>
            </div>

            <button
              type="submit"
              style={{
                background: "#3b82f6",
                color: "#fff",
                border: "none",
                padding: "8px 20px",
                borderRadius: "6px",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Simpan Konfigurasi Cadangan
            </button>
          </form>
        )}

        {/* TAB 5: ACTIVITY LOGS */}
        {activeTab === "ACTIVITIES" && (
          <div style={{ background: "#18181b", padding: "24px", borderRadius: "10px", border: "1px solid #27272a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#fff", margin: "0 0 4px 0" }}>
                  Audit Jejak Aktivitas Produksi
                </h2>
                <p style={{ margin: 0, color: "#a1a1aa", fontSize: "12px" }}>
                  Mencatat seluruh aksi operasional: pembuatan proyek, registrasi aset, ekspor/impor, pemulihan cadangan, dan tinjauan QC.
                </p>
              </div>
              <button
                onClick={loadActivities}
                style={{
                  background: "#27272a",
                  color: "#fff",
                  border: "1px solid #3f3f46",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Muat Ulang
              </button>
            </div>

            {isLoadingActivities ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#71717a" }}>Memuat aktivitas...</div>
            ) : activities.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #27272a", color: "#a1a1aa" }}>
                      <th style={{ padding: "8px" }}>WAKTU</th>
                      <th style={{ padding: "8px" }}>AKSI</th>
                      <th style={{ padding: "8px" }}>JUDUL</th>
                      <th style={{ padding: "8px" }}>DESKRIPSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((a) => (
                      <tr key={a.id} style={{ borderBottom: "1px solid #1f1f23" }}>
                        <td style={{ padding: "8px", color: "#71717a", whiteSpace: "nowrap" }}>
                          {new Date(a.createdAt).toLocaleString("id-ID")}
                        </td>
                        <td style={{ padding: "8px" }}>
                          <span style={{ background: "#27272a", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 600 }}>
                            {a.actionType}
                          </span>
                        </td>
                        <td style={{ padding: "8px", fontWeight: 600, color: "#f4f4f5" }}>{a.title}</td>
                        <td style={{ padding: "8px", color: "#a1a1aa" }}>{a.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: "32px", textAlign: "center", color: "#71717a" }}>Belum ada log aktivitas tercatat.</div>
            )}
          </div>
        )}

        {/* TAB 6: SYSTEM LOGS */}
        {activeTab === "LOGS" && (
          <div style={{ background: "#18181b", padding: "24px", borderRadius: "10px", border: "1px solid #27272a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#fff", margin: "0 0 4px 0" }}>
                  Log Teknis Sistem & Error (File-based)
                </h2>
                <p style={{ margin: 0, color: "#a1a1aa", fontSize: "12px" }}>
                  Berkas log disimpan di disk dengan proteksi redaksi otomatis untuk seluruh token & API keys.
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => setLogType("combined")}
                  style={{
                    background: logType === "combined" ? "#3b82f6" : "#27272a",
                    color: "#fff",
                    border: "none",
                    padding: "4px 10px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Semua Log
                </button>
                <button
                  onClick={() => setLogType("error")}
                  style={{
                    background: logType === "error" ? "#ef4444" : "#27272a",
                    color: "#fff",
                    border: "none",
                    padding: "4px 10px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Error Saja
                </button>
                <button
                  onClick={() => loadSystemLogs(logType)}
                  style={{
                    background: "#27272a",
                    color: "#fff",
                    border: "1px solid #3f3f46",
                    padding: "4px 10px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Refresh
                </button>
              </div>
            </div>

            {isLoadingLogs ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#71717a" }}>Memuat log teknis...</div>
            ) : systemLogs.length > 0 ? (
              <div
                style={{
                  background: "#09090b",
                  padding: "16px",
                  borderRadius: "8px",
                  maxHeight: "450px",
                  overflowY: "auto",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  border: "1px solid #27272a",
                }}
              >
                {systemLogs.map((l, i) => (
                  <div key={i} style={{ marginBottom: "8px", borderBottom: "1px solid #18181b", paddingBottom: "4px" }}>
                    <span style={{ color: "#71717a" }}>[{l.timestamp}] </span>
                    <span
                      style={{
                        color: l.level === "ERROR" ? "#ef4444" : l.level === "WARN" ? "#f59e0b" : "#3b82f6",
                        fontWeight: 700,
                      }}
                    >
                      {l.level}:{" "}
                    </span>
                    <span style={{ color: "#e4e4e7" }}>{l.message}</span>
                    {l.context && Object.keys(l.context).length > 0 && (
                      <div style={{ color: "#a1a1aa", paddingLeft: "16px", fontSize: "10px" }}>
                        {JSON.stringify(l.context)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "32px", textAlign: "center", color: "#71717a" }}>
                Tidak ada log dalam file {logType === "error" ? "error.log" : "production-control.log"}.
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
