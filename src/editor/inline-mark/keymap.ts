import { toggleMark } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";
import type { Schema } from "prosemirror-model";
import { createEditLinkCommand } from "@/editor/inline-mark/link-command";

export function createInlineMarkKeymap(schema: Schema) {
  const { strong, em, code } = schema.marks;

  return keymap({
    "Mod-b": toggleMark(strong),
    "Mod-i": toggleMark(em),
    "Mod-e": toggleMark(code),
    "Mod-k": createEditLinkCommand(schema),
  });
}
