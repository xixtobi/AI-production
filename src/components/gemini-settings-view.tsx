"use client";

import { useState } from "react";

type GeminiSettingsViewProps = {
  isConfigured: boolean;
  configuredModel: string;
  defaultThinkingLevel: string;
  taskDefaults: Record<string, string>;
};

export function GeminiSettingsView({
  isConfigured,
  configuredModel,
  defaultThinkingLevel,
  taskDefaults,
}: GeminiSettingsViewProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    status: string;
    message: string;
    model: string;
  } | null>(null);

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/settings/ai/test-connection", {
        method: "POST",
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({
        ok: false,
        status: "ERROR",
        message: (err as Error).message || "Gagal menguji koneksi ke server.",
        model: configuredModel,
      });
    } finally {
      setTesting(false);
    }
  }

  const initialStatusLabel = isConfigured ? "CONFIGURED" : "NOT CONFIGURED";
  const initialStatusColor = isConfigured ? "#416335" : "#a4443c";
  const initialStatusBg = isConfigured ? "#eaf5e9" : "#fff0ef";

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">INTEGRASI AI UTAMA</p>
            <h2>Pengaturan Google Gemini</h2>
          </div>
          <span className="panel-mark">✦</span>
        </div>

        <div style={{ marginTop: "16px", display: "grid", gap: "14px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              background: "#fbfcfb",
              border: "1px solid #e8ece9",
              borderRadius: "8px",
            }}
          >
            <div>
              <strong style={{ fontSize: "12px", display: "block" }}>Gemini API Status</strong>
              <small style={{ color: "#77857c", fontSize: "10px" }}>
                Konektivitas server ke Google GenAI SDK (@google/genai)
              </small>
            </div>
            <span
              style={{
                padding: "6px 12px",
                borderRadius: "20px",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.5px",
                backgroundColor: initialStatusBg,
                color: initialStatusColor,
              }}
            >
              {initialStatusLabel}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              background: "#fbfcfb",
              border: "1px solid #e8ece9",
              borderRadius: "8px",
            }}
          >
            <div>
              <strong style={{ fontSize: "12px", display: "block" }}>Configured Model</strong>
              <small style={{ color: "#77857c", fontSize: "10px" }}>
                Model dasar yang digunakan untuk seluruh tugas produksi
              </small>
            </div>
            <code
              style={{
                background: "#f1f3f1",
                padding: "4px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                fontFamily: "Consolas, monospace",
                fontWeight: 700,
                color: "#283b30",
              }}
            >
              {configuredModel}
            </code>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              background: "#fbfcfb",
              border: "1px solid #e8ece9",
              borderRadius: "8px",
            }}
          >
            <div>
              <strong style={{ fontSize: "12px", display: "block" }}>Default Thinking Level</strong>
              <small style={{ color: "#77857c", fontSize: "10px" }}>
                Tingkat penalaran default model Gemini
              </small>
            </div>
            <span
              style={{
                background: "#edf4ea",
                color: "#4d6d3e",
                padding: "4px 10px",
                borderRadius: "12px",
                fontSize: "10px",
                fontWeight: 700,
              }}
            >
              {defaultThinkingLevel}
            </span>
          </div>
        </div>

        <div style={{ marginTop: "20px", borderTop: "1px solid #edf0ee", paddingTop: "16px" }}>
          <button
            type="button"
            className="button button-primary"
            onClick={handleTestConnection}
            disabled={testing}
          >
            {testing ? "Menguji Koneksi..." : "Test Gemini Connection"}
          </button>
        </div>

        {testResult && (
          <div
            style={{
              marginTop: "16px",
              padding: "12px 16px",
              borderRadius: "8px",
              border: `1px solid ${testResult.ok ? "#cde5be" : "#f1c7c2"}`,
              backgroundColor: testResult.ok ? "#f2f8ed" : "#fff2f0",
              color: testResult.ok ? "#2d5221" : "#a13c32",
              fontSize: "11px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <strong>Status: {testResult.status}</strong>
              <span style={{ fontSize: "10px", color: "#666" }}>({testResult.model})</span>
            </div>
            <div>{testResult.message}</div>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">DISTRIBUSI PENALARAN</p>
            <h2>Standar Thinking Level per Tugas</h2>
          </div>
        </div>

        <div style={{ marginTop: "14px" }}>
          <table className="project-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Tugas Produksi</th>
                <th>Kategori</th>
                <th>Default Thinking Level</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(taskDefaults).map(([taskKey, level]) => (
                <tr key={taskKey}>
                  <td className="table-code">{taskKey}</td>
                  <td>Produksi</td>
                  <td>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "10px",
                        fontSize: "9px",
                        fontWeight: 700,
                        backgroundColor:
                          level === "HIGH" ? "#fbf1e0" : level === "MEDIUM" ? "#edf4ea" : "#f1f3f2",
                        color:
                          level === "HIGH" ? "#96611f" : level === "MEDIUM" ? "#446937" : "#68736d",
                      }}
                    >
                      {level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">KEAMANAN & LINGKUNGAN SERVER</p>
            <h2>Kebijakan Kunci API</h2>
          </div>
        </div>
        <p style={{ fontSize: "11px", color: "#748279", lineHeight: "1.6", margin: "12px 0 0" }}>
          Kunci <code>GEMINI_API_KEY</code> dimuat secara aman hanya pada proses server Node.js dan tidak
          pernah dikirimkan ke peramban (browser), disimpan di database SQLite, atau dicatat ke log.
          Jika kunci belum dikonfigurasi, sistem tetap beroperasi normal untuk manajemen proyek, shot, dan file.
        </p>
      </section>
    </div>
  );
}
