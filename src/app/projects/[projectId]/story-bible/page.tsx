import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getProject } from "@/lib/projects/service";
import {
  listCharacters,
  listEnvironments,
  getOrCreateStoryBible,
  getOrCreateStyleBible,
} from "@/lib/script";

export default async function StoryBiblePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) notFound();

  const storyBible = getOrCreateStoryBible(projectId);
  const styleBible = getOrCreateStyleBible(projectId);
  const characters = listCharacters(projectId);
  const environments = listEnvironments(projectId);

  return (
    <AppShell active="Proyek" projectId={projectId} projectSection="Story Bible">
      <div className="project-topline">
        <Link href={`/projects/${projectId}`} className="back-link">
          ← Dashboard Proyek
        </Link>
        <span style={{ fontSize: "11px", color: "#6a7b70" }}>
          Kanon Resmi · {project.code}
        </span>
      </div>

      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">DOKUMEN KANON PRODUKSI</p>
          <h1>Story Bible & Panduan Semesta</h1>
          <p className="subheading">
            Fondasi naratif, aturan dunia, karakter, latar tempat, dan standar gaya visual proyek {project.name}.
          </p>
        </div>
      </div>

      {/* Story Bible Overview */}
      <section className="subsection">
        <div className="panel" style={{ marginBottom: "20px" }}>
          <div className="panel-heading" style={{ marginBottom: "12px" }}>
            <h2>Premis & Aturan Dunia (Story Bible V{storyBible.versionNumber})</h2>
          </div>
          <dl className="details-panel" style={{ margin: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "10px", padding: "10px 0", borderTop: "1px solid #edf1ee" }}>
              <strong style={{ fontSize: "11px", color: "#6b7a70" }}>Premis Cerita:</strong>
              <div style={{ fontSize: "12px", color: "#2d3c32", lineHeight: "1.5" }}>{storyBible.premise || "Belum diisi."}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "10px", padding: "10px 0", borderTop: "1px solid #edf1ee" }}>
              <strong style={{ fontSize: "11px", color: "#6b7a70" }}>Aturan Dunia (World Rules):</strong>
              <div style={{ fontSize: "12px", color: "#2d3c32", lineHeight: "1.5" }}>{storyBible.worldRules || "Belum diisi."}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "10px", padding: "10px 0", borderTop: "1px solid #edf1ee" }}>
              <strong style={{ fontSize: "11px", color: "#6b7a70" }}>Misteri Utama:</strong>
              <div style={{ fontSize: "12px", color: "#2d3c32", lineHeight: "1.5" }}>{storyBible.mystery || "Belum diisi."}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "10px", padding: "10px 0", borderTop: "1px solid #edf1ee" }}>
              <strong style={{ fontSize: "11px", color: "#6b7a70" }}>Tema Besar:</strong>
              <div style={{ fontSize: "12px", color: "#2d3c32", lineHeight: "1.5" }}>{storyBible.themes || "Belum diisi."}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "10px", padding: "10px 0", borderTop: "1px solid #edf1ee" }}>
              <strong style={{ fontSize: "11px", color: "#6b7a70" }}>Tone & Batasan:</strong>
              <div style={{ fontSize: "12px", color: "#7a5522", lineHeight: "1.5" }}>
                <b>Tone:</b> {storyBible.tone} <br />
                <b>Batasan:</b> {storyBible.constraints}
              </div>
            </div>
          </dl>
        </div>
      </section>

      {/* Characters Bible */}
      <section className="subsection">
        <div className="subsection-heading">
          <div>
            <p className="eyebrow">KARAKTER UTAMA</p>
            <h2>Character Bible ({characters.length})</h2>
          </div>
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
                  <span>{char.personality}</span>
                </li>
                <li>
                  <strong>Pakaian:</strong>
                  <span>{char.costume}</span>
                </li>
                <li>
                  <strong>Prop Khas:</strong>
                  <span>{char.signatureProps}</span>
                </li>
                <li>
                  <strong>Aturan Kanon:</strong>
                  <span style={{ color: "#7a5522" }}>{char.rules}</span>
                </li>
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Environments Bible */}
      <section className="subsection" style={{ marginTop: "28px" }}>
        <div className="subsection-heading">
          <div>
            <p className="eyebrow">LOKASI & DUNIA</p>
            <h2>Environment Bible ({environments.length})</h2>
          </div>
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
                  <strong>Visual:</strong>
                  <span>{env.visualCharacteristics}</span>
                </li>
                <li>
                  <strong>Tone:</strong>
                  <span>{env.tone}</span>
                </li>
                <li>
                  <strong>Waktu:</strong>
                  <span>{env.timeOfDayNotes}</span>
                </li>
                <li>
                  <strong>Aturan:</strong>
                  <span style={{ color: "#7a5522" }}>{env.rules}</span>
                </li>
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Style Bible */}
      <section className="subsection" style={{ marginTop: "28px" }}>
        <div className="panel">
          <div className="panel-heading" style={{ marginBottom: "12px" }}>
            <h2>Style Bible (Standar Visual & Sinematografi)</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "11px" }}>
            <div>
              <strong style={{ color: "#5d6e62" }}>Gaya Visual:</strong>
              <p style={{ margin: "4px 0 10px" }}>{styleBible.visualStyle || "—"}</p>

              <strong style={{ color: "#5d6e62" }}>Bahasa Kamera:</strong>
              <p style={{ margin: "4px 0 10px" }}>{styleBible.cameraLanguage || "—"}</p>

              <strong style={{ color: "#5d6e62" }}>Pencahayaan (Lighting):</strong>
              <p style={{ margin: "4px 0" }}>{styleBible.lighting || "—"}</p>
            </div>
            <div>
              <strong style={{ color: "#5d6e62" }}>Target Penonton:</strong>
              <p style={{ margin: "4px 0 10px" }}>{styleBible.audience || "—"}</p>

              <strong style={{ color: "#5d6e62" }}>Palet Warna:</strong>
              <p style={{ margin: "4px 0 10px" }}>{styleBible.paletteNotes || "—"}</p>

              <strong style={{ color: "#9e3832" }}>Elemen Terlarang:</strong>
              <p style={{ margin: "4px 0", color: "#7a2a26" }}>{styleBible.forbiddenVisuals || "—"}</p>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
