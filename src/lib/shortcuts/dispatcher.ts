import { matchesChord, eventToChord } from "@/lib/shortcuts/bindings";
import { resolveChordCommand, resolveModECommand } from "@/lib/shortcuts/context";
import { COMMAND_CATALOG } from "@/lib/shortcuts/registry";
import type { ShortcutContext } from "@/lib/shortcuts/types";

export type ShortcutDispatcherOptions = {
  handlers: Record<string, () => void | Promise<void>>;
  getContext: () => ShortcutContext;
  getChordMap: () => Record<string, string>;
  isEditorFocused: () => boolean;
};

export function createShortcutDispatcher(options: ShortcutDispatcherOptions) {
  const { handlers, getContext, getChordMap, isEditorFocused } = options;

  async function run(commandId: string) {
    const command = COMMAND_CATALOG.find((entry) => entry.id === commandId);
    if (!command || !command.enabled) {
      return false;
    }

    if (command.scope === "editor" && !isEditorFocused()) {
      return false;
    }

    const handler = handlers[commandId];
    if (!handler) {
      return false;
    }

    await handler();
    return true;
  }

  async function handleKeydown(event: KeyboardEvent) {
    const chord = eventToChord(event);
    if (!chord) {
      if (event.key === "F8") {
        event.preventDefault();
        await run("view.focus");
        return true;
      }
      return false;
    }

    if (chord === "Mod-e") {
      event.preventDefault();
      await run(resolveModECommand(getContext()));
      return true;
    }

    const commandId = resolveChordCommand(chord, getContext(), getChordMap());
    if (!commandId) {
      return false;
    }

    if (!matchesChord(event, chord)) {
      return false;
    }

    event.preventDefault();
    await run(commandId);
    return true;
  }

  return { run, handleKeydown };
}

export type ShortcutDispatcher = ReturnType<typeof createShortcutDispatcher>;
