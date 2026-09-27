import { AppShell } from "@/components/app-shell";
import { GeminiSettingsView } from "@/components/gemini-settings-view";
import {
  GEMINI_PRIMARY_MODEL,
  GEMINI_DEFAULT_THINKING_LEVEL,
  TASK_DEFAULT_THINKING_LEVELS,
  isGeminiConfigured,
} from "@/lib/gemini/config";

export default function AiSettingsPage() {
  const isConfigured = isGeminiConfigured();

  return (
    <AppShell active="Pengaturan">
      <div className="page-heading">
        <p className="eyebrow">KONFIGURASI SISTEM</p>
        <h1>Pengaturan Gemini AI</h1>
        <p className="subheading">
          Penyedia AI tunggal: Google Gemini API & Gemini 3.8 Flash
        </p>
      </div>

      <GeminiSettingsView
        isConfigured={isConfigured}
        configuredModel={GEMINI_PRIMARY_MODEL}
        defaultThinkingLevel={GEMINI_DEFAULT_THINKING_LEVEL}
        taskDefaults={TASK_DEFAULT_THINKING_LEVELS}
      />
    </AppShell>
  );
}
