import { i18n } from '#i18n';
import { formatRate, sameRate } from './rate';
import type { FloatingNote } from './types';
import { formatTime } from './utils';

export type FloatingEntryNote =
  | { kind: 'volume' | 'rate'; text: string; boost: boolean }
  /** `time` is the clock, such as `12:04`. `text` is the short label that includes it. */
  | { kind: 'sleep'; text: string; time: string; boost: false };

/**
 * Status beside the floating entry.
 * `volume` prefers the percent, and shows speed at 100% when speed is not 1×.
 * A running sleep timer replaces that when `sleep.show` is on. `remainingSeconds` uses the same
 * rounded-up clock as the panel. Zero or a hidden preference falls through to the note above.
 */
export function floatingEntryNote(preference: FloatingNote, volumePercent: number, rate: number, sleep?: { show: boolean; remainingSeconds: number }): FloatingEntryNote | null {
  if (sleep?.show && sleep.remainingSeconds > 0) {
    const time = formatTime(sleep.remainingSeconds);
    return { kind: 'sleep', text: i18n.t('floatingSleepNoteText', { time }), time, boost: false };
  }
  if (preference === 'off') return null;
  const percent = Math.round(volumePercent);
  const speed = `${formatRate(rate)}×`;
  if (preference === 'rate' || (percent === 100 && !sameRate(rate, 1))) return { kind: 'rate', text: speed, boost: false };
  return { kind: 'volume', text: `${percent}%`, boost: percent > 100 };
}
