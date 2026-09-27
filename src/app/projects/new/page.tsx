import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CreateProjectForm } from "@/components/create-project-form";

export default function NewProjectPage() {
  return (
    <AppShell active="Proyek">
      <div className="page-heading">
        <div><Link href="/" className="back-link">← Kembali ke proyek</Link><p className="eyebrow">RUANG KERJA BARU</p><h1>Buat proyek</h1><p className="subheading">Atur identitas dan lokasi folder produksi.</p></div>
      </div>
      <CreateProjectForm />
    </AppShell>
  );
}
