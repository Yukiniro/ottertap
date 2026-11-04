/** Inputs the panel already has. Nothing here is stored. */
export interface RemainingMedia {
  currentTime: number;
  duration: number | null;
  rate: number;
  live: boolean;
  seekable: { start: number; end: number }[];
}

/**
 * Wall-clock seconds left if playback continues at `rate`.
 * Null for live, unknown duration, or media that cannot be seeked, so the panel does not invent a time.
 */
export function remainingWallSeconds(media: RemainingMedia): number | null {
  if (media.live) return null;
  const duration = media.duration;
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) return null;
  const ranges = media.seekable;
  const start = ranges[0]?.start;
  const end = ranges[ranges.length - 1]?.end;
  if (typeof start !== 'number' || typeof end !== 'number' || !Number.isFinite(start) || !Number.isFinite(end) || !(end > start)) return null;
  if (!Number.isFinite(media.rate) || media.rate <= 0) return null;
  const current = Number.isFinite(media.currentTime) ? media.currentTime : 0;
  return Math.max(0, duration - current) / media.rate;
}
