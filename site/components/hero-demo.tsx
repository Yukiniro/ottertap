'use client';
import { i18n } from '#i18n';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react';
import { maxGain } from '@/lib/amplifier';
import { demoRate, demoStartAt, demoUrl, demoVolume } from '@/lib/demo';
import type { MediaClient, MediaState, PageState } from '@/lib/types';
import { MediaPanel } from '@/components/media-panel';
import { SettingsPage } from '@/components/settings-page';
import { Button } from '@/components/ui/button';
import { getDemo } from './demo-runtime';

export interface HeroDemoCopy { caption: string; play: string; pause: string; reset: string; addSecond: string; removeSecond: string; note: string; mediaTitle: string; secondTitle: string }

// preview/demo.wav is 8 kHz, 16-bit, mono, 12_288_000 data bytes.
const demoDuration = 768;
const demoHost = new URL(demoUrl).host;

/** The settled popup, so the static HTML matches the panel after metadata loads. */
function demoPreviewPage(title: string): PageState {
  const media: MediaState = {
    id: '1', label: title, title, host: demoHost, kind: 'video', paused: true, muted: false,
    volume: demoVolume, maxVolume: maxGain, rate: demoRate, currentTime: demoStartAt, duration: demoDuration, live: false,
    seekable: [{ start: 0, end: demoDuration }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true
  };
  return { host: demoHost, enabled: true, media: [media], selectedId: '' };
}

function previewClient(page: PageState): MediaClient {
  return { read: () => Promise.resolve(page), command: () => Promise.resolve(), select: () => Promise.resolve(), highlight: () => Promise.resolve() };
}

export default function HeroDemo({ copy }: { copy: HeroDemoCopy }) {
  const preview = demoPreviewPage(copy.mediaTitle);
  const [client, setClient] = useState<MediaClient>(() => previewClient(preview));
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [extra, setExtra] = useState(false);
  const [settings, setSettings] = useState(false);
  const demoRef = useRef<ReturnType<typeof getDemo> | null>(null);
  useEffect(() => {
    const demo = getDemo(copy.mediaTitle);
    demoRef.current = demo;
    const { media } = demo;
    const sync = () => setPlaying(!media.paused);
    const attach = () => { if (media.readyState >= 1 && Number.isFinite(media.duration)) { setClient(demo.client); setReady(true); setFailed(false); } };
    const fail = () => { setReady(false); setFailed(true); };
    media.addEventListener('play', sync);
    media.addEventListener('pause', sync);
    media.addEventListener('loadedmetadata', attach);
    media.addEventListener('error', fail);
    attach();
    if (media.error) fail();
    return () => {
      media.removeEventListener('play', sync);
      media.removeEventListener('pause', sync);
      media.removeEventListener('loadedmetadata', attach);
      media.removeEventListener('error', fail);
    };
  }, [copy.mediaTitle]);
  useEffect(() => { if (ready) return demoRef.current?.listenHotkeys(window); }, [ready]);
  useEffect(() => {
    if (!settings) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setSettings(false); };
    window.addEventListener('keydown', close);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', close); document.body.style.overflow = ''; };
  }, [settings]);

  return <div data-hero-demo className="flex w-full flex-col items-center gap-5">
    <p className="flex w-[400px] max-w-full items-center gap-3 text-[11px] text-muted-foreground"><span className="h-px flex-1 bg-border" />{copy.caption}<span className="h-px flex-1 bg-border" /></p>
    <fieldset disabled={!ready} inert={!ready} aria-busy={!ready && !failed} className="w-[400px] max-w-full overflow-hidden rounded-xl border bg-background text-left shadow-[0_12px_32px_-12px_rgb(0_0_0/.16)] dark:shadow-[0_12px_32px_-12px_rgb(0_0_0/.4)]">
      <MediaPanel client={client} initial={preview} openSettings={() => setSettings(true)} />
    </fieldset>
    {failed && <p role="alert" className="text-sm text-destructive">{i18n.t('demoLoadError')}</p>}
    <div className="flex flex-wrap justify-center gap-2.5">
      <Button disabled={!ready} variant="secondary" onClick={() => { const media = demoRef.current?.media; if (!media) return; if (media.paused) void media.play(); else media.pause(); }}>{playing ? <Pause /> : <Play />}{playing ? copy.pause : copy.play}</Button>
      <Button disabled={!ready} variant="outline" onClick={() => void demoRef.current?.reset()}><RotateCcw />{copy.reset}</Button>
      <Button disabled={!ready} variant="ghost" className="text-muted-foreground" onClick={() => { const demo = demoRef.current; if (!demo) return; demo.setSecond(extra ? null : copy.secondTitle); setExtra(!extra); }}>{extra ? <Minus /> : <Plus />}{extra ? copy.removeSecond : copy.addSecond}</Button>
    </div>
    <p className="max-w-sm text-center text-xs leading-relaxed text-muted-foreground">{copy.note}</p>
    {settings && createPortal(<div className="fixed inset-0 z-50 overflow-y-auto bg-background"><SettingsPage back={() => setSettings(false)} /></div>, document.body)}
  </div>;
}
