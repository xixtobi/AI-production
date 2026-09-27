import "server-only";

import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { DomainError } from "@/lib/projects/domain-error";

export function getGoogleFlowUrl(): string {
  return process.env.GOOGLE_FLOW_URL || "https://flow.google.com/";
}

interface ExecError extends Error {
  code?: number | string;
}

function launch(args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    execFile("explorer.exe", args, { windowsHide: true }, (error) => {
      // In Windows, explorer.exe often returns exit code 1 even when successfully opening a folder/file
      if (error && (error as ExecError).code !== 1) {
        reject(new DomainError("Windows Explorer tidak dapat dibuka."));
      } else {
        resolve();
      }
    });
  });
}

export async function openGoogleFlowInBrowser(): Promise<{ url: string }> {
  const url = getGoogleFlowUrl();
  return new Promise<{ url: string }>((resolve, reject) => {
    execFile("cmd.exe", ["/c", "start", "", url], { windowsHide: true }, (error) => {
      if (error) {
        reject(new DomainError(`Gagal membuka browser untuk URL: ${url}`));
      } else {
        resolve({ url });
      }
    });
  });
}

export async function revealFileInExplorer(targetPath: string): Promise<void> {
  const resolved = path.resolve(targetPath);
  if (!existsSync(resolved)) {
    throw new DomainError(`File tidak ditemukan di disk: ${resolved}`);
  }
  await launch([`/select,${resolved}`]);
}

export async function openFolderInExplorer(targetFolder: string): Promise<void> {
  const resolved = path.resolve(targetFolder);
  if (!existsSync(resolved)) {
    throw new DomainError(`Folder tidak ditemukan di disk: ${resolved}`);
  }
  await launch([resolved]);
}

export async function openFileInDefaultApp(targetFile: string): Promise<void> {
  const resolved = path.resolve(targetFile);
  if (!existsSync(resolved)) {
    throw new DomainError(`File tidak ditemukan di disk: ${resolved}`);
  }
  return new Promise<void>((resolve, reject) => {
    execFile("cmd.exe", ["/c", "start", "", resolved], { windowsHide: true }, (error) => {
      if (error) reject(new DomainError("Gagal membuka file dengan aplikasi bawaan."));
      else resolve();
    });
  });
}

export async function copyTextToWindowsClipboard(text: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      const child = spawn("clip.exe", [], { shell: false, windowsHide: true, stdio: ["pipe", "ignore", "ignore"] });
      child.on("error", () => reject(new DomainError("Gagal menyalin ke clipboard Windows.")));
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new DomainError(`clip.exe keluar dengan kode ${code}`));
      });
      child.stdin.end(text);
    } catch {
      reject(new DomainError("Gagal menjalankan clip.exe."));
    }
  });
}
