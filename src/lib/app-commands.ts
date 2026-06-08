import { chordToDisplay } from "@/lib/shortcuts/display";
import { COMMAND_CATALOG, createCommandHandlers, type CommandHandlerDeps } from "@/lib/shortcuts/registry";

export type AppCommandRuntime = ReturnType<typeof createAppCommandRuntime>;

export type PaletteCommand = {
  id: string;
  label: string;
  shortcut?: string;
  enabled: boolean;
  run: () => void | Promise<void>;
};

const ALWAYS_AVAILABLE_COMMANDS = new Set([
  "view.outline",
  "view.files",
  "view.aiSettings",
  "view.aiRewriteDocument",
]);

export function createAppCommandRuntime(deps: CommandHandlerDeps) {
  const handlers = createCommandHandlers(deps);

  function canRun(commandId: string, scope?: "app" | "editor" | "export" | "view") {
    if (!(commandId in handlers)) {
      return false;
    }

    if (scope !== "editor") {
      return true;
    }

    if (ALWAYS_AVAILABLE_COMMANDS.has(commandId)) {
      return true;
    }

    return deps.canRunEditorCommand?.(commandId) ?? false;
  }

  function getPaletteCommands(effectiveChord: (commandId: string) => string | null): PaletteCommand[] {
    return COMMAND_CATALOG
      .filter((command) => command.enabled && command.id in handlers)
      .map((command) => {
        const chord = effectiveChord(command.id);
        return {
          id: command.id,
          label: command.label,
          shortcut: chord ? chordToDisplay(chord) : undefined,
          enabled: canRun(command.id, command.scope),
          run: handlers[command.id],
        };
      });
  }

  return {
    handlers,
    canRun,
    getPaletteCommands,
  };
}
