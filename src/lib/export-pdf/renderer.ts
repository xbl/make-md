import { rgb } from "pdf-lib";
import type { PageEngine } from "./page-engine";
import type { PdfFonts, PageConfig, LayoutLine, RgbColor, FormattedRun } from "./types";
import { COLORS, PAGE_CONFIG } from "./types";
import { layoutRichText, flattenInlineTokens, wrapLines, measureLineHeight } from "./text-layout";

// ── Block type (mirrors export-pdf.ts PfdBlock) ──

export type PfdBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: number; text: string }
  | { type: "listItem"; text: string; ordered: boolean; level: number; number?: number }
  | { type: "blockquote"; text: string }
  | { type: "code"; language: string; text: string }
  | { type: "mermaid"; code: string; png: Uint8Array }
  | { type: "image"; alt: string; png: Uint8Array }
  | { type: "table"; rows: string[][]; headerRowCount: number };

export interface PdfExportPayload {
  title: string;
  blocks: PfdBlock[];
}

export interface RenderContext {
  engine: PageEngine;
  fonts: PdfFonts;
  config: PageConfig;
}

// ── Heading config ──

const HEADING_SIZES: Record<number, { size: number; before: number; after: number; rule?: boolean }> = {
  1: { size: 22, before: 24, after: 8 },
  2: { size: 16.5, before: 20, after: 6, rule: true },
  3: { size: 13.75, before: 16, after: 4 },
  4: { size: 12.1, before: 14, after: 4 },
  5: { size: 11, before: 12, after: 2 },
  6: { size: 10.45, before: 10, after: 2 },
};

const HEADING_LINE_HEIGHT = 1.2;

// ── Helpers ──

function headingFont(level: number, fonts: PdfFonts) {
  return level <= 2 ? fonts.bodyBold : fonts.bodyBold;
}

function drawLayoutLine(
  engine: PageEngine,
  line: LayoutLine,
  y: number,
): void {
  let x = engine.contentLeft;
  for (const run of line.runs) {
    const runWidth = run.font.widthOfTextAtSize(run.text, run.fontSize);
    engine.drawText(run.text, x, y, run.font, run.fontSize, run.color);
    if (run.strikethrough) {
      engine.drawStrikethrough(x, y, runWidth, run.fontSize, run.color);
    }
    x += runWidth;
  }
}

function drawRichText(
  engine: PageEngine,
  fonts: PdfFonts,
  text: string,
  fontSize: number,
  y: number,
  maxWidth: number,
  lineHeightFactor: number,
  font: "body" | "bodyBold" | "mono" = "body",
  color?: RgbColor,
): number {
  const { lines } = layoutRichText(text, fonts, fontSize, maxWidth, lineHeightFactor, font, color);
  const lineAdvance = measureLineHeight(fonts, fontSize, lineHeightFactor);
  let lineY = y;

  for (const line of lines) {
    drawLayoutLine(engine, line, lineY);
    lineY -= lineAdvance;
  }

  return lines.length * lineAdvance;
}

function measureRichTextHeight(
  fonts: PdfFonts,
  text: string,
  fontSize: number,
  maxWidth: number,
  lineHeightFactor = 1.78,
  font: "body" | "bodyBold" | "mono" = "body",
): number {
  const { totalHeight } = layoutRichText(text, fonts, fontSize, maxWidth, lineHeightFactor, font);
  return totalHeight;
}

// ── Block renderers ──

function renderHeading(
  block: Extract<PfdBlock, { type: "heading" }>,
  ctx: RenderContext,
): void {
  const { engine, fonts, config } = ctx;
  const h = HEADING_SIZES[Math.min(block.level, 6)] ?? HEADING_SIZES[6]!;
  const font = headingFont(block.level, fonts);
  const textHeight = measureRichTextHeight(
    fonts, block.text, h.size, config.contentWidth, HEADING_LINE_HEIGHT, "bodyBold",
  );

  engine.ensureSpace(h.before + textHeight + h.after + config.bodyLineHeight);
  engine.advanceY(h.before);

  const consumed = drawRichText(
    engine, fonts, block.text, h.size,
    engine.currentY, config.contentWidth, HEADING_LINE_HEIGHT, "bodyBold",
  );
  engine.advanceY(consumed);

  if (h.rule) {
    engine.advanceY(4);
    engine.drawRule(engine.currentY, COLORS.border, 0.75);
    engine.advanceY(0);
  }

  engine.advanceY(h.after);
}

function renderParagraph(
  block: Extract<PfdBlock, { type: "paragraph" }>,
  ctx: RenderContext,
): void {
  const { engine, fonts, config } = ctx;
  const textHeight = measureRichTextHeight(fonts, block.text, config.bodyFontSize, config.contentWidth);

  engine.ensureSpace(6 + textHeight + 6);
  engine.advanceY(6);

  const consumed = drawRichText(
    engine, fonts, block.text, config.bodyFontSize,
    engine.currentY, config.contentWidth, 1.78,
  );
  engine.advanceY(consumed);
  engine.advanceY(6);
}

function renderCodeBlock(
  block: Extract<PfdBlock, { type: "code" }>,
  ctx: RenderContext,
): void {
  const { engine, fonts, config } = ctx;
  const lines = block.text.split("\n");
  const codeLineAdvance = config.codeLineHeight;
  const padX = 12;
  const padY = 10;
  const codeAreaWidth = config.contentWidth;

  // Measure max line width
  let maxLineWidth = 0;
  for (const line of lines) {
    const w = fonts.mono.widthOfTextAtSize(line || " ", config.codeFontSize);
    if (w > maxLineWidth) maxLineWidth = w;
  }
  const bgWidth = Math.min(codeAreaWidth, maxLineWidth + padX * 2 + 4);

  const totalHeight = lines.length * codeLineAdvance + padY * 2;

  // Page breaking: keep at least 6 lines together
  const minKeep = codeLineAdvance * Math.min(6, lines.length) + padY * 2;
  engine.ensureSpace(16 + Math.max(minKeep, totalHeight) + 14);

  engine.advanceY(16);

  const rectTop = engine.currentY;
  const rectBottom = rectTop - totalHeight;

  // Background
  engine.drawRect(
    config.contentLeft,
    rectTop,
    bgWidth,
    totalHeight,
    COLORS.codeBg,
    COLORS.border,
  );

  // Draw code lines
  let codeY = rectTop - padY - fonts.mono.heightAtSize(config.codeFontSize) * 0.8;
  for (const line of lines) {
    engine.drawText(
      line || " ",
      config.contentLeft + padX,
      codeY,
      fonts.mono,
      config.codeFontSize,
      COLORS.codeText,
    );
    codeY -= codeLineAdvance;
  }

  engine.advanceY(totalHeight);
  engine.advanceY(14);
}

async function renderImage(
  block: Extract<PfdBlock, { type: "image" }> | Extract<PfdBlock, { type: "mermaid" }>,
  ctx: RenderContext,
): Promise<void> {
  const { engine, config } = ctx;
  const pngBytes = block.png;

  let pdfImage;
  try {
    pdfImage = await engine.doc.embedPng(pngBytes);
  } catch {
    return;
  }

  const nativeW = pdfImage.width;
  const nativeH = pdfImage.height;
  const maxWidth = config.contentWidth;
  const maxHeight = config.contentHeight * 0.8;

  let displayW = nativeW;
  let displayH = nativeH;

  if (displayW > maxWidth) {
    displayH = displayH * (maxWidth / displayW);
    displayW = maxWidth;
  }
  if (displayH > maxHeight) {
    displayW = displayW * (maxHeight / displayH);
    displayH = maxHeight;
  }

  const imageHeight = displayH;

  engine.ensureSpace(18 + imageHeight + 14);
  engine.advanceY(18);

  const x = config.contentLeft + (config.contentWidth - displayW) / 2;
  // pdf-lib drawImage uses bottom-left y, so image bottom = currentY - displayH
  const imageBottom = engine.currentY - displayH;

  engine.currentPage.drawImage(pdfImage, {
    x,
    y: imageBottom,
    width: displayW,
    height: displayH,
  });

  engine.advanceY(imageHeight);

  // Alt text caption (image blocks only)
  const alt = "alt" in block ? (block as Extract<PfdBlock, { type: "image" }>).alt : "";
  if (alt && alt.trim()) {
    engine.advanceY(4);
    const capHeight = measureRichTextHeight(ctx.fonts, alt, 8, config.contentWidth, 1.2);
    drawRichText(ctx.engine, ctx.fonts, alt, 8, engine.currentY, config.contentWidth, 1.2, "body", COLORS.textSecondary);
    engine.advanceY(capHeight);
  }

  engine.advanceY(14);
}

function renderTable(
  block: Extract<PfdBlock, { type: "table" }>,
  ctx: RenderContext,
): void {
  const { engine, fonts, config } = ctx;
  const rows = block.rows;
  const headerCount = Math.min(block.headerRowCount, rows.length);
  const fontSize = 10;
  const cellPadX = 6;
  const cellPadY = 4;
  const lineAdvance = measureLineHeight(fonts, fontSize, 1.4);
  const minColWidth = 40;

  if (rows.length === 0) return;

  const colCount = Math.max(...rows.map((r) => r.length));
  const normalizedRows = rows.map((r) => {
    const filled = [...r];
    while (filled.length < colCount) filled.push("");
    return filled;
  });

  // Measure column widths: max content width per column
  const colWidths: number[] = new Array(colCount).fill(minColWidth);
  for (const row of normalizedRows) {
    for (let ci = 0; ci < colCount; ci++) {
      const cellText = row[ci] ?? "";
      const runWidth = fonts.body.widthOfTextAtSize(cellText, fontSize);
      colWidths[ci] = Math.max(colWidths[ci]!, runWidth + cellPadX * 2);
    }
  }

  // Scale columns down if total > contentWidth
  const totalColWidth = colWidths.reduce((a, b) => a + b, 0);
  if (totalColWidth > config.contentWidth) {
    const scale = config.contentWidth / totalColWidth;
    for (let ci = 0; ci < colCount; ci++) {
      colWidths[ci] = Math.max(minColWidth, colWidths[ci]! * scale);
    }
  }

  // Calculate row heights
  const rowHeights = normalizedRows.map((row) => {
    let maxH = lineAdvance;
    for (let ci = 0; ci < colCount; ci++) {
      const cellText = row[ci] ?? "";
      const colW = colWidths[ci]! - cellPadX * 2;
      const textH = measureRichTextHeight(fonts, cellText, fontSize, Math.max(1, colW), 1.4);
      maxH = Math.max(maxH, textH + cellPadY * 2);
    }
    return maxH;
  });

  const totalTableHeight = rowHeights.reduce((a, b) => a + b, 0);

  // Page breaking: header + 2 rows must fit
  const minKeep = rowHeights.slice(0, Math.min(headerCount + 2, rowHeights.length)).reduce((a, b) => a + b, 0);
  engine.ensureSpace(16 + Math.max(minKeep, totalTableHeight) + 14);
  engine.advanceY(16);

  const tableLeft = config.contentLeft;
  let rowY = engine.currentY;

  // Accumulated column x positions
  const colX: number[] = [];
  let cx = tableLeft;
  for (let ci = 0; ci < colCount; ci++) {
    colX.push(cx);
    cx += colWidths[ci]!;
  }

  for (let ri = 0; ri < normalizedRows.length; ri++) {
    const row = normalizedRows[ri]!;
    const rowH = rowHeights[ri]!;
    const isHeader = ri < headerCount;

    // Draw cell backgrounds
    for (let ci = 0; ci < colCount; ci++) {
      const bgColor = isHeader ? COLORS.tableHeaderBg : undefined;
      const borderClr = COLORS.border;
      // Draw border (thin rect outline)
      engine.currentPage.drawRectangle({
        x: colX[ci]!,
        y: rowY - rowH,
        width: colWidths[ci]!,
        height: rowH,
        color: bgColor ? rgb(bgColor.r, bgColor.g, bgColor.b) : undefined,
        borderColor: rgb(borderClr.r, borderClr.g, borderClr.b),
        borderWidth: 0.5,
      });
    }

    // Draw cell text
    for (let ci = 0; ci < colCount; ci++) {
      const cellText = row[ci] ?? "";
      const cellFont = isHeader ? fonts.bodyBold : fonts.body;
      const cellW = colWidths[ci]! - cellPadX * 2;
      const textBottom = rowY - cellPadY - cellFont.heightAtSize(fontSize) * 0.2;

      drawRichText(
        engine, fonts, cellText, fontSize,
        textBottom, Math.max(1, cellW), 1.4,
        isHeader ? "bodyBold" : "body",
      );
    }

    rowY -= rowH;
  }

  engine.advanceY(totalTableHeight);
  engine.advanceY(14);
}

function renderBlockquote(
  block: Extract<PfdBlock, { type: "blockquote" }>,
  ctx: RenderContext,
): void {
  const { engine, fonts, config } = ctx;
  const indent = 12;
  const borderWidth = 3;
  const textWidth = config.contentWidth - borderWidth - indent;
  const textHeight = measureRichTextHeight(fonts, block.text, config.bodyFontSize, textWidth);

  engine.ensureSpace(16 + textHeight + 14);
  engine.advanceY(16);

  const topY = engine.currentY;
  const consumed = drawRichText(
    engine, fonts, block.text, config.bodyFontSize,
    topY, textWidth, 1.78, "body", COLORS.quoteText,
  );
  const bottomY = topY - consumed;

  // Draw left border
  engine.currentPage.drawLine({
    start: { x: config.contentLeft, y: topY },
    end: { x: config.contentLeft, y: bottomY },
    color: rgb(COLORS.quoteBorder.r, COLORS.quoteBorder.g, COLORS.quoteBorder.b),
    thickness: borderWidth,
  });

  engine.advanceY(consumed);
  engine.advanceY(14);
}

function renderListGroup(
  items: Extract<PfdBlock, { type: "listItem" }>[],
  ctx: RenderContext,
): void {
  const { engine, fonts, config } = ctx;
  const fontSize = config.bodyFontSize;
  const indentPerLevel = 24;
  const itemSpacing = 4;

  // Measure total height
  let totalH = 0;
  for (const item of items) {
    const bulletWidth = 12;
    const textWidth = config.contentWidth - (item.level + 1) * indentPerLevel - bulletWidth;
    const itemH = measureRichTextHeight(fonts, item.text, fontSize, Math.max(1, textWidth));
    totalH += itemH + itemSpacing;
  }

  engine.ensureSpace(12 + totalH);
  engine.advanceY(12);

  let orderedCounter = 0;
  let lastOrderedLevel = -1;

  for (const item of items) {
    const bulletWidth = 12;
    const levelIndent = item.level * indentPerLevel;
    const textX = config.contentLeft + levelIndent + bulletWidth;
    const textWidth = config.contentRight - textX;

    const itemH = measureRichTextHeight(fonts, item.text, fontSize, Math.max(1, textWidth));

    // Reset ordered counter when starting a new ordered list level
    if (item.ordered && item.level !== lastOrderedLevel) {
      orderedCounter = 0;
    }
    lastOrderedLevel = item.level;

    // Draw bullet or number
    let marker: string;
    if (item.ordered) {
      orderedCounter += 1;
      marker = `${orderedCounter}.`;
    } else {
      const bullets = ["•", "◦", "▪"];
      marker = bullets[Math.min(item.level, bullets.length - 1)] ?? "•";
    }

    engine.drawText(
      marker,
      config.contentLeft + levelIndent,
      engine.currentY - fonts.body.heightAtSize(fontSize) * 0.8,
      fonts.body,
      fontSize,
    );

    // Draw item text
    drawRichText(engine, fonts, item.text, fontSize, engine.currentY, Math.max(1, textWidth), 1.78);

    engine.advanceY(itemH + itemSpacing);
  }

  // Remove trailing item spacing
  engine.retractY(itemSpacing);
  engine.advanceY(6);
}

// ── Main render loop ──

export async function renderBlocks(payload: PdfExportPayload, ctx: RenderContext): Promise<void> {
  const blocks = payload.blocks;
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i]!;

    // Group consecutive list items
    if (block.type === "listItem") {
      const group: Extract<PfdBlock, { type: "listItem" }>[] = [];
      while (i < blocks.length && blocks[i]!.type === "listItem") {
        group.push(blocks[i]! as Extract<PfdBlock, { type: "listItem" }>);
        i++;
      }
      renderListGroup(group, ctx);
      continue;
    }

    switch (block.type) {
      case "heading":
        renderHeading(block, ctx);
        break;
      case "paragraph":
        renderParagraph(block, ctx);
        break;
      case "code":
        renderCodeBlock(block, ctx);
        break;
      case "image":
      case "mermaid":
        await renderImage(block, ctx);
        break;
      case "table":
        renderTable(block, ctx);
        break;
      case "blockquote":
        renderBlockquote(block, ctx);
        break;
    }
    i++;
  }
}
