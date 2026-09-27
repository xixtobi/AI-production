import { priorities, projectStatuses } from "@/lib/db/enums";

const statusLabels: Record<(typeof projectStatuses)[number], string> = { NOT_STARTED: "Belum dimulai", IN_PROGRESS: "Berjalan", APPROVED: "Disetujui", NEEDS_REVISION: "Perlu revisi", BLOCKED: "Terhambat", FINAL: "Final" };
const priorityLabels: Record<(typeof priorities)[number], string> = { LOW: "Rendah", NORMAL: "Normal", HIGH: "Tinggi", URGENT: "Mendesak" };

export function StatusBadge({ status }: { status: (typeof projectStatuses)[number] }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}><i />{statusLabels[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: (typeof priorities)[number] }) {
  return <span className={`priority-badge priority-${priority.toLowerCase()}`}>{priorityLabels[priority]}</span>;
}
