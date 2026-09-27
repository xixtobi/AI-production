import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, mkdir, rm, writeFile, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let temporary: string; let projectId: string; let database: typeof import("../src/lib/db");
let projectService: typeof import("../src/lib/projects/service"); let assets: typeof import("../src/lib/assets/service"); let scanner: typeof import("../src/lib/filesystem/scanner-service"); let paths: typeof import("../src/lib/filesystem/path-service");
before(async () => {
  temporary = await mkdtemp(path.join(os.tmpdir(), "lpc-filesystem-")); process.env.PRODUCTION_CONTROL_DATA_DIR = path.join(temporary, "db");
  database = await import("../src/lib/db"); projectService = await import("../src/lib/projects/service"); assets = await import("../src/lib/assets/service"); scanner = await import("../src/lib/filesystem/scanner-service"); paths = await import("../src/lib/filesystem/path-service");
  const root = path.join(temporary, "production"); await mkdir(path.join(root, "EP01", "SH008", "KEYFRAME"), { recursive: true });
  projectId = projectService.createProject({ code:"FS-TEST",name:"Filesystem test",projectType:"ANIMATION_SERIES",description:"",rootPath:root,defaultAspectRatio:"16:9",defaultLanguage:"Indonesian" }).id;
});
after(async () => { database.db.$client.close(); await rm(temporary, { recursive:true, force:true }); });

test("normalizes relative paths and rejects traversal and absolute paths", () => {
  assert.equal(paths.normalizeRelativePath("EP01\\SH008\\KEYFRAME\\KF-B08.png"),"EP01/SH008/KEYFRAME/KF-B08.png");
  for (const value of ["../secret.png","C:\\secret.png","\\\\server\\share\\x.png","/etc/passwd"]) assert.throws(()=>paths.normalizeRelativePath(value));
});

test("updates a project root only to a valid non-root absolute path", () => {
  const current=projectService.getProject(projectId)!;
  assert.equal(projectService.updateProjectRootPath(projectId,current.rootPath).rootPath,current.rootPath);
  assert.throws(()=>projectService.updateProjectRootPath(projectId,"relative-folder"),/absolut/);
  assert.throws(()=>projectService.updateProjectRootPath(projectId,"C:\\"),/root drive/);
});

test("registers files, captures image metadata, and preserves separate version history", async () => {
  const imagePath = path.join(temporary,"production","EP01","SH008","KEYFRAME","KF-B08.png");
  const sharp = (await import("sharp")).default;
  await sharp({ create:{ width:32,height:24,channels:3,background:"#7799aa" } }).png().toFile(imagePath);
  const registered = await assets.registerAsset({ projectId,assetCode:"KF-B08",assetType:"IMAGE",name:"Keyframe B08",relativePath:"EP01/SH008/KEYFRAME/KF-B08.png" });
  assert.equal(registered.version.width,32); assert.equal(registered.version.height,24); assert.equal(registered.version.versionNumber,1);
  await sharp({ create:{ width:48,height:24,channels:3,background:"#998877" } }).png().toFile(path.join(temporary,"production","EP01","SH008","KEYFRAME","KF-B08-v2.png"));
  const next = await assets.registerAssetVersion(registered.asset.id,"EP01/SH008/KEYFRAME/KF-B08-v2.png");
  assert.equal(next.versionNumber,2); assert.equal(assets.getAssetVersions(registered.asset.id).filter(v=>v.isCurrent).length,1);
});

test("scanner detects unlinked and duplicate files and remains project scoped", async () => {
  const root=path.join(temporary,"production");
  await mkdir(path.join(root,"EXTRA"),{recursive:true});
  await writeFile(path.join(root,"EXTRA","copy.txt"),"same");
  await writeFile(path.join(root,"EXTRA","copy-2.txt"),"same");
  const result=await scanner.scanProject(projectId);
  assert.ok(result.files.some(file=>file.status==="UNLINKED"));
  assert.ok(result.files.some(file=>file.status==="DUPLICATE"));
  const secondRoot=path.join(temporary,"other"); await mkdir(secondRoot);
  const second=projectService.createProject({code:"FS-OTHER",name:"Other",projectType:"OTHER",description:"",rootPath:secondRoot,defaultAspectRatio:"16:9",defaultLanguage:"Indonesian"});
  assert.equal((await scanner.scanProject(second.id)).files.length,0);
});

test("refuses symlink escapes when a platform supports directory symlinks", async (t) => {
  const outside=path.join(temporary,"outside"); await mkdir(outside); await writeFile(path.join(outside,"secret.txt"),"secret");
  const root=path.join(temporary,"production");
  try { await symlink(outside,path.join(root,"escape"),"junction"); }
  catch { t.skip("Symlink creation unavailable in this environment"); return; }
  await assert.rejects(paths.resolveExistingProjectFile(root,"escape/secret.txt"));
});
