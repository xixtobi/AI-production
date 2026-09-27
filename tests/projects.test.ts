import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

let dataDir: string;
let projectService: typeof import("../src/lib/projects/service");
let database: typeof import("../src/lib/db");
let contentService: typeof import("../src/lib/content/service");
let seasonService: typeof import("../src/lib/seasons/service");
let sceneService: typeof import("../src/lib/scenes/service");
let shotService: typeof import("../src/lib/shots/service");
let testProjectId: string;
let otherProjectId: string;
let contentId: string;
let otherContentId: string;
let sceneId: string;
let firstShotId: string;
let thirdShotId: string;

before(async () => {
  dataDir = mkdtempSync(path.join(os.tmpdir(), "lpc-phase1-"));
  process.env.PRODUCTION_CONTROL_DATA_DIR = dataDir;
  projectService = await import("../src/lib/projects/service");
  database = await import("../src/lib/db");
  contentService = await import("../src/lib/content/service");
  seasonService = await import("../src/lib/seasons/service");
  sceneService = await import("../src/lib/scenes/service");
  shotService = await import("../src/lib/shots/service");
});

after(() => {
  database.db.$client.close();
  rmSync(dataDir, { recursive: true, force: true });
});

test("creates a project and returns it from the project dashboard query", () => {
  const created = projectService.createProject({
    code: "TEST-VIDEO",
    name: "Test Video Project",
    projectType: "YOUTUBE",
    description: "A test project",
    rootPath: "D:\\Production\\Test-Video",
    defaultAspectRatio: "16:9",
    defaultLanguage: "Indonesian",
  });

  assert.equal(created.status, "NOT_STARTED");
  assert.equal(projectService.getProject(created.id)?.name, "Test Video Project");
  assert.equal(projectService.listProjects().some((project) => project.id === created.id), true);
});

test("rejects duplicate project codes", () => {
  const input = {
    code: "DUPLICATE",
    name: "Duplicate Test",
    projectType: "OTHER" as const,
    description: "",
    rootPath: "D:\\Production\\Duplicate",
    defaultAspectRatio: "16:9",
    defaultLanguage: "Indonesian",
  };
  projectService.createProject(input);
  assert.throws(() => projectService.createProject(input), /UNIQUE constraint failed/);
});

test("creates seasons and content items, including content without a season", () => {
  const project = projectService.createProject({ code:"PHASE2-A",name:"Phase Two Project",projectType:"ANIMATION_SERIES",description:"",rootPath:"D:\\Production\\P2",defaultAspectRatio:"16:9",defaultLanguage:"Indonesian" });
  testProjectId = project.id;
  const otherProject = projectService.createProject({ code:"PHASE2-B",name:"Second Project",projectType:"UGC_SERIES",description:"",rootPath:"D:\\Production\\P2B",defaultAspectRatio:"9:16",defaultLanguage:"Indonesian" });
  otherProjectId = otherProject.id;
  const season = seasonService.createSeason(project.id,{code:"S01",seasonNumber:1,name:"Season 1",description:"",status:"NOT_STARTED"});
  assert.equal(seasonService.listSeasons(project.id).length,1);
  assert.throws(()=>contentService.createContent(otherProject.id,{seasonId:season.id,code:"BAD",contentNumber:1,title:"Bad",contentType:"VIDEO",description:"",durationTarget:null,status:"NOT_STARTED",priority:"NORMAL"}),/Musim tidak ditemukan/);
  const content = contentService.createContent(project.id,{seasonId:season.id,code:"EP01",contentNumber:1,title:"Episode 01",contentType:"EPISODE",description:"",durationTarget:null,status:"NOT_STARTED",priority:"NORMAL"});
  contentId = content.id;
  const otherContent = contentService.createContent(project.id,{seasonId:null,code:"EP02",contentNumber:2,title:"Episode 02",contentType:"EPISODE",description:"",durationTarget:null,status:"NOT_STARTED",priority:"NORMAL"});
  otherContentId = otherContent.id;
  assert.equal(contentService.getContent(project.id,content.id)?.item.code,"EP01");
});

test("creates a scene scoped to its content and refuses cross-project scene creation", () => {
  const scene = sceneService.createScene(testProjectId,contentId,{code:"SC01",sceneNumber:1,title:"Scene 01",location:"",description:"",durationTarget:null,status:"NOT_STARTED"});
  sceneId = scene.id;
  assert.equal(sceneService.listScenes(testProjectId,contentId).length,1);
  assert.throws(()=>sceneService.createScene(otherProjectId,contentId,{code:"BAD",sceneNumber:1,title:"Invalid",location:"",description:"",durationTarget:null,status:"NOT_STARTED"}),/Konten tidak ditemukan/);
});

test("creates ordered shots, prevents duplicates and cross-content scene links", () => {
  const create = (shotCode:string,shotNumber:number,scene:string|null=sceneId,content=contentId,project=testProjectId) => shotService.createShot(project,{contentItemId:content,sceneId:scene,shotCode,shotNumber,title:shotCode,description:"",durationTarget:null,cameraType:"",action:"",dialogue:"",notes:"",status:"NOT_STARTED",priority:"NORMAL"});
  firstShotId = create("SH001",1).id;
  create("SH002",2,null);
  thirdShotId = create("SH003",3).id;
  assert.throws(()=>create("SH001",4),/Kode shot atau nomor shot sudah digunakan/);
  assert.throws(()=>create("SH004",4,sceneId,otherContentId),/Adegan harus berasal dari konten yang sama/);
  assert.throws(()=>create("SH004",4,null,contentId,otherProjectId),/Konten tidak ditemukan/);
});

test("updates shot status and resolves previous/next navigation by shot number", () => {
  shotService.updateShot(testProjectId,firstShotId,{title:"Opening shot",description:"Updated description",durationTarget:4,cameraType:"Wide",action:"",dialogue:"",notes:"Checked",status:"IN_PROGRESS",priority:"HIGH"});
  const detail=shotService.getShotDetail(testProjectId,firstShotId);
  assert.equal(detail?.shot.status,"IN_PROGRESS");
  assert.equal(detail?.shot.priority,"HIGH");
  assert.equal(detail?.previous,undefined);
  assert.ok(detail?.next);
  assert.equal(shotService.getShotDetail(testProjectId,thirdShotId)?.previous?.shotCode,"SH002");
});

test("scene deletion requires confirmation when shots exist and keeps the shots", () => {
  assert.throws(()=>sceneService.deleteScene(testProjectId,contentId,sceneId,false),/Adegan memiliki shot/);
  sceneService.deleteScene(testProjectId,contentId,sceneId,true);
  assert.equal(sceneService.listScenes(testProjectId,contentId).length,0);
  assert.equal(shotService.getShotDetail(testProjectId,firstShotId)?.shot.sceneId,null);
});

test("seed migration installs Season 1, EP01 and the 91 known shot codes idempotently", () => {
  const seedProject=projectService.listProjects().find((project)=>project.code.toLowerCase()==="lembah-awan");
  assert.ok(seedProject);
  const seedContent=contentService.listContent(seedProject.id).find(({item})=>item.code==="EP01");
  assert.equal(seedContent?.item.title,"Lonceng di Puncak Gunung");
  assert.equal(shotService.listShots(seedProject.id).filter(({content})=>content.id===seedContent?.item.id).length,91);
  assert.deepEqual(sceneService.listScenes(seedProject.id,seedContent!.item.id).map(({scene,shotCount})=>[scene.code,shotCount]),[["ANCHOR_A",8],["ANCHOR_B",23],["ANCHOR_C",10],["ANCHOR_D",13],["ANCHOR_E",10],["ANCHOR_F",17],["ANCHOR_G",10]]);
});
