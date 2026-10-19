import { i18n } from '#i18n';
import { useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { ChevronDown, Settings2, Settings as SettingsIcon, Volume2, VolumeX, AppWindow, Pause, Play, RotateCcw, RotateCw, Keyboard, CircleAlert, Search, RefreshCw, PictureInPicture2 } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './ui/empty';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from './ui/item';
import { Slider } from './ui/slider';
import { VolumeSlider } from './volume-slider';
import { Switch } from './ui/switch';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Brand } from './brand';
import { useMedia } from '../hooks/use-media';
import { mediaChoiceLabel, pipHint } from '../lib/media';
import { formatRate, sameRate } from '../lib/rate';
import type { SoundingTab, SoundingTabsClient } from '../lib/tabs';
import { disableSite, enableSite, forgetMatchingSites, isSiteEnabled, rememberSite, sitePrefFor } from '../lib/settings';
import { defaultSettings, type MediaClient } from '../lib/types';
import { formatTime } from '../lib/utils';
import { useSettingsAtoms } from './theme';

const first = (value: number | readonly number[]) => Array.isArray(value) ? value[0] : value;
function TabIcon({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <AppWindow aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />;
  return <img src={src} alt="" className="size-4 shrink-0 rounded-sm" onError={() => setFailed(true)} />;
}
function useSoundingTabs(client?: SoundingTabsClient) {
  const [tabs, setTabs] = useState<SoundingTab[]>([]);
  const [ready, setReady] = useState(false);
  const loadRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    if (!client) return;
    let alive = true;
    let ticket = 0;
    const load = async () => {
      const current = ++ticket;
      try {
        const next = await client.list();
        if (alive && current === ticket) { setTabs(next); setReady(true); }
      } catch { /* A later tab event retries. */ }
    };
    loadRef.current = load;
    void load();
    const stop = client.watch(() => { void load(); });
    return () => { alive = false; stop(); };
  }, [client]);
  const focus = (tabId: number) => { void client?.focus(tabId).catch(() => {}); };
  const mute = (tab: SoundingTab) => {
    if (!client) return;
    const muted = !tab.muted;
    setTabs(current => current.map(item => item.id === tab.id ? { ...item, muted } : item));
    void client.mute(tab.id, muted).catch(() => {}).finally(() => { void loadRef.current(); });
  };
  return { tabs: client && ready ? tabs : [], ready: !!client && ready, focus, mute };
}
function OtherPlaying({ client }: { client?: SoundingTabsClient }) {
  const { tabs, ready, focus, mute } = useSoundingTabs(client);
  if (!ready) return null;
  if (!tabs.length) return <p className="pb-1 text-center text-xs text-muted-foreground">{i18n.t('otherPlayingEmpty')}</p>;
  return <section aria-labelledby="other-playing-tabs" className="shrink-0">
    <h2 id="other-playing-tabs" className="px-1 pb-1 text-xs font-medium text-muted-foreground">{i18n.t('otherPlayingTabs')}</h2>
    <div role="list" className="max-h-28 overflow-y-auto overscroll-contain rounded-xl bg-card shadow-card">
      {tabs.map(tab => <div role="listitem" key={tab.id} className="flex items-center gap-1 border-b border-border/70 px-1.5 py-1 last:border-b-0">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-muted" aria-label={i18n.t('switchToTab', { title: tab.title || '—' })} onClick={() => focus(tab.id)}>
          <TabIcon src={tab.favIconUrl} />
          <span title={tab.title} className="truncate text-sm">{tab.title || '—'}</span>
        </button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={tab.muted ? i18n.t('unmute') : i18n.t('mute')} aria-pressed={tab.muted} onClick={() => mute(tab)}>{tab.muted ? <VolumeX /> : <Volume2 />}</Button>
      </div>)}
    </div>
  </section>;
}
export function MediaPanel({ client, openSettings, sounding }: { client: MediaClient; openSettings: () => void; sounding?: SoundingTabsClient }) {
  const { page, selected, select, command, refresh, loading, error } = useMedia(client);
  const { floatingAtom, siteModeAtom, sitesAtom, sitePrefsAtom, ratePresetsAtom, loadingAtom, errorAtom, writeSettingsAtom } = useSettingsAtoms();
  const floating = useAtomValue(floatingAtom);
  const siteMode = useAtomValue(siteModeAtom);
  const sites = useAtomValue(sitesAtom);
  const sitePrefs = useAtomValue(sitePrefsAtom);
  const ratePresets = useAtomValue(ratePresetsAtom);
  const settingsLoading = useAtomValue(loadingAtom);
  const settingsError = useAtomValue(errorAtom);
  const write = useSetAtom(writeSettingsAtom);
  const rules = { ...defaultSettings, siteMode, sites };
  const rulesEnabled = page.host ? isSiteEnabled(`https://${page.host}/`, rules) : page.enabled;
  const outOfSync = !settingsLoading && rulesEnabled !== page.enabled;
  const siteAction = !settingsLoading && page.host && !outOfSync ? (page.enabled ? disableSite(page.host, rules) : enableSite(page.host, rules)) : null;
  useEffect(() => { if (outOfSync) void refresh(); }, [outOfSync, refresh]);
  const showMedia = (id: string) => { const media = page.media.find(item => item.id === id); if (media) void client.highlight(media).catch(() => {}); };
  const [seekDraft, setSeekDraft] = useState<number | null>(null);
  const [offerRemember, setOfferRemember] = useState(false);
  const remembered = page.host ? sitePrefFor(page.host, sitePrefs) : null;
  const storePreference = () => {
    if (!selected || !page.host || settingsLoading) return;
    void write({ sitePrefs: rememberSite(sitePrefs, page.host, { volume: selected.volume, rate: selected.rate }) });
  };
  const adjust = (value: Parameters<typeof command>[0]) => {
    if ((value.type === 'volume' || value.type === 'rate') && !remembered) setOfferRemember(true);
    return command(value);
  };
  useEffect(() => { setOfferRemember(false); }, [page.host, selected?.id]);
  const ranges = selected?.seekable ?? [];
  const seekMin = ranges[0]?.start ?? 0;
  const seekMax = ranges[ranges.length - 1]?.end ?? 0;
  const canSeek = seekMax > seekMin;
  const volume = selected ? Math.round((selected.muted ? 0 : selected.volume) * 100) : 0;
  const hint = selected ? pipHint(selected) : '';
  const activePreset = selected ? ratePresets.find(speed => sameRate(speed, selected.rate)) : undefined;
  const showSiteAction = page.enabled && !outOfSync && !!siteAction?.settings;
  return <section className="flex w-[400px] max-w-full flex-col gap-2.5 bg-background px-3.5 pt-1 pb-2" aria-label={i18n.t('mediaPanel')}>
    <header className="flex h-12 items-center justify-between">
      <Brand className="text-base [&_img]:size-7" />
      <Button variant="ghost" size="icon" aria-label={i18n.t('openSettings')} onClick={openSettings}><SettingsIcon className="size-5" /></Button>
    </header>
    {page.media.length > 1 && <DropdownMenu onOpenChange={open => { if (open && selected) showMedia(selected.id); }}>
      <DropdownMenuTrigger id="popup-media" render={<Button variant="ghost" size="sm" />} className="h-8 w-full justify-between rounded-full bg-card px-3 font-normal shadow-card">
        <span className="truncate">{selected ? mediaChoiceLabel(selected, page.media.findIndex(media => media.id === selected.id)) : i18n.t('chooseMedia')}</span>
        <ChevronDown data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuRadioGroup value={selected?.id ?? ''} onValueChange={id => { select(id); setSeekDraft(null); showMedia(id); }}>
          {page.media.map((media, index) => <DropdownMenuRadioItem key={media.id} value={media.id}><span className="truncate">{mediaChoiceLabel(media, index)}</span></DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>}
    {selected ? <>
      <div className="rounded-2xl bg-card px-4 pt-4 pb-3 shadow-card">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">{page.host || selected.host}</p>
          <h1 title={selected.title} className="mt-1.5 line-clamp-2 min-h-7 text-[22px] leading-7 font-bold tracking-tight">{selected.title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{selected.kind === 'video' ? i18n.t('video') : i18n.t('audio')} · {selected.paused ? i18n.t('paused') : i18n.t('playing')}</p>
        </div>
        <div className="mt-4 flex items-center justify-center gap-7">
          <Button variant="ghost" className="relative size-[50px] rounded-full bg-muted hover:bg-muted/80 [&_svg:not([class*='size-'])]:size-[26px]" aria-label={i18n.t('skipBack')} disabled={!canSeek} onClick={() => void command({ type: 'skip', value: -10 })}><RotateCcw className="-translate-y-0.5" /><span className="absolute top-6 bg-muted px-0.5 text-[10px] leading-none font-semibold">10</span></Button>
          <Button className="size-[66px] rounded-full transition-transform hover:bg-primary/90 active:scale-95 [&_svg:not([class*='size-'])]:size-7" aria-label={selected.paused ? i18n.t('play') : i18n.t('pause')} onClick={() => void command({ type: selected.paused ? 'play' : 'pause' })}>{selected.paused ? <Play fill="currentColor" strokeWidth={0} className="ml-0.5" /> : <Pause fill="currentColor" strokeWidth={0} />}</Button>
          <Button variant="ghost" className="relative size-[50px] rounded-full bg-muted hover:bg-muted/80 [&_svg:not([class*='size-'])]:size-[26px]" aria-label={i18n.t('skipForward')} disabled={!canSeek} onClick={() => void command({ type: 'skip', value: 10 })}><RotateCw className="-translate-y-0.5" /><span className="absolute top-6 bg-muted px-0.5 text-[10px] leading-none font-semibold">10</span></Button>
        </div>
        <Slider aria-label={i18n.t('seek')} className="mt-3 py-2" min={seekMin} max={Math.max(seekMin + 1, seekMax)} step={1} value={[seekDraft ?? selected.currentTime]} disabled={!canSeek} onValueChange={value => setSeekDraft(first(value) ?? null)} onValueCommitted={value => { void command({ type: 'seek', value: first(value) ?? seekMin }).finally(() => setSeekDraft(null)); }} />
        <div className="mt-0.5 flex justify-between text-sm text-muted-foreground tabular-nums"><span>{formatTime(seekDraft ?? selected.currentTime)}</span><span>{selected.duration === null ? selected.live ? i18n.t('live') : '--:--' : formatTime(selected.duration)}</span></div>
        <div className="mt-3 flex flex-col items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full bg-muted px-3 hover:bg-muted/80 aria-pressed:bg-primary/15 aria-pressed:text-primary" aria-pressed={selected.pip} aria-label={selected.pip ? i18n.t('exitPictureInPicture') : i18n.t('pictureInPicture')} aria-describedby={hint ? 'pip-hint' : undefined} disabled={!!hint} onClick={() => void command({ type: 'pip' })}><PictureInPicture2 />{selected.pip ? i18n.t('exitPictureInPicture') : i18n.t('pictureInPicture')}</Button>
          {hint ? <p id="pip-hint" className="text-center text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
      <div className="rounded-xl bg-muted/60 px-3 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{i18n.t('volume')}</span>
          <span className="text-sm tabular-nums text-muted-foreground">{volume}%</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Button variant="ghost" size="icon" className="[&_svg:not([class*='size-'])]:size-5" aria-label={selected.muted ? i18n.t('unmute') : i18n.t('mute')} aria-pressed={selected.muted} onClick={() => void command({ type: 'mute' })}>{selected.muted || selected.volume === 0 ? <VolumeX /> : <Volume2 />}</Button>
          <VolumeSlider size="bar" aria-label={i18n.t('volume')} className="flex-1" max={Math.round(selected.maxVolume * 100)} value={volume} onValueChange={value => void adjust({ type: 'volume', value: value / 100 })} />
        </div>
        <div className="mt-3">
          <div className="flex items-start gap-3">
            <span id="speed-label" className="mt-2 min-w-8 shrink-0 text-sm">{i18n.t('speed')}</span>
            <ToggleGroup aria-labelledby="speed-label" spacing={1} className="grid h-auto min-w-0 flex-1 grid-cols-4 rounded-lg bg-background/80 p-1" value={activePreset === undefined ? [] : [String(activePreset)]} onValueChange={value => { if (value[0]) void adjust({ type: 'rate', value: Number(value[0]) }); }}>
              {ratePresets.map(speed => <ToggleGroupItem key={speed} value={String(speed)} aria-label={i18n.t('speedOption', { speed: formatRate(speed) })} className="h-7 w-full min-w-0 rounded-md border-0 px-0.5 text-xs text-muted-foreground shadow-none aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-sm">{formatRate(speed)}×</ToggleGroupItem>)}
            </ToggleGroup>
          </div>
          {activePreset === undefined && <p className="mt-1 text-xs text-muted-foreground">{i18n.t('currentSpeed', { rate: formatRate(selected.rate) })}</p>}
          {offerRemember && !remembered && <Button variant="ghost" size="sm" className="mt-1 h-7 w-full justify-start px-1 text-xs text-primary" disabled={settingsLoading} onClick={storePreference}>{i18n.t('rememberSite')}</Button>}
        </div>
      </div>
    </> : <div className="flex min-h-[26.25rem] flex-col justify-center rounded-2xl bg-card shadow-card">
      <Empty className="border-0 px-4 py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="size-12 rounded-full bg-accent text-primary [&_svg:not([class*='size-'])]:size-6">{page.enabled ? <Search /> : <Settings2 />}</EmptyMedia>
          <EmptyTitle className="text-lg font-semibold">{loading ? i18n.t('searchingMedia') : page.enabled ? i18n.t('noMedia') : i18n.t('siteOff')}</EmptyTitle>
          <EmptyDescription className="text-[13px]/[1.8] whitespace-pre-line">{page.enabled ? i18n.t('noMediaHint') : i18n.t('siteOffHint')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent><Button variant="outline" disabled={settingsLoading || outOfSync} onClick={() => { if (page.enabled || outOfSync) { void refresh(); return; } if (siteAction?.settings) void write(siteAction.settings).then(ok => { if (ok) void refresh(); }); else openSettings(); }}>{page.enabled ? <><RefreshCw />{i18n.t('rescan')}</> : outOfSync ? i18n.t('restoring') : siteAction?.label ?? i18n.t('manageSites')}</Button></EmptyContent>
      </Empty>
    </div>}
    {(error || settingsError) && <Alert variant="destructive"><CircleAlert /><AlertDescription>{error || settingsError}</AlertDescription></Alert>}
    <ItemGroup className="gap-0 divide-y overflow-hidden rounded-xl bg-card shadow-card">
      {selected && page.host && <Item role="listitem" className="rounded-none px-3 py-2.5">
        <ItemContent>
          <ItemTitle className="font-normal"><label htmlFor="remember-site">{i18n.t('rememberSite')}</label></ItemTitle>
          <ItemDescription className="text-xs">{i18n.t('rememberSiteDescription')}</ItemDescription>
        </ItemContent>
        <ItemActions><Switch id="remember-site" aria-label={i18n.t('rememberSite')} checked={!!remembered} disabled={settingsLoading} onCheckedChange={checked => { if (!page.host) return; void write({ sitePrefs: checked ? rememberSite(sitePrefs, page.host, selected ? { volume: selected.volume, rate: selected.rate } : {}) : forgetMatchingSites(sitePrefs, page.host) }); }} /></ItemActions>
      </Item>}
      <Item role="listitem" className="min-h-12 rounded-none px-3">
        <ItemMedia variant="icon" className="text-muted-foreground"><AppWindow className="size-5" /></ItemMedia>
        <ItemContent><ItemTitle className="font-normal"><label htmlFor="floating-toggle">{i18n.t('floatingController')}</label></ItemTitle></ItemContent>
        <ItemActions><Switch id="floating-toggle" aria-label={i18n.t('floatingController')} checked={floating} disabled={settingsLoading} onCheckedChange={checked => void write({ floating: checked })} /></ItemActions>
      </Item>
      {showSiteAction && <Item role="listitem" className="rounded-none px-1.5 py-1">
        <Button variant="ghost" className="w-full justify-start text-muted-foreground" disabled={settingsLoading} onClick={() => void write(siteAction.settings!).then(ok => { if (ok) void refresh(); })}>{siteAction.label}</Button>
      </Item>}
    </ItemGroup>
    <footer className="flex min-h-9 items-center justify-center gap-2 pb-1 text-xs text-muted-foreground"><Keyboard aria-hidden="true" className="size-4" /><span>{i18n.t('volumeShortcut')}</span></footer>
    <OtherPlaying client={sounding} />
  </section>;
}
