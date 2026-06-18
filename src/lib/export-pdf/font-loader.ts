import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument } from "pdf-lib";
import { readBinaryFile } from "@/lib/file-service";
import type { PdfFonts } from "./types";

const BODY_CANDIDATES = [
  "/Library/Fonts/Arial Unicode.ttf",
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
];

const MONO_CANDIDATES = [
  "/System/Library/Fonts/Monaco.ttf",
];

async function readFirstAvailable(candidates: string[]): Promise<Uint8Array> {
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

export async function loadPdfFonts(pdfDoc: PDFDocument): Promise<PdfFonts> {
  pdfDoc.registerFontkit(fontkit);

  const [bodyBytes, monoBytes] = await Promise.all([
    readFirstAvailable(BODY_CANDIDATES),
    readFirstAvailable(MONO_CANDIDATES),
  ]);

  const [body, bodyBold, mono] = await Promise.all([
    pdfDoc.embedFont(bodyBytes, { subset: true }),
    // Bold uses same font face — Arial Unicode has only one weight.
    // A follow-up can add TTC face extraction (e.g., STHeitiSC-Medium) for true bold.
    pdfDoc.embedFont(bodyBytes, { subset: true }),
    pdfDoc.embedFont(monoBytes, { subset: true }),
  ]);

  return { body, bodyBold, mono };
}
