import { i18n } from '#i18n';
import { useEffect, useRef, useState } from 'react';
import { rateHintEvent } from '../lib/hotkey';
import { formatRate } from '../lib/rate';
import { cn } from '../lib/utils';

export function RateHint() {
  const [text, setText] = useState('');
  const [shown, setShown] = useState(false);
  const current = useRef('');
  useEffect(() => {
    let show = 0;
    let hide = 0;
    let clear = 0;
    const onRate = (event: Event) => {
      const rate = (event as CustomEvent<number>).detail;
      if (typeof rate !== 'number' || !Number.isFinite(rate)) return;
      const label = i18n.t('speedHint', { rate: formatRate(rate) });
      window.clearTimeout(show);
      window.clearTimeout(hide);
      window.clearTimeout(clear);
      const reveal = () => {
        current.current = label;
        setText(label);
        setShown(true);
        hide = window.setTimeout(() => setShown(false), 1000);
        clear = window.setTimeout(() => { current.current = ''; setText(''); }, 1200);
      };
      // Repeating the same label still needs a text change so the live region speaks again.
      if (current.current === label) {
        setText('');
        show = window.setTimeout(reveal, 20);
      } else reveal();
    };
    window.addEventListener(rateHintEvent, onRate);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
      window.clearTimeout(clear);
      window.removeEventListener(rateHintEvent, onRate);
    };
  }, []);
  return <p role="status" aria-live="polite" aria-atomic="true" className={cn('pointer-events-none fixed top-6 left-1/2 z-2147483647 -translate-x-1/2 rounded-full border bg-card px-3.5 py-2 text-sm font-medium text-card-foreground tabular-nums shadow-card transition-opacity duration-200', shown && text ? 'opacity-100' : 'opacity-0')}>{text}</p>;
}
