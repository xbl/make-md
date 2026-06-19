import { readBinaryFile } from "@/lib/file-service";

export const BODY_CANDIDATES = [
  "/Library/Fonts/Arial Unicode.ttf",
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
];

export const MONO_CANDIDATES = [
  "/System/Library/Fonts/Monaco.ttf",
];

export async function readFirstAvailable(candidates: string[]): Promise<Uint8Array> {
  for (const path of candidates) {
    try {
      return await readBinaryFile(path);
    } catch {
      continue;
    }
  }
  throw new Error(
    `Could not find a required system font. Tried: ${candidates.join(", ")}`,
  );
}
