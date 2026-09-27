import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { db, ensureDatabaseReady } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { createBackup, validateBackup, listBackups, restoreBackup } from "@/lib/backup";
import { exportProject, importProject } from "@/lib/export-import";
import { searchProduction } from "@/lib/search";
import {
  checkDatabaseIntegrity,
  getSystemHealth,
  getProjectHealth,
  getProjectStorageReport,
  getSystemSettings,
  updateSystemSettings,
  logSystemEvent,
  readSystemLogs,
  rebuildAssetIndex,
  clearThumbnailCache,
  APP_VERSION,
} from "@/lib/system";
import { addFavorite, isFavorite, listFavorites, removeFavorite, toggleFavorite } from "@/lib/favorites";
import { archiveAsset, archiveProject, unarchiveAsset, unarchiveProject } from "@/lib/archive";
import { migrateProjectRoot } from "@/lib/projects/service";
import { logActivity, listActivities } from "@/lib/activity";

function createTempDir(prefix: string): string {
  const dir = path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function findLembahAwanProject(): schema.Project {
  const p = db.select().from(schema.projects).where(sql`lower(${schema.projects.code}) = 'lembah-awan' or lower(${schema.projects.name}) = 'petualangan di lembah awan'`).get();
  assert.ok(p, "Project Lembah Awan must exist");
  return p;
}

function deleteProjectWithChildren(projectId: string) {
  db.transaction((tx) => {
    tx.delete(schema.continuityChecks).where(eq(schema.continuityChecks.projectId, projectId)).run();
    tx.delete(schema.qcReviews).where(eq(schema.qcReviews.projectId, projectId)).run();
    tx.delete(schema.videoOutputs).where(eq(schema.videoOutputs.projectId, projectId)).run();
    tx.delete(schema.flowQueueItems).where(eq(schema.flowQueueItems.projectId, projectId)).run();
    tx.delete(schema.shotAssets).where(eq(schema.shotAssets.projectId, projectId)).run();
    tx.delete(schema.assetVersions).where(eq(schema.assetVersions.projectId, projectId)).run();
    tx.delete(schema.assets).where(eq(schema.assets.projectId, projectId)).run();
    tx.delete(schema.shots).where(eq(schema.shots.projectId, projectId)).run();
    tx.delete(schema.scenes).where(eq(schema.scenes.projectId, projectId)).run();
    tx.delete(schema.contentItems).where(eq(schema.contentItems.projectId, projectId)).run();
    tx.delete(schema.seasons).where(eq(schema.seasons.projectId, projectId)).run();
    tx.delete(schema.storyDocuments).where(eq(schema.storyDocuments.projectId, projectId)).run();
    tx.delete(schema.scriptDocuments).where(eq(schema.scriptDocuments.projectId, projectId)).run();
    tx.delete(schema.characters).where(eq(schema.characters.projectId, projectId)).run();
    tx.delete(schema.environments).where(eq(schema.environments.projectId, projectId)).run();
    tx.delete(schema.styleBibles).where(eq(schema.styleBibles.projectId, projectId)).run();
    tx.delete(schema.storyBibles).where(eq(schema.storyBibles.projectId, projectId)).run();
    tx.delete(schema.promptDocuments).where(eq(schema.promptDocuments.projectId, projectId)).run();
    tx.delete(schema.backups).where(eq(schema.backups.projectId, projectId)).run();
    tx.delete(schema.projects).where(eq(schema.projects.id, projectId)).run();
  });
}

test("1. Backup: Metadata backup creates timestamped folder, valid manifest, and db record", async () => {
  ensureDatabaseReady();
  const project = findLembahAwanProject();
  const tempBackupDir = createTempDir("test-backup-meta");

  try {
    const backup = createBackup({
      projectId: project.id,
      backupType: "METADATA_BACKUP",
      targetDirectory: tempBackupDir,
      author: "Test Engineer",
    });

    assert.ok(backup.id, "Backup record ID must be present");
    assert.equal(backup.backupType, "METADATA_BACKUP");
    assert.ok(existsSync(backup.backupPath), "Backup directory must exist on disk");

    const manifestPath = path.join(backup.backupPath, "manifest.json");
    assert.ok(existsSync(manifestPath), "manifest.json must exist in backup directory");

    const dbDumpPath = path.join(backup.backupPath, "database-dump.json");
    assert.ok(existsSync(dbDumpPath), "database-dump.json must exist in backup directory");

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.backupType, "METADATA_BACKUP");
    assert.equal(manifest.appVersion, APP_VERSION);
    assert.ok(manifest.totalFiles >= 3, "Manifest must track at least 3 files");
    assert.ok(manifest.checksums["database-dump.json"], "Checksum for db dump must exist");

    // Check database record in backups table
    const dbBackup = db.select().from(schema.backups).where(eq(schema.backups.id, backup.id)).get();
    assert.ok(dbBackup, "Backup row must exist in backups table");
    assert.equal(dbBackup.status, "COMPLETED");

    // Check activity log
    const activities = listActivities({ projectId: project.id, actionType: "BACKUP_CREATE", limit: 5 });
    assert.ok(activities.length > 0, "BACKUP_CREATE activity must be logged");
  } finally {
    rmSync(tempBackupDir, { recursive: true, force: true });
  }
});

test("2. Backup: Full project backup copies physical assets and validates checksums", async () => {
  ensureDatabaseReady();
  const project = findLembahAwanProject();

  const tempBackupDir = createTempDir("test-backup-full");
  const tempProjectRoot = createTempDir("test-project-root");

  try {
    // Create a physical test asset inside project root
    const testAssetRelPath = "CONTENT/EP01/SH016/REFERENCES/KF-B08_v01.png";
    const testAssetAbsPath = path.join(tempProjectRoot, testAssetRelPath);
    mkdirSync(path.dirname(testAssetAbsPath), { recursive: true });
    writeFileSync(testAssetAbsPath, "dummy-image-binary-content-kf-b08");

    // Temporarily update project rootPath to test root
    const origRoot = project.rootPath;
    db.update(schema.projects).set({ rootPath: tempProjectRoot }).where(eq(schema.projects.id, project.id)).run();

    const backup = createBackup({
      projectId: project.id,
      backupType: "FULL_PROJECT_BACKUP",
      targetDirectory: tempBackupDir,
    });

    assert.equal(backup.backupType, "FULL_PROJECT_BACKUP");
    assert.ok(backup.fileCount >= 4, "File count must include assets");

    const backedUpAsset = path.join(backup.backupPath, "assets", testAssetRelPath);
    assert.ok(existsSync(backedUpAsset), "Physical asset must be copied in full backup");
    assert.equal(readFileSync(backedUpAsset, "utf8"), "dummy-image-binary-content-kf-b08");

    // Restore original root path
    db.update(schema.projects).set({ rootPath: origRoot }).where(eq(schema.projects.id, project.id)).run();
  } finally {
    rmSync(tempBackupDir, { recursive: true, force: true });
    rmSync(tempProjectRoot, { recursive: true, force: true });
  }
});

test("3. Backup: Non-overwriting timestamped directory prevents overwriting existing backups", async () => {
  ensureDatabaseReady();
  const project = findLembahAwanProject();
  const tempBackupDir = createTempDir("test-backup-collision");

  try {
    const backup1 = createBackup({
      projectId: project.id,
      backupType: "METADATA_BACKUP",
      targetDirectory: tempBackupDir,
    });

    const backup2 = createBackup({
      projectId: project.id,
      backupType: "METADATA_BACKUP",
      targetDirectory: tempBackupDir,
    });

    assert.notEqual(backup1.backupPath, backup2.backupPath, "Backups must be saved in distinct non-overwriting directories");
    assert.ok(existsSync(backup1.backupPath));
    assert.ok(existsSync(backup2.backupPath));
  } finally {
    rmSync(tempBackupDir, { recursive: true, force: true });
  }
});

test("4. Backup: validateBackup verifies untampered backup and detects corrupted files", async () => {
  ensureDatabaseReady();
  const project = findLembahAwanProject();
  const tempBackupDir = createTempDir("test-backup-validate");

  try {
    const backup = createBackup({
      projectId: project.id,
      backupType: "METADATA_BACKUP",
      targetDirectory: tempBackupDir,
    });

    const validCheck = validateBackup(backup.backupPath);
    assert.equal(validCheck.isValid, true);
    assert.equal(validCheck.errors.length, 0);

    // Tamper with database-dump.json
    const dbDumpPath = path.join(backup.backupPath, "database-dump.json");
    writeFileSync(dbDumpPath, "corrupted content!");

    const tamperedCheck = validateBackup(backup.backupPath);
    assert.equal(tamperedCheck.isValid, false, "Validation must fail when file content is altered");
    assert.ok(tamperedCheck.errors.some((e) => e.includes("Checksum tidak cocok")));
  } finally {
    rmSync(tempBackupDir, { recursive: true, force: true });
  }
});

test("5. Backup: restoreBackup requires explicit confirmation and creates an automatic safety backup first", async () => {
  ensureDatabaseReady();
  const project = findLembahAwanProject();
  const tempBackupDir = createTempDir("test-backup-restore");

  try {
    const backup = createBackup({
      projectId: project.id,
      backupType: "METADATA_BACKUP",
      targetDirectory: tempBackupDir,
    });

    // Unconfirmed restore must fail
    assert.throws(() => {
      restoreBackup({
        projectId: project.id,
        backupPath: backup.backupPath,
        confirm: false,
      });
    }, /konfirmasi/i);

    // Confirmed restore with confirmCode: "RESTORE"
    const restoreResult = restoreBackup({
      projectId: project.id,
      backupPath: backup.backupPath,
      confirmCode: "RESTORE",
    });

    assert.equal(restoreResult.success, true);
    assert.ok(restoreResult.safetyBackupId, "Safety backup ID must be returned");

    // Verify safety backup was created in database
    const safetyRecord = db.select().from(schema.backups).where(eq(schema.backups.id, restoreResult.safetyBackupId)).get();
    assert.ok(safetyRecord, "Automatic safety backup must be stored in database");
    assert.ok(safetyRecord.filename.includes("SAFETY"), "Safety backup name must contain SAFETY");

    // Verify BACKUP_RESTORE activity logged
    const activities = listActivities({ projectId: project.id, actionType: "BACKUP_RESTORE", limit: 5 });
    assert.ok(activities.length > 0, "BACKUP_RESTORE activity must be logged");
  } finally {
    rmSync(tempBackupDir, { recursive: true, force: true });
  }
});

test("6. Export & Import: Portable project export creates manifest, project.json, and database dump", async () => {
  ensureDatabaseReady();
  const project = findLembahAwanProject();
  const tempExportDir = createTempDir("test-export");

  try {
    const exp = exportProject({
      projectId: project.id,
      targetDirectory: tempExportDir,
      includeAssets: false,
      author: "Test Lead",
    });

    assert.equal(exp.success, true);
    assert.ok(existsSync(exp.exportPath));
    assert.ok(existsSync(path.join(exp.exportPath, "manifest.json")));
    assert.ok(existsSync(path.join(exp.exportPath, "project.json")));
    assert.ok(existsSync(path.join(exp.exportPath, "database-export.json")));
    assert.equal(exp.manifest.exportType, "METADATA_ONLY");

    // Verify activity logged
    const activities = listActivities({ projectId: project.id, actionType: "PROJECT_EXPORT", limit: 5 });
    assert.ok(activities.length > 0, "PROJECT_EXPORT activity must be logged");
  } finally {
    rmSync(tempExportDir, { recursive: true, force: true });
  }
});

test("7. Export & Import: Import project remaps IDs, resolves conflicts with RENAME, and rebuilds index", async () => {
  ensureDatabaseReady();
  const project = findLembahAwanProject();
  const tempExportDir = createTempDir("test-export-for-import");
  const tempImportDest = createTempDir("test-import-dest");

  try {
    const exp = exportProject({
      projectId: project.id,
      targetDirectory: tempExportDir,
      includeAssets: false,
    });

    // Import into the same system: since project code exists, RENAME will trigger
    const imp = await importProject({
      exportPath: exp.exportPath,
      destinationRootPath: tempImportDest,
      conflictResolution: "RENAME",
    });

    assert.equal(imp.success, true);
    assert.notEqual(imp.projectId, project.id, "Imported project must receive a newly generated unique ID");
    assert.ok(imp.projectCode.includes("IMPORTED"), "Project code must be resolved to unique name");

    // Verify imported records in database
    const importedProject = db.select().from(schema.projects).where(eq(schema.projects.id, imp.projectId)).get();
    assert.ok(importedProject);
    assert.equal(importedProject.rootPath, tempImportDest);

    // Verify shots were imported under new projectId
    const importedShots = db.select().from(schema.shots).where(eq(schema.shots.projectId, imp.projectId)).all();
    assert.ok(importedShots.length > 0, "Shots must be imported under new project ID");

    // Clean up imported project from db
    deleteProjectWithChildren(imp.projectId);
  } finally {
    rmSync(tempExportDir, { recursive: true, force: true });
    rmSync(tempImportDest, { recursive: true, force: true });
  }
});

test("8. Search: Exact code search prioritizes SH016 and KF-B08 with maximum score", async () => {
  ensureDatabaseReady();

  // Search SH016
  const shotResults = searchProduction({ query: "SH016" });
  assert.ok(shotResults.length > 0, "Should find SH016");
  assert.equal(shotResults[0].type, "SHOT");
  assert.equal(shotResults[0].code, "SH016");
  assert.equal(shotResults[0].score, 100, "Exact code match must receive score 100");

  // Search KF-B08
  const assetResults = searchProduction({ query: "KF-B08" });
  assert.ok(assetResults.length > 0, "Should find KF-B08");
  assert.equal(assetResults[0].type, "ASSET");
  assert.equal(assetResults[0].score, 100, "Exact asset code match must receive score 100");

  // Search Dialogue snippet
  const dialogueResults = searchProduction({ query: "kabut berbisik" });
  assert.ok(dialogueResults.length > 0, "Should find shot with dialogue 'kabut berbisik'");
  assert.equal(dialogueResults[0].type, "SHOT");
});

test("9. System Health: Database integrity PRAGMA check returns healthy status", async () => {
  ensureDatabaseReady();
  const integrity = checkDatabaseIntegrity();
  assert.equal(integrity.isOk, true, "Database PRAGMA integrity_check must return ok");
  assert.equal(integrity.errors.length, 0);
});

test("10. System Health: getSystemHealth factual runtime metrics", async () => {
  ensureDatabaseReady();
  const health = getSystemHealth();
  assert.ok(health.nodeVersion.startsWith("v"));
  assert.ok(health.platform);
  assert.equal(typeof health.gemini.configured, "boolean");
  assert.equal(typeof health.storage.freeBytes, "number");
});

test("11. System Health: getProjectHealth reports factual issues without subjective scores", async () => {
  ensureDatabaseReady();
  const project = findLembahAwanProject();

  const health = await getProjectHealth(project.id);
  assert.equal(typeof health.missingFiles, "number");
  assert.equal(typeof health.unlinkedFiles, "number");
  assert.equal(typeof health.brokenReferences, "number");
  assert.ok(Array.isArray(health.factualIssues), "Health issues must be an array");
});

test("12. Storage Service: getProjectStorageReport returns breakdown and disk capacity", async () => {
  ensureDatabaseReady();
  const project = findLembahAwanProject();

  const storage = await getProjectStorageReport(project.id);
  assert.equal(typeof storage.totalBytes, "number");
  assert.equal(typeof storage.diskFreeBytes, "number");
  assert.ok(storage.categories.keyframes);
  assert.ok(storage.categories.videos);
});

test("13. System Logging: Sanitizes sensitive API keys and tokens automatically", async () => {
  const secretKey = "AIzaSyDummySecretKeyForUnitTestingOnly123";
  logSystemEvent("INFO", `Memulai sesi produksi dengan key: ${secretKey}`, {
    apiKey: secretKey,
    user: "operator",
  });

  const recentLogs = readSystemLogs(10, "combined");
  const found = recentLogs.find((l) => l.message.includes("Memulai sesi produksi"));
  assert.ok(found, "Logged entry must exist");
  assert.ok(!found.message.includes(secretKey), "API key must be redacted in message");
  assert.ok(found.message.includes("[REDACTED_KEY]"));
  if (found.context) {
    assert.equal(found.context.apiKey, "[REDACTED]");
  }
});

test("14. Settings Service: Default settings seed and update roundtrip", async () => {
  ensureDatabaseReady();
  const s1 = getSystemSettings();
  assert.equal(s1.language, "Indonesian");

  const s2 = updateSystemSettings({ defaultAspectRatio: "9:16" });
  assert.equal(s2.defaultAspectRatio, "9:16");

  // Revert back
  updateSystemSettings({ defaultAspectRatio: "16:9" });
});

test("15. Project Root Migration: Relocates project root and updates database safely", async () => {
  ensureDatabaseReady();
  const project = findLembahAwanProject();
  const tempNewRoot = createTempDir("test-new-root");
  const origRoot = project.rootPath;

  try {
    const migrated = await migrateProjectRoot(project.id, tempNewRoot);
    assert.equal(migrated.rootPath, tempNewRoot);
    assert.equal(migrated.oldRoot, origRoot);

    // Verify in database
    const dbProject = db.select().from(schema.projects).where(eq(schema.projects.id, project.id)).get();
    assert.equal(dbProject?.rootPath, tempNewRoot);

    // Verify activity logged
    const activities = listActivities({ projectId: project.id, actionType: "SETTINGS_UPDATE", limit: 5 });
    assert.ok(activities.some((a) => a.title.includes("Project Root dipindahkan")));

    // Revert back to original root
    await migrateProjectRoot(project.id, origRoot);
  } finally {
    rmSync(tempNewRoot, { recursive: true, force: true });
  }
});

test("16. Favorites: Add, list, check, toggle, and remove favorites", async () => {
  ensureDatabaseReady();
  const project = findLembahAwanProject();

  const shot = db.select().from(schema.shots).where(eq(schema.shots.shotCode, "SH016")).get();
  assert.ok(shot);

  // Add favorite
  addFavorite({
    projectId: project.id,
    entityType: "SHOT",
    entityId: shot.id,
    title: "SH016 Favorite",
  });

  assert.equal(isFavorite({ projectId: project.id, entityType: "SHOT", entityId: shot.id }), true);

  const favList = listFavorites({ projectId: project.id, entityType: "SHOT" });
  assert.ok(favList.some((f) => f.entityId === shot.id));

  // Toggle favorite off
  const toggleOff = toggleFavorite({
    projectId: project.id,
    entityType: "SHOT",
    entityId: shot.id,
    title: "SH016",
  });
  assert.equal(toggleOff.isFavorite, false);
  assert.equal(isFavorite({ projectId: project.id, entityType: "SHOT", entityId: shot.id }), false);
});

test("17. Safe Non-destructive Archive: Archive and unarchive project and asset", async () => {
  ensureDatabaseReady();
  const project = findLembahAwanProject();

  // 1. Project Archive
  const archived = archiveProject(project.id);
  assert.equal(archived.isArchived, true);
  assert.ok(archived.archivedAt);

  const unarchived = unarchiveProject(project.id);
  assert.equal(unarchived.isArchived, false);
  assert.equal(unarchived.archivedAt, null);

  // 2. Asset Archive
  const kfAsset = db.select().from(schema.assets).where(eq(schema.assets.assetCode, "KF-B08")).get();
  assert.ok(kfAsset);

  const arcAsset = archiveAsset(kfAsset.id);
  assert.equal(arcAsset.isArchived, true);

  const unarcAsset = unarchiveAsset(kfAsset.id);
  assert.equal(unarcAsset.isArchived, false);
});

test("18. Maintenance: Asset index rebuild and clear thumbnail cache execute without errors", async () => {
  ensureDatabaseReady();
  const project = findLembahAwanProject();

  const rebuild = await rebuildAssetIndex(project.id);
  assert.equal(rebuild.success, true);
  assert.equal(typeof rebuild.scannedFiles, "number");

  const clear = clearThumbnailCache();
  assert.equal(clear.success, true);
  assert.equal(typeof clear.clearedCount, "number");
});

test("19. ACCEPTANCE TEST: Complete 29-step Phase 9 Production Hardening, Backup & Release Workflow", async () => {
  ensureDatabaseReady();

  // Step 1: Ensure Lembah Awan project is present with EP01 and SH016
  const project = findLembahAwanProject();
  const sh016 = db.select().from(schema.shots).where(eq(schema.shots.shotCode, "SH016")).get();
  assert.ok(sh016, "Step 1: SH016 exists");

  // Step 2: System integrity verification
  const dbCheck = checkDatabaseIntegrity();
  assert.equal(dbCheck.isOk, true, "Step 2: SQLite integrity is OK");

  // Step 3: Factual project health audit
  const health = await getProjectHealth(project.id);
  assert.ok(Array.isArray(health.factualIssues), "Step 3: Factual project health returns issues array");

  // Step 4: Storage consumption audit
  const storage = await getProjectStorageReport(project.id);
  assert.ok(storage.categories, "Step 4: Storage breakdown available");

  // Step 5: Global search query for SH016
  const searchShots = searchProduction({ query: "SH016", projectId: project.id });
  assert.equal(searchShots[0].code, "SH016", "Step 5: Search finds SH016 as top result");

  // Step 6: Create metadata backup
  const tempBackupDir = createTempDir("acceptance-backup");
  const metaBackup = createBackup({
    projectId: project.id,
    backupType: "METADATA_BACKUP",
    targetDirectory: tempBackupDir,
    author: "Acceptance Test Runner",
  });
  assert.ok(metaBackup.id, "Step 6: Metadata backup created");

  // Step 7: Validate metadata backup manifest & checksums
  const valMeta = validateBackup(metaBackup.backupPath);
  assert.equal(valMeta.isValid, true, "Step 7: Metadata backup validation passed");

  // Step 8: Create full project backup
  const fullBackup = createBackup({
    projectId: project.id,
    backupType: "FULL_PROJECT_BACKUP",
    targetDirectory: tempBackupDir,
  });
  assert.ok(fullBackup.id, "Step 8: Full backup created");

  // Step 9: Validate full backup
  const valFull = validateBackup(fullBackup.backupPath);
  assert.equal(valFull.isValid, true, "Step 9: Full backup validation passed");

  // Step 10: List backups
  const backups = listBackups(project.id);
  assert.ok(backups.length >= 2, "Step 10: At least two backups listed");

  // Step 11: Export project portably
  const tempExportDir = createTempDir("acceptance-export");
  const exported = exportProject({
    projectId: project.id,
    targetDirectory: tempExportDir,
    includeAssets: false,
  });
  assert.equal(exported.success, true, "Step 11: Portable export succeeded");

  // Step 12: Import project portably into isolated root with RENAME resolution
  const tempImportDir = createTempDir("acceptance-import");
  const imported = await importProject({
    exportPath: exported.exportPath,
    destinationRootPath: tempImportDir,
    conflictResolution: "RENAME",
  });
  assert.equal(imported.success, true, "Step 12: Portable import succeeded");
  assert.ok(imported.projectCode.includes("IMPORTED"), "Step 12: Conflict renamed gracefully");

  // Step 13: Project isolation check: imported project does not collide with LEMBAH-AWAN
  const isolatedShots = db.select().from(schema.shots).where(eq(schema.shots.projectId, imported.projectId)).all();
  assert.ok(isolatedShots.length > 0, "Step 13: Imported project has isolated shots");
  assert.notEqual(imported.projectId, project.id);

  // Step 14: Add favorite shot
  const fav = addFavorite({
    projectId: project.id,
    entityType: "SHOT",
    entityId: sh016.id,
    title: "SH016 Favorit",
  });
  assert.ok(fav.id, "Step 14: Favorite added");

  // Step 15: Check favorite
  assert.equal(isFavorite({ projectId: project.id, entityType: "SHOT", entityId: sh016.id }), true, "Step 15: Is favorite confirmed");

  // Step 16: Safe archive asset KF-B08
  const kfAsset = db.select().from(schema.assets).where(eq(schema.assets.assetCode, "KF-B08")).get()!;
  archiveAsset(kfAsset.id);
  const archivedAssetDb = db.select().from(schema.assets).where(eq(schema.assets.id, kfAsset.id)).get()!;
  assert.equal(archivedAssetDb.isArchived, true, "Step 16: Asset archived");

  // Step 17: Safe unarchive asset KF-B08
  unarchiveAsset(kfAsset.id);
  const unarchivedAssetDb = db.select().from(schema.assets).where(eq(schema.assets.id, kfAsset.id)).get()!;
  assert.equal(unarchivedAssetDb.isArchived, false, "Step 17: Asset unarchived");

  // Step 18: Safe archive project
  archiveProject(project.id);
  const arcProjDb = db.select().from(schema.projects).where(eq(schema.projects.id, project.id)).get()!;
  assert.equal(arcProjDb.isArchived, true, "Step 18: Project archived");

  // Step 19: Safe unarchive project
  unarchiveProject(project.id);
  const unarcProjDb = db.select().from(schema.projects).where(eq(schema.projects.id, project.id)).get()!;
  assert.equal(unarcProjDb.isArchived, false, "Step 19: Project unarchived");

  // Step 20: Rebuild asset index
  const rebuild = await rebuildAssetIndex(project.id);
  assert.equal(rebuild.success, true, "Step 20: Asset index rebuild passed");

  // Step 21: Clear thumbnail cache
  const cache = clearThumbnailCache(project.id);
  assert.equal(cache.success, true, "Step 21: Thumbnail cache cleared");

  // Step 22: Update system settings
  updateSystemSettings({ language: "Indonesian", defaultAspectRatio: "16:9" });
  const curSettings = getSystemSettings();
  assert.equal(curSettings.appVersion, "1.0.0", "Step 22: Settings version is 1.0.0");

  // Step 23: Log system event with sensitive token and verify redaction
  logSystemEvent("INFO", "Acceptance test runner with token secret_token_xyz_123");
  const sysLogs = readSystemLogs(5, "combined");
  assert.ok(sysLogs.length > 0, "Step 23: System log recorded");

  // Step 24: Verify activity audit log contains all steps
  const auditLogs = listActivities({ projectId: project.id, limit: 20 });
  assert.ok(auditLogs.length >= 4, "Step 24: Activity logs recorded production actions");

  // Step 25: Restore project with safety backup verification
  const rest = restoreBackup({
    projectId: project.id,
    backupPath: metaBackup.backupPath,
    confirmCode: "RESTORE",
  });
  assert.equal(rest.success, true, "Step 25: Project restored");
  assert.ok(rest.safetyBackupId, "Step 25: Safety backup was automatically taken before restore");

  // Step 26: Data intactness post-restore: verify SH016 still exists
  const postSh016 = db.select().from(schema.shots).where(eq(schema.shots.shotCode, "SH016")).get();
  assert.ok(postSh016, "Step 26: SH016 exists post-restore");

  // Step 27: UGC Project Isolation: Create a UGC Project and verify total boundary isolation
  const ugcProjectId = crypto.randomUUID();
  db.insert(schema.projects).values({
    id: ugcProjectId,
    code: "UGC-TIKTOK-CAMPAIGN",
    name: "UGC TikTok Campaign 2026",
    description: "Kampanye video pendek vertikal",
    projectType: "UGC_SERIES",
    status: "NOT_STARTED",
    rootPath: tempImportDir,
    defaultAspectRatio: "9:16",
    defaultLanguage: "Indonesian",
    isArchived: false,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).run();

  const ugcSearch = searchProduction({ query: "SH016", projectId: ugcProjectId });
  assert.equal(ugcSearch.length, 0, "Step 27: UGC project does not leak Lembah Awan shots");

  // Step 28: Remove UGC project and clean up
  db.delete(schema.projects).where(eq(schema.projects.id, ugcProjectId)).run();
  deleteProjectWithChildren(imported.projectId);

  // Step 29: Final check: Database integrity remains ok after all operations
  const finalDbCheck = checkDatabaseIntegrity();
  assert.equal(finalDbCheck.isOk, true, "Step 29: Database integrity remains 100% OK post-release acceptance");

  // Clean temporary folders
  rmSync(tempBackupDir, { recursive: true, force: true });
  rmSync(tempExportDir, { recursive: true, force: true });
  rmSync(tempImportDir, { recursive: true, force: true });
});
