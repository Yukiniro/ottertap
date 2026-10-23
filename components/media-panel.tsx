import { i18n } from '#i18n';
import { useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { ChevronDown, Settings2, Settings as SettingsIcon, Volume2, VolumeX, AppWindow, Pause, Play, RotateCcw, RotateCw, Keyboard, CircleAlert, Info, Search, RefreshCw, PictureInPicture2, Headphones, Minus, Plus } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './ui/empty';
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from './ui/item';
import { Popover, PopoverContent, PopoverDescription, PopoverTrigger } from './ui/popover';
import { Slider } from './ui/slider';
import { VolumeSlider } from './volume-slider';
import { Switch } from './ui/switch';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Brand } from './brand';
import { useMedia } from '../hooks/use-media';
import { channelModes, isChannelMode } from '../lib/amplifier';
import { channelLabel, mediaChoiceLabel, pipHint } from '../lib/media';
import { formatRate, nextRate, sameRate } from '../lib/rate';
import type { SoundingTab, SoundingTabsClient } from '../lib/tabs';
import { disableSite, enableSite, forgetMatchingSites, isSiteEnabled, rememberSite, sitePrefFor } from '../lib/settings';
import { defaultSettings, type MediaClient, type MediaState, type PageState, type SitePref } from '../lib/types';
import { formatTime } from '../lib/utils';
import { useSettingsAtoms } from './theme';

const first = (value: number | readonly number[]) => Array.isArray(value) ? value[0] : value;
const currentPref = (media: MediaState): SitePref => ({ volume: media.volume, rate: media.rate, ...(media.channel === 'stereo' ? {} : { channel: media.channel }) });
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
    <div role="list" className="max-h-28 overflow-y-auto overscroll-contain rounded-lg border">
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
export function MediaPanel({ client, openSettings, sounding, initial }: { client: MediaClient; openSettings: () => void; sounding?: SoundingTabsClient; initial?: PageState }) {
  const { page, selected, select, command, refresh, loading, error } = useMedia(client, { initial });
  const { floatingAtom, siteModeAtom, sitesAtom, sitePrefsAtom, ratePresetsAtom, skipSecondsAtom, rateStepAtom, loadingAtom, errorAtom, writeSettingsAtom } = useSettingsAtoms();
  const floating = useAtomValue(floatingAtom);
  const siteMode = useAtomValue(siteModeAtom);
  const sites = useAtomValue(sitesAtom);
  const sitePrefs = useAtomValue(sitePrefsAtom);
  const ratePresets = useAtomValue(ratePresetsAtom);
  const skipSeconds = useAtomValue(skipSecondsAtom);
  const rateStep = useAtomValue(rateStepAtom);
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
    void write({ sitePrefs: rememberSite(sitePrefs, page.host, currentPref(selected)) });
  };
  const adjust = (value: Parameters<typeof command>[0]) => {
    if ((value.type === 'volume' || value.type === 'rate' || value.type === 'channel') && !remembered) setOfferRemember(true);
    return command(value);
  };
  useEffect(() => { setOfferRemember(false); }, [page.host, selected?.id]);
  const ranges = selected?.seekable ?? [];
  const seekMin = ranges[0]?.start ?? 0;
  const seekMax = ranges[ranges.length - 1]?.end ?? 0;
  const canSeek = seekMax > seekMin;
  const volume = selected ? Math.round((selected.muted ? 0 : selected.volume) * 100) : 0;
  const hint = selected ? pipHint(selected) : '';
  const channelHint = selected && !selected.channelAvailable ? i18n.t('channelCrossOrigin') : '';
  const activePreset = selected ? ratePresets.find(speed => sameRate(speed, selected.rate)) : undefined;
  const slowerRate = selected ? nextRate(selected.rate, -1, null, rateStep) : 1;
  const fasterRate = selected ? nextRate(selected.rate, 1, null, rateStep) : 1;
  const showSiteAction = page.enabled && !outOfSync && !!siteAction?.settings;
  return <section className="flex w-[400px] max-w-full flex-col gap-3 bg-background px-4 pt-1 pb-3" aria-label={i18n.t('mediaPanel')}>
    <header className="flex h-10 items-center justify-between">
      <Brand className="text-sm [&_img]:size-6" />
      <Button variant="ghost" size="icon" aria-label={i18n.t('openSettings')} onClick={openSettings}><SettingsIcon className="size-5" /></Button>
    </header>
    {page.media.length > 1 && <DropdownMenu onOpenChange={open => { if (open && selected) showMedia(selected.id); }}>
      <DropdownMenuTrigger id="popup-media" render={<Button variant="ghost" size="sm" />} className="h-8 w-full justify-between rounded-md bg-secondary px-2 font-normal">
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
      <div className="rounded-xl bg-secondary/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <p className="min-w-0 break-all">{page.host || selected.host}</p>
          <p>{selected.kind === 'video' ? i18n.t('video') : i18n.t('audio')} · {selected.paused ? i18n.t('paused') : i18n.t('playing')}</p>
        </div>
        <h1 title={selected.title} className="mt-2 line-clamp-2 text-lg leading-6 font-semibold break-words">{selected.title}</h1>
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_48px_44px_48px_minmax(0,1fr)] items-center gap-2">
          <Button variant="ghost" size="sm" className="col-start-2 h-9 w-12 gap-1 px-2 tabular-nums" aria-label={i18n.t('skipBack', { seconds: skipSeconds })} disabled={!canSeek} onClick={() => void command({ type: 'skip', value: -skipSeconds })}><RotateCcw /><span className="text-xs">{skipSeconds}</span></Button>
          <Button className="size-11 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 [&_svg:not([class*='size-'])]:size-5" aria-label={selected.paused ? i18n.t('play') : i18n.t('pause')} onClick={() => void command({ type: selected.paused ? 'play' : 'pause' })}>{selected.paused ? <Play fill="currentColor" strokeWidth={0} className="ml-0.5" /> : <Pause fill="currentColor" strokeWidth={0} />}</Button>
          <Button variant="ghost" size="sm" className="h-9 w-12 gap-1 px-2 tabular-nums" aria-label={i18n.t('skipForward', { seconds: skipSeconds })} disabled={!canSeek} onClick={() => void command({ type: 'skip', value: skipSeconds })}><span className="text-xs">{skipSeconds}</span><RotateCw /></Button>
          <Button type="button" variant="ghost" size="icon" className="justify-self-end text-muted-foreground aria-pressed:bg-accent aria-pressed:text-primary" aria-pressed={selected.pip} title={selected.pip ? i18n.t('exitPictureInPicture') : i18n.t('pictureInPicture')} aria-label={selected.pip ? i18n.t('exitPictureInPicture') : i18n.t('pictureInPicture')} aria-describedby={hint ? 'pip-hint' : undefined} disabled={!!hint} onClick={() => void command({ type: 'pip' })}><PictureInPicture2 /></Button>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
          <span className="shrink-0">{formatTime(seekDraft ?? selected.currentTime)}</span>
          <Slider aria-label={i18n.t('seek')} className="min-w-0 flex-1 py-2" min={seekMin} max={Math.max(seekMin + 1, seekMax)} step={1} value={[seekDraft ?? selected.currentTime]} disabled={!canSeek} onValueChange={value => setSeekDraft(first(value) ?? null)} onValueCommitted={value => { void command({ type: 'seek', value: first(value) ?? seekMin }).finally(() => setSeekDraft(null)); }} />
          <span className="shrink-0">{selected.duration === null ? selected.live ? i18n.t('live') : '--:--' : formatTime(selected.duration)}</span>
        </div>
        {hint ? <p id="pip-hint" className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="border-b pb-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="[&_svg:not([class*='size-'])]:size-5" aria-label={selected.muted ? i18n.t('unmute') : i18n.t('mute')} aria-pressed={selected.muted} onClick={() => void command({ type: 'mute' })}>{selected.muted || selected.volume === 0 ? <VolumeX /> : <Volume2 />}</Button>
          <VolumeSlider aria-label={i18n.t('volume')} className="min-w-16 flex-1 py-2" max={Math.round(selected.maxVolume * 100)} value={volume} onValueChange={value => void adjust({ type: 'volume', value: value / 100 })} />
          <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{volume}%</span>
        </div>
        {channelHint ? <p id="channel-hint" className="mt-1 text-xs text-muted-foreground">{channelHint}</p> : null}
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span id="speed-label" className="text-sm font-medium">{i18n.t('speed')}</span>
            <div className="flex min-w-0 items-center gap-1">
              <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={i18n.t('shortcutSpeedDown', { step: formatRate(rateStep) })} disabled={sameRate(slowerRate, selected.rate)} onClick={() => void adjust({ type: 'rate', value: slowerRate })}><Minus /></Button>
              <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={i18n.t('shortcutSpeedUp', { step: formatRate(rateStep) })} disabled={sameRate(fasterRate, selected.rate)} onClick={() => void adjust({ type: 'rate', value: fasterRate })}><Plus /></Button>
              <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="xs" />} disabled={!selected.channelAvailable} title={channelLabel(selected.channel)} aria-label={i18n.t('channelModeLabel', { mode: channelLabel(selected.channel) })} aria-describedby={channelHint ? 'channel-hint' : undefined} data-active={selected.channel !== 'stereo' ? '' : undefined} className="min-w-0 shrink rounded-md px-1 font-normal text-muted-foreground data-active:bg-accent data-active:text-primary">
                <Headphones data-icon="inline-start" /><span className="truncate">{channelLabel(selected.channel)}</span><ChevronDown data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{i18n.t('channelMode')}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={selected.channel} onValueChange={value => { if (isChannelMode(value)) void adjust({ type: 'channel', value }); }}>
                    {channelModes.map(mode => <DropdownMenuRadioItem key={mode} value={mode}>{channelLabel(mode)}</DropdownMenuRadioItem>)}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </div>
          <ToggleGroup aria-labelledby="speed-label" spacing={1} className="grid h-auto w-full min-w-0 grid-cols-4 gap-1.5" value={activePreset === undefined ? [] : [String(activePreset)]} onValueChange={value => { if (value[0]) void adjust({ type: 'rate', value: Number(value[0]) }); }}>
            {ratePresets.map(speed => <ToggleGroupItem key={speed} value={String(speed)} aria-label={i18n.t('speedOption', { speed: formatRate(speed) })} className="h-8 w-full min-w-0 rounded-md border-0 bg-secondary/60 px-1 text-sm text-muted-foreground shadow-none aria-pressed:bg-primary aria-pressed:font-semibold aria-pressed:text-primary-foreground">{formatRate(speed)}×</ToggleGroupItem>)}
          </ToggleGroup>
          {activePreset === undefined && <p className="mt-1 text-xs text-muted-foreground">{i18n.t('currentSpeed', { rate: formatRate(selected.rate) })}</p>}
          {selected.rateLock === 'given-up' && <p className="mt-1 text-xs leading-5 text-destructive">{i18n.t('rateLockGaveUp')}</p>}
          {offerRemember && !remembered && <Button variant="ghost" size="sm" className="mt-1 h-7 w-full justify-start px-1 text-xs text-primary" disabled={settingsLoading} onClick={storePreference}>{i18n.t('rememberSite')}</Button>}
        </div>
      </div>
    </> : <div className="flex min-h-56 flex-col justify-center border-y">
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
    <ItemGroup className="gap-0 divide-y">
      {selected && page.host && <Item role="listitem" className="flex-nowrap rounded-none px-0 py-1.5">
        <ItemContent>
          <ItemTitle className="overflow-visible font-normal"><label htmlFor="remember-site">{i18n.t('rememberSite')}</label>
            <Popover>
              <PopoverTrigger render={<Button variant="ghost" size="icon-xs" />} aria-label={i18n.t('rememberSiteDescription')} className="text-muted-foreground"><Info /></PopoverTrigger>
              <PopoverContent side="top" aria-label={i18n.t('rememberSite')} className="max-w-[calc(100vw-32px)] p-3 text-sm leading-6"><PopoverDescription>{i18n.t('rememberSiteDescription')}</PopoverDescription></PopoverContent>
            </Popover>
          </ItemTitle>
        </ItemContent>
        <ItemActions><Switch id="remember-site" aria-label={i18n.t('rememberSite')} checked={!!remembered} disabled={settingsLoading} onCheckedChange={checked => { if (!page.host) return; void write({ sitePrefs: checked ? rememberSite(sitePrefs, page.host, selected ? currentPref(selected) : {}) : forgetMatchingSites(sitePrefs, page.host) }); }} /></ItemActions>
      </Item>}
      <Item role="listitem" className="min-h-10 flex-nowrap rounded-none px-0 py-1.5">
        <ItemMedia variant="icon" className="text-muted-foreground"><AppWindow className="size-5" /></ItemMedia>
        <ItemContent><ItemTitle className="font-normal"><label htmlFor="floating-toggle">{i18n.t('floatingController')}</label></ItemTitle></ItemContent>
        <ItemActions><Switch id="floating-toggle" aria-label={i18n.t('floatingController')} checked={floating} disabled={settingsLoading} onCheckedChange={checked => void write({ floating: checked })} /></ItemActions>
      </Item>
      {showSiteAction && <Item role="listitem" className="rounded-none px-0 py-0">
        <Button variant="ghost" size="sm" className="h-auto min-h-8 w-full justify-start px-0 text-muted-foreground whitespace-normal break-all" disabled={settingsLoading} onClick={() => void write(siteAction.settings!).then(ok => { if (ok) void refresh(); })}>{siteAction.label}</Button>
      </Item>}
    </ItemGroup>
    <footer className="flex min-h-7 items-center gap-2 text-xs text-muted-foreground"><Keyboard aria-hidden="true" className="size-4 shrink-0" /><span>{i18n.t('volumeShortcut')}</span></footer>
    <OtherPlaying client={sounding} />
  </section>;
}
