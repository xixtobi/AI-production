export const supportedExtensions = new Set([
  ".png", ".jpg", ".jpeg", ".webp",
  ".mp4", ".mov", ".webm", ".mkv",
  ".wav", ".mp3", ".m4a", ".flac",
  ".txt", ".md", ".json", ".pdf",
]);

export const ignoredDirectoryNames = new Set([
  "production-control", ".cache", "node_modules", ".git", "backup", "temp", "tmp",
]);

export const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);
export const videoExtensions = new Set([".mp4", ".mov", ".webm", ".mkv"]);
export const audioExtensions = new Set([".wav", ".mp3", ".m4a", ".flac"]);

export const mimeByExtension: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".mkv": "video/x-matroska",
  ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".flac": "audio/flac",
  ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".json": "application/json", ".pdf": "application/pdf",
};
