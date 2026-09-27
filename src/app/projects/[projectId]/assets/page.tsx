import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AssetRegisterForm } from "@/components/asset-register-form";
import { AssetLibrary } from "@/components/asset-library";
import { ScanButton } from "@/components/asset-controls";
import { getProject } from "@/lib/projects/service";
import { listAssets } from "@/lib/assets/service";
export default async function AssetsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params; const project = getProject(projectId); if (!project) notFound(); const rows = listAssets(projectId);
  return <AppShell active="Proyek" projectId={projectId} projectSection="Asset"><div className="section-heading"><div><p className="eyebrow">LIBRARY PROYEK</p><h1>Aset & file</h1><p className="subheading">File tetap berada di folder produksi. Database menyimpan path relatif dan versi.</p></div><ScanButton projectId={projectId}/></div>
    <div className="panel"><div className="panel-heading"><div><p className="eyebrow">TERDAFTAR</p><h2>{rows.length} aset</h2></div></div><AssetLibrary projectId={projectId} rows={rows}/></div>
    <AssetRegisterForm projectId={projectId}/>
  </AppShell>;
}
