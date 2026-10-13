import { useEffect, useRef, useState } from 'react';
import { CircleAlert, Volume2, VolumeX } from 'lucide-react';
import otterMark from '../assets/otter-mark';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Slider } from './ui/slider';
import { useMedia } from '../hooks/use-media';
import { useSettings } from '../hooks/use-settings';
import type { MediaClient, SettingsStore } from '../lib/types';

const clampPosition = (value: { x: number; y: number }) => ({ x: Math.max(8, Math.min(value.x, window.innerWidth - 56)), y: Math.max(8, Math.min(value.y, window.innerHeight - 56)) });
const first = (value: number | readonly number[]) => Array.isArray(value) ? value[0] : value;

export function FloatingController({ client, store }: { client: MediaClient; store: SettingsStore }) {
  const { settings } = useSettings(store);
  const { page, selected, command, error } = useMedia(client);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<number | null>(null);
  const [position, setPosition] = useState(() => clampPosition({ x: window.innerWidth - 72, y: window.innerHeight - 170 }));
  const container = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const dragged = useRef(false);

  useEffect(() => {
    const resize = () => setPosition(clampPosition);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => { setDraft(null); }, [selected?.id]);

  if (!settings.floating || !page.enabled || !selected) return null;
  const volume = draft ?? Math.round((selected.muted ? 0 : selected.volume) * 100);
  return <aside ref={container} className="fixed z-2147483647 size-12" aria-label="浮动控制器" style={{ left: position.x, top: position.y }}>
    <Popover open={expanded} onOpenChange={setExpanded}>
      <PopoverTrigger render={<Button variant="outline" size="icon" />} className="size-12 cursor-grab touch-none rounded-full bg-background text-primary shadow-[0_5px_18px_#15112914] hover:border-2 hover:border-primary hover:bg-background active:cursor-grabbing aria-expanded:border-2 aria-expanded:border-primary aria-expanded:bg-background dark:bg-background dark:hover:bg-background" aria-label={expanded ? '收起音量药丸，方向键可移动浮动入口' : '打开音量药丸，方向键可移动浮动入口'} title={selected.title + ' · 点击调节音量，拖动移动'} onClick={event => {
        if (!dragged.current) return;
        dragged.current = false;
        event.preventBaseUIHandler();
      }} onPointerDown={event => {
        if (event.button !== 0) return;
        dragged.current = false;
        drag.current = { x: event.clientX - position.x, y: event.clientY - position.y, startX: event.clientX, startY: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }} onPointerMove={event => {
        const origin = drag.current;
        if (!origin || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        if (Math.hypot(event.clientX - origin.startX, event.clientY - origin.startY) > 5) dragged.current = true;
        if (dragged.current) { setExpanded(false); setPosition(clampPosition({ x: event.clientX - origin.x, y: event.clientY - origin.y })); }
      }} onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { drag.current = null; dragged.current = false; }} onKeyDown={event => {
        const steps: Record<string, [number, number]> = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
        const step = steps[event.key];
        if (step) { event.preventDefault(); setPosition(previous => clampPosition({ x: previous.x + step[0], y: previous.y + step[1] })); }
      }}><img src={otterMark} alt="" aria-hidden="true" className="pointer-events-none size-[34px] object-contain" /></PopoverTrigger>
      <PopoverContent container={container} side="left" sideOffset={8} aria-label="音量药丸" className="relative h-[184px] w-[60px] gap-0 rounded-full p-0 shadow-[0_12px_28px_#15112924] ring-0">
        <Slider size="pill" orientation="vertical" aria-label="音量" format={{ style: 'unit', unit: 'percent' }} className="size-full rounded-[inherit]" min={0} max={100} step={1} value={[volume]} onValueChange={value => {
          const next = first(value);
          if (next === undefined) return;
          setDraft(next); void command({ type: 'volume', value: next / 100 });
        }} onValueCommitted={value => {
          const next = first(value);
          if (next === undefined) return;
          void command({ type: 'volume', value: next / 100 }).finally(() => setDraft(null));
        }} />
        <span aria-hidden="true" className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 rounded-lg bg-background px-1 text-sm font-semibold tabular-nums">{volume}%</span>
        <Button variant="ghost" size="icon" className="absolute bottom-2 left-1/2 size-11 -translate-x-1/2 rounded-full text-primary-foreground hover:bg-transparent hover:text-primary-foreground data-[low-volume=true]:text-foreground data-[low-volume=true]:hover:text-foreground dark:hover:bg-transparent [&_svg:not([class*='size-'])]:size-[23px]" data-low-volume={volume < 22} aria-label={selected.muted ? '取消静音' : '静音'} aria-pressed={selected.muted} onClick={() => { setDraft(null); void command({ type: 'mute' }); }}>{selected.muted || volume === 0 ? <VolumeX /> : <Volume2 />}</Button>
      </PopoverContent>
    </Popover>
    {error && <Alert variant="destructive" className="fixed bottom-2 left-2 w-auto max-w-[min(320px,calc(100vw-16px))] shadow-md"><CircleAlert /><AlertDescription>{error}</AlertDescription></Alert>}
  </aside>;
}
