/** Pause must last this long before the floater hides, so a quick pause and play does not flash it away. */
export const floatingWhilePlayingHideMs = 400;

export interface FloatingWhilePlayingGate {
  /** Set once playback has been seen while the switch is on. A paused page that never played stays hidden. */
  seenPlayingAt: number | null;
  /** When the current pause started. Empty selection is stored as already elapsed, so it stays hidden. */
  hiddenSince: number | null;
}

export function createFloatingWhilePlayingGate(): FloatingWhilePlayingGate {
  return { seenPlayingAt: null, hiddenSince: null };
}

/**
 * Whether the floating entry may stay up for the play/pause switch.
 * The caller still requires the master floating switch, an enabled site, and a selection.
 * Off: always allowed, and the gate resets, so turning the switch on later starts from the current pause.
 * On and playing: allowed immediately.
 * On and paused after playback: allowed until `floatingWhilePlayingHideMs`.
 * On with nothing selected, or paused before any playback: not allowed.
 */
export function stepFloatingWhilePlaying(gate: FloatingWhilePlayingGate, input: { whilePlaying: boolean; selected: boolean; playing: boolean; now: number }): { gate: FloatingWhilePlayingGate; visible: boolean } {
  if (!input.whilePlaying) return { gate: createFloatingWhilePlayingGate(), visible: true };
  if (!input.selected) return { gate: { seenPlayingAt: gate.seenPlayingAt, hiddenSince: input.now - floatingWhilePlayingHideMs }, visible: false };
  if (input.playing) return { gate: { seenPlayingAt: input.now, hiddenSince: null }, visible: true };
  const hiddenSince = gate.hiddenSince ?? input.now;
  const next = { seenPlayingAt: gate.seenPlayingAt, hiddenSince };
  if (gate.seenPlayingAt == null) return { gate: next, visible: false };
  return { gate: next, visible: input.now - hiddenSince < floatingWhilePlayingHideMs };
}
