import { i18n } from '#i18n';
import { useEffect, useState } from 'react';
import { Moon } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from './ui/popover';
import { maxSleepMinutes, sleepMinutes, sleepPresets, type SleepTimerClient } from '../lib/sleep-timer';
import { formatTime } from '../lib/utils';

function useNow(ticking: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!ticking) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);
  return now;
}

/**
 * Header button for the tab's sleep timer. `available` is false when there is no media to pause;
 * the button then stays focusable so its popover can say why.
 */
export function SleepTimer({ client, sleepAt, available, onStarted }: { client: SleepTimerClient; sleepAt?: number; available: boolean; onStarted: () => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const now = useNow(typeof sleepAt === 'number');
  const remaining = typeof sleepAt === 'number' ? Math.ceil((sleepAt - now) / 1000) : 0;
  const running = remaining > 0;
  const customMinutes = custom.trim() ? sleepMinutes(Number(custom)) : null;
  const start = async (minutes: number) => {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await client.start(minutes);
      setOpen(false);
      setCustom('');
      onStarted();
    } catch (err) { setError(err instanceof Error ? err.message : i18n.t('actionFailed')); }
    finally { setPending(false); }
  };
  const status = !available ? i18n.t('sleepTimerNoMedia') : running ? i18n.t('sleepTimerRemaining', { time: formatTime(remaining) }) : '';
  return <>
    <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) { setCustom(''); setError(''); } }}>
      <PopoverTrigger render={<Button variant="ghost" size={running ? 'sm' : 'icon'} />} aria-label={i18n.t('sleepTimer')} aria-disabled={available ? undefined : true} aria-describedby={status ? 'sleep-timer-status' : undefined} title={status ? `${i18n.t('sleepTimer')} · ${status}` : i18n.t('sleepTimer')} data-running={running ? '' : undefined} className="tabular-nums text-muted-foreground aria-disabled:opacity-50 data-running:bg-accent data-running:font-semibold data-running:text-primary [&_svg:not([class*='size-'])]:size-5">
        <Moon />{running ? formatTime(remaining) : null}
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" aria-label={i18n.t('sleepTimer')} className="w-64">
        {available ? <>
          <PopoverHeader>
            <PopoverTitle>{i18n.t('sleepTimerTitle')}</PopoverTitle>
            <PopoverDescription className="text-xs leading-5">{i18n.t('sleepTimerScope')}</PopoverDescription>
          </PopoverHeader>
          <div className="grid grid-cols-4 gap-1.5">
            {sleepPresets.map(minutes => <Button key={minutes} type="button" variant="secondary" size="sm" className="px-1" disabled={pending} aria-label={i18n.t('sleepTimerPreset', { minutes })} onClick={() => void start(minutes)}>{i18n.t('sleepTimerPresetShort', { minutes })}</Button>)}
          </div>
          <form className="flex items-center gap-1.5" onSubmit={event => { event.preventDefault(); if (customMinutes != null) void start(customMinutes); }}>
            <Input id="sleep-timer-custom" type="number" inputMode="numeric" min={1} max={maxSleepMinutes} step={1} className="h-7 flex-1" aria-label={i18n.t('sleepTimerCustom')} placeholder={i18n.t('sleepTimerCustomRange', { max: maxSleepMinutes })} value={custom} onChange={event => setCustom(event.target.value)} />
            <Button type="submit" size="sm" disabled={pending || customMinutes == null}>{i18n.t('sleepTimerStart')}</Button>
          </form>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </> : <PopoverHeader>
          <PopoverTitle>{i18n.t('sleepTimer')}</PopoverTitle>
          <PopoverDescription className="text-xs leading-5">{i18n.t('sleepTimerNoMedia')}</PopoverDescription>
        </PopoverHeader>}
      </PopoverContent>
    </Popover>
    {status && <span id="sleep-timer-status" className="sr-only">{status}</span>}
  </>;
}
