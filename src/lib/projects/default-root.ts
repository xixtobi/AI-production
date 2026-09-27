export const DEFAULT_PROJECTS_ROOT = "D:\\AI-PRODUCTION";

export function getDefaultProjectRoot(code: string) {
  const folderName = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "-");
  return `${DEFAULT_PROJECTS_ROOT}\\${folderName || "PROJECT"}`;
}
