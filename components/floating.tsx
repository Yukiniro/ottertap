import { i18n } from '#i18n';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { CircleAlert, Volume2, VolumeX } from 'lucide-react';
import otterMark from '../assets/otter-mark';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Slider } from './ui/slider';
import { useMedia } from '../hooks/use-media';
import { dockedPoint, dockSize, dropPosition, nudgePosition, type Viewport } from '../lib/dock';
import { commandForHotkey, createHotkeyInput, volumeGestureEvent } from '../lib/hotkey';
import type { FloatingPosition, MediaClient, MediaCommand, MediaState } from '../lib/types';
import { useSettingsAtoms } from './theme';

const first = (value: number | readonly number[]) => Array.isArray(value) ? value[0] : value;
const readViewport = (): Viewport => ({ width: document.documentElement.clientWidth || window.innerWidth, height: document.documentElement.clientHeight || window.innerHeight });
const thumbHeight = 10;
const boostColor = (volume: number, max: number) => `color-mix(in oklch, oklch(0.577 0.245 27.325) ${Math.max(0, Math.min(1, (volume - 100) / (max - 100))) * 100}%, oklch(0.705 0.213 47.604))`;

export function FloatingController({ client }: { client: MediaClient }) {
  const { floatingAtom, floatingPositionAtom, loadingAtom, writeSettingsAtom } = useSettingsAtoms();
  const floating = useAtomValue(floatingAtom);
  const floatingPosition = useAtomValue(floatingPositionAtom);
  const loading = useAtomValue(loadingAtom);
  const write = useSetAtom(writeSettingsAtom);
  const { page, selected, command, error } = useMedia(client);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<number | null>(null);
  const [viewport, setViewport] = useState(readViewport);
  const [moved, setMoved] = useState<FloatingPosition | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const container = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const dragged = useRef(false);
  const hideTimer = useRef(0);

  useEffect(() => {
    const resize = () => setViewport(readViewport());
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); window.clearTimeout(hideTimer.current); };
  }, []);
  useEffect(() => { setDraft(null); }, [selected?.id]);
  const floatingRef = useRef(floating);
  const mediaRef = useRef(selected);
  const clientRef = useRef(client);
  const optimistic = useRef<MediaState | null>(null);
  const pendingCommand = useRef<MediaCommand | null>(null);
  const sending = useRef(false);
  floatingRef.current = floating;
  mediaRef.current = selected;
  clientRef.current = client;
  const hotkeys = useMemo(() => createHotkeyInput(action => {
    const current = mediaRef.current;
    if (!current) return;
    const base = optimistic.current?.id === current.id ? optimistic.current : current;
    const next = commandForHotkey(action, base);
    if (!next) return;
    if (next.type === 'volume') {
      optimistic.current = { ...base, volume: next.value, muted: next.value <= 0 };
      setDraft(Math.round(next.value * 100));
      pendingCommand.current = next;
      if (sending.current) return;
      const flush = () => {
        const command = pendingCommand.current;
        const media = mediaRef.current;
        pendingCommand.current = null;
        if (!command || !media) { sending.current = false; return; }
        sending.current = true;
        void clientRef.current.command(media, command).finally(flush);
      };
      flush();
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
    const open = () => { if (floatingRef.current) setExpanded(true); };
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

  if (loading || !floating || !page.enabled || !selected) return null;
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
  const setVolume = (value: number | readonly number[], commit: boolean) => {
    const next = first(value);
    if (next === undefined) return;
    optimistic.current = null;
    if (!commit) setDraft(next);
    const done = command({ type: 'volume', value: next / 100 });
    if (commit) void done.finally(() => setDraft(null));
  };
  const boostLimit = max > 100 ? undefined : i18n.t('cannotBoostCrossOrigin');
  return <aside ref={container} className="fixed z-2147483647 size-12 transition-[left,top] duration-150 ease-out data-dragging:transition-none" aria-label={i18n.t('floatingController')} data-side={position.side} data-revealed={revealed} data-dragging={dragPoint ? '' : undefined} style={{ left: point.x, top: point.y }} onPointerEnter={() => { window.clearTimeout(hideTimer.current); setHovered(true); }} onPointerLeave={() => { window.clearTimeout(hideTimer.current); hideTimer.current = window.setTimeout(() => setHovered(false), 300); }} onKeyDownCapture={event => { hotkeys.key(event); }} onWheelCapture={event => { hotkeys.wheel(event); }}>
    <Popover open={expanded} onOpenChange={setExpanded}>
      <PopoverTrigger render={<Button variant="outline" size="icon" />} className="size-12 cursor-grab touch-none rounded-full bg-background text-primary shadow-[0_5px_18px_#15112914] hover:border-2 hover:border-primary hover:bg-background active:cursor-grabbing aria-expanded:border-2 aria-expanded:border-primary aria-expanded:bg-background dark:bg-background dark:hover:bg-background" aria-label={expanded ? i18n.t('collapsePill') : i18n.t('openPill')} title={i18n.t('pillTitle', { title: selected.title })} onFocus={event => setFocused(event.currentTarget.matches(':focus-visible'))} onBlur={() => setFocused(false)} onClick={event => {
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
      <PopoverContent container={container} side={position.side === 'right' ? 'left' : 'right'} sideOffset={8} aria-label={i18n.t('volumePill')} title={boostLimit} className="group/pill relative w-[60px] gap-0 rounded-full p-0 shadow-[0_12px_28px_#15112924] ring-0" style={{ height: pillHeight, '--volume-boost': max > 100 ? boostColor(volume, max) : undefined } as CSSProperties}>
        <Slider size="pill" orientation="vertical" aria-label={i18n.t('volume')} aria-description={boostLimit} data-boost={volume > 100} format={{ style: 'unit', unit: 'percent' }} className="size-full rounded-[inherit]" min={0} max={max} step={1} value={[volume]} onValueChange={value => setVolume(value, false)} onValueCommitted={value => setVolume(value, true)} />
        {max > 100 && <span aria-hidden="true" data-slot="volume-limit-mark" className="pointer-events-none absolute inset-x-2 h-px bg-foreground/35" style={{ bottom: `calc(${thumbHeight / 2}px + (100% - ${thumbHeight}px) * ${100 / max})` }} />}
        <span aria-hidden="true" className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 rounded-lg bg-background px-1 text-sm font-semibold tabular-nums transition-colors group-has-data-dragging/pill:text-primary data-[boost=true]:text-(--volume-boost)" data-boost={volume > 100}>{volume}%</span>
        <Button variant="ghost" size="icon" className="absolute bottom-2 left-1/2 size-11 -translate-x-1/2 rounded-full text-primary-foreground hover:bg-transparent hover:text-primary-foreground data-[low-volume=true]:text-foreground data-[low-volume=true]:hover:text-foreground dark:hover:bg-transparent [&_svg:not([class*='size-'])]:size-[23px]" data-low-volume={volume / max * pillHeight < 40} aria-label={selected.muted ? i18n.t('unmute') : i18n.t('mute')} aria-pressed={selected.muted} onClick={() => { setDraft(null); void command({ type: 'mute' }); }}>{selected.muted || volume === 0 ? <VolumeX /> : <Volume2 />}</Button>
      </PopoverContent>
    </Popover>
    {error && <Alert variant="destructive" className="fixed bottom-2 left-2 w-auto max-w-[min(320px,calc(100vw-16px))] shadow-md"><CircleAlert /><AlertDescription>{error}</AlertDescription></Alert>}
  </aside>;
}
