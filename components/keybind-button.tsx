import { i18n } from '#i18n';
import { useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

const modifierKeys = new Set(['Shift', 'Alt', 'AltGraph', 'Control', 'Meta', 'CapsLock', 'Fn', 'OS']);

/** Click, then press the new key. Esc, Tab, or leaving the button cancels. `onKey` returns true once the key is taken. */
export function KeybindButton({ label, keyLabel, disabled, errorId, onKey, onCancel }: { label: string; keyLabel: string; disabled: boolean; errorId: string; onKey: (event: KeyboardEvent) => boolean; onCancel: () => void }) {
  const [recording, setRecording] = useState(false);
  // Space activates a button on keyup, so the keyup of a recorded key must not start recording again.
  const swallowUp = useRef(false);
  const stop = () => { setRecording(false); onCancel(); };
  return <Button type="button" variant="outline" size="sm" disabled={disabled}
    aria-label={recording ? i18n.t('keybindRecording') : i18n.t('changeKeybind', { action: label, key: keyLabel })}
    aria-describedby={recording ? errorId : undefined}
    className={cn('min-w-9 font-mono text-xs', recording && 'border-primary font-sans ring-3 ring-ring/50')}
    onClick={() => { if (!recording) setRecording(true); }}
    onBlur={() => { if (recording) stop(); }}
    onKeyDown={event => {
      if (!recording) return;
      if (event.key === 'Tab') { stop(); return; }
      event.preventDefault();
      event.stopPropagation();
      swallowUp.current = true;
      if (event.repeat || modifierKeys.has(event.key)) return;
      if (event.key === 'Escape') { stop(); return; }
      if (onKey(event.nativeEvent)) setRecording(false);
    }}
    onKeyUp={event => {
      if (!swallowUp.current) return;
      swallowUp.current = false;
      event.preventDefault();
    }}>
    {recording ? i18n.t('keybindRecording') : <>{keyLabel}<Pencil aria-hidden="true" className="size-3 text-muted-foreground" /></>}
  </Button>;
}
