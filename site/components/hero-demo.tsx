'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react';
import { MediaPanel } from '@/components/media-panel';
import { SettingsPage } from '@/components/settings-page';
import { Button } from '@/components/ui/button';
import { getDemo } from './demo-runtime';

export interface HeroDemoCopy { caption: string; play: string; pause: string; reset: string; addSecond: string; removeSecond: string; note: string; mediaTitle: string; secondTitle: string }

export default function HeroDemo({ copy }: { copy: HeroDemoCopy }) {
  const [demo] = useState(() => getDemo(copy.mediaTitle));
  const { media } = demo;
  const [playing, setPlaying] = useState(!media.paused);
  const [extra, setExtra] = useState(false);
  const [settings, setSettings] = useState(false);
  useEffect(() => {
    const sync = () => setPlaying(!media.paused);
    media.addEventListener('play', sync); media.addEventListener('pause', sync);
    return () => { media.removeEventListener('play', sync); media.removeEventListener('pause', sync); };
  }, [media]);
  useEffect(() => demo.listenHotkeys(window), [demo]);
  useEffect(() => {
    if (!settings) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setSettings(false); };
    window.addEventListener('keydown', close);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', close); document.body.style.overflow = ''; };
  }, [settings]);

  return <div className="flex w-full flex-col items-center gap-5">
    <p className="flex w-[400px] max-w-full items-center gap-3 text-[11px] text-muted-foreground"><span className="h-px flex-1 bg-border" />{copy.caption}<span className="h-px flex-1 bg-border" /></p>
    <div className="w-[400px] max-w-full overflow-hidden rounded-[13px] border bg-background text-left shadow-[0_24px_60px_-20px_rgb(101_93_233/.35)] dark:shadow-[0_24px_60px_-20px_rgb(0_0_0/.6)]">
      <MediaPanel client={demo.client} openSettings={() => setSettings(true)} />
    </div>
    <div className="flex flex-wrap justify-center gap-2.5">
      <Button onClick={() => { if (media.paused) void media.play(); else media.pause(); }}>{playing ? <Pause /> : <Play />}{playing ? copy.pause : copy.play}</Button>
      <Button variant="outline" onClick={() => void demo.reset()}><RotateCcw />{copy.reset}</Button>
      <Button variant="ghost" className="text-muted-foreground" onClick={() => { demo.setSecond(extra ? null : copy.secondTitle); setExtra(!extra); }}>{extra ? <Minus /> : <Plus />}{extra ? copy.removeSecond : copy.addSecond}</Button>
    </div>
    <p className="max-w-sm text-center text-xs leading-relaxed text-muted-foreground">{copy.note}</p>
    {settings && createPortal(<div className="fixed inset-0 z-50 overflow-y-auto bg-background"><SettingsPage back={() => setSettings(false)} /></div>, document.body)}
  </div>;
}
