import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { PageEngine } from "./page-engine";
import { renderBlocks } from "./renderer";
import type { PfdBlock, PdfExportPayload } from "./renderer";
import type { PageConfig, PdfFonts } from "./types";

interface WorkerInput {
  blocks: PfdBlock[];
  title: string;
  bodyFontBytes: ArrayBuffer;
  monoFontBytes: ArrayBuffer;
  config: PageConfig;
}

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  try {
    const { blocks, title, bodyFontBytes, monoFontBytes, config } = e.data;

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const [body, bodyBold, mono] = await Promise.all([
      pdfDoc.embedFont(bodyFontBytes, { subset: true }),
      pdfDoc.embedFont(bodyFontBytes, { subset: true }),
      pdfDoc.embedFont(monoFontBytes, { subset: true }),
    ]);

    const fonts: PdfFonts = { body, bodyBold, mono };
    const engine = new PageEngine(pdfDoc, fonts, config);
    const payload: PdfExportPayload = { title, blocks };

    await renderBlocks(payload, { engine, fonts, config });

    const pdfBytes = await pdfDoc.save();

    self.postMessage({ pdfBytes }, { transfer: [pdfBytes.buffer] });
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) });
  }
};
