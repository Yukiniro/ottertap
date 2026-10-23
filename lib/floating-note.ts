import { formatRate, sameRate } from './rate';
import type { FloatingNote } from './types';

export interface FloatingEntryNote {
  kind: 'volume' | 'rate';
  /** Short text beside the button, such as `80%` or `1.25×`. */
  text: string;
  /** True only when the note is showing a volume above 100%. */
  boost: boolean;
}

/** Status beside the floating entry. `volume` prefers the percent, and shows speed at 100% when speed is not 1×. */
export function floatingEntryNote(preference: FloatingNote, volumePercent: number, rate: number): FloatingEntryNote | null {
  if (preference === 'off') return null;
  const percent = Math.round(volumePercent);
  const speed = `${formatRate(rate)}×`;
  if (preference === 'rate' || (percent === 100 && !sameRate(rate, 1))) return { kind: 'rate', text: speed, boost: false };
  return { kind: 'volume', text: `${percent}%`, boost: percent > 100 };
}
