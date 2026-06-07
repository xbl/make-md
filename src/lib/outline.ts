import type { Node as ProseMirrorNode } from "prosemirror-model";

export type OutlineItem = {
  level: number;
  text: string;
  pos: number;
};

export function extractOutline(doc: ProseMirrorNode): OutlineItem[] {
  const items: OutlineItem[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      items.push({
        level: Number(node.attrs.level ?? 1),
        text: node.textContent,
        pos,
      });
    }
  });
  return items;
}

export function nestOutlineItems(items: OutlineItem[]) {
  const root: Array<OutlineItem & { children: OutlineItem[] }> = [];
  const stack: Array<OutlineItem & { children: OutlineItem[] }> = [];

  for (const item of items) {
    const node = { ...item, children: [] as OutlineItem[] };
    while (stack.length > 0 && stack[stack.length - 1]!.level >= node.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1]!.children.push(node);
    }
    stack.push(node);
  }

  return root;
}
