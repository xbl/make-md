import { markdownSchema } from "@/editor/schema";
import { paragraphFromMarkdown, parseInline } from "@/editor/inline-parser";
import type { Node as PMNode } from "prosemirror-model";

function heading(level: number, text: string): PMNode {
  return markdownSchema.nodes.heading.createAndFill({ level }, parseInline(text))!;
}

function codeBlock(lang: string, text: string): PMNode {
  const content = text ? [markdownSchema.text(text)] : undefined;
  return markdownSchema.nodes.code_block.create({ params: lang }, content);
}

function listItem(text: string): PMNode {
  return markdownSchema.nodes.list_item.createAndFill(null, paragraphFromMarkdown(text))!;
}

function taskItem(checked: boolean, text: string): PMNode {
  return markdownSchema.nodes.task_item.createAndFill({ checked }, paragraphFromMarkdown(text))!;
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s:-]+\|[\s|:-]+\|?$/.test(line.trim());
}

function isBlockStart(line: string) {
  return (
    /^(#{1,6})\s+/.test(line) ||
    line.startsWith("```") ||
    /^\s*[-*+]\s+\[[ xX]\]/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    /^\s*>\s?/.test(line) ||
    /^\|.+\|/.test(line.trim()) ||
    /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim()) ||
    /^!\[[^\]]*\]\([^)]+\)$/.test(line.trim())
  );
}

function parseTable(lines: string[], startIndex: number): { node: PMNode; nextIndex: number } {
  const headerCells = splitTableRow(lines[startIndex]);
  const separatorIndex = startIndex + 1;
  let bodyStart = separatorIndex;
  if (lines[separatorIndex] && isTableSeparator(lines[separatorIndex])) {
    bodyStart = separatorIndex + 1;
  }

  const headerRow = markdownSchema.nodes.table_row.create(
    null,
    headerCells.map((cell) =>
      markdownSchema.nodes.table_header.createAndFill(null, paragraphFromMarkdown(cell))!,
    ),
  );

  const bodyRows: PMNode[] = [];
  let index = bodyStart;
  while (index < lines.length && /^\|.+\|/.test(lines[index].trim())) {
    const cells = splitTableRow(lines[index]);
    bodyRows.push(
      markdownSchema.nodes.table_row.create(
        null,
        cells.map((cell) =>
          markdownSchema.nodes.table_cell.createAndFill(null, paragraphFromMarkdown(cell))!,
        ),
      ),
    );
    index += 1;
  }

  return {
    node: markdownSchema.nodes.table.create(null, [headerRow, ...bodyRows]),
    nextIndex: index,
  };
}

export function parseMarkdown(source: string): PMNode {
  const lines = source.split(/\r?\n/);
  const blocks: PMNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push(heading(Number(headingMatch[1].length), headingMatch[2]));
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push(markdownSchema.nodes.horizontal_rule.create());
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      index += 1;
      const buffer: string[] = [];
      while (index < lines.length && !lines[index].startsWith("```")) {
        buffer.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push(codeBlock(lang, buffer.join("\n")));
      continue;
    }

    if (/^\|.+\|/.test(line.trim())) {
      const table = parseTable(lines, index);
      blocks.push(table.node);
      index = table.nextIndex;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push(
        markdownSchema.nodes.blockquote.createAndFill(
          null,
          quoteLines.map((text) => paragraphFromMarkdown(text)),
        )!,
      );
      continue;
    }

    const taskItems: { checked: boolean; text: string }[] = [];
    while (index < lines.length) {
      const taskMatch = lines[index].match(/^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/);
      if (!taskMatch) {
        break;
      }
      taskItems.push({ checked: taskMatch[1].toLowerCase() === "x", text: taskMatch[2] });
      index += 1;
    }
    if (taskItems.length > 0) {
      blocks.push(
        markdownSchema.nodes.task_list.createAndFill(
          null,
          taskItems.map((item) => taskItem(item.checked, item.text)),
        )!,
      );
      continue;
    }

    const orderedItems: string[] = [];
    while (index < lines.length) {
      const listMatch = lines[index].match(/^\s*(\d+)\.\s+(.*)$/);
      if (!listMatch) {
        break;
      }
      orderedItems.push(listMatch[2]);
      index += 1;
    }
    if (orderedItems.length > 0) {
      blocks.push(
        markdownSchema.nodes.ordered_list.createAndFill(null, orderedItems.map(listItem))!,
      );
      continue;
    }

    const listItems: string[] = [];
    while (index < lines.length) {
      const listMatch = lines[index].match(/^\s*[-*+]\s+(.*)$/);
      if (!listMatch) {
        break;
      }
      listItems.push(listMatch[1]);
      index += 1;
    }
    if (listItems.length > 0) {
      blocks.push(
        markdownSchema.nodes.bullet_list.createAndFill(null, listItems.map(listItem))!,
      );
      continue;
    }

    const paragraphLines: string[] = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    blocks.push(paragraphFromMarkdown(paragraphLines.join(" ")));
  }

  if (blocks.length === 0) {
    blocks.push(paragraphFromMarkdown(""));
  }

  return markdownSchema.nodes.doc.createAndFill(null, blocks)!;
}
