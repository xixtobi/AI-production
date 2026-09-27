import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ShotForm } from "@/components/shot-form";
import { getProject } from "@/lib/projects/service";
import { listContent } from "@/lib/content/service";
import { listProjectScenes } from "@/lib/scenes/service";
import { suggestNextShot } from "@/lib/shots/service";

export default async function NewShotPage({params,searchParams}:{params:Promise<{projectId:string}>;searchParams:Promise<{contentId?:string}>}){
  const [{projectId},query]=await Promise.all([params,searchParams]);
  const project=getProject(projectId);
  if(!project)notFound();
  const contents=listContent(projectId).map(({item})=>({id:item.id,code:item.code,title:item.title}));
  if(contents.length===0)return <AppShell active="Proyek" projectId={projectId} projectSection="Shot"><div className="page-heading"><Link href={`/projects/${projectId}/content/new`} className="back-link">← Buat konten</Link><h1>Tambahkan konten sebelum membuat shot</h1></div><div className="empty-inline">Shot harus terhubung ke satu konten.</div></AppShell>;
  const defaultContentId=contents.some((item)=>item.id===query.contentId)?query.contentId:contents[0].id;
  if (!defaultContentId) notFound();
  const suggested=suggestNextShot(projectId,defaultContentId);
  const scenes=listProjectScenes(projectId).map(({scene,content})=>({id:scene.id,contentItemId:content.id,code:scene.code,title:scene.title,location:scene.location}));
  return <AppShell active="Proyek" projectId={projectId} projectSection="Shot"><div className="page-heading"><Link className="back-link" href={`/projects/${projectId}/shots`}>← Kembali ke shot</Link><p className="eyebrow">SHOT BARU</p><h1>Tambahkan shot</h1><p className="subheading">Shot tersimpan di dalam konten yang dipilih.</p></div><ShotForm projectId={projectId} contents={contents} scenes={scenes} suggested={suggested} defaultContentId={defaultContentId}/></AppShell>;
}
