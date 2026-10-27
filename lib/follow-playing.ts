/** A manual pick keeps its selection until this much time has passed. */
export const followPlayingGraceMs = 2500;

/**
 * Another media started playing. Follow it unless the setting is off,
 * it is already the selection, or a manual pick is still inside the grace window.
 */
export function shouldFollowPlaying(input: {
  enabled: boolean;
  selectedId: string;
  playingId: string;
  manualAt: number | null;
  now: number;
}) {
  if (!input.enabled || !input.playingId || input.playingId === input.selectedId) return false;
  if (input.manualAt != null && input.now - input.manualAt < followPlayingGraceMs) return false;
  return true;
}
