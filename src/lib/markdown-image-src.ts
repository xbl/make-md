import { convertFileSrc, isTauri } from "@tauri-apps/api/core";

function normalizePath(path: string) {
  return path.replace(/\\/g, "/");
}

function decodeLocalPath(path: string) {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

function resolveRelativePath(fromDir: string, target: string) {
  const baseParts = normalizePath(fromDir).split("/").filter(Boolean);
  const targetParts = normalizePath(target).split("/");
  for (const part of targetParts) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      baseParts.pop();
      continue;
    }
    baseParts.push(part);
  }
  return `/${baseParts.join("/")}`;
}

function encodeFileUrlPath(path: string) {
  return encodeURI(normalizePath(path));
}

export function resolveMarkdownImagePath(src: string, docPath?: string) {
  const localSrc = decodeLocalPath(src);

  if (localSrc.startsWith("/")) {
    return normalizePath(localSrc);
  }

  if (!docPath) {
    return localSrc;
  }

  const docDir = normalizePath(docPath).replace(/\/[^/]*$/, "");
  return resolveRelativePath(docDir, localSrc);
}

export function resolveMarkdownImageDisplaySrc(src: string, docPath?: string) {
  if (/^(https?:|data:|blob:)/i.test(src)) {
    return src;
  }

  const resolvedPath = resolveMarkdownImagePath(src, docPath);
  if (!resolvedPath.startsWith("/")) {
    return resolvedPath;
  }

  return isTauri() ? convertFileSrc(resolvedPath) : `file://${encodeFileUrlPath(resolvedPath)}`;
}
