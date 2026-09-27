"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export interface SearchResultItem {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  code?: string;
  projectId?: string;
  projectName?: string;
  url: string;
  score: number;
}

export function CommandPaletteModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"SEARCH" | "COMMANDS">("SEARCH");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Listen for Ctrl+K or Cmd+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery("");
      setResults([]);
      setCommandFeedback(null);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || activeTab !== "SEARCH") {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=15`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setSelectedIndex(0);
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query, activeTab]);

  const commands = [
    {
      id: "cmd-new-project",
      title: "Buat Proyek Baru",
      subtitle: "Buka halaman utama untuk membuat proyek produksi baru",
      badge: "PROYEK",
      action: () => {
        setIsOpen(false);
        router.push("/");
      },
    },
    {
      id: "cmd-settings",
      title: "Buka Pengaturan Sistem (v1.0.0)",
      subtitle: "Konfigurasi AI, backup, penyimpanan, dan log audit",
      badge: "PENGATURAN",
      action: () => {
        setIsOpen(false);
        router.push("/settings");
      },
    },
    {
      id: "cmd-db-integrity",
      title: "Periksa Integritas Database (PRAGMA integrity_check)",
      subtitle: "Jalankan diagnosa kesehatan SQLite lokal",
      badge: "DIAGNOSA",
      action: async () => {
        setCommandFeedback("Memeriksa integritas database...");
        try {
          const res = await fetch("/api/system/integrity");
          const data = await res.json();
          setCommandFeedback(
            data.isOk ? "✓ Database sehat (ok)" : `⚠ Integritas bermasalah: ${JSON.stringify(data.result)}`
          );
        } catch {
          setCommandFeedback("Gagal menjalankan pemeriksaan integritas.");
        }
      },
    },
    {
      id: "cmd-clear-cache",
      title: "Bersihkan Cache Thumbnail & Render Sementara",
      subtitle: "Hapus berkas cache untuk menghemat ruang disk",
      badge: "MAINTENANCE",
      action: async () => {
        setCommandFeedback("Membersihkan cache...");
        try {
          const res = await fetch("/api/system/clear-cache", { method: "POST" });
          const data = await res.json();
          setCommandFeedback(`✓ Cache dibersihkan (${data.clearedCount || 0} berkas dihapus).`);
        } catch {
          setCommandFeedback("Gagal membersihkan cache.");
        }
      },
    },
    {
      id: "cmd-ai-history",
      title: "Buka Riwayat AI & Token Usage",
      subtitle: "Audit semua pemanggilan Gemini API dan estimasi token",
      badge: "AI",
      action: () => {
        setIsOpen(false);
        router.push("/ai/history");
      },
    },
  ];

  function handleSelectResult(item: SearchResultItem) {
    setIsOpen(false);
    router.push(item.url);
  }

  function handleKeyDownInBox(e: React.KeyboardEvent) {
    if (activeTab === "SEARCH") {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        handleSelectResult(results[selectedIndex]);
      }
    }
  }

  function getTypeColor(type: string): string {
    switch (type) {
      case "PROJECT":
        return "#3b82f6";
      case "CONTENT":
        return "#8b5cf6";
      case "SCENE":
        return "#f59e0b";
      case "SHOT":
        return "#10b981";
      case "ASSET":
        return "#6366f1";
      case "PROMPT":
        return "#06b6d4";
      case "VIDEO":
        return "#ec4899";
      case "QC":
        return "#f97316";
      default:
        return "#6b7280";
    }
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
      }}
      onClick={() => setIsOpen(false)}
    >
      <div
        style={{
          width: "680px",
          maxWidth: "92vw",
          background: "#18181b",
          border: "1px solid #27272a",
          borderRadius: "12px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          color: "#f4f4f5",
          fontFamily: "inherit",
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDownInBox}
      >
        {/* Header Tabs & Search Input */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #27272a" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <button
              onClick={() => setActiveTab("SEARCH")}
              style={{
                background: activeTab === "SEARCH" ? "#27272a" : "transparent",
                color: activeTab === "SEARCH" ? "#fff" : "#a1a1aa",
                border: "1px solid #3f3f46",
                padding: "4px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              🔍 Cari Produksi
            </button>
            <button
              onClick={() => setActiveTab("COMMANDS")}
              style={{
                background: activeTab === "COMMANDS" ? "#27272a" : "transparent",
                color: activeTab === "COMMANDS" ? "#fff" : "#a1a1aa",
                border: "1px solid #3f3f46",
                padding: "4px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ⚡ Perintah Cepat
            </button>
            <span style={{ marginLeft: "auto", fontSize: "11px", color: "#71717a", alignSelf: "center" }}>
              ESC untuk menutup
            </span>
          </div>

          {activeTab === "SEARCH" ? (
            <div style={{ position: "relative" }}>
              <input
                ref={inputRef}
                type="text"
                placeholder="Cari kode (SH016, KF-B08, EP01), judul, aset, prompt..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  width: "100%",
                  background: "#09090b",
                  border: "1px solid #3f3f46",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  color: "#fff",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
              {isLoading && (
                <span
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "10px",
                    fontSize: "12px",
                    color: "#a1a1aa",
                  }}
                >
                  Mencari...
                </span>
              )}
            </div>
          ) : (
            <div style={{ color: "#a1a1aa", fontSize: "13px" }}>
              Pilih perintah sistem di bawah untuk aksi produksi cepat:
            </div>
          )}
        </div>

        {/* Content list */}
        <div style={{ maxHeight: "380px", overflowY: "auto", padding: "8px 0" }}>
          {commandFeedback && (
            <div
              style={{
                margin: "8px 16px",
                padding: "8px 12px",
                borderRadius: "6px",
                background: "#27272a",
                fontSize: "12px",
                color: "#10b981",
                border: "1px solid #3f3f46",
              }}
            >
              {commandFeedback}
            </div>
          )}

          {activeTab === "SEARCH" ? (
            results.length > 0 ? (
              results.map((item, idx) => (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleSelectResult(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    padding: "10px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    cursor: "pointer",
                    background: selectedIndex === idx ? "#27272a" : "transparent",
                    borderLeft: selectedIndex === idx ? "3px solid #3b82f6" : "3px solid transparent",
                  }}
                >
                  <span
                    style={{
                      background: getTypeColor(item.type),
                      color: "#fff",
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      minWidth: "55px",
                      textAlign: "center",
                    }}
                  >
                    {item.type}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#f4f4f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: "11px", color: "#a1a1aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.subtitle}
                    </div>
                  </div>
                  {item.code && (
                    <span style={{ fontSize: "11px", color: "#71717a", fontFamily: "monospace" }}>
                      {item.code}
                    </span>
                  )}
                </div>
              ))
            ) : query.trim() ? (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "#71717a", fontSize: "13px" }}>
                Tidak ada hasil ditemukan untuk &ldquo;{query}&rdquo;
              </div>
            ) : (
              <div style={{ padding: "24px 20px", textAlign: "center", color: "#71717a", fontSize: "12px" }}>
                Ketikkan kata kunci untuk mencari di seluruh database produksi (kode shot, nama karakter, judul scene, aset).
              </div>
            )
          ) : (
            commands.map((cmd) => (
              <div
                key={cmd.id}
                onClick={cmd.action}
                style={{
                  padding: "10px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  cursor: "pointer",
                  borderBottom: "1px solid #27272a",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#27272a")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span
                  style={{
                    background: "#3f3f46",
                    color: "#fff",
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    minWidth: "70px",
                    textAlign: "center",
                  }}
                >
                  {cmd.badge}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#f4f4f5" }}>
                    {cmd.title}
                  </div>
                  <div style={{ fontSize: "11px", color: "#a1a1aa" }}>
                    {cmd.subtitle}
                  </div>
                </div>
                <button
                  style={{
                    background: "#09090b",
                    border: "1px solid #3f3f46",
                    color: "#d4d4d8",
                    padding: "4px 10px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  Jalankan
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div
          style={{
            padding: "8px 20px",
            background: "#111113",
            borderTop: "1px solid #27272a",
            display: "flex",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "#71717a",
          }}
        >
          <span>Gunakan ↑ ↓ untuk navigasi • ↵ untuk membuka</span>
          <span>Local Production Control v1.0.0</span>
        </div>
      </div>
    </div>
  );
}
