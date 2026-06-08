const SYSTEM_RESERVED_CHORDS = new Set([
  "Mod-c",
  "Mod-v",
  "Mod-x",
  "Mod-z",
  "Mod-Shift-z",
  "Ctrl-y",
  "Mod-a",
  "Mod-q",
]);

export function isSystemReservedChord(chord: string) {
  return SYSTEM_RESERVED_CHORDS.has(chord);
}
