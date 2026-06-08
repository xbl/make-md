const SYSTEM_RESERVED_CHORDS = new Set([
  "Mod-c",
  "Mod-v",
  "Mod-x",
  "Mod-z",
  "Mod-Shift-z",
  "Ctrl-y",
  "Mod-a",
  "Mod-h",
  "Mod-m",
  "Mod-n",
  "Mod-o",
  "Mod-p",
  "Mod-q",
  "Mod-s",
  "Mod-t",
  "Mod-w",
]);

export function isSystemReservedChord(chord: string) {
  return SYSTEM_RESERVED_CHORDS.has(chord);
}
