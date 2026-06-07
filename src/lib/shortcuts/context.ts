import type { ShortcutContext } from "@/lib/shortcuts/types";

const MOD_E_COMMANDS = ["format.inlineCode", "export.html"] as const;

export function resolveModECommand(ctx: ShortcutContext): string {
  if (ctx.editorFocused && (ctx.hasSelection || ctx.inInlineMark)) {
    return "format.inlineCode";
  }

  return "export.html";
}

export function resolveChordCommand(
  chord: string,
  ctx: ShortcutContext,
  chordMap: Record<string, string>,
): string | null {
  const commandIds = Object.entries(chordMap)
    .filter(([, mappedChord]) => mappedChord === chord)
    .map(([commandId]) => commandId);

  if (commandIds.length === 0) {
    return null;
  }

  if (commandIds.length === 1) {
    return commandIds[0];
  }

  if (chord === "Mod-e" && MOD_E_COMMANDS.every((id) => commandIds.includes(id))) {
    return resolveModECommand(ctx);
  }

  return commandIds[0];
}
