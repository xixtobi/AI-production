"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  AffectedShot,
  ChangeImpactReport,
  Character,
  Environment,
  GeneratedSceneProposal,
  GeneratedShotProposal,
  ScriptAiAction,
  ScriptBlockInput,
  ScriptBlockType,
  ScriptDocumentDetail,
  ScriptVersionDetail,
  StoryBible,
  StoryDocumentType,
  StyleBible,
} from "@/lib/script/types";
import type { StoryDocumentWithVersions } from "@/lib/script/story-service";

interface ScriptStudioViewProps {
  projectId: string;
  contentItemId: string;
  projectCode: string;
  projectName: string;
  contentTitle: string;
  initialScript: ScriptDocumentDetail;
  initialStoryDocs: StoryDocumentWithVersions[];
  initialCharacters: Character[];
  initialEnvironments: Environment[];
  initialStoryBible: StoryBible | null;
  initialStyleBible: StyleBible | null;
  prodScenes: Array<{ id: string; code: string; sceneNumber: number; title: string }>;
  prodShots: Array<{ id: string; shotCode: string; shotNumber: number; title: string; sceneId: string | null }>;
}

export function ScriptStudioView({
  projectId,
  contentItemId,
  projectCode,
  projectName,
  contentTitle,
  initialScript,
  initialStoryDocs,
  initialCharacters,
  initialEnvironments,
  initialStoryBible,
  initialStyleBible,
  prodScenes,
  prodShots,
}: ScriptStudioViewProps) {
  const router = useRouter();

  // Active Top Tab
  const [activeTab, setActiveTab] = useState<
    "Story" | "Outline" | "Script" | "Scenes" | "Characters" | "Environments" | "Style"
  >("Script");

  // Script & Version State
  const [scriptDetail, setScriptDetail] = useState<ScriptDocumentDetail>(initialScript);
  const [currentVersion, setCurrentVersion] = useState<ScriptVersionDetail | null>(
    initialScript.currentVersion
  );
  const [activeSceneId, setActiveSceneId] = useState<string>(
    initialScript.currentVersion?.scenes[0]?.id || ""
  );
  const [activeBlockId, setActiveBlockId] = useState<string>("");
  const [sceneSearch, setSceneSearch] = useState<string>("");
  const [screenplayMode, setScreenplayMode] = useState<boolean>(false);

  // Story Docs State
  const [storyDocs, setStoryDocs] = useState<StoryDocumentWithVersions[]>(initialStoryDocs);
  const [selectedStoryDocId, setSelectedStoryDocId] = useState<string>(
    initialStoryDocs.find((d) => d.docType !== "OUTLINE")?.id || initialStoryDocs[0]?.id || ""
  );
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocType, setNewDocType] = useState<StoryDocumentType>("CONCEPT");
  const [newDocContent, setNewDocContent] = useState("");
  const [storyDocVersionDraft, setStoryDocVersionDraft] = useState("");

  // Bibles State
  const [characters, setCharacters] = useState<Character[]>(initialCharacters);
  const [environments, setEnvironments] = useState<Environment[]>(initialEnvironments);
  const [storyBible] = useState<StoryBible | null>(initialStoryBible);
  const [styleBible, setStyleBible] = useState<StyleBible | null>(initialStyleBible);

  // Character / Environment Forms
  const [isCharModalOpen, setIsCharModalOpen] = useState(false);
  const [charForm, setCharForm] = useState<Partial<Character>>({
    name: "",
    age: "",
    role: "",
    personality: "",
    appearance: "",
    costume: "",
    signatureProps: "",
    storyFunction: "",
    rules: "",
  });

  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
  const [envForm, setEnvForm] = useState<Partial<Environment>>({
    name: "",
    description: "",
    visualCharacteristics: "",
    tone: "",
    timeOfDayNotes: "",
    rules: "",
  });

  // AI Assist State
  const [aiAction, setAiAction] = useState<ScriptAiAction>("DIALOGUE_POLISH");
  const [aiInstructions, setAiInstructions] = useState<string>("");
  const [aiSelectedChar, setAiSelectedChar] = useState<string>("");
  const [aiSelectedEnv, setAiSelectedEnv] = useState<string>("");
  const [aiTargetContent, setAiTargetContent] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{
    original: string;
    suggestion: string;
    reasoning: string;
    suggestedBlocks?: ScriptBlockInput[];
  } | null>(null);
  const [editableSuggestionText, setEditableSuggestionText] = useState<string>("");

  // Change Impact State
  const [changeImpact, setChangeImpact] = useState<ChangeImpactReport | null>(null);
  const [isCheckingImpact, setIsCheckingImpact] = useState<boolean>(false);

  // Modals for Scene & Shot Generation
  const [isSceneGenModalOpen, setIsSceneGenModalOpen] = useState(false);
  const [sceneGenInstructions, setSceneGenInstructions] = useState("");
  const [generatedSceneProposals, setGeneratedSceneProposals] = useState<GeneratedSceneProposal[]>([]);
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);

  const [isShotGenModalOpen, setIsShotGenModalOpen] = useState(false);
  const [shotGenInstructions, setShotGenInstructions] = useState("");
  const [generatedShotProposals, setGeneratedShotProposals] = useState<GeneratedShotProposal[]>([]);
  const [isGeneratingShots, setIsGeneratingShots] = useState(false);

  // Generic Notification / Error
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" | "info" } | null>(
    null
  );

  function notify(text: string, type: "success" | "error" | "info" = "info") {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 5000);
  }

  // Active scene
  const activeScene = currentVersion?.scenes.find((s) => s.id === activeSceneId) || currentVersion?.scenes[0] || null;

  // Filtered scenes in navigator
  const filteredScenes = (currentVersion?.scenes || []).filter(
    (s) =>
      s.sceneCode.toLowerCase().includes(sceneSearch.toLowerCase()) ||
      s.heading.toLowerCase().includes(sceneSearch.toLowerCase()) ||
      s.location.toLowerCase().includes(sceneSearch.toLowerCase())
  );

  // ==================== VERSION HANDLERS ====================

  async function handleSwitchVersion(versionId: string) {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/content/${contentItemId}/script/versions/${versionId}`
      );
      const data = await res.json();
      if (data.success) {
        setCurrentVersion(data.version);
        if (data.version.scenes.length > 0) {
          setActiveSceneId(data.version.scenes[0].id);
        }
        setAiSuggestion(null);
        notify(`Beralih ke versi ${data.version.versionLabel}`, "info");
      }
    } catch {
      notify("Gagal memuat versi skrip.", "error");
    }
  }

  async function handleCreateNewVersion() {
    if (!currentVersion) return;
    const confirmMsg = `Buat versi baru (misal V${String(scriptDetail.versions.length + 1).padStart(2, "0")}) dengan menduplikasi seluruh adegan saat ini?`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/content/${contentItemId}/script/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cloneFromVersionId: currentVersion.id }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh script detail
        const docRes = await fetch(`/api/projects/${projectId}/content/${contentItemId}/script`);
        const docData = await docRes.json();
        if (docData.success) {
          setScriptDetail(docData.script);
          setCurrentVersion(data.version);
          if (data.version.scenes.length > 0) {
            setActiveSceneId(data.version.scenes[0].id);
          }
          notify(`Versi baru ${data.version.versionLabel} berhasil dibuat!`, "success");
        }
      } else {
        notify(data.error || "Gagal membuat versi baru.", "error");
      }
    } catch {
      notify("Terjadi kesalahan koneksi saat membuat versi baru.", "error");
    }
  }

  async function handleLockVersion() {
    if (!currentVersion) return;
    if (currentVersion.isLocked) {
      notify("Versi ini sudah berstatus LOCKED.", "info");
      return;
    }

    const confirmMsg = `KUNCI VERSI ${currentVersion.versionLabel}?\n\nSetelah dikunci, versi ini menjadi snapshot resmi produksi dan TIDAK DAPAT DIUBAH LAGI. Untuk mengubah, Anda harus membuat versi baru. Lanjutkan?`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(
        `/api/projects/${projectId}/content/${contentItemId}/script/versions/${currentVersion.id}/lock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: `Dikunci resmi pada ${new Date().toLocaleDateString("id-ID")}` }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setCurrentVersion(data.version);
        notify(`Versi ${data.version.versionLabel} berhasil DIKUNCI (LOCKED)!`, "success");
      } else {
        notify(data.error || "Gagal mengunci versi.", "error");
      }
    } catch {
      notify("Gagal mengunci versi.", "error");
    }
  }

  // ==================== SCENE HANDLERS ====================

  async function handleAddScene() {
    if (!currentVersion) return;
    if (currentVersion.isLocked) {
      notify("Versi telah dikunci. Buat versi baru untuk menambah adegan.", "error");
      return;
    }

    const nextNum = currentVersion.scenes.length + 1;
    const defaultHeading = `EXT. LOKASI BARU - SIANG`;

    try {
      const res = await fetch(`/api/projects/${projectId}/content/${contentItemId}/script/scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId: currentVersion.id,
          sceneNumber: nextNum,
          sceneCode: `SC${String(nextNum).padStart(3, "0")}`,
          heading: defaultHeading,
          location: "Desa Lembah Awan",
          timeOfDay: "SIANG",
          blocks: [
            {
              blockType: "ACTION",
              content: "Kamera menampilkan suasana sekitar pemandangan alam Lembah Awan.",
            },
          ],
        }),
      });
      const data = await res.json();
      if (data.success) {
        const updatedScenes = [...currentVersion.scenes, data.scene];
        setCurrentVersion({ ...currentVersion, scenes: updatedScenes });
        setActiveSceneId(data.scene.id);
        notify(`Adegan ${data.scene.sceneCode} berhasil ditambahkan.`, "success");
      } else {
        notify(data.error || "Gagal menambah adegan.", "error");
      }
    } catch {
      notify("Gagal menambah adegan.", "error");
    }
  }

  async function handleUpdateSceneHeading(heading: string) {
    if (!activeScene || !currentVersion || currentVersion.isLocked) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/content/${contentItemId}/script/scenes/${activeScene.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ heading }),
        }
      );
      const data = await res.json();
      if (data.success) {
        const updatedScenes = currentVersion.scenes.map((s) => (s.id === activeScene.id ? data.scene : s));
        setCurrentVersion({ ...currentVersion, scenes: updatedScenes });
      }
    } catch {
      notify("Gagal memperbarui adegan.", "error");
    }
  }

  // ==================== BLOCK HANDLERS ====================

  async function handleAddBlock(blockType: ScriptBlockType) {
    if (!activeScene || !currentVersion) return;
    if (currentVersion.isLocked) {
      notify("Versi telah dikunci (LOCKED). Buat versi baru untuk mengubah skrip.", "error");
      return;
    }

    const defaultChar = blockType === "DIALOGUE" ? (characters[0]?.name || "Raka") : undefined;
    const defaultContent =
      blockType === "ACTION"
        ? "Deskripsi aksi visual di sini."
        : blockType === "DIALOGUE"
        ? "Kalimat dialog di sini..."
        : blockType === "SFX"
        ? "BUNYI DENTING LONCENG MENGGEMA"
        : blockType === "MUSIC"
        ? "Musik instrumen bambu lembut mengalun"
        : blockType === "TRANSITION"
        ? "CUT TO:"
        : "Catatan produksi...";

    try {
      const res = await fetch(
        `/api/projects/${projectId}/content/${contentItemId}/script/scenes/${activeScene.id}/blocks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blockType,
            character: defaultChar,
            content: defaultContent,
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        const updatedBlocks = [...activeScene.blocks, data.block];
        const updatedScene = { ...activeScene, blocks: updatedBlocks };
        const updatedScenes = currentVersion.scenes.map((s) => (s.id === activeScene.id ? updatedScene : s));
        setCurrentVersion({ ...currentVersion, scenes: updatedScenes });
        setActiveBlockId(data.block.id);
      } else {
        notify(data.error || "Gagal menambah blok.", "error");
      }
    } catch {
      notify("Gagal menambah blok.", "error");
    }
  }

  async function handleUpdateBlock(blockId: string, updates: Partial<ScriptBlockInput>) {
    if (!activeScene || !currentVersion || currentVersion.isLocked) return;

    try {
      const res = await fetch(
        `/api/projects/${projectId}/content/${contentItemId}/script/blocks/${blockId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }
      );
      const data = await res.json();
      if (data.success) {
        const updatedBlocks = activeScene.blocks.map((b) => (b.id === blockId ? data.block : b));
        const updatedScene = { ...activeScene, blocks: updatedBlocks };
        const updatedScenes = currentVersion.scenes.map((s) => (s.id === activeScene.id ? updatedScene : s));
        setCurrentVersion({ ...currentVersion, scenes: updatedScenes });
      }
    } catch {
      notify("Gagal memperbarui blok.", "error");
    }
  }

  async function handleDeleteBlock(blockId: string) {
    if (!activeScene || !currentVersion || currentVersion.isLocked) return;
    if (!confirm("Hapus blok ini?")) return;

    try {
      const res = await fetch(
        `/api/projects/${projectId}/content/${contentItemId}/script/blocks/${blockId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        const updatedBlocks = activeScene.blocks.filter((b) => b.id !== blockId);
        const updatedScene = { ...activeScene, blocks: updatedBlocks };
        const updatedScenes = currentVersion.scenes.map((s) => (s.id === activeScene.id ? updatedScene : s));
        setCurrentVersion({ ...currentVersion, scenes: updatedScenes });
      }
    } catch {
      notify("Gagal menghapus blok.", "error");
    }
  }

  // ==================== AI ASSIST HANDLERS ====================

  async function handleRunAiAssist() {
    if (!currentVersion) return;
    const target =
      aiTargetContent.trim() ||
      (activeBlockId
        ? activeScene?.blocks.find((b) => b.id === activeBlockId)?.content || ""
        : activeScene?.blocks.map((b) => b.content).join("\n") || "");

    if (!target) {
      notify("Pilih blok atau ketik teks pada editor untuk diproses AI.", "error");
      return;
    }

    setIsAiLoading(true);
    setAiError(null);
    setAiSuggestion(null);

    try {
      const res = await fetch(
        `/api/projects/${projectId}/content/${contentItemId}/script/ai-assist`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scriptVersionId: currentVersion.id,
            scriptSceneId: activeScene?.id,
            scriptBlockId: activeBlockId || undefined,
            action: aiAction,
            targetContent: target,
            instructions: aiInstructions,
            characterName: aiSelectedChar || undefined,
            environmentName: aiSelectedEnv || undefined,
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setAiSuggestion({
          original: target,
          suggestion: data.result.suggestion,
          reasoning: data.result.reasoning,
          suggestedBlocks: data.result.suggestedBlocks,
        });
        setEditableSuggestionText(data.result.suggestion);
        notify("Usulan AI siap ditinjau! Tinjau dan klik Terima untuk menerapkan.", "success");
      } else {
        setAiError(data.error || "Gagal memproses bantuan AI.");
        notify(data.error || "Gagal memproses AI.", "error");
      }
    } catch {
      setAiError("Terjadi kegagalan jaringan saat menghubungi Gemini API.");
      notify("Gagal menghubungi Gemini API.", "error");
    } finally {
      setIsAiLoading(false);
    }
  }

  async function handleAcceptAiSuggestion(finalText: string) {
    if (!activeScene || !currentVersion) return;
    if (currentVersion.isLocked) {
      notify("Versi terkunci. Buat versi baru sebelum menerapkan usulan AI.", "error");
      return;
    }

    if (activeBlockId) {
      await handleUpdateBlock(activeBlockId, { content: finalText });
      notify("Usulan AI berhasil diterapkan pada blok aktif!", "success");
    } else {
      // Append as new block
      await handleAddBlock("ACTION");
      notify("Usulan AI ditambahkan sebagai blok baru!", "success");
    }
    setAiSuggestion(null);
  }

  function handleRejectAiSuggestion() {
    setAiSuggestion(null);
    notify("Usulan AI ditolak tanpa mengubah skrip.", "info");
  }

  // ==================== CHANGE IMPACT HANDLER ====================

  async function handleCheckChangeImpact() {
    if (!currentVersion) return;
    // Find base version: previous version or first locked version
    const otherVersions = scriptDetail.versions.filter((v) => v.id !== currentVersion.id);
    if (otherVersions.length === 0) {
      notify("Hanya ada satu versi skrip saat ini. Buat versi baru untuk membandingkan.", "info");
      return;
    }

    const lockedVersion = otherVersions.find((v) => v.isLocked) || otherVersions[0];
    setIsCheckingImpact(true);

    try {
      const res = await fetch(
        `/api/projects/${projectId}/content/${contentItemId}/script/change-impact?baseVersionId=${lockedVersion.id}&targetVersionId=${currentVersion.id}`
      );
      const data = await res.json();
      if (data.success) {
        setChangeImpact(data.impact);
        if (data.impact.hasModifications) {
          notify(`Ditemukan ${data.impact.diffs.length} perbedaan dan ${data.impact.affectedShots.length} shot terdampak.`, "info");
        } else {
          notify("Tidak ada perbedaan antara versi yang dibandingkan.", "success");
        }
      } else {
        notify(data.error || "Gagal memeriksa dampak perubahan.", "error");
      }
    } catch {
      notify("Gagal memeriksa dampak perubahan.", "error");
    } finally {
      setIsCheckingImpact(false);
    }
  }

  // ==================== SCENE GENERATION HANDLERS ====================

  async function handleGenerateSceneProposals() {
    if (!currentVersion) return;
    setIsGeneratingScenes(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/content/${contentItemId}/script/generate-scenes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scriptVersionId: currentVersion.id,
            instructions: sceneGenInstructions,
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setGeneratedSceneProposals(data.scenes);
        notify(`${data.scenes.length} usulan struktur adegan berhasil di-generate!`, "success");
      } else {
        notify(data.error || "Gagal men-generate adegan.", "error");
      }
    } catch {
      notify("Gagal menghubungi layanan Gemini untuk generate adegan.", "error");
    } finally {
      setIsGeneratingScenes(false);
    }
  }

  async function handleApplyGeneratedScenes() {
    if (!currentVersion || generatedSceneProposals.length === 0) return;
    if (currentVersion.isLocked) {
      notify("Versi telah dikunci. Buat versi baru untuk menerapkan adegan.", "error");
      return;
    }

    try {
      const res = await fetch(
        `/api/projects/${projectId}/content/${contentItemId}/script/apply-scenes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scriptVersionId: currentVersion.id,
            scenes: generatedSceneProposals,
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        // Refresh version
        await handleSwitchVersion(currentVersion.id);
        setIsSceneGenModalOpen(false);
        setGeneratedSceneProposals([]);
        notify("Adegan berhasil diterapkan ke skrip!", "success");
      } else {
        notify(data.error || "Gagal menerapkan adegan.", "error");
      }
    } catch {
      notify("Gagal menerapkan adegan.", "error");
    }
  }

  // ==================== SHOT GENERATION HANDLERS ====================

  async function handleGenerateShotBreakdown() {
    if (!activeScene) return;
    setIsGeneratingShots(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/content/${contentItemId}/script/generate-shots`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scriptSceneId: activeScene.id,
            startingShotNumber: (prodShots.length > 0 ? Math.max(...prodShots.map((s) => s.shotNumber)) + 1 : 1),
            instructions: shotGenInstructions,
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setGeneratedShotProposals(data.shots);
        notify(`${data.shots.length} proposal shot berhasil di-generate!`, "success");
      } else {
        notify(data.error || "Gagal men-generate shot.", "error");
      }
    } catch {
      notify("Gagal men-generate breakdown shot.", "error");
    } finally {
      setIsGeneratingShots(false);
    }
  }

  async function handleApplyGeneratedShots() {
    if (generatedShotProposals.length === 0) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/content/${contentItemId}/script/apply-shots`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sceneId: activeScene?.linkedSceneId || undefined,
            shots: generatedShotProposals,
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setIsShotGenModalOpen(false);
        setGeneratedShotProposals([]);
        notify("Breakdown shot berhasil diterapkan ke daftar shot produksi!", "success");
        router.refresh();
      } else {
        notify(data.error || "Gagal menerapkan shot ke produksi.", "error");
      }
    } catch {
      notify("Gagal menerapkan shot ke produksi.", "error");
    }
  }

  // ==================== STORY DOCS HANDLERS ====================

  async function handleCreateStoryDoc() {
    if (!newDocTitle.trim()) {
      notify("Judul dokumen cerita tidak boleh kosong.", "error");
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/story-docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType: newDocType,
          title: newDocTitle.trim(),
          contentItemId,
          initialContent: newDocContent,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStoryDocs([data.document, ...storyDocs]);
        setSelectedStoryDocId(data.document.id);
        setNewDocTitle("");
        setNewDocContent("");
        notify("Dokumen cerita berhasil dibuat!", "success");
      } else {
        notify(data.error || "Gagal membuat dokumen cerita.", "error");
      }
    } catch {
      notify("Gagal membuat dokumen cerita.", "error");
    }
  }

  async function handleAddStoryDocVersion(docId: string) {
    if (!storyDocVersionDraft) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/story-docs/${docId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: storyDocVersionDraft,
          notes: "Revisi naskah cerita",
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh list
        const refreshRes = await fetch(`/api/projects/${projectId}/story-docs?contentItemId=${contentItemId}`);
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setStoryDocs(refreshData.documents);
        }
        setStoryDocVersionDraft("");
        notify("Versi dokumen cerita berhasil ditambahkan!", "success");
      } else {
        notify(data.error || "Gagal menambah versi dokumen.", "error");
      }
    } catch {
      notify("Gagal menambah versi dokumen cerita.", "error");
    }
  }

  // ==================== BIBLE HANDLERS ====================

  async function handleSaveCharacter() {
    if (!charForm.name?.trim()) {
      notify("Nama karakter wajib diisi.", "error");
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/bibles/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(charForm),
      });
      const data = await res.json();
      if (data.success) {
        setCharacters([...characters, data.character]);
        setIsCharModalOpen(false);
        setCharForm({ name: "", role: "", personality: "", costume: "", rules: "" });
        notify(`Karakter ${data.character.name} berhasil ditambahkan!`, "success");
      } else {
        notify(data.error || "Gagal menambah karakter.", "error");
      }
    } catch {
      notify("Gagal menambah karakter.", "error");
    }
  }

  async function handleSaveEnvironment() {
    if (!envForm.name?.trim()) {
      notify("Nama lingkungan wajib diisi.", "error");
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/bibles/environments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(envForm),
      });
      const data = await res.json();
      if (data.success) {
        setEnvironments([...environments, data.environment]);
        setIsEnvModalOpen(false);
        setEnvForm({ name: "", description: "", visualCharacteristics: "", tone: "", rules: "" });
        notify(`Lingkungan ${data.environment.name} berhasil ditambahkan!`, "success");
      } else {
        notify(data.error || "Gagal menambah lingkungan.", "error");
      }
    } catch {
      notify("Gagal menambah lingkungan.", "error");
    }
  }

  async function handleSaveStyleBible() {
    if (!styleBible) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/bibles/style`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(styleBible),
      });
      const data = await res.json();
      if (data.success) {
        setStyleBible(data.styleBible);
        notify("Style Bible berhasil disimpan!", "success");
      }
    } catch {
      notify("Gagal menyimpan Style Bible.", "error");
    }
  }

  // Active Story Doc
  const activeStoryDoc = storyDocs.find((d) => d.id === selectedStoryDocId) || storyDocs[0] || null;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Top Breadcrumb & Actions */}
      <div className="project-topline" style={{ marginBottom: "12px" }}>
        <div>
          <Link href={`/projects/${projectId}/content/${contentItemId}`} className="back-link">
            ← Kembali ke {contentTitle}
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Script Studio</h1>
            <span style={{ fontSize: "11px", color: "#8a968e" }}>
              {projectCode} ({projectName}) · {contentTitle}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            onClick={() => setIsSceneGenModalOpen(true)}
            className="button button-secondary"
            title="Generate struktur adegan dari skrip via Gemini AI"
          >
            ✨ Generate Adegan
          </button>
          <button
            onClick={() => setIsShotGenModalOpen(true)}
            className="button button-secondary"
            disabled={!activeScene}
            title="Generate breakdown shot dari adegan aktif"
          >
            ✨ Generate Shot
          </button>
          <button
            onClick={handleCheckChangeImpact}
            className="button button-secondary"
            disabled={isCheckingImpact}
            title="Bandingkan dengan versi sebelumnya & deteksi shot terdampak (e.g. SH016)"
          >
            {isCheckingImpact ? "Menganalisis..." : "⚠️ Dampak Perubahan"}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {feedbackMsg && (
        <div
          style={{
            padding: "9px 14px",
            borderRadius: "6px",
            marginBottom: "14px",
            fontSize: "11px",
            fontWeight: 600,
            background:
              feedbackMsg.type === "success"
                ? "#eaf7e6"
                : feedbackMsg.type === "error"
                ? "#fdeeed"
                : "#eef3fb",
            color:
              feedbackMsg.type === "success"
                ? "#3b7a2d"
                : feedbackMsg.type === "error"
                ? "#a4332d"
                : "#2d5ba4",
            border: "1px solid currentColor",
          }}
        >
          {feedbackMsg.text}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="script-studio-tabs">
        {(["Story", "Outline", "Script", "Scenes", "Characters", "Environments", "Style"] as const).map(
          (tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`script-studio-tab ${activeTab === tab ? "active" : ""}`}
            >
              {tab === "Script" && "📝 "}
              {tab === "Story" && "💡 "}
              {tab === "Outline" && "📋 "}
              {tab === "Scenes" && "🎬 "}
              {tab === "Characters" && "👥 "}
              {tab === "Environments" && "🏞️ "}
              {tab === "Style" && "🎨 "}
              <span>{tab}</span>
              {tab === "Script" && currentVersion && (
                <span className="tab-badge">{currentVersion.versionLabel}</span>
              )}
              {tab === "Scenes" && currentVersion && (
                <span className="tab-badge">{currentVersion.scenes.length}</span>
              )}
              {tab === "Characters" && (
                <span className="tab-badge">{characters.length}</span>
              )}
              {tab === "Environments" && (
                <span className="tab-badge">{environments.length}</span>
              )}
            </button>
          )
        )}
      </div>

      {/* ==================== TAB 1: SCRIPT (3-COLUMN DESKTOP WORKSPACE) ==================== */}
      {activeTab === "Script" && (
        <div className="script-3col-layout">
          {/* LEFT COLUMN: Scene Navigator */}
          <aside className="script-nav-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <strong style={{ fontSize: "11px", letterSpacing: ".5px", color: "#546458" }}>
                NAVIGATOR ADEGAN ({currentVersion?.scenes.length ?? 0})
              </strong>
              <button
                onClick={handleAddScene}
                className="button button-primary"
                style={{ height: "26px", padding: "0 8px", fontSize: "10px" }}
                disabled={currentVersion?.isLocked}
                title="Tambah adegan baru"
              >
                ＋ Adegan
              </button>
            </div>

            <input
              type="text"
              placeholder="Cari kode, heading, lokasi..."
              value={sceneSearch}
              onChange={(e) => setSceneSearch(e.target.value)}
              style={{
                width: "100%",
                height: "30px",
                border: "1px solid #dce2de",
                borderRadius: "5px",
                padding: "0 8px",
                fontSize: "10px",
                marginBottom: "12px",
              }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {filteredScenes.length === 0 ? (
                <div style={{ fontSize: "10px", color: "#8b968e", textAlign: "center", padding: "20px" }}>
                  Belum ada adegan. Klik &apos;＋ Adegan&apos; untuk menambahkan.
                </div>
              ) : (
                filteredScenes.map((scene) => (
                  <div
                    key={scene.id}
                    onClick={() => setActiveSceneId(scene.id)}
                    className={`scene-nav-item ${activeScene?.id === scene.id ? "active" : ""}`}
                  >
                    <div className="scene-nav-header">
                      <span>{scene.sceneCode}</span>
                      <small style={{ color: "#7a8a7f" }}>{scene.blocks.length} blok</small>
                    </div>
                    <div className="scene-nav-heading">{scene.heading}</div>
                    <div className="scene-nav-meta">
                      {scene.location || "Lokasi bebas"} · {scene.timeOfDay || "Waktu"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>

          {/* CENTER COLUMN: Screenplay & Block Editor */}
          <main className="script-editor-panel">
            {/* Version & Lock Header */}
            <div className="script-version-bar">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", fontWeight: "700" }}>VERSI:</span>
                <select
                  value={currentVersion?.id || ""}
                  onChange={(e) => handleSwitchVersion(e.target.value)}
                  style={{
                    height: "28px",
                    border: "1px solid #d4ded0",
                    borderRadius: "5px",
                    padding: "0 8px",
                    fontSize: "11px",
                    fontWeight: "600",
                    background: "#fff",
                  }}
                >
                  {scriptDetail.versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.versionLabel} {v.isLocked ? "(LOCKED)" : "(Editable)"}
                    </option>
                  ))}
                </select>

                {currentVersion?.isLocked ? (
                  <span className="version-tag-locked">🔒 LOCKED SNAPSHOT</span>
                ) : (
                  <span className="version-tag-editable">✏️ DRAF AKTIF (EDITABLE)</span>
                )}
              </div>

              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <button
                  onClick={() => setScreenplayMode(!screenplayMode)}
                  className="button button-secondary"
                  style={{ height: "28px", fontSize: "10px" }}
                >
                  {screenplayMode ? "Tampilan Blok" : "Teks Naskah"}
                </button>
                <button
                  onClick={handleCreateNewVersion}
                  className="button button-secondary"
                  style={{ height: "28px", fontSize: "10px" }}
                  title="Buat versi baru (V02, V03...)"
                >
                  ＋ Versi Baru
                </button>
                {!currentVersion?.isLocked && (
                  <button
                    onClick={handleLockVersion}
                    className="button button-secondary"
                    style={{ height: "28px", fontSize: "10px", borderColor: "#f0b8b4", color: "#a53730" }}
                    title="Kunci versi ini sebagai snapshot resmi produksi"
                  >
                    🔒 Kunci Versi
                  </button>
                )}
              </div>
            </div>

            {/* Change Impact Warning Banner (if detected) */}
            {changeImpact?.warningMessage && (
              <div className="impact-warning-banner">
                <strong>⚠️ PERINGATAN DAMPAK PRODUKSI</strong>
                <p>{changeImpact.warningMessage}</p>
                {changeImpact.affectedShots?.length > 0 && (
                  <div className="impact-shots-list">
                    {changeImpact.affectedShots.map((shot: AffectedShot) => (
                      <span
                        key={shot.shotId}
                        className={`impact-shot-chip ${shot.shotCode === "SH016" ? "critical" : ""}`}
                        title={shot.reason}
                      >
                        {shot.shotCode} {shot.shotCode === "SH016" && "★"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Active Scene Content */}
            {activeScene ? (
              screenplayMode ? (
                /* Screenplay Paper View */
                <div className="screenplay-paper">
                  <div className="screenplay-heading">
                    {activeScene.sceneNumber}. {activeScene.heading}
                  </div>
                  {activeScene.blocks.map((block) => (
                    <div key={block.id}>
                      {block.blockType === "ACTION" && (
                        <div className="screenplay-action">{block.content}</div>
                      )}
                      {block.blockType === "CHARACTER" && (
                        <div className="screenplay-character">{block.content.toUpperCase()}</div>
                      )}
                      {block.blockType === "PARENTHETICAL" && (
                        <div className="screenplay-parenthetical">({block.content})</div>
                      )}
                      {block.blockType === "DIALOGUE" && (
                        <div>
                          {block.character && (
                            <div className="screenplay-character">{block.character.toUpperCase()}</div>
                          )}
                          <div className="screenplay-dialogue">{block.content}</div>
                        </div>
                      )}
                      {block.blockType === "SFX" && (
                        <div className="screenplay-action" style={{ fontWeight: "bold" }}>
                          SFX: {block.content}
                        </div>
                      )}
                      {block.blockType === "MUSIC" && (
                        <div className="screenplay-action" style={{ fontStyle: "italic" }}>
                          MUSIK: {block.content}
                        </div>
                      )}
                      {block.blockType === "TRANSITION" && (
                        <div className="screenplay-transition">{block.content}</div>
                      )}
                      {block.blockType === "NOTE" && (
                        <div className="screenplay-action" style={{ color: "#777" }}>
                          [[Catatan: {block.content}]]
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Structured Block Editor */
                <div>
                  {/* Scene Heading Editor */}
                  <div
                    style={{
                      background: "#f8faf7",
                      border: "1px solid #e3e8e1",
                      borderRadius: "7px",
                      padding: "12px",
                      marginBottom: "14px",
                    }}
                  >
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                      <span
                        style={{
                          fontFamily: "Consolas, monospace",
                          fontWeight: 700,
                          fontSize: "11px",
                          color: "#46594a",
                        }}
                      >
                        {activeScene.sceneCode}
                      </span>
                      <input
                        type="text"
                        value={activeScene.heading}
                        onChange={(e) => handleUpdateSceneHeading(e.target.value)}
                        disabled={currentVersion?.isLocked}
                        style={{
                          flex: 1,
                          height: "30px",
                          border: "1px solid #d2ded0",
                          borderRadius: "4px",
                          padding: "0 8px",
                          fontSize: "11px",
                          fontWeight: "700",
                          background: currentVersion?.isLocked ? "#f0f2f0" : "#fff",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: "10px", fontSize: "10px", color: "#6a7b70" }}>
                      <span>Lokasi: <b>{activeScene.location || "Belum disetel"}</b></span>
                      <span>Waktu: <b>{activeScene.timeOfDay || "Belum disetel"}</b></span>
                    </div>
                  </div>

                  {/* Add Block Toolbar */}
                  {!currentVersion?.isLocked && (
                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                        padding: "8px 10px",
                        background: "#fff",
                        border: "1px solid #e8edea",
                        borderRadius: "6px",
                        marginBottom: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontSize: "9px", fontWeight: "700", alignSelf: "center", color: "#8a968f" }}>
                        + TAMBAH BLOK:
                      </span>
                      <button
                        onClick={() => handleAddBlock("DIALOGUE")}
                        className="button button-secondary"
                        style={{ height: "24px", padding: "0 7px", fontSize: "9px" }}
                      >
                        💬 Dialog
                      </button>
                      <button
                        onClick={() => handleAddBlock("ACTION")}
                        className="button button-secondary"
                        style={{ height: "24px", padding: "0 7px", fontSize: "9px" }}
                      >
                        🏃 Aksi
                      </button>
                      <button
                        onClick={() => handleAddBlock("SFX")}
                        className="button button-secondary"
                        style={{ height: "24px", padding: "0 7px", fontSize: "9px" }}
                      >
                        💥 SFX
                      </button>
                      <button
                        onClick={() => handleAddBlock("MUSIC")}
                        className="button button-secondary"
                        style={{ height: "24px", padding: "0 7px", fontSize: "9px" }}
                      >
                        🎵 Musik
                      </button>
                      <button
                        onClick={() => handleAddBlock("TRANSITION")}
                        className="button button-secondary"
                        style={{ height: "24px", padding: "0 7px", fontSize: "9px" }}
                      >
                        ⏩ Transisi
                      </button>
                      <button
                        onClick={() => handleAddBlock("NOTE")}
                        className="button button-secondary"
                        style={{ height: "24px", padding: "0 7px", fontSize: "9px" }}
                      >
                        📌 Catatan
                      </button>
                    </div>
                  )}

                  {/* Blocks List */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {activeScene.blocks.length === 0 ? (
                      <div className="empty-inline">
                        Adegan ini belum memiliki blok skrip. Tambahkan aksi atau dialog di atas.
                      </div>
                    ) : (
                      activeScene.blocks.map((block) => (
                        <div
                          key={block.id}
                          onClick={() => {
                            setActiveBlockId(block.id);
                            setAiTargetContent(block.content);
                            if (block.character) setAiSelectedChar(block.character);
                          }}
                          className={`script-block-row ${activeBlockId === block.id ? "active-edit" : ""}`}
                        >
                          {/* Block Type Column */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <span className={`block-badge block-badge-${block.blockType}`}>
                              {block.blockType}
                            </span>
                            {block.blockType === "DIALOGUE" && (
                              <select
                                value={block.character || ""}
                                onChange={(e) => handleUpdateBlock(block.id, { character: e.target.value })}
                                disabled={currentVersion?.isLocked}
                                style={{
                                  fontSize: "9px",
                                  border: "1px solid #d4ded5",
                                  borderRadius: "4px",
                                  padding: "2px",
                                  background: "#fff",
                                }}
                              >
                                {characters.map((c) => (
                                  <option key={c.id} value={c.name}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          {/* Block Content Input */}
                          <textarea
                            value={block.content}
                            onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                            disabled={currentVersion?.isLocked}
                            rows={Math.max(2, Math.ceil(block.content.length / 70))}
                            style={{
                              width: "100%",
                              border: "1px solid transparent",
                              borderRadius: "4px",
                              padding: "4px 6px",
                              fontSize: "11px",
                              lineHeight: "1.5",
                              resize: "vertical",
                              background: currentVersion?.isLocked ? "transparent" : "#fff",
                              borderColor: activeBlockId === block.id ? "#b9d6ab" : "#e6ece8",
                            }}
                          />

                          {/* Actions Column */}
                          {!currentVersion?.isLocked && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteBlock(block.id);
                                }}
                                style={{
                                  border: 0,
                                  background: "none",
                                  color: "#b0524d",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                  padding: "2px 4px",
                                }}
                                title="Hapus blok"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className="empty-inline">Pilih atau tambahkan adegan pada panel navigator kiri.</div>
            )}
          </main>

          {/* RIGHT COLUMN: AI Assist & Context Panel */}
          <aside className="script-ai-panel">
            <strong style={{ fontSize: "11px", letterSpacing: ".5px", color: "#546458", display: "block", marginBottom: "10px" }}>
              ✨ GEMINI SCRIPT ASSIST
            </strong>

            {/* Context Capsule */}
            <div
              style={{
                background: "#f4f7f2",
                border: "1px solid #e0eae0",
                borderRadius: "7px",
                padding: "10px",
                fontSize: "10px",
                color: "#5b6d61",
                marginBottom: "12px",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: "4px" }}>Konteks Kanon:</div>
              <div>Tokoh: <b>{aiSelectedChar || "Semua Karakter"}</b></div>
              <div>
                <span>Lokasi: </span>
                <select
                  value={aiSelectedEnv}
                  onChange={(e) => setAiSelectedEnv(e.target.value)}
                  style={{ fontSize: "9px", padding: "1px 4px", border: "1px solid #cfded0", borderRadius: "3px", background: "#fff" }}
                >
                  <option value="">{activeScene?.location || "Lembah Awan"}</option>
                  {environments.map((env) => (
                    <option key={env.id} value={env.name}>
                      {env.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>Tone: <b>{storyBible?.tone || "Ramah Anak & Keluarga"}</b></div>
            </div>

            {/* AI Action Selection */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
              <label style={{ fontSize: "9px", fontWeight: "700", color: "#74857b" }}>
                PILIH TINDAKAN AI:
              </label>
              <select
                value={aiAction}
                onChange={(e) => setAiAction(e.target.value as ScriptAiAction)}
                style={{
                  height: "32px",
                  border: "1px solid #cfded0",
                  borderRadius: "5px",
                  padding: "0 8px",
                  fontSize: "11px",
                  fontWeight: "600",
                  background: "#fff",
                }}
              >
                <option value="DIALOGUE_POLISH">💬 DIALOGUE_POLISH (Poles Dialog)</option>
                <option value="CHILD_FRIENDLY_REWRITE">🧸 CHILD_FRIENDLY_REWRITE (Ramah Anak)</option>
                <option value="CONTINUE">➡️ CONTINUE (Lanjutkan Naskah)</option>
                <option value="REWRITE">✏️ REWRITE (Tulis Ulang)</option>
                <option value="SHORTEN">✂️ SHORTEN (Ringkas)</option>
                <option value="EXPAND">🔍 EXPAND (Perluas Detail)</option>
                <option value="IMPROVE_PACING">⏱️ IMPROVE_PACING (Perbaiki Tempo)</option>
                <option value="ADD_ACTION">🎬 ADD_ACTION (Tambah Beat Aksi)</option>
                <option value="CONTINUITY_CHECK">🛡️ CONTINUITY_CHECK (Cek Kanon)</option>
              </select>

              <label style={{ fontSize: "9px", fontWeight: "700", color: "#74857b" }}>
                INSTRUKSI KHUSUS (OPSIONAL):
              </label>
              <textarea
                value={aiInstructions}
                onChange={(e) => setAiInstructions(e.target.value)}
                placeholder="Contoh: Tekankan rasa takjub Raka saat melihat cahaya lonceng..."
                rows={2}
                style={{
                  width: "100%",
                  border: "1px solid #d4ded5",
                  borderRadius: "5px",
                  padding: "6px",
                  fontSize: "10px",
                }}
              />

              <button
                onClick={handleRunAiAssist}
                disabled={isAiLoading}
                className="button button-primary"
                style={{ height: "34px", marginTop: "4px" }}
              >
                {isAiLoading ? "Sedang Berpikir..." : "✨ Jalankan AI Assist"}
              </button>
            </div>

            {/* AI Error Display */}
            {aiError && (
              <div className="form-error" style={{ fontSize: "10px", margin: "8px 0" }}>
                {aiError}
              </div>
            )}

            {/* AI Suggestion Review Box */}
            {aiSuggestion && (
              <div className="ai-suggestion-box">
                <h4>✨ Usulan AI ({aiAction})</h4>
                <div className="ai-reasoning">
                  <strong>Alasan:</strong> {aiSuggestion.reasoning}
                </div>

                <div style={{ fontSize: "9px", fontWeight: "700", color: "#6a7b70", marginBottom: "4px" }}>
                  EDIT USULAN SEBELUM MENERIMA:
                </div>
                <textarea
                  value={editableSuggestionText}
                  onChange={(e) => setEditableSuggestionText(e.target.value)}
                  rows={4}
                  style={{
                    width: "100%",
                    border: "1px solid #bed6b6",
                    borderRadius: "5px",
                    padding: "6px",
                    fontSize: "11px",
                    lineHeight: "1.4",
                    marginBottom: "10px",
                  }}
                />

                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => handleAcceptAiSuggestion(editableSuggestionText)}
                    className="button button-primary"
                    style={{ flex: 1, height: "30px", fontSize: "10px" }}
                  >
                    ✓ Terima (Accept)
                  </button>
                  <button
                    onClick={handleRejectAiSuggestion}
                    className="button button-secondary"
                    style={{ height: "30px", fontSize: "10px" }}
                  >
                    ✕ Tolak
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* ==================== TAB 2: STORY ==================== */}
      {activeTab === "Story" && (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "16px" }}>
          {/* Docs List */}
          <div className="panel">
            <div className="panel-heading" style={{ marginBottom: "12px" }}>
              <h2>Dokumen Cerita</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {storyDocs
                .filter((d) => d.docType !== "OUTLINE")
                .map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedStoryDocId(doc.id)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid",
                      borderColor: selectedStoryDocId === doc.id ? "#7ba563" : "#edf1ee",
                      background: selectedStoryDocId === doc.id ? "#f1f7ec" : "#fafbfa",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: "9px", fontWeight: 700, color: "#6a7b70" }}>
                      {doc.docType} · V{doc.currentVersion?.versionNumber || 1}
                    </div>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#2d3c32" }}>
                      {doc.title}
                    </div>
                  </div>
                ))}
            </div>

            <div style={{ borderTop: "1px solid #edf1ee", marginTop: "16px", paddingTop: "12px" }}>
              <strong style={{ fontSize: "10px", display: "block", marginBottom: "8px" }}>
                + DOKUMEN BARU
              </strong>
              <select
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value as StoryDocumentType)}
                style={{ width: "100%", height: "30px", fontSize: "10px", marginBottom: "6px" }}
              >
                <option value="CONCEPT">CONCEPT</option>
                <option value="LOGLINE">LOGLINE</option>
                <option value="SYNOPSIS">SYNOPSIS</option>
                <option value="STORY_BIBLE">STORY_BIBLE</option>
              </select>
              <input
                type="text"
                placeholder="Judul dokumen..."
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                style={{ width: "100%", height: "30px", fontSize: "10px", marginBottom: "8px" }}
              />
              <button
                onClick={handleCreateStoryDoc}
                className="button button-primary"
                style={{ width: "100%", height: "30px", fontSize: "10px" }}
              >
                Buat Dokumen
              </button>
            </div>
          </div>

          {/* Doc Detail & Version History */}
          <div className="panel">
            {activeStoryDoc ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div>
                    <span style={{ fontSize: "9px", fontWeight: 700, color: "#6e8074" }}>
                      {activeStoryDoc.docType}
                    </span>
                    <h2 style={{ margin: "2px 0 0" }}>{activeStoryDoc.title}</h2>
                  </div>
                  <span className="version-tag-editable">
                    Versi Saat Ini: V{activeStoryDoc.currentVersion?.versionNumber || 1}
                  </span>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: "#6a7b70", marginBottom: "4px" }}>
                    ISI VERSI AKTIF:
                  </div>
                  <div
                    style={{
                      background: "#fcfdfc",
                      border: "1px solid #e2e8e2",
                      borderRadius: "6px",
                      padding: "14px",
                      fontSize: "12px",
                      lineHeight: "1.6",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {activeStoryDoc.currentVersion?.content || "Konten belum diisi."}
                  </div>
                </div>

                {/* Add New Version Form */}
                <div style={{ borderTop: "1px solid #edf1ee", paddingTop: "14px" }}>
                  <strong style={{ fontSize: "11px", display: "block", marginBottom: "8px" }}>
                    + Simpan Sebagai Versi Baru
                  </strong>
                  <textarea
                    value={storyDocVersionDraft}
                    onChange={(e) => setStoryDocVersionDraft(e.target.value)}
                    placeholder="Ketik revisi konten cerita di sini..."
                    rows={4}
                    style={{
                      width: "100%",
                      border: "1px solid #d4ded5",
                      borderRadius: "6px",
                      padding: "8px",
                      fontSize: "11px",
                      marginBottom: "8px",
                    }}
                  />
                  <button
                    onClick={() => handleAddStoryDocVersion(activeStoryDoc.id)}
                    className="button button-primary"
                    style={{ height: "30px", fontSize: "10px" }}
                  >
                    Simpan Versi Baru
                  </button>
                </div>

                {/* Version History List */}
                <div style={{ marginTop: "20px" }}>
                  <strong style={{ fontSize: "10px", color: "#74857b", display: "block", marginBottom: "8px" }}>
                    RIWAYAT VERSI TERDAFTAR:
                  </strong>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {activeStoryDoc.versions.map((ver) => (
                      <div
                        key={ver.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "6px 9px",
                          border: "1px solid #edf1ee",
                          borderRadius: "4px",
                          fontSize: "10px",
                        }}
                      >
                        <span>
                          <b>V{ver.versionNumber}</b> — {ver.title}
                        </span>
                        <small style={{ color: "#8a968e" }}>
                          {new Date(ver.createdAt).toLocaleDateString("id-ID")}
                        </small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-inline">Belum ada dokumen cerita dipilih.</div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 3: OUTLINE ==================== */}
      {activeTab === "Outline" && (
        <div className="panel">
          <div className="panel-heading" style={{ marginBottom: "14px" }}>
            <div>
              <p className="eyebrow">STRUKTUR PLOT</p>
              <h2>Outline Cerita</h2>
            </div>
          </div>
          <p style={{ fontSize: "11px", color: "#78877e", marginBottom: "14px" }}>
            Struktur beat naratif dan garis besar alur dari permulaan hingga ending cliffhanger.
          </p>
          <div
            style={{
              background: "#fafbfa",
              border: "1px solid #e1e7e2",
              borderRadius: "8px",
              padding: "16px",
              fontSize: "12px",
              lineHeight: "1.7",
            }}
          >
            <strong>Babak 1 — Panggilan Petualangan:</strong>
            <p style={{ margin: "4px 0 12px" }}>
              Di Desa Lembah Awan yang damai, Raka menemukan kompas kakeknya yang bergetar aneh. Denting lonceng dari Gunung Awan bergema tanpa ada pendaki.
            </p>
            <strong>Babak 2 — Penyelidikan di Hutan Bisikan:</strong>
            <p style={{ margin: "4px 0 12px" }}>
              Raka bersama Lila, Bimo, dan maskot Mimo melintasi jembatan tua menuju Hutan Bisikan. Lila menemukan simbol awan kuno pada peta rahasia.
            </p>
            <strong>Babak 3 — Penemuan Pintu Rahasia & Cliffhanger:</strong>
            <p style={{ margin: "4px 0 0" }}>
              Di balik akar pohon raksasa, pintu batu terbuka menampilkan lukisan dinding tiga anak masa lalu. Lonceng berdentang untuk kedua kalinya!
            </p>
          </div>
        </div>
      )}

      {/* ==================== TAB 4: SCENES ==================== */}
      {activeTab === "Scenes" && (
        <div>
          <div className="subsection-heading">
            <div>
              <h2>
                Adegan Skrip ({currentVersion?.scenes.length ?? 0}){" "}
                <small style={{ fontSize: "11px", fontWeight: 400, color: "#8a968e" }}>
                  (Terhubung ke {prodScenes.length} adegan produksi)
                </small>
              </h2>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setIsSceneGenModalOpen(true)}
                className="button button-primary"
              >
                ✨ Generate Struktur Adegan (Gemini)
              </button>
            </div>
          </div>

          <div className="project-table-wrap">
            <table className="project-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nomor</th>
                  <th>Heading</th>
                  <th>Lokasi</th>
                  <th>Waktu</th>
                  <th>Blok Skrip</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {currentVersion?.scenes.map((scene) => (
                  <tr key={scene.id}>
                    <td className="table-code">{scene.sceneCode}</td>
                    <td>{scene.sceneNumber}</td>
                    <td className="table-title">{scene.heading}</td>
                    <td>{scene.location || "—"}</td>
                    <td>{scene.timeOfDay || "—"}</td>
                    <td>{scene.blocks.length} blok</td>
                    <td>
                      <button
                        onClick={() => {
                          setActiveSceneId(scene.id);
                          setActiveTab("Script");
                        }}
                        className="text-link"
                      >
                        Buka di Editor →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TAB 5: CHARACTERS ==================== */}
      {activeTab === "Characters" && (
        <div>
          <div className="subsection-heading">
            <div>
              <p className="eyebrow">KARAKTER KANON LEMBAH AWAN</p>
              <h2>Character Bible ({characters.length})</h2>
            </div>
            <button onClick={() => setIsCharModalOpen(true)} className="button button-primary">
              ＋ Karakter Baru
            </button>
          </div>

          <div className="bible-grid">
            {characters.map((char) => (
              <div key={char.id} className="bible-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3>{char.name}</h3>
                    <div className="bible-role">{char.role}</div>
                  </div>
                  {char.age && (
                    <span style={{ fontSize: "9px", background: "#f0f4ee", padding: "2px 6px", borderRadius: "4px" }}>
                      {char.age}
                    </span>
                  )}
                </div>

                <ul className="bible-props-list">
                  <li>
                    <strong>Sifat:</strong>
                    <span>{char.personality || "—"}</span>
                  </li>
                  <li>
                    <strong>Kostum:</strong>
                    <span>{char.costume || "—"}</span>
                  </li>
                  <li>
                    <strong>Prop Khas:</strong>
                    <span>{char.signatureProps || "—"}</span>
                  </li>
                  <li>
                    <strong>Fungsi:</strong>
                    <span>{char.storyFunction || "—"}</span>
                  </li>
                  <li>
                    <strong>Aturan Kanon:</strong>
                    <span style={{ color: "#7a5522" }}>{char.rules || "—"}</span>
                  </li>
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== TAB 6: ENVIRONMENTS ==================== */}
      {activeTab === "Environments" && (
        <div>
          <div className="subsection-heading">
            <div>
              <p className="eyebrow">LINGKUNGAN KANON LEMBAH AWAN</p>
              <h2>Environment Bible ({environments.length})</h2>
            </div>
            <button onClick={() => setIsEnvModalOpen(true)} className="button button-primary">
              ＋ Lingkungan Baru
            </button>
          </div>

          <div className="bible-grid">
            {environments.map((env) => (
              <div key={env.id} className="bible-card">
                <h3>{env.name}</h3>
                <p style={{ fontSize: "11px", color: "#5d6d62", margin: "4px 0 8px", lineHeight: "1.4" }}>
                  {env.description}
                </p>
                <ul className="bible-props-list">
                  <li>
                    <strong>Karakter Visual:</strong>
                    <span>{env.visualCharacteristics || "—"}</span>
                  </li>
                  <li>
                    <strong>Tone / Mood:</strong>
                    <span>{env.tone || "—"}</span>
                  </li>
                  <li>
                    <strong>Catatan Waktu:</strong>
                    <span>{env.timeOfDayNotes || "—"}</span>
                  </li>
                  <li>
                    <strong>Aturan Dunia:</strong>
                    <span style={{ color: "#7a5522" }}>{env.rules || "—"}</span>
                  </li>
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== TAB 7: STYLE ==================== */}
      {activeTab === "Style" && (
        <div className="panel" style={{ maxWidth: "800px" }}>
          <div className="panel-heading" style={{ marginBottom: "14px" }}>
            <div>
              <p className="eyebrow">STANDAR PRODUKSI VISUAL</p>
              <h2>Style Bible</h2>
            </div>
            <button onClick={handleSaveStyleBible} className="button button-primary">
              Simpan Style Bible
            </button>
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            <div className="field">
              <span>Gaya Visual:</span>
              <input
                type="text"
                value={styleBible?.visualStyle || ""}
                onChange={(e) =>
                  setStyleBible(styleBible ? { ...styleBible, visualStyle: e.target.value } : null)
                }
              />
            </div>
            <div className="field">
              <span>Target Audiens:</span>
              <input
                type="text"
                value={styleBible?.audience || ""}
                onChange={(e) =>
                  setStyleBible(styleBible ? { ...styleBible, audience: e.target.value } : null)
                }
              />
            </div>
            <div className="field">
              <span>Bahasa Kamera (Camera Language):</span>
              <textarea
                value={styleBible?.cameraLanguage || ""}
                onChange={(e) =>
                  setStyleBible(styleBible ? { ...styleBible, cameraLanguage: e.target.value } : null)
                }
                rows={2}
              />
            </div>
            <div className="field">
              <span>Tata Cahaya (Lighting):</span>
              <textarea
                value={styleBible?.lighting || ""}
                onChange={(e) =>
                  setStyleBible(styleBible ? { ...styleBible, lighting: e.target.value } : null)
                }
                rows={2}
              />
            </div>
            <div className="field">
              <span>Palet Warna:</span>
              <input
                type="text"
                value={styleBible?.paletteNotes || ""}
                onChange={(e) =>
                  setStyleBible(styleBible ? { ...styleBible, paletteNotes: e.target.value } : null)
                }
              />
            </div>
            <div className="field">
              <span>Elemen Visual Terlarang (Forbidden Visuals):</span>
              <textarea
                value={styleBible?.forbiddenVisuals || ""}
                onChange={(e) =>
                  setStyleBible(styleBible ? { ...styleBible, forbiddenVisuals: e.target.value } : null)
                }
                rows={2}
              />
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODALS ==================== */}

      {/* 1. Scene Generation Modal */}
      {isSceneGenModalOpen && (
        <div className="studio-modal-backdrop">
          <div className="studio-modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0 }}>✨ Generate Struktur Adegan (Gemini AI)</h3>
              <button onClick={() => setIsSceneGenModalOpen(false)} style={{ border: 0, background: "none", cursor: "pointer", fontSize: "16px" }}>✕</button>
            </div>

            <p style={{ fontSize: "11px", color: "#6a7b70" }}>
              Gemini akan menganalisis naskah skrip saat ini dan memecahnya menjadi struktur adegan sinematik.
            </p>

            <textarea
              placeholder="Instruksi tambahan (misal: buat adegan transisi tegang di jembatan)..."
              value={sceneGenInstructions}
              onChange={(e) => setSceneGenInstructions(e.target.value)}
              rows={2}
              style={{ width: "100%", padding: "8px", fontSize: "11px", marginBottom: "12px", border: "1px solid #d4ded5", borderRadius: "5px" }}
            />

            <button
              onClick={handleGenerateSceneProposals}
              disabled={isGeneratingScenes}
              className="button button-primary"
              style={{ width: "100%", marginBottom: "16px" }}
            >
              {isGeneratingScenes ? "Menganalisis & Men-generate..." : "Generate Proposal Adegan"}
            </button>

            {generatedSceneProposals.length > 0 && (
              <div>
                <strong style={{ fontSize: "11px", display: "block", marginBottom: "8px" }}>
                  PROPOSAL STRUKTUR ADEGAN ({generatedSceneProposals.length}):
                </strong>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto", marginBottom: "14px" }}>
                  {generatedSceneProposals.map((prop, idx) => (
                    <div key={idx} style={{ background: "#f8faf7", border: "1px solid #e1e7de", borderRadius: "6px", padding: "10px", fontSize: "10px" }}>
                      <div style={{ fontWeight: 700, color: "#384a3c" }}>
                        {prop.sceneCode}: {prop.heading}
                      </div>
                      <div style={{ color: "#6a7b70", margin: "3px 0" }}>
                        {prop.location} · {prop.timeOfDay}
                      </div>
                      <p style={{ margin: "4px 0 0", color: "#4f5e55" }}>{prop.description}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleApplyGeneratedScenes}
                  className="button button-primary"
                  style={{ width: "100%" }}
                >
                  ✓ Terapkan Proposal ke Skrip
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Shot Breakdown Generation Modal */}
      {isShotGenModalOpen && (
        <div className="studio-modal-backdrop">
          <div className="studio-modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0 }}>✨ Generate Breakdown Shot untuk {activeScene?.sceneCode}</h3>
              <button onClick={() => setIsShotGenModalOpen(false)} style={{ border: 0, background: "none", cursor: "pointer", fontSize: "16px" }}>✕</button>
            </div>

            <p style={{ fontSize: "11px", color: "#6a7b70" }}>
              Gemini akan memecah dialog dan aksi pada adegan ini ke dalam shot-by-shot visual breakdown siap produksi.
            </p>

            <textarea
              placeholder="Instruksi shot breakdown (misal: mulai dengan establishing wide shot, lalu over-the-shoulder Raka)..."
              value={shotGenInstructions}
              onChange={(e) => setShotGenInstructions(e.target.value)}
              rows={2}
              style={{ width: "100%", padding: "8px", fontSize: "11px", marginBottom: "12px", border: "1px solid #d4ded5", borderRadius: "5px" }}
            />

            <button
              onClick={handleGenerateShotBreakdown}
              disabled={isGeneratingShots}
              className="button button-primary"
              style={{ width: "100%", marginBottom: "16px" }}
            >
              {isGeneratingShots ? "Men-generate Breakdown Shot..." : "Generate Breakdown Shot"}
            </button>

            {generatedShotProposals.length > 0 && (
              <div>
                <strong style={{ fontSize: "11px", display: "block", marginBottom: "8px" }}>
                  PROPOSAL SHOT BREAKDOWN ({generatedShotProposals.length}):
                </strong>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto", marginBottom: "14px" }}>
                  {generatedShotProposals.map((shot, idx) => (
                    <div key={idx} style={{ background: "#f8faf7", border: "1px solid #e1e7de", borderRadius: "6px", padding: "10px", fontSize: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontWeight: 700, color: "#384a3c" }}>{shot.shotCode} — {shot.title}</span>
                        <span style={{ background: "#e8efe4", padding: "2px 5px", borderRadius: "3px" }}>{shot.cameraType}</span>
                      </div>
                      <p style={{ margin: "4px 0", color: "#4f5e55" }}><b>Aksi:</b> {shot.action}</p>
                      {shot.dialogue && <p style={{ margin: "2px 0", color: "#30547a" }}><b>Dialog:</b> &quot;{shot.dialogue}&quot;</p>}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleApplyGeneratedShots}
                  className="button button-primary"
                  style={{ width: "100%" }}
                >
                  ✓ Terapkan ke Daftar Shot Produksi
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. New Character Modal */}
      {isCharModalOpen && (
        <div className="studio-modal-backdrop">
          <div className="studio-modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0 }}>＋ Tambah Karakter Baru</h3>
              <button onClick={() => setIsCharModalOpen(false)} style={{ border: 0, background: "none", cursor: "pointer", fontSize: "16px" }}>✕</button>
            </div>
            <div style={{ display: "grid", gap: "10px" }}>
              <input
                type="text"
                placeholder="Nama Karakter (misal: Raka)..."
                value={charForm.name || ""}
                onChange={(e) => setCharForm({ ...charForm, name: e.target.value })}
                style={{ height: "32px", padding: "0 8px", fontSize: "11px" }}
              />
              <input
                type="text"
                placeholder="Usia (misal: 10 tahun)..."
                value={charForm.age || ""}
                onChange={(e) => setCharForm({ ...charForm, age: e.target.value })}
                style={{ height: "32px", padding: "0 8px", fontSize: "11px" }}
              />
              <input
                type="text"
                placeholder="Peran (misal: Protagonis utama)..."
                value={charForm.role || ""}
                onChange={(e) => setCharForm({ ...charForm, role: e.target.value })}
                style={{ height: "32px", padding: "0 8px", fontSize: "11px" }}
              />
              <textarea
                placeholder="Kepribadian..."
                value={charForm.personality || ""}
                onChange={(e) => setCharForm({ ...charForm, personality: e.target.value })}
                rows={2}
                style={{ padding: "8px", fontSize: "11px" }}
              />
              <textarea
                placeholder="Pakaian / Kostum..."
                value={charForm.costume || ""}
                onChange={(e) => setCharForm({ ...charForm, costume: e.target.value })}
                rows={2}
                style={{ padding: "8px", fontSize: "11px" }}
              />
              <textarea
                placeholder="Aturan Kanon Karakter..."
                value={charForm.rules || ""}
                onChange={(e) => setCharForm({ ...charForm, rules: e.target.value })}
                rows={2}
                style={{ padding: "8px", fontSize: "11px" }}
              />
              <button onClick={handleSaveCharacter} className="button button-primary" style={{ height: "34px", marginTop: "6px" }}>
                Simpan Karakter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. New Environment Modal */}
      {isEnvModalOpen && (
        <div className="studio-modal-backdrop">
          <div className="studio-modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0 }}>＋ Tambah Lingkungan Baru</h3>
              <button onClick={() => setIsEnvModalOpen(false)} style={{ border: 0, background: "none", cursor: "pointer", fontSize: "16px" }}>✕</button>
            </div>
            <div style={{ display: "grid", gap: "10px" }}>
              <input
                type="text"
                placeholder="Nama Lingkungan (misal: Lembah Awan)..."
                value={envForm.name || ""}
                onChange={(e) => setEnvForm({ ...envForm, name: e.target.value })}
                style={{ height: "32px", padding: "0 8px", fontSize: "11px" }}
              />
              <textarea
                placeholder="Deskripsi..."
                value={envForm.description || ""}
                onChange={(e) => setEnvForm({ ...envForm, description: e.target.value })}
                rows={2}
                style={{ padding: "8px", fontSize: "11px" }}
              />
              <textarea
                placeholder="Karakteristik Visual..."
                value={envForm.visualCharacteristics || ""}
                onChange={(e) => setEnvForm({ ...envForm, visualCharacteristics: e.target.value })}
                rows={2}
                style={{ padding: "8px", fontSize: "11px" }}
              />
              <input
                type="text"
                placeholder="Suasana / Tone..."
                value={envForm.tone || ""}
                onChange={(e) => setEnvForm({ ...envForm, tone: e.target.value })}
                style={{ height: "32px", padding: "0 8px", fontSize: "11px" }}
              />
              <textarea
                placeholder="Aturan Lingkungan..."
                value={envForm.rules || ""}
                onChange={(e) => setEnvForm({ ...envForm, rules: e.target.value })}
                rows={2}
                style={{ padding: "8px", fontSize: "11px" }}
              />
              <button onClick={handleSaveEnvironment} className="button button-primary" style={{ height: "34px", marginTop: "6px" }}>
                Simpan Lingkungan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
