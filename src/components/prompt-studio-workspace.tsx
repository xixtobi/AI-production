"use client";

import { useState, useTransition, useId } from "react";
import Link from "next/link";
import type * as schema from "@/lib/db/schema";
import type { ShotContextData } from "@/lib/gemini/context-builder";
import type {
  PromptType,
  PromptParameters,
  PromptCompareResult,
  FlowQueuePayload,
} from "@/lib/prompts/types";

interface PromptStudioWorkspaceProps {
  projectId: string;
  shotId: string;
  initialDocument: schema.PromptDocument;
  initialVersions: schema.PromptVersion[];
  shotContext: ShotContextData | null;
  templates: schema.PromptTemplate[];
}

export function PromptStudioWorkspace({
  projectId,
  shotId,
  initialDocument,
  initialVersions,
  shotContext,
  templates,
}: PromptStudioWorkspaceProps) {
  const [document, setDocument] = useState<schema.PromptDocument>(initialDocument);
  const [versions, setVersions] = useState<schema.PromptVersion[]>(initialVersions);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(
    () => initialVersions.find((v) => v.isCurrent)?.id || initialVersions[initialVersions.length - 1]?.id || null
  );

  const activeVersion = versions.find((v) => v.id === currentVersionId) || null;
  const isLocked = activeVersion?.isLocked || false;

  const [promptType, setPromptType] = useState<PromptType>(document.promptType as PromptType || "VIDEO");
  const [promptText, setPromptText] = useState(activeVersion?.promptText || "");
  const [negativePrompt, setNegativePrompt] = useState(activeVersion?.negativePrompt || "");

  const initialParams: PromptParameters = (() => {
    if (activeVersion?.parametersJson) {
      try {
        return JSON.parse(activeVersion.parametersJson);
      } catch {}
    }
    return {} as PromptParameters;
  })();

  // Engine & Generation Parameters
  const [engine, setEngine] = useState<string>(initialParams.engine || "VEO");
  const [aspectRatio, setAspectRatio] = useState<string>(initialParams.aspectRatio || "16:9");
  const [duration, setDuration] = useState<number>(initialParams.duration || 4);
  const [resolution, setResolution] = useState<string>(initialParams.resolution || "1080p");
  const [audio, setAudio] = useState<boolean>(initialParams.audio === true);
  const [seed, setSeed] = useState<string>(initialParams.seed != null ? String(initialParams.seed) : "");

  // Structured prompt fields
  const [videoFields, setVideoFields] = useState({
    startFrameRef: shotContext?.linkedAssets.find((a) => a.link.role === "START_FRAME")?.asset.assetCode || "KF-B08",
    actionMovement: shotContext?.shot.action || "",
    cameraMotion: shotContext?.shot.cameraType || "Smooth slow push-in, eye-level",
    speedPacing: "Moderate cinematic pacing",
    environmentDynamics: "Subtle floating dust particles, gentle morning breeze",
    moodTone: "Warm family adventure, mysterious wonder",
    dialogueAudioCues: shotContext?.shot.dialogue || "",
    endFrameRef: "",
    negativeConstraints: "flickering, jitter, sudden morphing, extra limbs, modern cars, text watermark",
  });

  const [imageFields, setImageFields] = useState({
    subject: "Pak Arga holding the ancient compass with Raka and Lila",
    actionPose: "Pak Arga presenting the compass, children leaning forward with curiosity",
    cameraFraming: "Medium two-shot, eye-level slightly low",
    environmentBackground: "interior of Rumah Pak Arga, rustic wooden bookshelves and window",
    lightingAtmosphere: "warm golden morning sunlight filtering through wooden blinds",
    styleRendering: "storybook 3D animation feature film quality, rich warm textures",
    qualityTags: "highly detailed, cinematic lighting, masterpiece",
    negativeConstraints: "blurry, low resolution, deformed anatomy, extra fingers, dark horror",
  });

  const [audioFields, setAudioFields] = useState({
    dialogueLine: shotContext?.shot.dialogue || "Kompas ini tidak menunjuk ke utara, Raka...",
    voiceDescription: "Warm, aged, gentle male voice with grandfatherly cadence",
    emotionTone: "Intriguing, calm, affectionate",
    pacingSpeed: "Slow and deliberate",
    ambientSound: "Soft morning birds outside, distant mountain wind",
    foleySfx: "Gentle wooden box latch click, faint metallic compass needle hum",
    musicStyle: "Whimsical acoustic adventure theme with subtle strings",
  });

  // UI State
  const [openSections, setOpenSections] = useState({
    structured: true,
    engine: true,
    ai: true,
    references: true,
  });

  const [thinkingLevel, setThinkingLevel] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("VIDEO_I2V_FAMILY_ADVENTURE");

  // Notifications
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // AI Review State
  const [aiPreview, setAiPreview] = useState<{
    type: "GENERATE" | "IMPROVE" | "TRANSLATE" | "NEGATIVE";
    positivePrompt?: string;
    negativePrompt?: string;
    notes?: string;
    fullText?: string;
    requestId?: string;
  } | null>(null);

  // Compare Modal State
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareVersionA, setCompareVersionA] = useState<string>("");
  const [compareVersionB, setCompareVersionB] = useState<string>("");
  const [compareResult, setCompareResult] = useState<PromptCompareResult | null>(null);

  // Flow Queue Modal State
  const [flowQueueModalOpen, setFlowQueueModalOpen] = useState(false);
  const [stagedPayload, setStagedPayload] = useState<FlowQueuePayload | null>(null);

  const [isPending, startTransition] = useTransition();

  const videoStartFrameId = useId();
  const videoActionMovementId = useId();
  const videoCameraMotionId = useId();
  const videoSpeedPacingId = useId();
  const videoEnvironmentDynamicsId = useId();
  const videoMoodToneId = useId();
  const videoDialogueAudioCuesId = useId();
  const videoEndFrameId = useId();
  const videoNegativeConstraintsId = useId();

  const imageSubjectId = useId();
  const imageActionPoseId = useId();
  const imageCameraFramingId = useId();
  const imageEnvironmentBackgroundId = useId();
  const imageLightingAtmosphereId = useId();
  const imageStyleRenderingId = useId();
  const imageQualityTagsId = useId();
  const imageNegativeConstraintsId = useId();

  const audioDialogueLineId = useId();
  const audioVoiceDescriptionId = useId();
  const audioEmotionToneId = useId();
  const audioPacingSpeedId = useId();
  const audioAmbientSoundId = useId();
  const audioFoleySfxId = useId();
  const audioMusicStyleId = useId();

  const engineSelectId = useId();
  const aspectRatioSelectId = useId();
  const durationInputId = useId();
  const resolutionSelectId = useId();
  const audioToggleId = useId();
  const seedInputId = useId();
  const templateSelectId = useId();
  const thinkingLevelSelectId = useId();
  const compareVersionASelectId = useId();
  const compareVersionBSelectId = useId();

  function applyVersionToEditor(ver: schema.PromptVersion) {
    setPromptText(ver.promptText || "");
    setNegativePrompt(ver.negativePrompt || "");
    if (ver.parametersJson) {
      try {
        const params = JSON.parse(ver.parametersJson) as PromptParameters;
        if (params.engine) setEngine(params.engine);
        if (params.aspectRatio) setAspectRatio(params.aspectRatio);
        if (params.duration) setDuration(params.duration);
        if (params.resolution) setResolution(params.resolution);
        if (params.audio !== undefined) setAudio(Boolean(params.audio));
        if (params.seed !== undefined) setSeed(String(params.seed || ""));
      } catch {}
    }
  }

  function showMessage(type: "success" | "error", text: string) {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 6000);
  }

  // Compile structured fields to text
  function handleCompileStructured() {
    if (promptType === "IMAGE") {
      const parts = [
        imageFields.subject,
        imageFields.actionPose,
        imageFields.cameraFraming,
        imageFields.environmentBackground ? `in ${imageFields.environmentBackground}` : "",
        imageFields.lightingAtmosphere,
        imageFields.styleRendering,
        imageFields.qualityTags,
      ].filter(Boolean);
      setPromptText(parts.join(", "));
      if (imageFields.negativeConstraints) setNegativePrompt(imageFields.negativeConstraints);
    } else if (promptType === "AUDIO") {
      const parts = [
        imageFields.subject ? `Subject: ${imageFields.subject}` : "",
        audioFields.dialogueLine ? `Spoken dialogue: "${audioFields.dialogueLine}"` : "",
        audioFields.voiceDescription ? `Voice: ${audioFields.voiceDescription}` : "",
        audioFields.emotionTone ? `Tone: ${audioFields.emotionTone}` : "",
        audioFields.pacingSpeed ? `Pacing: ${audioFields.pacingSpeed}` : "",
        audioFields.ambientSound ? `Ambience: ${audioFields.ambientSound}` : "",
        audioFields.foleySfx ? `SFX: ${audioFields.foleySfx}` : "",
        audioFields.musicStyle ? `Music: ${audioFields.musicStyle}` : "",
      ].filter(Boolean);
      setPromptText(parts.join(". "));
    } else {
      // Default VIDEO
      const parts = [
        videoFields.startFrameRef ? `Starting from keyframe image ${videoFields.startFrameRef}:` : "",
        videoFields.actionMovement,
        videoFields.cameraMotion,
        videoFields.speedPacing ? `Pacing: ${videoFields.speedPacing}` : "",
        videoFields.environmentDynamics,
        videoFields.moodTone ? `Mood: ${videoFields.moodTone}` : "",
        videoFields.dialogueAudioCues ? `Dialogue / Audio cues: ${videoFields.dialogueAudioCues}` : "",
        videoFields.endFrameRef ? `Ending at frame ${videoFields.endFrameRef}` : "",
      ].filter(Boolean);
      setPromptText(parts.join(". ").replace(/\.\./g, "."));
      if (videoFields.negativeConstraints) setNegativePrompt(videoFields.negativeConstraints);
    }
    showMessage("success", "Prompt berhasil dikompilasi dari field terstruktur.");
  }

  // Save Version (Manual / Direct)
  async function handleSaveVersion(forceNew = false) {
    if (!promptText.trim()) {
      showMessage("error", "Teks prompt tidak boleh kosong.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/shots/${shotId}/prompts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            promptText,
            negativePrompt,
            parameters: {
              engine,
              aspectRatio,
              duration,
              resolution,
              audio,
              seed: seed ? Number(seed) : null,
            },
            source: "MANUAL",
            promptType,
            forceNewVersion: forceNew || isLocked,
          }),
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        // Refresh document and versions
        const fetchRes = await fetch(`/api/projects/${projectId}/shots/${shotId}/prompts`);
        const refreshed = await fetchRes.json();
        if (refreshed.success) {
          setDocument(refreshed.document);
          setVersions(refreshed.versions);
          setCurrentVersionId(data.version.id);
        }

        showMessage(
          "success",
          `Versi ${data.version.versionLabel} berhasil disimpan ${isLocked || forceNew ? "(versi baru)" : ""}. File lokal diperbarui.`
        );
      } catch (err: unknown) {
        showMessage("error", err instanceof Error ? err.message : "Gagal menyimpan versi.");
      }
    });
  }

  // Lock Version
  async function handleLockVersion() {
    if (!activeVersion) return;
    if (!confirm(`Kunci versi ${activeVersion.versionLabel}? Setelah dikunci, versi ini tidak dapat diedit dan perubahan berikutnya akan otomatis membuat versi baru.`)) {
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/shots/${shotId}/prompts/versions/${activeVersion.id}/lock`,
          { method: "POST" }
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        setVersions((prev) =>
          prev.map((v) => (v.id === activeVersion.id ? { ...v, isLocked: true } : v))
        );
        showMessage("success", `Versi ${activeVersion.versionLabel} berhasil dikunci (immutable).`);
      } catch (err: unknown) {
        showMessage("error", err instanceof Error ? err.message : "Gagal mengunci versi.");
      }
    });
  }

  // Switch Active Version
  async function handleSelectVersion(versionId: string) {
    setCurrentVersionId(versionId);
    const targetVer = versions.find((v) => v.id === versionId);
    if (targetVer) {
      applyVersionToEditor(targetVer);
    }
    startTransition(async () => {
      try {
        await fetch(
          `/api/projects/${projectId}/shots/${shotId}/prompts/versions/${versionId}/activate`,
          { method: "POST" }
        );
      } catch {}
    });
  }

  // Apply Template
  async function handleApplyTemplate() {
    if (!selectedTemplate) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/shots/${shotId}/prompts/templates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateIdOrCode: selectedTemplate }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        setPromptText(data.promptText);
        setNegativePrompt(data.negativePrompt || "");
        if (data.parameters) {
          if (data.parameters.engine) setEngine(data.parameters.engine);
          if (data.parameters.aspectRatio) setAspectRatio(data.parameters.aspectRatio);
          if (data.parameters.duration) setDuration(data.parameters.duration);
          if (data.parameters.resolution) setResolution(data.parameters.resolution);
          if (data.parameters.audio !== undefined) setAudio(Boolean(data.parameters.audio));
        }

        showMessage("success", `Template '${data.template.name}' diterapkan dengan variabel shot.`);
      } catch (err: unknown) {
        showMessage("error", err instanceof Error ? err.message : "Gagal menerapkan template.");
      }
    });
  }

  // AI Assist: Generate Prompt
  async function handleAiGenerate() {
    setAiPreview(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/shots/${shotId}/prompts/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            thinkingLevel,
            targetEngine: engine,
            promptType,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        setAiPreview({
          type: "GENERATE",
          positivePrompt: data.result.positivePrompt,
          negativePrompt: data.result.negativePrompt,
          notes: data.result.notes,
          fullText: data.compiledFullPrompt,
          requestId: data.requestId,
        });

        showMessage("success", "Prompt berhasil dibuat oleh Gemini 3.8 Flash. Tinjau hasil di bawah.");
      } catch (err: unknown) {
        showMessage("error", err instanceof Error ? err.message : "Gagal memanggil Gemini.");
      }
    });
  }

  // AI Assist: Improve Current Prompt
  async function handleAiImprove() {
    if (!promptText.trim()) {
      showMessage("error", "Isi prompt terlebih dahulu untuk disempurnakan.");
      return;
    }
    setAiPreview(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/shots/${shotId}/prompts/improve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPrompt: promptText,
            currentNegative: negativePrompt,
            targetEngine: engine,
            thinkingLevel,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        setAiPreview({
          type: "IMPROVE",
          positivePrompt: data.result.improvedPrompt,
          negativePrompt: data.result.improvedNegativePrompt,
          notes: `${data.result.summaryOfChanges} | Advice: ${data.result.targetEngineAdvice}`,
          fullText: data.result.improvedPrompt,
          requestId: data.requestId,
        });

        showMessage("success", "Prompt berhasil disempurnakan oleh Gemini 3.8 Flash.");
      } catch (err: unknown) {
        showMessage("error", err instanceof Error ? err.message : "Gagal menyempurnakan prompt.");
      }
    });
  }

  // AI Assist: Translate to English
  async function handleAiTranslate() {
    if (!promptText.trim()) {
      showMessage("error", "Isi teks dalam bahasa Indonesia terlebih dahulu.");
      return;
    }
    setAiPreview(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/shots/${shotId}/prompts/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            indonesianText: promptText,
            targetEngine: engine,
            thinkingLevel,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        setAiPreview({
          type: "TRANSLATE",
          positivePrompt: data.result.englishPrompt,
          negativePrompt: data.result.negativePrompt,
          notes: data.result.notes,
          fullText: data.result.englishPrompt,
          requestId: data.requestId,
        });

        showMessage("success", "Penerjemahan ke prompt visual bahasa Inggris berhasil.");
      } catch (err: unknown) {
        showMessage("error", err instanceof Error ? err.message : "Gagal menerjemahkan.");
      }
    });
  }

  // AI Assist: Generate Negative
  async function handleAiNegative() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/shots/${shotId}/prompts/negative`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetEngine: engine,
            thinkingLevel,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        setNegativePrompt(data.result.negativePrompt);
        showMessage("success", "Negative prompt spesifik engine berhasil diperbarui.");
      } catch (err: unknown) {
        showMessage("error", err instanceof Error ? err.message : "Gagal membuat negative prompt.");
      }
    });
  }

  // Apply AI Preview
  async function handleAcceptAiPreview(saveImmediately = false) {
    if (!aiPreview?.fullText) return;
    setPromptText(aiPreview.fullText);
    if (aiPreview.negativePrompt) setNegativePrompt(aiPreview.negativePrompt);

    if (saveImmediately) {
      startTransition(async () => {
        try {
          const res = await fetch(`/api/projects/${projectId}/shots/${shotId}/prompts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              promptText: aiPreview.fullText,
              negativePrompt: aiPreview.negativePrompt || negativePrompt,
              parameters: { engine, aspectRatio, duration, resolution, audio },
              source: "GEMINI",
              notes: aiPreview.notes || "Generated with Gemini 3.8 Flash",
              promptType,
              forceNewVersion: isLocked || versions.length > 0,
            }),
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error);

          const fetchRes = await fetch(`/api/projects/${projectId}/shots/${shotId}/prompts`);
          const refreshed = await fetchRes.json();
          if (refreshed.success) {
            setDocument(refreshed.document);
            setVersions(refreshed.versions);
            setCurrentVersionId(data.version.id);
          }

          setAiPreview(null);
          showMessage("success", `Hasil Gemini berhasil disimpan sebagai versi ${data.version.versionLabel}.`);
        } catch (err: unknown) {
          showMessage("error", err instanceof Error ? err.message : "Gagal menyimpan hasil AI.");
        }
      });
    } else {
      setAiPreview(null);
      showMessage("success", "Hasil Gemini disalin ke editor (belum disimpan ke database).");
    }
  }

  // Compare Versions
  async function handleOpenCompare() {
    if (versions.length < 2) {
      showMessage("error", "Dibutuhkan minimal 2 versi prompt untuk membandingkan.");
      return;
    }
    const verA = versions[0].id;
    const verB = versions[versions.length - 1].id;
    setCompareVersionA(verA);
    setCompareVersionB(verB);
    setCompareModalOpen(true);
    await fetchComparison(verA, verB);
  }

  async function fetchComparison(verA: string, verB: string) {
    if (!verA || !verB) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/shots/${shotId}/prompts/compare?versionA=${verA}&versionB=${verB}`
      );
      const data = await res.json();
      if (data.success) {
        setCompareResult(data.comparison);
      }
    } catch {}
  }

  // Flow Queue Staging
  async function handleAddToFlowQueue() {
    if (!activeVersion) {
      showMessage("error", "Simpan versi prompt terlebih dahulu sebelum menambahkan ke Flow Queue.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/shots/${shotId}/prompts/flow-queue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            promptVersionId: activeVersion.id,
            engine,
            customParameters: { aspectRatio, duration, resolution, audio },
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        setStagedPayload(data.payload);
        setFlowQueueModalOpen(true);
        showMessage("success", `Prompt ${activeVersion.versionLabel} berhasil dimasukkan ke Flow Queue (Status: STAGED).`);
      } catch (err: unknown) {
        showMessage("error", err instanceof Error ? err.message : "Gagal menambahkan ke Flow Queue.");
      }
    });
  }

  // Copy to clipboard
  function handleCopyPrompt() {
    navigator.clipboard.writeText(promptText);
    showMessage("success", "Prompt disalin ke papan klip.");
  }

  return (
    <div className="prompt-studio-container">
      {statusMessage && (
        <div
          style={{
            padding: "10px 14px",
            marginBottom: "14px",
            borderRadius: "7px",
            fontSize: "11px",
            fontWeight: 600,
            background: statusMessage.type === "success" ? "#eef7e8" : "#fdf0ed",
            color: statusMessage.type === "success" ? "#346320" : "#a83930",
            border: `1px solid ${statusMessage.type === "success" ? "#cce4bc" : "#fad0cb"}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            style={{ background: "none", border: 0, cursor: "pointer", color: "inherit", fontWeight: "bold" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Bar Navigation & Version Selector */}
      <div className="prompt-header-bar">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span className={`prompt-type-pill ${promptType}`}>{promptType} PROMPT</span>
          <strong>{document.name}</strong>
          {activeVersion?.localFilePath && (
            <span style={{ fontSize: "9px", color: "#8a968e", fontFamily: "monospace" }} title={activeVersion.localFilePath}>
              📁 {activeVersion.versionLabel}.md
            </span>
          )}
        </div>

        <div className="prompt-version-selector">
          <span style={{ fontSize: "10px", color: "#6e7c74", fontWeight: 600, marginRight: "4px" }}>Versi:</span>
          {versions.map((ver) => (
            <button
              type="button"
              key={ver.id}
              onClick={() => handleSelectVersion(ver.id)}
              className={`version-chip ${ver.id === currentVersionId ? "active" : ""} ${ver.isLocked ? "locked" : ""}`}
            >
              {ver.versionLabel} {ver.isLocked && "🔒"}
            </button>
          ))}
          {versions.length === 0 && <span style={{ fontSize: "10px", color: "#9aa49f" }}>Belum ada versi disimpan</span>}
        </div>
      </div>

      {/* Main 3-Column Layout */}
      <div className="prompt-3col-layout">
        {/* ================= LEFT COLUMN: CONTEXT & REFERENCES ================= */}
        <aside className="prompt-context-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#28392e" }}>Konteks & Referensi</h3>
            <span style={{ fontSize: "9px", color: "#7a8a81", fontWeight: 600 }}>{shotContext?.shot.shotCode}</span>
          </div>

          {/* Shot Details Excerpt */}
          <div style={{ background: "#f8faf8", border: "1px solid #e7eee8", borderRadius: "7px", padding: "10px", marginBottom: "12px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#2d3e33" }}>{shotContext?.shot.title}</div>
            <div style={{ fontSize: "9px", color: "#78877e", marginTop: "3px" }}>
              Durasi: {shotContext?.shot.durationTarget || 4}s | Status: {shotContext?.shot.status} | Kamera: {shotContext?.shot.cameraType || "Push-in"}
            </div>
            {shotContext?.shot.action && (
              <div style={{ marginTop: "7px", fontSize: "10px", color: "#3f5247", lineHeight: 1.4 }}>
                <strong>Aksi:</strong> {shotContext.shot.action}
              </div>
            )}
            {shotContext?.shot.dialogue && (
              <div style={{ marginTop: "5px", fontSize: "10px", color: "#2b4d37", fontStyle: "italic", background: "#f0f6ec", padding: "5px 7px", borderRadius: "4px" }}>
                {shotContext.shot.dialogue}
              </div>
            )}
          </div>

          {/* Keyframe Start Frame Reference (e.g. KF-B08 for SH016) */}
          <div style={{ marginBottom: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#4f6155" }}>START FRAME (ACUAN)</span>
              <span className="start-frame-badge">I2V Motion Anchor</span>
            </div>

            {shotContext?.linkedAssets.filter((a) => a.link.role === "START_FRAME").length ? (
              shotContext.linkedAssets
                .filter((a) => a.link.role === "START_FRAME")
                .map(({ asset, version }) => (
                  <div key={asset.id} className="prompt-asset-card" style={{ borderColor: "#a9cee8", background: "#f2f8fc" }}>
                    <div className="prompt-asset-icon" style={{ background: "#dbebf7", color: "#1e5b88" }}>🖼</div>
                    <div className="prompt-asset-info">
                      <strong style={{ color: "#194c73" }}>{asset.assetCode}</strong>
                      <small>{asset.name}</small>
                      <small style={{ color: "#2a73a6", fontFamily: "monospace" }}>{version?.relativePath || asset.assetCode}</small>
                    </div>
                  </div>
                ))
            ) : (
              <div className="prompt-asset-card">
                <div className="prompt-asset-icon">KF</div>
                <div className="prompt-asset-info">
                  <strong>KF-B08 (Default Acuan)</strong>
                  <small>Keyframe B08 - Pak Arga Menunjukkan Kompas</small>
                </div>
              </div>
            )}
          </div>

          {/* Linked Characters */}
          <div style={{ marginBottom: "14px" }}>
            <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#4f6155", marginBottom: "6px" }}>
              KARAKTER TERKAIT
            </span>
            {shotContext?.characterReferences.length ? (
              shotContext.characterReferences.map((c) => (
                <div key={c.assetCode} className="prompt-asset-card">
                  <div className="prompt-asset-icon">👤</div>
                  <div className="prompt-asset-info">
                    <strong>{c.name} ({c.assetCode})</strong>
                    <small>{c.description}</small>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: "10px", color: "#6a7b70", lineHeight: 1.4, background: "#fdfdfc", padding: "8px", borderRadius: "6px", border: "1px solid #edf1ee" }}>
                <strong>Pak Arga, Raka & Lila</strong>: Kakek bijaksana menunjukkan kompas kuno pada kedua anak penjelajah.
              </div>
            )}
          </div>

          {/* Linked Environment */}
          <div style={{ marginBottom: "14px" }}>
            <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#4f6155", marginBottom: "6px" }}>
              LINGKUNGAN / LATAR
            </span>
            {shotContext?.environmentReferences.length ? (
              shotContext.environmentReferences.map((e) => (
                <div key={e.assetCode} className="prompt-asset-card">
                  <div className="prompt-asset-icon">🏡</div>
                  <div className="prompt-asset-info">
                    <strong>{e.name}</strong>
                    <small>{e.description}</small>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: "10px", color: "#6a7b70", lineHeight: 1.4, background: "#fdfdfc", padding: "8px", borderRadius: "6px", border: "1px solid #edf1ee" }}>
                <strong>Rumah Pak Arga</strong>: Interior rumah kayu tua, rak buku usang, cahaya pagi hangat menerobos jendela.
              </div>
            )}
          </div>

          {/* Style Bible Summary */}
          <div>
            <span style={{ display: "block", fontSize: "10px", fontWeight: 700, color: "#4f6155", marginBottom: "6px" }}>
              STYLE BIBLE PROYEK
            </span>
            <div style={{ fontSize: "9px", color: "#54665a", background: "#f7faf6", border: "1px solid #e1ebde", padding: "8px", borderRadius: "6px", lineHeight: 1.4 }}>
              {shotContext?.styleBible || "3D Pixar/Disney style, vibrant, warm storybook atmospheric animation aesthetic."}
            </div>
          </div>
        </aside>

        {/* ================= CENTER COLUMN: PROMPT BUILDER & EDITOR ================= */}
        <main className="prompt-builder-panel">
          {/* Prompt Type Selector & Controls Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ display: "flex", gap: "6px" }}>
              {(["VIDEO", "IMAGE", "AUDIO"] as PromptType[]).map((type) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setPromptType(type)}
                  className={`button ${promptType === type ? "button-primary" : "button-secondary"}`}
                  style={{ height: "30px", fontSize: "10px", padding: "0 10px" }}
                >
                  {type === "VIDEO" && "🎬 Video Prompt"}
                  {type === "IMAGE" && "🖼 Image Prompt"}
                  {type === "AUDIO" && "🎙 Audio Prompt"}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              {activeVersion && (
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "4px 8px",
                    borderRadius: "4px",
                    background: isLocked ? "#fbe8e7" : "#eaf7e6",
                    color: isLocked ? "#992f28" : "#2e691e",
                    border: `1px solid ${isLocked ? "#f7c7c3" : "#c6e8bb"}`,
                  }}
                >
                  {isLocked ? "🔒 TERKUNCI (IMMUTABLE)" : "✏ DAPAT DIEDIT"}
                </span>
              )}
            </div>
          </div>

          {/* Structured Builder (Collapsible) */}
          <div className="structured-card">
            <div
              className="structured-header"
              onClick={() => setOpenSections((p) => ({ ...p, structured: !p.structured }))}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>🧩</span>
                <strong>Field Terstruktur ({promptType})</strong>
                <span style={{ fontSize: "9px", color: "#78877f", fontWeight: "normal" }}>
                  (Dapat diedit offline tanpa Gemini)
                </span>
              </div>
              <span style={{ fontSize: "11px", color: "#6a7b72" }}>{openSections.structured ? "▲" : "▼"}</span>
            </div>

            {openSections.structured && (
              <div className="structured-body">
                {promptType === "VIDEO" && (
                  <>
                    <div className="field">
                      <label htmlFor={videoStartFrameId}>Start Frame Reference (Keyframe Acuan Awal):</label>
                      <input
                        id={videoStartFrameId}
                        value={videoFields.startFrameRef}
                        onChange={(e) => setVideoFields({ ...videoFields, startFrameRef: e.target.value })}
                        placeholder="Contoh: KF-B08"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={videoActionMovementId}>Action / Pergerakan Karakter:</label>
                      <textarea
                        id={videoActionMovementId}
                        rows={2}
                        value={videoFields.actionMovement}
                        onChange={(e) => setVideoFields({ ...videoFields, actionMovement: e.target.value })}
                        placeholder="Pak Arga perlahan membuka kotak beludru dan mengangkat kompas..."
                      />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <div className="field">
                        <label htmlFor={videoCameraMotionId}>Gerakan Kamera:</label>
                        <input
                          id={videoCameraMotionId}
                          value={videoFields.cameraMotion}
                          onChange={(e) => setVideoFields({ ...videoFields, cameraMotion: e.target.value })}
                          placeholder="Slow push-in, subtle pan right, steady"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={videoSpeedPacingId}>Kecepatan / Tempo:</label>
                        <input
                          id={videoSpeedPacingId}
                          value={videoFields.speedPacing}
                          onChange={(e) => setVideoFields({ ...videoFields, speedPacing: e.target.value })}
                          placeholder="Moderate cinematic pacing, gentle"
                        />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <div className="field">
                        <label htmlFor={videoEnvironmentDynamicsId}>Dinamika Lingkungan (Debu, Cahaya, Kabut):</label>
                        <input
                          id={videoEnvironmentDynamicsId}
                          value={videoFields.environmentDynamics}
                          onChange={(e) => setVideoFields({ ...videoFields, environmentDynamics: e.target.value })}
                          placeholder="Warm sunbeams, floating atmospheric dust particles"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={videoMoodToneId}>Mood / Atmosfer:</label>
                        <input
                          id={videoMoodToneId}
                          value={videoFields.moodTone}
                          onChange={(e) => setVideoFields({ ...videoFields, moodTone: e.target.value })}
                          placeholder="Mysterious, heartwarming, adventurous wonder"
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor={videoDialogueAudioCuesId}>Cue Audio / Dialog Karakter:</label>
                      <input
                        id={videoDialogueAudioCuesId}
                        value={videoFields.dialogueAudioCues}
                        onChange={(e) => setVideoFields({ ...videoFields, dialogueAudioCues: e.target.value })}
                        placeholder="Dialogue sync cue or ambient sound trigger"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={videoEndFrameId}>End Frame Reference (Opsional):</label>
                      <input
                        id={videoEndFrameId}
                        value={videoFields.endFrameRef}
                        onChange={(e) => setVideoFields({ ...videoFields, endFrameRef: e.target.value })}
                        placeholder="Contoh: KF-B09"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={videoNegativeConstraintsId}>Negative Constraints (Hal yang Dilarang):</label>
                      <input
                        id={videoNegativeConstraintsId}
                        value={videoFields.negativeConstraints}
                        onChange={(e) => setVideoFields({ ...videoFields, negativeConstraints: e.target.value })}
                        placeholder="jitter, flickering, abrupt morphing, warped hands"
                      />
                    </div>
                  </>
                )}

                {promptType === "IMAGE" && (
                  <>
                    <div className="field">
                      <label htmlFor={imageSubjectId}>Subjek Utama:</label>
                      <input
                        id={imageSubjectId}
                        value={imageFields.subject}
                        onChange={(e) => setImageFields({ ...imageFields, subject: e.target.value })}
                        placeholder="Karakter atau objek fokus"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={imageActionPoseId}>Aksi / Pose:</label>
                      <input
                        id={imageActionPoseId}
                        value={imageFields.actionPose}
                        onChange={(e) => setImageFields({ ...imageFields, actionPose: e.target.value })}
                        placeholder="Pose atau interaksi subjek"
                      />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <div className="field">
                        <label htmlFor={imageCameraFramingId}>Framing Kamera:</label>
                        <input
                          id={imageCameraFramingId}
                          value={imageFields.cameraFraming}
                          onChange={(e) => setImageFields({ ...imageFields, cameraFraming: e.target.value })}
                          placeholder="Medium close-up, eye-level, rule of thirds"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={imageEnvironmentBackgroundId}>Lingkungan Latar Belakang:</label>
                        <input
                          id={imageEnvironmentBackgroundId}
                          value={imageFields.environmentBackground}
                          onChange={(e) => setImageFields({ ...imageFields, environmentBackground: e.target.value })}
                          placeholder="Interior Rumah Pak Arga..."
                        />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <div className="field">
                        <label htmlFor={imageLightingAtmosphereId}>Pencahayaan & Warna:</label>
                        <input
                          id={imageLightingAtmosphereId}
                          value={imageFields.lightingAtmosphere}
                          onChange={(e) => setImageFields({ ...imageFields, lightingAtmosphere: e.target.value })}
                          placeholder="Golden hour, volumetric warmth"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={imageStyleRenderingId}>Gaya Seni / Rendering:</label>
                        <input
                          id={imageStyleRenderingId}
                          value={imageFields.styleRendering}
                          onChange={(e) => setImageFields({ ...imageFields, styleRendering: e.target.value })}
                          placeholder="Pixar Disney 3D animation style"
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor={imageQualityTagsId}>Tag Kualitas:</label>
                      <input
                        id={imageQualityTagsId}
                        value={imageFields.qualityTags}
                        onChange={(e) => setImageFields({ ...imageFields, qualityTags: e.target.value })}
                        placeholder="masterpiece, 8k resolution, highly detailed"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={imageNegativeConstraintsId}>Negative Constraints:</label>
                      <input
                        id={imageNegativeConstraintsId}
                        value={imageFields.negativeConstraints}
                        onChange={(e) => setImageFields({ ...imageFields, negativeConstraints: e.target.value })}
                        placeholder="deformed, extra limbs, photorealistic, gloomy horror"
                      />
                    </div>
                  </>
                )}

                {promptType === "AUDIO" && (
                  <>
                    <div className="field">
                      <label htmlFor={audioDialogueLineId}>Kalimat Dialog:</label>
                      <input
                        id={audioDialogueLineId}
                        value={audioFields.dialogueLine}
                        onChange={(e) => setAudioFields({ ...audioFields, dialogueLine: e.target.value })}
                      />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <div className="field">
                        <label htmlFor={audioVoiceDescriptionId}>Karakter Suara:</label>
                        <input
                          id={audioVoiceDescriptionId}
                          value={audioFields.voiceDescription}
                          onChange={(e) => setAudioFields({ ...audioFields, voiceDescription: e.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={audioEmotionToneId}>Emosi / Nada:</label>
                        <input
                          id={audioEmotionToneId}
                          value={audioFields.emotionTone}
                          onChange={(e) => setAudioFields({ ...audioFields, emotionTone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <div className="field">
                        <label htmlFor={audioPacingSpeedId}>Kecepatan Penyampaian:</label>
                        <input
                          id={audioPacingSpeedId}
                          value={audioFields.pacingSpeed}
                          onChange={(e) => setAudioFields({ ...audioFields, pacingSpeed: e.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={audioAmbientSoundId}>Suara Latar (Ambience):</label>
                        <input
                          id={audioAmbientSoundId}
                          value={audioFields.ambientSound}
                          onChange={(e) => setAudioFields({ ...audioFields, ambientSound: e.target.value })}
                        />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <div className="field">
                        <label htmlFor={audioFoleySfxId}>Foley / SFX:</label>
                        <input
                          id={audioFoleySfxId}
                          value={audioFields.foleySfx}
                          onChange={(e) => setAudioFields({ ...audioFields, foleySfx: e.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={audioMusicStyleId}>Musik / Mood Lagu:</label>
                        <input
                          id={audioMusicStyleId}
                          value={audioFields.musicStyle}
                          onChange={(e) => setAudioFields({ ...audioFields, musicStyle: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                  <button
                    type="button"
                    onClick={handleCompileStructured}
                    className="button button-secondary"
                    style={{ height: "30px", fontSize: "10px" }}
                  >
                    ⬇ Salin ke Editor Prompt Utama
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* AI Review Banner (Preview before applying) */}
          {aiPreview && (
            <div className="ai-review-banner">
              <strong>✨ Hasil Gemini 3.8 Flash ({aiPreview.type}) — Tinjau Sebelum Menerapkan</strong>
              <p>AI tidak menimpa prompt Anda secara otomatis. Klik tombol di bawah untuk menyetujui atau menolak.</p>

              <div style={{ background: "#fff", border: "1px solid #cde4c0", borderRadius: "6px", padding: "10px", marginBottom: "10px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#223d16", marginBottom: "4px" }}>Prompt yang Disarankan:</div>
                <div style={{ fontSize: "11px", fontFamily: "monospace", color: "#183011", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {aiPreview.fullText}
                </div>

                {aiPreview.negativePrompt && (
                  <div style={{ marginTop: "8px", borderTop: "1px solid #e3edd9", paddingTop: "6px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#8a3d35" }}>Negative Prompt Disarankan:</div>
                    <div style={{ fontSize: "10px", fontFamily: "monospace", color: "#6e2922" }}>
                      {aiPreview.negativePrompt}
                    </div>
                  </div>
                )}

                {aiPreview.notes && (
                  <div style={{ marginTop: "6px", fontSize: "9px", color: "#5d7350", fontStyle: "italic" }}>
                    Catatan: {aiPreview.notes}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleAcceptAiPreview(true)}
                  className="button button-primary"
                  style={{ height: "32px", fontSize: "10px" }}
                >
                  ✓ Setujui & Simpan sebagai Versi Baru
                </button>
                <button
                  type="button"
                  onClick={() => handleAcceptAiPreview(false)}
                  className="button button-secondary"
                  style={{ height: "32px", fontSize: "10px" }}
                >
                  Salin ke Editor Saja
                </button>
                <button
                  type="button"
                  onClick={() => setAiPreview(null)}
                  className="button button-outline"
                  style={{ height: "32px", fontSize: "10px" }}
                >
                  Tolak / Buang
                </button>
              </div>
            </div>
          )}

          {/* Compiled Prompt Editor */}
          <div className="prompt-textarea-wrap">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#25382b" }}>
                Prompt Utama {isLocked && "(Terkunci — Edit akan membuat versi baru saat disimpan)"}
              </label>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="text-link"
                style={{ background: "none", border: 0, cursor: "pointer", fontSize: "10px" }}
              >
                📋 Salin Prompt
              </button>
            </div>
            <textarea
              className="prompt-textarea"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Ketik atau kompilasi prompt visual produksi di sini..."
            />
          </div>

          {/* Negative Prompt Editor */}
          <div className="prompt-textarea-wrap">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#7a3731" }}>
                Negative Prompt (Batasan & Larangan Visual)
              </label>
            </div>
            <textarea
              className="negative-textarea"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="Daftar cacat visual, elemen terlarang, atau artefak mesin..."
            />
          </div>

          {/* Action Buttons Toolbar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", paddingTop: "10px", borderTop: "1px solid #edf2ed" }}>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleSaveVersion(false)}
                className="button button-primary"
              >
                {isLocked ? "💾 Simpan sebagai Versi Baru" : "💾 Simpan Versi"}
              </button>

              {!isLocked && activeVersion && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSaveVersion(true)}
                  className="button button-secondary"
                  title="Simpan perubahan saat ini ke label versi baru (misal V02)"
                >
                  + Versi Baru
                </button>
              )}

              {activeVersion && !isLocked && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleLockVersion}
                  className="button button-secondary"
                  style={{ color: "#8a2f26" }}
                >
                  🔒 Kunci Versi
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={handleOpenCompare}
                className="button button-secondary"
                disabled={versions.length < 2}
                title="Bandingkan dua versi prompt secara berdampingan"
              >
                ↔ Bandingkan Versi
              </button>

              <button
                type="button"
                disabled={isPending || !activeVersion}
                onClick={handleAddToFlowQueue}
                className="button button-primary"
                style={{ background: "#4a7c36", color: "#fff" }}
              >
                🚀 [ Add to Flow Queue ]
              </button>
            </div>
          </div>
        </main>

        {/* ================= RIGHT COLUMN: ENGINE & AI CONTROLS ================= */}
        <aside className="prompt-controls-panel">
          {/* Target Engine & Parameters */}
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", cursor: "pointer" }}
              onClick={() => setOpenSections((p) => ({ ...p, engine: !p.engine }))}
            >
              <h3 style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "#28392e" }}>Pengaturan Engine & Output</h3>
              <span style={{ fontSize: "10px", color: "#6a7b72" }}>{openSections.engine ? "▲" : "▼"}</span>
            </div>

            {openSections.engine && (
              <div style={{ display: "grid", gap: "8px", background: "#f8faf8", padding: "10px", borderRadius: "8px", border: "1px solid #e7eee8" }}>
                <div className="field">
                  <label htmlFor={engineSelectId}>Target Generation Engine:</label>
                  <select
                    id={engineSelectId}
                    value={engine}
                    onChange={(e) => setEngine(e.target.value)}
                  >
                    <option value="VEO">Google VEO (Video)</option>
                    <option value="MIDJOURNEY">Midjourney (Image)</option>
                    <option value="KLING">Kling AI (Video/UGC)</option>
                    <option value="RUNWAY">Runway Gen-3 (Video)</option>
                    <option value="CUSTOM">Custom Engine</option>
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div className="field">
                    <label htmlFor={aspectRatioSelectId}>Aspek Rasio:</label>
                    <select
                      id={aspectRatioSelectId}
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                    >
                      <option value="16:9">16:9 (Landscape Animasi)</option>
                      <option value="9:16">9:16 (Vertikal UGC/Shorts)</option>
                      <option value="1:1">1:1 (Square)</option>
                      <option value="4:3">4:3 (Classic TV)</option>
                      <option value="21:9">21:9 (Cinematic)</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={durationInputId}>Durasi (Detik):</label>
                    <input
                      id={durationInputId}
                      type="number"
                      min={1}
                      max={30}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div className="field">
                    <label htmlFor={resolutionSelectId}>Resolusi:</label>
                    <select
                      id={resolutionSelectId}
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                    >
                      <option value="720p">720p HD</option>
                      <option value="1080p">1080p Full HD</option>
                      <option value="4k">4K Ultra HD</option>
                    </select>
                  </div>
                  <div className="field" style={{ justifyContent: "center" }}>
                    <label htmlFor={audioToggleId}>Generasi Audio:</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                      <input
                        id={audioToggleId}
                        type="checkbox"
                        checked={audio}
                        onChange={(e) => setAudio(e.target.checked)}
                      />
                      <span style={{ fontSize: "10px", color: "#4f6155" }}>{audio ? "Aktif (Lip-sync/SFX)" : "Nonaktif"}</span>
                    </div>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor={seedInputId}>Seed (Opsional):</label>
                  <input
                    id={seedInputId}
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    placeholder="Nilai angka untuk reproduksibilitas"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Prompt Templates */}
          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: "12px", fontWeight: 700, color: "#28392e" }}>Template Prompt Siap Pakai</h3>
            <div style={{ display: "flex", gap: "6px" }}>
              <label htmlFor={templateSelectId} className="sr-only">Pilih Template:</label>
              <select
                id={templateSelectId}
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                style={{ flex: 1, height: "32px", fontSize: "10px", border: "1px solid #d2ded5", borderRadius: "6px" }}
              >
                <optgroup label="ANIMASI">
                  {templates.filter((t) => t.category === "ANIMATION").map((t) => (
                    <option key={t.code} value={t.code}>{t.name}</option>
                  ))}
                </optgroup>
                <optgroup label="UGC / VIDEO">
                  {templates.filter((t) => t.category === "UGC").map((t) => (
                    <option key={t.code} value={t.code}>{t.name}</option>
                  ))}
                </optgroup>
              </select>
              <button
                type="button"
                onClick={handleApplyTemplate}
                disabled={isPending}
                className="button button-secondary"
                style={{ height: "32px", fontSize: "10px", whiteSpace: "nowrap" }}
              >
                Terapkan
              </button>
            </div>
          </div>

          {/* Gemini AI Assist Controls */}
          <div>
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", cursor: "pointer" }}
              onClick={() => setOpenSections((p) => ({ ...p, ai: !p.ai }))}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>✨</span>
                <h3 style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "#234c21" }}>Gemini 3.8 Flash Assist</h3>
              </div>
              <span style={{ fontSize: "10px", color: "#6a7b72" }}>{openSections.ai ? "▲" : "▼"}</span>
            </div>

            {openSections.ai && (
              <div style={{ display: "grid", gap: "8px", background: "#f5f9f2", padding: "12px", borderRadius: "8px", border: "1px solid #d4e7cc" }}>
                <div className="field">
                  <label htmlFor={thinkingLevelSelectId}>Thinking Level Gemini:</label>
                  <select
                    id={thinkingLevelSelectId}
                    value={thinkingLevel}
                    onChange={(e) => setThinkingLevel(e.target.value as "LOW" | "MEDIUM" | "HIGH")}
                    style={{ background: "#fff" }}
                  >
                    <option value="LOW">LOW (Cepat, instruksi ringkas)</option>
                    <option value="MEDIUM">MEDIUM (Rekomendasi, seimbang)</option>
                    <option value="HIGH">HIGH (Analisis mendalam, Style Bible ketat)</option>
                  </select>
                </div>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleAiGenerate}
                  className="button button-primary"
                  style={{ width: "100%", justifyContent: "flex-start", height: "34px", fontSize: "10px" }}
                >
                  ✨ Buat Prompt dari Konteks Shot
                </button>

                <button
                  type="button"
                  disabled={isPending || !promptText.trim()}
                  onClick={handleAiImprove}
                  className="button button-secondary"
                  style={{ width: "100%", justifyContent: "flex-start", height: "34px", fontSize: "10px" }}
                >
                  🛠 Sempurnakan Prompt Aktif
                </button>

                <button
                  type="button"
                  disabled={isPending || !promptText.trim()}
                  onClick={handleAiTranslate}
                  className="button button-secondary"
                  style={{ width: "100%", justifyContent: "flex-start", height: "34px", fontSize: "10px" }}
                >
                  🌐 Terjemahkan ke Bahasa Inggris Sinematik
                </button>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleAiNegative}
                  className="button button-outline"
                  style={{ width: "100%", justifyContent: "flex-start", height: "34px", fontSize: "10px", color: "#8a2f26" }}
                >
                  🚫 Hasilkan Negative Prompt Spesifik
                </button>

                <div style={{ fontSize: "8px", color: "#627a56", lineHeight: 1.4, marginTop: "4px" }}>
                  Catatan: Panggilan AI dilakukan via server-side Google Gemini SDK. Kunci API tidak terekspos ke peramban.
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ================= COMPARE VERSIONS MODAL ================= */}
      {compareModalOpen && (
        <div className="studio-modal-backdrop" onClick={() => setCompareModalOpen(false)}>
          <div className="studio-modal" style={{ maxWidth: "880px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>Komparasi Versi Prompt</h2>
              <button
                type="button"
                onClick={() => setCompareModalOpen(false)}
                style={{ background: "none", border: 0, fontSize: "16px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
              <div style={{ flex: 1 }}>
                <label htmlFor={compareVersionASelectId} style={{ display: "block", fontSize: "10px", fontWeight: 700, marginBottom: "4px" }}>Versi A:</label>
                <select
                  id={compareVersionASelectId}
                  value={compareVersionA}
                  onChange={(e) => {
                    setCompareVersionA(e.target.value);
                    fetchComparison(e.target.value, compareVersionB);
                  }}
                  style={{ width: "100%", height: "32px", fontSize: "11px" }}
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>{v.versionLabel} ({v.source}) {v.isLocked ? "🔒" : ""}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label htmlFor={compareVersionBSelectId} style={{ display: "block", fontSize: "10px", fontWeight: 700, marginBottom: "4px" }}>Versi B:</label>
                <select
                  id={compareVersionBSelectId}
                  value={compareVersionB}
                  onChange={(e) => {
                    setCompareVersionB(e.target.value);
                    fetchComparison(compareVersionA, e.target.value);
                  }}
                  style={{ width: "100%", height: "32px", fontSize: "11px" }}
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>{v.versionLabel} ({v.source}) {v.isLocked ? "🔒" : ""}</option>
                  ))}
                </select>
              </div>
            </div>

            {compareResult && (
              <div>
                <h4 style={{ margin: "0 0 8px", fontSize: "12px" }}>Perbedaan Teks Prompt:</h4>
                <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
                  <div className="diff-col">
                    <div style={{ fontSize: "10px", fontWeight: 700, marginBottom: "6px" }}>
                      {compareResult.versionA.versionLabel} ({compareResult.versionA.source})
                    </div>
                    <div style={{ fontSize: "11px", whiteSpace: "pre-wrap", lineHeight: 1.5, color: "#223126" }}>
                      {compareResult.versionA.promptText}
                    </div>
                  </div>
                  <div className="diff-col">
                    <div style={{ fontSize: "10px", fontWeight: 700, marginBottom: "6px" }}>
                      {compareResult.versionB.versionLabel} ({compareResult.versionB.source})
                    </div>
                    <div style={{ fontSize: "11px", whiteSpace: "pre-wrap", lineHeight: 1.5, color: "#223126" }}>
                      {compareResult.versionB.promptText}
                    </div>
                  </div>
                </div>

                <h4 style={{ margin: "0 0 6px", fontSize: "12px" }}>Diff Line Highlight:</h4>
                <div style={{ background: "#f8f9f8", border: "1px solid #e1e7e2", borderRadius: "6px", padding: "8px", maxHeight: "160px", overflowY: "auto", marginBottom: "14px" }}>
                  {compareResult.promptTextDiff.map((line, idx) => (
                    <div key={idx} className={`diff-line ${line.type}`}>
                      {line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  "}
                      {line.line}
                    </div>
                  ))}
                </div>

                <h4 style={{ margin: "0 0 6px", fontSize: "12px" }}>Perbedaan Parameter:</h4>
                <div style={{ fontSize: "10px", display: "grid", gap: "4px" }}>
                  {compareResult.parameterDiffs.map((diff) => (
                    <div
                      key={diff.key}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "4px 8px",
                        background: diff.changed ? "#fdf0ee" : "#f4f6f4",
                        borderRadius: "4px",
                      }}
                    >
                      <strong>{diff.key}</strong>
                      <span>
                        {String(diff.valueA)} {diff.changed ? "→" : "=="} {String(diff.valueB)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= FLOW QUEUE STAGED CONFIRMATION MODAL ================= */}
      {flowQueueModalOpen && stagedPayload && (
        <div className="studio-modal-backdrop" onClick={() => setFlowQueueModalOpen(false)}>
          <div className="studio-modal" style={{ maxWidth: "760px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "20px" }}>🚀</span>
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#28441f" }}>
                  Staged to Flow Queue
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setFlowQueueModalOpen(false)}
                style={{ background: "none", border: 0, fontSize: "16px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "11px", color: "#546b4e", margin: "0 0 14px", lineHeight: 1.5 }}>
              Prompt siap dieksekusi oleh mesin generasi video. Status: <strong>STAGED</strong>.
              Payload lengkap di bawah menyimpan acuan start frame, parameter resolusi, dan metadata shot.
            </p>

            <div style={{ background: "#1c2921", color: "#c0ef9b", borderRadius: "8px", padding: "14px", maxHeight: "350px", overflowY: "auto", fontSize: "11px", fontFamily: "monospace", lineHeight: 1.5 }}>
              <pre style={{ margin: 0 }}>{JSON.stringify(stagedPayload, null, 2)}</pre>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px", gap: "8px" }}>
              <Link
                href={`/projects/${projectId}/flow?shotId=${shotId}`}
                className="button button-secondary"
              >
                ⚡ Buka di Flow Queue →
              </Link>
              <button
                type="button"
                onClick={() => setFlowQueueModalOpen(false)}
                className="button button-primary"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
