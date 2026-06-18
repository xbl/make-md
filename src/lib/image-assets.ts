import { resolveMarkdownImagePath } from "@/lib/markdown-image-src";

function extractPathFromAssetUrl(src: string): string | null {
  const match = src.match(/^asset:\/*localhost\/(.+)/i);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function resolveImageAbsolutePath(docPath: string | undefined, src: string): string | null {
  if (/^(https?:|data:|blob:)/i.test(src)) return null;

  // Handle Tauri asset:// URLs (from copy/paste between documents)
  const assetPath = extractPathFromAssetUrl(src);
  const resolved = resolveMarkdownImagePath(assetPath ?? src, docPath);
  return resolved.startsWith("/") ? resolved : null;
}

export function assetRelativePath(docPath: string, absoluteAssetPath: string): string {
  const docDir = docPath.replace(/[/\\][^/\\]+$/, "");
  const normalized = absoluteAssetPath.replace(/\\/g, "/");
  const relative = normalized.startsWith(docDir)
    ? normalized.slice(docDir.length).replace(/^[/\\]/, "")
    : normalized;
  return relative.startsWith(".") ? relative : `./${relative}`;
}

export async function copyImageAsset(docPath: string, sourcePath: string) {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("copy_image_asset", { docPath, sourcePath });
}

export async function copyImageBytes(docPath: string, bytes: number[], ext: string) {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("copy_image_bytes", { docPath, bytes, ext });
}
