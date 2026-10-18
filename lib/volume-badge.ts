export const volumeBadgeColor = '#e4572e';
export const volumeReportIntervalMs = 1000;
export const volumeBadgeTtlMs = 3000;

export interface VolumeSample { volume: number; at: number }

export function maxEffectiveVolume(media: readonly { volume: number; paused?: boolean; muted?: boolean }[]) {
  let max = 0;
  for (const item of media) if (Number.isFinite(item.volume) && item.volume > max) max = item.volume;
  return max;
}

/** Whether this frame should send a register message. Amplified volume keeps reporting so the badge TTL can refresh. */
export function shouldReportVolume(volume: number | null, reported: number | null) {
  if (volume == null || !Number.isFinite(volume)) return reported == null ? null : { present: false as const };
  if (reported === volume && volume <= 1) return null;
  return { volume };
}

export function volumeBadgeFromReports(samples: Iterable<VolumeSample>, now: number, ttl = volumeBadgeTtlMs) {
  let max = 0;
  for (const sample of samples) {
    if (!Number.isFinite(sample.at) || now - sample.at >= ttl) continue;
    if (Number.isFinite(sample.volume) && sample.volume > max) max = sample.volume;
  }
  const percent = Math.round(max * 100);
  return percent > 100 ? { text: String(percent), percent } : null;
}
