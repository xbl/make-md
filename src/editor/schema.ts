import { schema as basicSchema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import { Schema } from "prosemirror-model";

const nodes = addListNodes(basicSchema.spec.nodes, "paragraph block*", "block");

export const markdownSchema = new Schema({
  nodes,
  marks: basicSchema.spec.marks,
});
