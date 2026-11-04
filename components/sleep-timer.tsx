import { i18n } from '#i18n';
import { useEffect, useState } from 'react';
import { Moon } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from './ui/item';
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

/** Panel row for the tab's sleep timer. `available` is false when there is no media to pause. */
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
  const describedBy = !available ? 'sleep-timer-hint' : running ? 'sleep-timer-status' : undefined;
  return <Item role="listitem" className="min-h-10 flex-nowrap rounded-none px-0 py-1.5">
    <ItemMedia variant="icon" className="text-muted-foreground"><Moon className="size-5" /></ItemMedia>
    <ItemContent className="min-w-0">
      <ItemTitle className="font-normal">{i18n.t('sleepTimer')}</ItemTitle>
      {!available && <ItemDescription id="sleep-timer-hint" className="text-xs">{i18n.t('sleepTimerNoMedia')}</ItemDescription>}
      {available && running && <span id="sleep-timer-status" className="sr-only">{i18n.t('sleepTimerRemaining', { time: formatTime(remaining) })}</span>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </ItemContent>
    <ItemActions>
      <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) setCustom(''); }}>
        <PopoverTrigger render={<Button variant="ghost" size="sm" />} disabled={!available} aria-label={i18n.t('sleepTimer')} aria-describedby={describedBy} data-running={running ? '' : undefined} className="min-w-14 px-2 tabular-nums text-muted-foreground data-running:bg-accent data-running:font-semibold data-running:text-primary">
          {running ? formatTime(remaining) : i18n.t('sleepTimerOff')}
        </PopoverTrigger>
        <PopoverContent side="top" align="end" aria-label={i18n.t('sleepTimer')} className="w-64">
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
        </PopoverContent>
      </Popover>
    </ItemActions>
  </Item>;
}
