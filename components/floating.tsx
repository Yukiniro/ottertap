import { useEffect, useId, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Slider } from '@base-ui/react/slider';
import otterMark from '../assets/otter-mark';
import { Button } from './ui/button';
import { useMedia } from '../hooks/use-media';
import { useSettings } from '../hooks/use-settings';
import type { MediaClient, SettingsStore } from '../lib/types';

export function FloatingController({ client, store }: { client: MediaClient; store: SettingsStore }) {
  const { settings } = useSettings(store);
  const { page, selected, command, error } = useMedia(client);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<number | null>(null);
  const [position, setPosition] = useState({ x: Math.max(8, window.innerWidth - 72), y: Math.max(8, window.innerHeight - 170) });
  const container = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const dragged = useRef(false);
  const panelId = useId();
  const pillWidth = Math.min(60, Math.max(24, window.innerWidth - 72));
  const pillHeight = Math.min(184, Math.max(64, window.innerHeight - 16));
  const clampPosition = (value: { x: number; y: number }, open = expanded) => {
    let x = Math.max(8, Math.min(value.x, window.innerWidth - 56));
    if (open && x < pillWidth + 16 && window.innerWidth - x - 56 < pillWidth + 8) x = x >= (window.innerWidth - 48) / 2 ? Math.max(8, window.innerWidth - 56) : 8;
    return { x, y: Math.max(8, Math.min(value.y, window.innerHeight - 56)) };
  };
  const pillLeft = position.x >= pillWidth + 16 ? -pillWidth - 8 : 56;
  const pillTop = Math.max(8 - position.y, Math.min((48 - pillHeight) / 2, window.innerHeight - 8 - position.y - pillHeight));

  useEffect(() => {
    const resize = () => setPosition(previous => clampPosition(previous));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [expanded]);
  useEffect(() => { setDraft(null); }, [selected?.id]);
  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => { if (container.current && !event.composedPath().includes(container.current)) setExpanded(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setExpanded(false);
      if (container.current && event.composedPath().includes(container.current)) { event.preventDefault(); event.stopPropagation(); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape, true); };
  }, [expanded]);

  if (!settings.floating || !page.enabled || !selected) return null;
  const volume = draft ?? Math.round((selected.muted ? 0 : selected.volume) * 100);
  return <aside ref={container} className="floating-controller" aria-label="小獭浮动控制器" style={{ left: position.x, top: position.y }}>
    <Button ref={trigger} variant="outline" size="icon" className="floating-trigger" aria-label={expanded ? '收起音量控制器，方向键可移动' : '打开音量控制器，方向键可移动'} aria-expanded={expanded} aria-controls={expanded ? panelId : undefined} aria-haspopup="dialog" title={selected.title + ' · 点击调节音量，拖动移动'} onClick={() => {
      if (dragged.current) { dragged.current = false; return; }
      if (!expanded) setPosition(previous => clampPosition(previous, true));
      setExpanded(!expanded);
    }} onPointerDown={event => {
      if (event.button !== 0) return;
      dragged.current = false;
      drag.current = { x: event.clientX - position.x, y: event.clientY - position.y, startX: event.clientX, startY: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={event => {
      const origin = drag.current;
      if (!origin || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
      if (Math.hypot(event.clientX - origin.startX, event.clientY - origin.startY) > 5) dragged.current = true;
      if (dragged.current) { setExpanded(false); setPosition(clampPosition({ x: event.clientX - origin.x, y: event.clientY - origin.y }, false)); }
    }} onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { drag.current = null; dragged.current = false; }} onKeyDown={event => {
      const steps: Record<string, [number, number]> = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
      const step = steps[event.key];
      if (step) { event.preventDefault(); setPosition(previous => clampPosition({ x: previous.x + step[0], y: previous.y + step[1] })); }
    }}><img src={otterMark} alt="" aria-hidden="true" /></Button>
    {expanded && <div id={panelId} role="dialog" aria-label="音量控制" className="floating-popover" style={{ left: pillLeft, top: pillTop, width: pillWidth, height: pillHeight }}>
      <Slider.Root className="volume-capsule" orientation="vertical" min={0} max={100} step={1} value={[volume]} thumbAlignment="edge" onValueChange={value => {
        const next = Array.isArray(value) ? value[0] : value;
        if (next === undefined) return;
        setDraft(next); void command({ type: 'volume', value: next / 100 });
      }} onValueCommitted={value => {
        const next = Array.isArray(value) ? value[0] : value;
        if (next === undefined) return;
        void command({ type: 'volume', value: next / 100 }).finally(() => setDraft(null));
      }}>
        <Slider.Control className="pill-control"><Slider.Track className="pill-track"><Slider.Indicator className="pill-fill" /></Slider.Track><Slider.Thumb className="pill-thumb" aria-label="音量" aria-valuetext={volume + '%'} /></Slider.Control>
        <span className="pill-value" aria-hidden="true">{volume}%</span>
      </Slider.Root>
      <Button variant="ghost" size="icon" className="pill-mute" data-low-volume={volume < 22} aria-label={selected.muted ? '取消静音' : '静音'} aria-pressed={selected.muted} onClick={() => { setDraft(null); void command({ type: 'mute' }); }}>{selected.muted || volume === 0 ? <VolumeX /> : <Volume2 />}</Button>
    </div>}
    {error && <p className="floating-error" role="alert">{error}</p>}
  </aside>;
}
