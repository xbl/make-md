import { markdownSchema } from "@/editor/schema";
import type { Node as PMNode } from "prosemirror-model";

function paragraph(text: string): PMNode {
  return markdownSchema.nodes.paragraph.createAndFill(
    null,
    text ? markdownSchema.text(text) : undefined,
  )!;
}

function heading(level: number, text: string): PMNode {
  return markdownSchema.nodes.heading.createAndFill(
    { level },
    text ? markdownSchema.text(text) : undefined,
  )!;
}

function codeBlock(lang: string, text: string): PMNode {
  return markdownSchema.nodes.code_block.createAndFill(
    lang ? { params: lang } : null,
    text ? markdownSchema.text(text) : undefined,
  )!;
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
      blocks.push(heading(headingMatch[1].length, headingMatch[2]));
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

    const listItems: string[] = [];
    while (index < lines.length) {
      const current = lines[index];
      const listMatch = current.match(/^\s*[-*+]\s+(.*)$/);
      if (!listMatch) {
        break;
      }
      listItems.push(listMatch[1]);
      index += 1;
    }

    if (listItems.length > 0) {
      const listNodes = listItems.map((item) =>
        markdownSchema.nodes.list_item.createAndFill(
          null,
          markdownSchema.nodes.paragraph.createAndFill(null, markdownSchema.text(item))!,
        )!,
      );
      blocks.push(markdownSchema.nodes.bullet_list.createAndFill(null, listNodes)!);
      continue;
    }

    const paragraphLines: string[] = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,6})\s+/.test(lines[index]) && !lines[index].startsWith("```") && !/^\s*[-*+]\s+/.test(lines[index])) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    blocks.push(paragraph(paragraphLines.join(" ")));
  }

  return markdownSchema.nodes.doc.createAndFill(null, blocks)!;
}
