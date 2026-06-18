import type { PDFDocument, PDFPage, PDFFont } from "pdf-lib";
import { rgb } from "pdf-lib";
import type { PageConfig, PdfFonts, RgbColor } from "./types";
import { PAGE_CONFIG, COLORS } from "./types";

export class PageEngine {
  readonly doc: PDFDocument;
  readonly fonts: PdfFonts;
  readonly config: PageConfig;
  private _currentPage: PDFPage;
  private _y: number;
  private _pageNumber = 1;

  constructor(doc: PDFDocument, fonts: PdfFonts, config: PageConfig = PAGE_CONFIG) {
    this.doc = doc;
    this.fonts = fonts;
    this.config = config;
    this._currentPage = doc.addPage([config.pageWidth, config.pageHeight]);
    // cursor starts at top of content area
    this._y = this.contentTop;
  }

  get contentWidth(): number {
    return this.config.contentWidth;
  }

  get contentLeft(): number {
    return this.config.contentLeft;
  }

  get contentRight(): number {
    return this.config.contentRight;
  }

  get contentTop(): number {
    return this.config.pageHeight - this.config.marginTop;
  }

  get contentBottom(): number {
    return this.config.marginBottom;
  }

  get currentY(): number {
    return this._y;
  }

  get currentPage(): PDFPage {
    return this._currentPage;
  }

  get pageNumber(): number {
    return this._pageNumber;
  }

  /** Remaining vertical space on current page from cursor to bottom margin. */
  remainingSpace(): number {
    return this._y - this.contentBottom;
  }

  /** Ensure `needed` points are available. If not, add a new page. */
  ensureSpace(needed: number): void {
    if (this.remainingSpace() < needed) {
      this.newPage();
    }
  }

  /** Start a new page and reset cursor to top margin. */
  newPage(): void {
    this._currentPage = this.doc.addPage([this.config.pageWidth, this.config.pageHeight]);
    this._pageNumber += 1;
    this._y = this.contentTop;
  }

  /** Move the cursor down by `delta` points. */
  advanceY(delta: number): void {
    this._y -= delta;
  }

  /** Move the cursor up by `delta` points. */
  retractY(delta: number): void {
    this._y += delta;
  }

  // ── Drawing primitives (y from page bottom!) ──

  toPageY(y: number): number {
    return y;
  }

  /** Draw text at a specific top-down y position. */
  drawText(text: string, x: number, y: number, font: PDFFont, size: number, color?: RgbColor): void {
    const clr = color ?? COLORS.text;
    this._currentPage.drawText(text, {
      x,
      y: this.toPageY(y),
      font,
      size,
      color: rgb(clr.r, clr.g, clr.b),
    });
  }

  /** Draw a filled rectangle. (x, y) is top-left corner, width/height extend down/right. */
  drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: RgbColor,
    borderColor?: RgbColor,
  ): void {
    if (borderColor) {
      // Border: draw filled rect then stroke
      this._currentPage.drawRectangle({
        x,
        y: this.toPageY(y) - height,
        width,
        height,
        color: rgb(color.r, color.g, color.b),
        borderColor: rgb(borderColor.r, borderColor.g, borderColor.b),
        borderWidth: 0.5,
      });
    } else {
      this._currentPage.drawRectangle({
        x,
        y: this.toPageY(y) - height,
        width,
        height,
        color: rgb(color.r, color.g, color.b),
      });
    }
  }

  /** Draw a horizontal line at y (top-down). */
  drawRule(y: number, color?: RgbColor, thickness = 0.5): void {
    const clr = color ?? COLORS.border;
    this._currentPage.drawLine({
      start: { x: this.contentLeft, y: this.toPageY(y) },
      end: { x: this.contentRight, y: this.toPageY(y) },
      color: rgb(clr.r, clr.g, clr.b),
      thickness,
    });
  }

  /** Draw a vertical line from y1 to y2 (top-down) at x. */
  drawVLine(x: number, y1: number, y2: number, color?: RgbColor, thickness = 0.5): void {
    const clr = color ?? COLORS.border;
    this._currentPage.drawLine({
      start: { x, y: this.toPageY(y1) },
      end: { x, y: this.toPageY(y2) },
      color: rgb(clr.r, clr.g, clr.b),
      thickness,
    });
  }

  /** Draw a line for strikethrough through a text run. */
  drawStrikethrough(
    x: number,
    y: number,
    width: number,
    size: number,
    color?: RgbColor,
  ): void {
    const clr = color ?? COLORS.text;
    // Strike through at ~35% of font size above the baseline
    const strikeY = y + size * 0.35;
    this._currentPage.drawLine({
      start: { x, y: this.toPageY(strikeY) },
      end: { x: x + width, y: this.toPageY(strikeY) },
      color: rgb(clr.r, clr.g, clr.b),
      thickness: Math.max(0.5, size * 0.06),
    });
  }
}
