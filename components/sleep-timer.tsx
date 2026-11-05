import { i18n } from '#i18n';
import { useEffect, useState } from 'react';
import { Moon } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from './ui/popover';
import { maxSleepMinutes, sleepMinutes, sleepPresets, sleepRemainingSeconds, type SleepTimerClient } from '../lib/sleep-timer';
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

const feedbackText = { cancelled: () => i18n.t('sleepTimerCancelled'), extended: () => i18n.t('sleepTimerExtended') };

function SleepTimerMenu({ running, remainingLabel, feedback, available, pending, custom, customMinutes, error, onCustom, onStart, onCancel, onExtend }: {
  running: boolean;
  remainingLabel: string;
  feedback: string;
  available: boolean;
  pending: boolean;
  custom: string;
  customMinutes: number | null;
  error: string;
  onCustom: (value: string) => void;
  onStart: (minutes: number) => void;
  onCancel: () => void;
  onExtend: () => void;
}) {
  return <>
    {running && <>
      <p className="text-sm font-medium tabular-nums">{remainingLabel}</p>
      <div className="grid gap-1.5">
        <Button type="button" variant="secondary" size="sm" disabled={pending} aria-label={i18n.t('sleepTimerCancel')} onClick={onCancel}>{i18n.t('sleepTimerCancel')}</Button>
        <Button type="button" variant="secondary" size="sm" disabled={pending} aria-label={i18n.t('sleepTimerExtend')} onClick={onExtend}>{i18n.t('sleepTimerExtend')}</Button>
      </div>
    </>}
    {feedback && <p id="sleep-timer-feedback" role="status" className="text-xs leading-5">{feedback}</p>}
    {available ? <>
      <PopoverHeader>
        <PopoverTitle>{i18n.t('sleepTimerTitle')}</PopoverTitle>
        <PopoverDescription className="text-xs leading-5">{i18n.t('sleepTimerScope')}</PopoverDescription>
      </PopoverHeader>
      <div className="grid grid-cols-4 gap-1.5">
        {sleepPresets.map(minutes => <Button key={minutes} type="button" variant="secondary" size="sm" className="px-1" disabled={pending} aria-label={i18n.t('sleepTimerPreset', { minutes })} onClick={() => onStart(minutes)}>{i18n.t('sleepTimerPresetShort', { minutes })}</Button>)}
      </div>
      <form className="flex items-center gap-1.5" onSubmit={event => { event.preventDefault(); if (customMinutes != null) onStart(customMinutes); }}>
        <Input id="sleep-timer-custom" type="number" inputMode="numeric" min={1} max={maxSleepMinutes} step={1} className="h-7 flex-1" aria-label={i18n.t('sleepTimerCustom')} placeholder={i18n.t('sleepTimerCustomRange', { max: maxSleepMinutes })} value={custom} onChange={event => onCustom(event.target.value)} />
        <Button type="submit" size="sm" disabled={pending || customMinutes == null}>{i18n.t('sleepTimerStart')}</Button>
      </form>
    </> : <PopoverHeader>
      <PopoverTitle>{i18n.t('sleepTimer')}</PopoverTitle>
      <PopoverDescription className="text-xs leading-5">{i18n.t('sleepTimerNoMedia')}</PopoverDescription>
    </PopoverHeader>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </>;
}

/**
 * Header button for the tab's sleep timer. `available` is false when there is no media to pause;
 * the button then stays focusable so its popover can say why. A running countdown can still be
 * cancelled or extended, and cancelling does not change playback.
 */
export function SleepTimer({ client, sleepAt, available, onChange }: { client: SleepTimerClient; sleepAt?: number; available: boolean; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<'' | 'cancelled' | 'extended'>('');
  const now = useNow(typeof sleepAt === 'number');
  const remaining = sleepRemainingSeconds(sleepAt, now);
  const running = remaining > 0;
  const customMinutes = custom.trim() ? sleepMinutes(Number(custom)) : null;
  const run = async (kind: 'cancel' | 'extend' | number) => {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      if (kind === 'cancel') await client.cancel();
      else if (kind === 'extend') await client.extend();
      else await client.start(kind);
      setNotice(kind === 'cancel' ? 'cancelled' : kind === 'extend' ? 'extended' : '');
      if (typeof kind === 'number') { setOpen(false); setCustom(''); }
      onChange();
    } catch (err) { setError(err instanceof Error ? err.message : i18n.t('actionFailed')); }
    finally { setPending(false); }
  };
  const remainingLabel = running ? i18n.t('sleepTimerRemaining', { time: formatTime(remaining) }) : '';
  const feedback = notice ? feedbackText[notice]() : '';
  const status = !available && !running ? i18n.t('sleepTimerNoMedia') : [feedback, remainingLabel].filter(Boolean).join(' ');
  return <>
    <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) { setCustom(''); setError(''); setNotice(''); } }}>
      <PopoverTrigger render={<Button variant="ghost" size={running ? 'sm' : 'icon'} />} aria-label={i18n.t('sleepTimer')} aria-disabled={available ? undefined : true} aria-describedby={status ? 'sleep-timer-status' : undefined} title={status ? `${i18n.t('sleepTimer')} · ${status}` : i18n.t('sleepTimer')} data-running={running ? '' : undefined} className="tabular-nums text-muted-foreground aria-disabled:opacity-50 data-running:bg-accent data-running:font-semibold data-running:text-primary [&_svg:not([class*='size-'])]:size-5">
        <Moon />{running ? formatTime(remaining) : null}
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" aria-label={i18n.t('sleepTimer')} className="w-64">
        <SleepTimerMenu running={running} remainingLabel={remainingLabel} feedback={feedback} available={available} pending={pending} custom={custom} customMinutes={customMinutes} error={error} onCustom={setCustom} onStart={minutes => void run(minutes)} onCancel={() => void run('cancel')} onExtend={() => void run('extend')} />
      </PopoverContent>
    </Popover>
    {status && <span id="sleep-timer-status" className="sr-only">{status}</span>}
  </>;
}
