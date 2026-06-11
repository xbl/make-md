import { schema as basicSchema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import { Schema, type MarkSpec, type NodeSpec } from "prosemirror-model";

const codeBlockSpec: NodeSpec = {
  content: "text*",
  marks: "",
  group: "block",
  code: true,
  defining: true,
  attrs: {
    params: { default: "" },
  },
  parseDOM: [{ tag: "pre", preserveWhitespace: "full" }],
  toDOM(node) {
    return ["pre", { "data-params": node.attrs.params ?? "" }, ["code", 0]];
  },
};

const imageSpec: NodeSpec = {
  inline: true,
  attrs: {
    src: {},
    alt: { default: null },
    title: { default: null },
    displaySrc: { default: null },
  },
  group: "inline",
  draggable: true,
  parseDOM: [
    {
      tag: "img[src]",
      getAttrs(dom) {
        if (!(dom instanceof HTMLImageElement)) {
          return false;
        }
        return {
          src: dom.getAttribute("src"),
          alt: dom.getAttribute("alt"),
          title: dom.getAttribute("title"),
          displaySrc: dom.getAttribute("src"),
        };
      },
    },
  ],
  toDOM(node) {
    return [
      "img",
      {
        src: node.attrs.displaySrc ?? node.attrs.src,
        alt: node.attrs.alt,
        title: node.attrs.title,
      },
    ];
  },
};

const tableNodes: Record<string, NodeSpec> = {
  table: {
    content: "table_row+",
    group: "block",
    isolating: true,
    parseDOM: [{ tag: "table" }],
    toDOM() {
      return ["table", { class: "md-table" }, ["tbody", 0]];
    },
  },
  table_row: {
    content: "(table_cell | table_header)+",
    parseDOM: [{ tag: "tr" }],
    toDOM() {
      return ["tr", 0];
    },
  },
  table_header: {
    content: "paragraph+",
    isolating: true,
    parseDOM: [{ tag: "th" }],
    toDOM() {
      return ["th", 0];
    },
  },
  table_cell: {
    content: "paragraph+",
    isolating: true,
    parseDOM: [{ tag: "td" }],
    toDOM() {
      return ["td", 0];
    },
  },
};

const taskNodes: Record<string, NodeSpec> = {
  task_list: {
    content: "task_item+",
    group: "block",
    parseDOM: [{ tag: "ul[data-task-list]" }],
    toDOM() {
      return ["ul", { "data-task-list": "true", class: "task-list" }, 0];
    },
  },
  task_item: {
    content: "paragraph block*",
    defining: true,
    attrs: {
      checked: { default: false },
    },
    parseDOM: [
      {
        tag: "li[data-task-item]",
        getAttrs(dom) {
          if (!(dom instanceof HTMLElement)) {
            return false;
          }
          return { checked: dom.dataset.checked === "true" };
        },
      },
    ],
    toDOM(node) {
      return [
        "li",
        {
          "data-task-item": "true",
          "data-checked": String(node.attrs.checked),
          class: node.attrs.checked ? "task-item is-checked" : "task-item",
        },
        0,
      ];
    },
  },
};

const nodes = addListNodes(basicSchema.spec.nodes, "paragraph block*", "block")
  .update("image", imageSpec)
  .update("code_block", codeBlockSpec)
  .append(tableNodes)
  .append(taskNodes);

const strikeMark: MarkSpec = {
  parseDOM: [
    { tag: "s" },
    { tag: "del" },
    {
      style: "text-decoration",
      getAttrs(value) {
        return value === "line-through" ? null : false;
      },
    },
  ],
  toDOM() {
    return ["s", 0];
  },
};

export const markdownSchema = new Schema({
  nodes,
  marks: basicSchema.spec.marks.append({ strike: strikeMark }),
});
