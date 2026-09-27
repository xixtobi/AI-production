import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { listAiHistory } from "@/lib/gemini/task-service";
import { formatTokenCostDisplay } from "@/lib/gemini/usage-service";
import { ensureDatabaseReady } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function AiHistoryPage() {
  ensureDatabaseReady();
  const history = listAiHistory({ limit: 100 });

  function getStatusStyle(status: string) {
    switch (status) {
      case "ACCEPTED":
        return { bg: "#eaf5e9", color: "#377433" };
      case "SUCCEEDED":
        return { bg: "#f0f7ec", color: "#4f7547" };
      case "FAILED":
        return { bg: "#fff0ef", color: "#aa4238" };
      case "REJECTED":
        return { bg: "#f7f1f0", color: "#8a6663" };
      case "RUNNING":
        return { bg: "#eef6fd", color: "#3b6b99" };
      default:
        return { bg: "#f3f5f3", color: "#77857c" };
    }
  }

  return (
    <AppShell active="AI Riwayat">
      <div className="page-heading">
        <p className="eyebrow">AUDIT & LOGGING</p>
        <h1>Riwayat Permintaan AI</h1>
        <p className="subheading">
          Daftar seluruh eksekusi tugas Gemini AI dan status tinjauan produksi
        </p>
      </div>

      <section className="panel" style={{ padding: "0", overflow: "hidden" }}>
        <div className="project-table-wrap">
          <table className="project-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Tugas (Task)</th>
                <th>Proyek</th>
                <th>Konten</th>
                <th>Shot</th>
                <th>Model</th>
                <th>Level</th>
                <th>Status</th>
                <th>Penggunaan Token</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "#8b9690" }}>
                    Belum ada riwayat permintaan AI yang tercatat.
                  </td>
                </tr>
              ) : (
                history.map(({ request, task, project, content, shot }) => {
                  const style = getStatusStyle(request.status);
                  const createdStr = new Date(request.createdAt).toLocaleString("id-ID", {
                    dateStyle: "short",
                    timeStyle: "medium",
                  });

                  return (
                    <tr key={request.id}>
                      <td style={{ whiteSpace: "nowrap", fontSize: "10px", color: "#7a877e" }}>
                        {createdStr}
                      </td>
                      <td>
                        <strong style={{ display: "block", fontSize: "11px" }}>{task.name}</strong>
                        <small className="table-code">{task.code}</small>
                      </td>
                      <td>
                        <Link
                          href={`/projects/${project.id}`}
                          style={{ color: "#4a6e3e", fontWeight: 600 }}
                        >
                          {project.code}
                        </Link>
                      </td>
                      <td>
                        {content ? (
                          <Link
                            href={`/projects/${project.id}/content/${content.id}`}
                            style={{ color: "#4a6e3e" }}
                          >
                            {content.code}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        {shot ? (
                          <Link
                            href={`/projects/${project.id}/shots/${shot.id}`}
                            style={{ color: "#4a6e3e", fontWeight: 600 }}
                          >
                            {shot.shotCode}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: "10px", color: "#5d6d63" }}>{request.model}</span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "8px",
                            backgroundColor: "#f2f5f1",
                            color: "#556b4f",
                          }}
                        >
                          {request.thinkingLevel}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            fontSize: "9px",
                            fontWeight: 700,
                            backgroundColor: style.bg,
                            color: style.color,
                          }}
                        >
                          {request.status}
                        </span>
                        {request.errorMessage && (
                          <div
                            style={{
                              fontSize: "8px",
                              color: "#aa4238",
                              marginTop: "3px",
                              maxWidth: "180px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={request.errorMessage}
                          >
                            {request.errorMessage}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: "10px", color: "#546459", whiteSpace: "nowrap" }}>
                        {formatTokenCostDisplay(
                          request.inputTokens,
                          request.outputTokens,
                          request.estimatedCost
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
