import { i18n } from '#i18n';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { CircleAlert, EyeOff, Minus, PanelTop, Pause, Play, Plus, RotateCcw, RotateCw, Volume2, VolumeX } from 'lucide-react';
import otterMark from '../assets/otter-mark';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { VolumeSlider } from './volume-slider';
import { useMedia } from '../hooks/use-media';
import { dockedPoint, dockSize, dropPosition, nudgePosition, type Viewport } from '../lib/dock';
import { actionHintEvent, commandForHotkey, createHotkeySession, rateHintEvent, volumeGestureEvent } from '../lib/hotkey';
import { floatingEntryNote } from '../lib/floating-note';
import { createFloatingWhilePlayingGate, floatingWhilePlayingHideMs, stepFloatingWhilePlaying } from '../lib/floating-play';
import { formatRate, nextRate, sameRate } from '../lib/rate';
import { hideFloating, isFloatingHidden } from '../lib/settings';
import { actualSkipSeconds } from '../lib/skip';
import type { FloatingPosition, MediaClient, MediaState } from '../lib/types';
import { useSettingsAtoms } from './theme';

const readViewport = (): Viewport => ({ width: document.documentElement.clientWidth || window.innerWidth, height: document.documentElement.clientHeight || window.innerHeight });
const thumbHeight = 10;
const boostColor = (volume: number, max: number) => `color-mix(in oklch, var(--destructive) ${Math.max(0, Math.min(1, (volume - 100) / (max - 100))) * 100}%, #b57835)`;

/** `hideOnSite` offers 「本站隐藏浮动」. Leave it off where the settings are not the user's real ones, such as demos. */
export function FloatingController({ client, openPanel, hideOnSite }: { client: MediaClient; openPanel?: (mediaId: string) => Promise<boolean>; hideOnSite?: boolean }) {
  const { coarseStepAtom, floatingAtom, floatingHiddenSitesAtom, floatingNoteAtom, floatingPositionAtom, floatingWhilePlayingAtom, fineWheelAtom, loadingAtom, ratePresetsAtom, rateStepAtom, skipSecondsAtom, skipWithRateAtom, volumeStepAtom, wheelDirectionAtom, writeSettingsAtom } = useSettingsAtoms();
  const floating = useAtomValue(floatingAtom);
  const floatingHiddenSites = useAtomValue(floatingHiddenSitesAtom);
  const floatingNote = useAtomValue(floatingNoteAtom);
  const floatingWhilePlaying = useAtomValue(floatingWhilePlayingAtom);
  const floatingPosition = useAtomValue(floatingPositionAtom);
  const loading = useAtomValue(loadingAtom);
  const ratePresets = useAtomValue(ratePresetsAtom);
  const rateStep = useAtomValue(rateStepAtom);
  const skipSeconds = useAtomValue(skipSecondsAtom);
  const skipWithRate = useAtomValue(skipWithRateAtom);
  const volumeStep = useAtomValue(volumeStepAtom);
  const coarseStep = useAtomValue(coarseStepAtom);
  const fineWheel = useAtomValue(fineWheelAtom);
  const wheelDirection = useAtomValue(wheelDirectionAtom);
  const write = useSetAtom(writeSettingsAtom);
  const { page, selected, command, error } = useMedia(client, { pauseWhenEmpty: true });
  const [expanded, setExpanded] = useState(false);
  const [panelHint, setPanelHint] = useState(false);
  const [openingPanel, setOpeningPanel] = useState(false);
  const [draft, setDraft] = useState<number | null>(null);
  const [rateDraft, setRateDraft] = useState<number | null>(null);
  const [rateSettled, setRateSettled] = useState(0);
  const [viewport, setViewport] = useState(readViewport);
  const [moved, setMoved] = useState<FloatingPosition | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const container = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const dragged = useRef(false);
  const hideTimer = useRef(0);
  const aimedRate = useRef<number | null>(null);
  const pendingRates = useRef(0);
  const rateQueue = useRef(Promise.resolve());
  const commandRef = useRef(command);
  commandRef.current = command;
  const volumeStepRef = useRef(volumeStep);
  const coarseStepRef = useRef(coarseStep);
  const fineWheelRef = useRef(fineWheel);
  const wheelDirectionRef = useRef(wheelDirection);
  volumeStepRef.current = volumeStep;
  coarseStepRef.current = coarseStep;
  fineWheelRef.current = fineWheel;
  wheelDirectionRef.current = wheelDirection;

  useEffect(() => {
    const resize = () => setViewport(readViewport());
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); window.clearTimeout(hideTimer.current); };
  }, []);
  useEffect(() => { setDraft(null); aimedRate.current = null; setRateDraft(null); }, [selected?.id]);
  useEffect(() => {
    if (aimedRate.current == null) return;
    if (!selected || pendingRates.current === 0 || sameRate(selected.rate, aimedRate.current)) {
      aimedRate.current = null;
      setRateDraft(null);
    }
  }, [selected, rateSettled]);
  const floatingRef = useRef(floating);
  const expandWhileShown = useRef(true);
  const mediaRef = useRef(selected);
  const clientRef = useRef(client);
  const optimistic = useRef<MediaState | null>(null);
  const hiddenHere = isFloatingHidden(page.host, floatingHiddenSites);
  floatingRef.current = floating && !hiddenHere;
  mediaRef.current = selected;
  clientRef.current = client;
  const hotkeys = useMemo(() => createHotkeySession(async action => {
    const current = mediaRef.current;
    if (!current) return;
    const base = optimistic.current?.id === current.id ? optimistic.current : current;
    const next = commandForHotkey(action, base, undefined, undefined, false, volumeStepRef.current, fineWheelRef.current, wheelDirectionRef.current, coarseStepRef.current);
    if (!next) return;
    if (next.type === 'volume') {
      optimistic.current = { ...base, volume: next.value, muted: next.value <= 0 };
      setDraft(Math.round(next.value * 100));
      await clientRef.current.command(current, next);
    }
  }), []);
  useEffect(() => {
    const onVolume = (event: Event) => {
      const percent = (event as CustomEvent<number>).detail;
      const current = mediaRef.current;
      if (!current || !Number.isFinite(percent)) return;
      optimistic.current = { ...current, volume: percent / 100, muted: percent <= 0 };
      setDraft(Math.round(percent));
    };
    const open = () => { if (floatingRef.current && expandWhileShown.current) setExpanded(true); };
    window.addEventListener(volumeGestureEvent, open);
    window.addEventListener('ottertap-volume', onVolume);
    return () => { hotkeys.dispose(); window.removeEventListener(volumeGestureEvent, open); window.removeEventListener('ottertap-volume', onVolume); };
  }, [hotkeys]);
  useEffect(() => {
    const live = optimistic.current;
    if (!selected || !live || live.id !== selected.id) return;
    const shown = Math.round((selected.muted ? 0 : selected.volume) * 100);
    if (shown !== Math.round(live.volume * 100)) return;
    optimistic.current = null;
    setDraft(value => value === shown ? null : value);
  }, [selected]);
  const playGate = useRef(createFloatingWhilePlayingGate());
  const [playClock, setPlayClock] = useState(0);
  const playback = stepFloatingWhilePlaying(playGate.current, {
    whilePlaying: floatingWhilePlaying,
    selected: !!selected,
    playing: !!selected && !selected.paused,
    now: Date.now()
  });
  playGate.current = playback.gate;
  expandWhileShown.current = !floatingWhilePlaying || playback.visible;
  const selectedId = selected?.id;
  const selectedPaused = selected?.paused;
  useEffect(() => {
    if (loading || !floatingWhilePlaying || !selectedId || selectedPaused !== true || !playback.visible) return;
    const since = playGate.current.hiddenSince ?? Date.now();
    const wait = floatingWhilePlayingHideMs - (Date.now() - since);
    const timer = window.setTimeout(() => setPlayClock(clock => clock + 1), Math.max(0, wait));
    return () => window.clearTimeout(timer);
  }, [loading, floatingWhilePlaying, playback.visible, playClock, selectedId, selectedPaused]);
  useEffect(() => {
    if (floatingWhilePlaying && !playback.visible) setExpanded(false);
  }, [floatingWhilePlaying, playback.visible]);
  useEffect(() => {
    if (hiddenHere) setExpanded(false);
  }, [hiddenHere]);

  if (loading || !floating || hiddenHere || !page.enabled || !selected || (floatingWhilePlaying && !playback.visible)) return null;
  const position = moved ?? floatingPosition;
  const revealed = hovered || focused || expanded || !!dragPoint;
  const point = dragPoint ?? dockedPoint(position, viewport, revealed);
  const max = Math.round(selected.maxVolume * 100);
  const volume = draft ?? Math.round((selected.muted ? 0 : selected.volume) * 100);
  const pillHeight = Math.min(280, viewport.height - 16);
  const move = (next: FloatingPosition) => {
    setMoved(next);
    void write({ floatingPosition: next }).then(saved => { if (saved) setMoved(null); });
  };
  const setVolume = (next: number, commit: boolean) => {
    optimistic.current = null;
    if (!commit) setDraft(next);
    const done = command({ type: 'volume', value: next / 100 });
    if (commit) void done.finally(() => setDraft(null));
  };
  const boostLimit = max > 100 ? undefined : i18n.t('cannotBoostCrossOrigin');
  const playbackRate = rateDraft ?? selected.rate;
  const entryNote = floatingEntryNote(floatingNote, volume, playbackRate);
  const jump = actualSkipSeconds(skipSeconds, playbackRate, skipWithRate);
  const ranges = selected.seekable;
  const seekMin = ranges[0]?.start ?? 0;
  const seekMax = ranges[ranges.length - 1]?.end ?? 0;
  const canSeek = seekMax > seekMin;
  const activePreset = ratePresets.find(speed => sameRate(speed, playbackRate));
  const slowerRate = nextRate(playbackRate, -1, null, rateStep);
  const fasterRate = nextRate(playbackRate, 1, null, rateStep);
  const commitRate = (next: number) => {
    const current = aimedRate.current ?? selected.rate;
    if (sameRate(next, current)) return;
    aimedRate.current = next;
    setRateDraft(next);
    const target = next;
    pendingRates.current += 1;
    rateQueue.current = rateQueue.current.then(async () => {
      const ok = await commandRef.current({ type: 'rate', value: target });
      if (ok) window.dispatchEvent(new CustomEvent(rateHintEvent, { detail: target }));
      else if (aimedRate.current != null && sameRate(aimedRate.current, target)) {
        aimedRate.current = null;
        setRateDraft(null);
      }
    }).finally(() => {
      pendingRates.current -= 1;
      if (pendingRates.current === 0) setRateSettled(count => count + 1);
    });
  };
  const stepPlayback = (direction: 1 | -1) => commitRate(nextRate(aimedRate.current ?? selected.rate, direction, null, rateStep));
  const requestPanel = async () => {
    if (!openPanel || openingPanel) return;
    setOpeningPanel(true);
    setPanelHint(false);
    try {
      const opened = await openPanel(selected.id);
      if (!opened) setPanelHint(true);
    } catch {
      setPanelHint(true);
    } finally {
      setOpeningPanel(false);
    }
  };
  const hideHere = async () => {
    if (await write({ floatingHiddenSites: hideFloating(floatingHiddenSites, page.host) })) window.dispatchEvent(new CustomEvent(actionHintEvent, { detail: i18n.t('floatingHiddenHint') }));
  };
  return <aside ref={container} className="fixed z-2147483647 size-12 transition-[left,top] duration-150 ease-out data-dragging:transition-none" aria-label={i18n.t('floatingController')} data-side={position.side} data-revealed={revealed} data-dragging={dragPoint ? '' : undefined} style={{ left: point.x, top: point.y }} onPointerEnter={() => { window.clearTimeout(hideTimer.current); setHovered(true); }} onPointerLeave={() => { window.clearTimeout(hideTimer.current); hideTimer.current = window.setTimeout(() => setHovered(false), 300); }} onWheelCapture={event => { hotkeys.wheel(event); }}>
    <Popover open={expanded} onOpenChange={setExpanded}>
      <PopoverTrigger render={<Button variant="outline" size="icon" />} className="size-12 cursor-grab touch-none rounded-full bg-background text-primary shadow-[0_2px_8px_rgb(0_0_0/.12)] hover:border-primary hover:bg-background active:cursor-grabbing aria-expanded:border-primary aria-expanded:bg-background dark:bg-background dark:hover:bg-background" aria-label={expanded ? i18n.t('collapsePill') : i18n.t('openPill')} title={i18n.t('pillTitle', { title: selected.title })} onFocus={event => setFocused(event.currentTarget.matches(':focus-visible'))} onBlur={() => setFocused(false)} onClick={event => {
        if (!dragged.current) return;
        dragged.current = false;
        event.preventBaseUIHandler();
      }} onPointerDown={event => {
        if (event.button !== 0) return;
        dragged.current = false;
        drag.current = { x: event.clientX - point.x, y: event.clientY - point.y, startX: event.clientX, startY: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }} onPointerMove={event => {
        const origin = drag.current;
        if (!origin || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        if (Math.hypot(event.clientX - origin.startX, event.clientY - origin.startY) > 5) dragged.current = true;
        if (!dragged.current) return;
        setExpanded(false);
        setDragPoint({ x: Math.max(0, Math.min(event.clientX - origin.x, viewport.width - dockSize)), y: Math.max(0, Math.min(event.clientY - origin.y, viewport.height - dockSize)) });
      }} onPointerUp={event => {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        if (dragPoint) { move(dropPosition(dragPoint, viewport)); setDragPoint(null); }
      }} onPointerCancel={() => { drag.current = null; dragged.current = false; setDragPoint(null); }} onKeyDown={event => {
        if (event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) return;
        const next = nudgePosition(position, event.key, viewport);
        if (next) { event.preventDefault(); move(next); }
      }}><img src={otterMark} alt="" aria-hidden="true" className="pointer-events-none size-[34px] object-contain" /></PopoverTrigger>
      <PopoverContent container={container} side={position.side === 'right' ? 'left' : 'right'} sideOffset={8} aria-label={i18n.t('volumePill')} className="h-auto w-auto flex-row items-center gap-2 bg-transparent p-0 shadow-none ring-0 data-[side=left]:flex-row-reverse" style={{ height: pillHeight }}>
        <div className="group/pill pointer-events-auto relative h-full w-[60px] shrink-0 overflow-hidden rounded-full bg-popover shadow-[0_4px_16px_rgb(0_0_0/.16)]" title={boostLimit} style={{ '--volume-boost': max > 100 ? boostColor(volume, max) : undefined } as CSSProperties}>
          <VolumeSlider size="pill" orientation="vertical" aria-label={i18n.t('volume')} aria-description={boostLimit} data-boost={volume > 100} format={{ style: 'unit', unit: 'percent' }} className="size-full rounded-[inherit]" max={max} value={volume} onValueChange={value => setVolume(value, false)} onValueCommitted={value => setVolume(value, true)} />
          {max > 100 && <span aria-hidden="true" data-slot="volume-limit-mark" className="pointer-events-none absolute inset-x-2 h-px bg-foreground/35" style={{ bottom: `calc(${thumbHeight / 2}px + (100% - ${thumbHeight}px) * ${100 / max})` }} />}
          <span aria-hidden="true" className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 rounded-lg bg-background px-1 text-sm font-semibold tabular-nums transition-colors text-primary data-[boost=true]:text-(--volume-boost)" data-boost={volume > 100}>{volume}%</span>
          <Button variant="ghost" size="icon" className="absolute bottom-2 left-1/2 size-11 -translate-x-1/2 rounded-full text-primary-foreground hover:bg-transparent hover:text-primary-foreground data-[low-volume=true]:text-foreground data-[low-volume=true]:hover:text-foreground dark:hover:bg-transparent [&_svg:not([class*='size-'])]:size-[23px]" data-low-volume={volume / max * pillHeight < 40} aria-label={selected.muted ? i18n.t('unmute') : i18n.t('mute')} aria-pressed={selected.muted} onClick={() => { setDraft(null); void command({ type: 'mute' }); }}>{selected.muted || volume === 0 ? <VolumeX /> : <Volume2 />}</Button>
        </div>
        <div className="pointer-events-auto flex max-h-full min-h-0 w-[148px] shrink-0 flex-col self-center overflow-hidden rounded-[28px] bg-popover shadow-[0_4px_16px_rgb(0_0_0/.16)]">
          <div role="group" aria-label={i18n.t('playback')} className="shrink-0 border-b border-border/70 px-1.5 pt-1.5 pb-1.5">
            <div className="flex items-center justify-between gap-0.5">
              <Button type="button" variant="ghost" size="sm" className="h-9 min-w-0 flex-1 gap-0.5 px-1 text-muted-foreground tabular-nums" aria-label={i18n.t('skipBack', { seconds: jump })} title={canSeek ? undefined : i18n.t('skipUnavailable')} aria-describedby={canSeek ? undefined : 'floating-skip-hint'} disabled={!canSeek} onClick={() => void command({ type: 'skip', value: -jump })}><RotateCcw /><span className="text-xs">{jump}</span></Button>
              <Button type="button" className="size-10 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 [&_svg:not([class*='size-'])]:size-5" aria-label={selected.paused ? i18n.t('play') : i18n.t('pause')} onClick={() => void command({ type: selected.paused ? 'play' : 'pause' })}>{selected.paused ? <Play fill="currentColor" strokeWidth={0} className="ml-0.5" /> : <Pause fill="currentColor" strokeWidth={0} />}</Button>
              <Button type="button" variant="ghost" size="sm" className="h-9 min-w-0 flex-1 gap-0.5 px-1 text-muted-foreground tabular-nums" aria-label={i18n.t('skipForward', { seconds: jump })} title={canSeek ? undefined : i18n.t('skipUnavailable')} aria-describedby={canSeek ? undefined : 'floating-skip-hint'} disabled={!canSeek} onClick={() => void command({ type: 'skip', value: jump })}><span className="text-xs">{jump}</span><RotateCw /></Button>
            </div>
            {!canSeek && <p id="floating-skip-hint" className="px-1 pt-1 text-center text-[11px] leading-4 text-muted-foreground">{i18n.t('skipUnavailable')}</p>}
          </div>
          <div role="group" aria-labelledby="floating-speed-label" className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden p-2">
            <p id="floating-speed-label" className="text-center text-xs font-medium text-muted-foreground">{i18n.t('speed')}</p>
            <div className="flex items-center justify-between gap-0.5">
              <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={i18n.t('shortcutSpeedDown', { step: formatRate(rateStep) })} disabled={sameRate(slowerRate, playbackRate)} onClick={() => stepPlayback(-1)}><Minus /></Button>
              <span className="min-w-0 truncate text-sm font-semibold text-primary tabular-nums">{formatRate(playbackRate)}×</span>
              <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={i18n.t('shortcutSpeedUp', { step: formatRate(rateStep) })} disabled={sameRate(fasterRate, playbackRate)} onClick={() => stepPlayback(1)}><Plus /></Button>
            </div>
            <ToggleGroup spacing={1} className="grid min-h-0 grid-cols-2 content-start gap-1 overflow-y-auto" value={activePreset === undefined ? [] : [String(activePreset)]} onValueChange={value => { const picked = value[0]; if (picked) commitRate(Number(picked)); }}>
              {ratePresets.map(speed => <ToggleGroupItem key={speed} value={String(speed)} aria-label={i18n.t('speedOption', { speed: formatRate(speed) })} className="h-7 w-full min-w-0 rounded-md border-0 bg-secondary/60 px-0.5 text-xs text-muted-foreground shadow-none aria-pressed:bg-primary aria-pressed:font-semibold aria-pressed:text-primary-foreground">{formatRate(speed)}×</ToggleGroupItem>)}
            </ToggleGroup>
          </div>
          {(openPanel || hideOnSite) && <div className="shrink-0 border-t border-border/70 px-1.5 py-1.5">
            <div className="flex items-center justify-end gap-0.5">
              {openPanel && <Button type="button" variant="ghost" size="sm" className="h-auto min-h-8 min-w-0 flex-1 gap-1 whitespace-normal px-2 py-1 text-xs text-muted-foreground" aria-label={i18n.t('openPanel')} disabled={openingPanel} onClick={() => void requestPanel()}><PanelTop />{i18n.t('openPanel')}</Button>}
              {hideOnSite && <Button type="button" variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground" aria-label={i18n.t('hideFloatingHere')} title={i18n.t('hideFloatingHere')} disabled={!page.host} onClick={() => void hideHere()}><EyeOff /></Button>}
            </div>
            {panelHint && <p role="status" className="px-1 pt-1 text-center text-[11px] leading-4 text-muted-foreground">{i18n.t('openPanelHint')}</p>}
          </div>}
        </div>
      </PopoverContent>
    </Popover>
    {entryNote && !expanded && <span role="status" aria-live="off" data-slot="entry-note" data-kind={entryNote.kind} data-boost={entryNote.boost} aria-label={entryNote.kind === 'volume' ? i18n.t('floatingEntryVolume', { percent: volume }) : i18n.t('floatingEntrySpeed', { rate: formatRate(playbackRate) })} className={`pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 rounded-full border border-border/70 bg-background/90 px-1.5 py-0.5 text-[11px] leading-none font-medium whitespace-nowrap text-muted-foreground tabular-nums shadow-[0_1px_2px_rgb(0_0_0/.12)] data-[boost=true]:font-semibold data-[boost=true]:text-(--volume-boost) ${position.side === 'right' ? 'right-[calc(100%+6px)]' : 'left-[calc(100%+6px)]'}`} style={entryNote.boost ? { '--volume-boost': boostColor(volume, max) } as CSSProperties : undefined}>{entryNote.text}</span>}
    {error && <Alert variant="destructive" className="fixed bottom-2 left-2 w-auto max-w-[min(320px,calc(100vw-16px))] shadow-md"><CircleAlert /><AlertDescription>{error}</AlertDescription></Alert>}
  </aside>;
}
