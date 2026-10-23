import { defaultKeybinds, pressedKey, type Keybinds } from './keybinds';

/** Hold-to-boost key matching. The keyup is paired by the physical key from keydown, not by the modifiers still held at release. */

export const holdRateEvent = 'ottertap-hold-rate';

export type HoldPhase = 'ignore' | 'start' | 'repeat' | 'end';

export interface HoldKeyEvent {
  type?: string;
  key: string;
  code?: string;
  repeat?: boolean;
  altKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/** Page chord is Alt+Shift+.. Single-key mode also accepts the hold key (S by default). Ctrl and Meta never match. */
export function isHoldRateChord(event: HoldKeyEvent, singleKey: boolean, keybinds: Keybinds = defaultKeybinds) {
  if (event.ctrlKey || event.metaKey) return false;
  const code = event.code ?? '';
  if (event.altKey && event.shiftKey && (code === 'Period' || event.key === '.' || event.key === '>')) return true;
  if (!singleKey || event.altKey) return false;
  return pressedKey(event, keybinds) === keybinds.holdBoost;
}

export function createHoldKeySession() {
  let code: string | null = null;
  const physical = (event: HoldKeyEvent) => event.code || event.key;
  return {
    holding() { return code != null; },
    /**
     * `active` is the feature switch, a media page, and a non-typing target.
     * A keyup for the key that started the hold still ends it when `active` is false,
     * so releasing Shift or moving focus cannot leave the temporary speed on.
     */
    key(event: HoldKeyEvent, active: boolean, singleKey: boolean, keybinds?: Keybinds): HoldPhase {
      const id = physical(event);
      if (code && event.type === 'keyup' && id === code) {
        code = null;
        return 'end';
      }
      if (code && event.type !== 'keyup' && id === code) return 'repeat';
      if (!active || event.type === 'keyup' || event.repeat || !isHoldRateChord(event, singleKey, keybinds)) return 'ignore';
      code = id;
      return 'start';
    },
    /** Drop the held key without a keyup, for blur and page hide. True when a hold was in progress. */
    cancel() {
      const was = code != null;
      code = null;
      return was;
    }
  };
}
