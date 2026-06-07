import { defineStore } from "pinia";
import { COMMAND_CATALOG, getDefaultChordMap } from "@/lib/shortcuts/registry";
import type { ShortcutOverrides } from "@/lib/shortcuts/types";

const STORAGE_KEY = "make-md:shortcuts";

function loadOverrides(): ShortcutOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as ShortcutOverrides;
  } catch {
    return {};
  }
}

function saveOverrides(overrides: ShortcutOverrides) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export const useShortcutsStore = defineStore("shortcuts", {
  state: () => ({
    overrides: loadOverrides(),
  }),
  getters: {
    catalog: () => COMMAND_CATALOG,
    effectiveChord(): (commandId: string) => string | null {
      return (commandId: string) => {
        if (commandId in this.overrides) {
          return this.overrides[commandId];
        }

        const command = COMMAND_CATALOG.find((entry) => entry.id === commandId);
        return command?.defaultChord ?? null;
      };
    },
    chordMap(state): Record<string, string> {
      const map = getDefaultChordMap();
      for (const [commandId, chord] of Object.entries(state.overrides)) {
        if (chord === null) {
          delete map[commandId];
        } else {
          map[commandId] = chord;
        }
      }
      return map;
    },
  },
  actions: {
    checkConflict(commandId: string, chord: string) {
      for (const [otherId, otherChord] of Object.entries(this.chordMap)) {
        if (otherId === commandId) {
          continue;
        }
        if (otherChord === chord) {
          return { commandId: otherId, label: COMMAND_CATALOG.find((c) => c.id === otherId)?.label ?? otherId };
        }
      }
      return null;
    },
    applyOverride(commandId: string, chord: string | null) {
      this.overrides = { ...this.overrides, [commandId]: chord };
      saveOverrides(this.overrides);
    },
    resetCommand(commandId: string) {
      const next = { ...this.overrides };
      delete next[commandId];
      this.overrides = next;
      saveOverrides(this.overrides);
    },
    resetAll() {
      this.overrides = {};
      saveOverrides(this.overrides);
    },
  },
});
