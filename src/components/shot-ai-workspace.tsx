"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TaskOption = {
  code: string;
  name: string;
  defaultThinkingLevel: string;
};

type ShotAiWorkspaceProps = {
  projectId: string;
  shotId: string;
  shotCode: string;
  tasks: TaskOption[];
};

export function ShotAiWorkspace({ projectId, shotId, shotCode, tasks }: ShotAiWorkspaceProps) {
  const router = useRouter();

  const [selectedTaskCode, setSelectedTaskCode] = useState<string>("PROMPT_GENERATION");
  const defaultLevel = tasks.find((t) => t.code === "PROMPT_GENERATION")?.defaultThinkingLevel || "MEDIUM";
  const [thinkingLevel, setThinkingLevel] = useState<string>(defaultLevel);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isPreparingContext, setIsPreparingContext] = useState<boolean>(false);
  const [isAccepting, setIsAccepting] = useState<boolean>(false);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [contextNotice, setContextNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState<string | null>(null);
  const [isEditingDraft, setIsEditingDraft] = useState<boolean>(false);
  const [editableDraft, setEditableDraft] = useState<string>("");

  function handleTaskChange(newCode: string) {
    setSelectedTaskCode(newCode);
    const task = tasks.find((t) => t.code === newCode);
    if (task) {
      setThinkingLevel(task.defaultThinkingLevel || "MEDIUM");
    }
  }

  async function handleGenerate() {
    setIsGenerating(true);
    setErrorMessage(null);
    setSuccessNotice(null);
    setContextNotice(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/shots/${shotId}/ai/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskCode: selectedTaskCode,
          thinkingLevel,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Gagal menghasilkan draf dari Gemini.");
        return;
      }

      setCurrentRequestId(data.request.id);
      setDraftContent(data.draftText);
      setEditableDraft(data.draftText);
      setIsEditingDraft(false);
    } catch (err) {
      setErrorMessage((err as Error).message || "Terjadi kesalahan jaringan.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handlePrepareContext() {
    setIsPreparingContext(true);
    setErrorMessage(null);
    setContextNotice(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/shots/${shotId}/ai/prepare-context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskCode: selectedTaskCode }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Gagal menyiapkan berkas konteks.");
        return;
      }

      setContextNotice(data.message || `Paket konteks berhasil disiapkan di AI_CONTEXT_PACK/ (${data.files?.length || 0} berkas).`);
    } catch (err) {
      setErrorMessage((err as Error).message || "Terjadi kesalahan saat menyiapkan konteks.");
    } finally {
      setIsPreparingContext(false);
    }
  }

  async function handleAccept() {
    if (!currentRequestId) return;
    setIsAccepting(true);
    setErrorMessage(null);

    try {
      const contentToSend = isEditingDraft ? editableDraft : draftContent;
      const res = await fetch(`/api/ai/requests/${currentRequestId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedContent: contentToSend }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Gagal menyetujui draf.");
        return;
      }

      setSuccessNotice(data.message || "Hasil AI berhasil disimpan ke data produksi shot.");
      setDraftContent(null);
      setCurrentRequestId(null);
      setIsEditingDraft(false);
      router.refresh();
    } catch (err) {
      setErrorMessage((err as Error).message || "Gagal menyetujui draf AI.");
    } finally {
      setIsAccepting(false);
    }
  }

  async function handleReject() {
    if (!currentRequestId) return;
    setIsRejecting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/ai/requests/${currentRequestId}/reject`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Gagal menolak draf.");
        return;
      }

      setSuccessNotice("Draf AI ditolak. Data produksi tetap tidak berubah.");
      setDraftContent(null);
      setCurrentRequestId(null);
      setIsEditingDraft(false);
    } catch (err) {
      setErrorMessage((err as Error).message || "Gagal menolak draf.");
    } finally {
      setIsRejecting(false);
    }
  }

  return (
    <section className="panel" style={{ marginTop: "18px" }}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">GEMINI AI WORKSPACE</p>
          <h2>AI Workspace · {shotCode}</h2>
        </div>
        <span className="panel-mark" title="Google Gemini 3.8 Flash">✦</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "14px" }}>
        <label className="field">
          <span>Tugas AI (Task)</span>
          <select
            value={selectedTaskCode}
            onChange={(e) => handleTaskChange(e.target.value)}
            disabled={isGenerating}
          >
            {tasks.map((task) => (
              <option key={task.code} value={task.code}>
                {task.name} ({task.code})
              </option>
            ))}
          </select>
          <small>Model aktif: Google Gemini 3.8 Flash</small>
        </label>

        <label className="field">
          <span>Thinking Level</span>
          <select
            value={thinkingLevel}
            onChange={(e) => setThinkingLevel(e.target.value)}
            disabled={isGenerating}
          >
            <option value="LOW">LOW (Cepat / Respons ringkas)</option>
            <option value="MEDIUM">MEDIUM (Standar seimbang)</option>
            <option value="HIGH">HIGH (Analisis mendalam & komprehensif)</option>
          </select>
          <small>Tingkat kedalaman penalaran model Gemini</small>
        </label>
      </div>

      <div style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" }}>
        <button
          type="button"
          className="button button-primary"
          onClick={handleGenerate}
          disabled={isGenerating || isPreparingContext}
        >
          {isGenerating ? "✦ Memproses dengan Gemini..." : "✦ Generate with Gemini"}
        </button>

        <button
          type="button"
          className="button button-secondary"
          onClick={handlePrepareContext}
          disabled={isGenerating || isPreparingContext}
        >
          {isPreparingContext ? "Menyiapkan Konteks..." : "Prepare Context"}
        </button>
      </div>

      {errorMessage && (
        <div className="form-error" style={{ marginTop: "14px" }}>
          <strong>Peringatan AI:</strong> {errorMessage}
        </div>
      )}

      {contextNotice && (
        <div
          style={{
            marginTop: "14px",
            padding: "10px 13px",
            backgroundColor: "#f2f7ec",
            border: "1px solid #d4e7c5",
            borderRadius: "6px",
            color: "#416335",
            fontSize: "11px",
          }}
        >
          ✓ {contextNotice}
        </div>
      )}

      {successNotice && (
        <div
          style={{
            marginTop: "14px",
            padding: "10px 13px",
            backgroundColor: "#f2f7ec",
            border: "1px solid #d4e7c5",
            borderRadius: "6px",
            color: "#416335",
            fontSize: "11px",
          }}
        >
          ✓ {successNotice}
        </div>
      )}

      {draftContent && (
        <div
          style={{
            marginTop: "18px",
            borderTop: "1px solid #edf0ee",
            paddingTop: "14px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div>
              <p className="eyebrow" style={{ margin: "0 0 2px" }}>HASIL GENERASI</p>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>AI Draft</h3>
            </div>
            <span style={{ fontSize: "10px", color: "#8b9790" }}>
              Status: Menunggu Tinjauan
            </span>
          </div>

          {isEditingDraft ? (
            <textarea
              value={editableDraft}
              onChange={(e) => setEditableDraft(e.target.value)}
              rows={12}
              style={{
                width: "100%",
                padding: "10px",
                fontFamily: "Consolas, monospace",
                fontSize: "11px",
                border: "1px solid #ced6d1",
                borderRadius: "6px",
                backgroundColor: "#fff",
              }}
            />
          ) : (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "#f7f9f7",
                border: "1px solid #e2e8e3",
                borderRadius: "6px",
                padding: "12px",
                fontSize: "11px",
                lineHeight: "1.5",
                maxHeight: "350px",
                overflowY: "auto",
                fontFamily: "Consolas, monospace",
                color: "#2c3b32",
              }}
            >
              {draftContent}
            </pre>
          )}

          <div style={{ display: "flex", gap: "8px", marginTop: "12px", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="button button-quiet"
              onClick={() => setIsEditingDraft(!isEditingDraft)}
              disabled={isAccepting || isRejecting}
            >
              {isEditingDraft ? "Batal Edit" : "Edit"}
            </button>

            <button
              type="button"
              className="button button-danger-outline"
              onClick={handleReject}
              disabled={isAccepting || isRejecting}
            >
              {isRejecting ? "Menolak..." : "Reject"}
            </button>

            <button
              type="button"
              className="button button-primary"
              onClick={handleAccept}
              disabled={isAccepting || isRejecting}
            >
              {isAccepting ? "Menyimpan..." : "Accept"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
