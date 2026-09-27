import "server-only";

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { DomainError } from "@/lib/projects/domain-error";
import { imageExtensions, mimeByExtension } from "./config";

export async function sha256File(filePath: string) {
  const hash = createHash("sha256");
  try {
    for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer);
  } catch {
    throw new DomainError("File tidak dapat dibaca. Mungkin sedang digunakan aplikasi lain.");
  }
  return hash.digest("hex");
}

export async function readFileMetadata(filePath: string, sizeBytes?: number) {
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = mimeByExtension[extension] ?? "application/octet-stream";
  let width: number | null = null;
  let height: number | null = null;
  if (imageExtensions.has(extension)) {
    try {
      const metadata = await sharp(filePath, { limitInputPixels: 100_000_000, failOn: "error" }).metadata();
      width = metadata.width ?? null;
      height = metadata.height ?? null;
      if (!width || !height) throw new Error("Missing image dimensions");
    } catch {
      throw new DomainError("File gambar tidak dapat dibaca atau rusak.");
    }
  }
  const sha256 = await sha256File(filePath);
  const measuredSize = sizeBytes ?? (await stat(filePath)).size;
  return {
    filename: path.basename(filePath),
    mimeType,
    sizeBytes: measuredSize,
    width,
    height,
    sha256,
  };
}
