import { useEffect, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { ChevronDown, Settings2, Settings as SettingsIcon, Volume2, VolumeX, AppWindow, Pause, Play, RotateCcw, RotateCw, Keyboard, CircleAlert, Search, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './ui/empty';
import { Field, FieldLabel } from './ui/field';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Brand } from './brand';
import { useMedia } from '../hooks/use-media';
import { mediaChoiceLabel } from '../lib/media';
import { disableSite, enableSite, isSiteEnabled } from '../lib/settings';
import { defaultSettings, type MediaClient } from '../lib/types';
import { formatTime } from '../lib/utils';
import { useSettingsAtoms } from './theme';

const speeds = [0.75, 1, 1.25, 1.5, 2];
const first = (value: number | readonly number[]) => Array.isArray(value) ? value[0] : value;
export function MediaPanel({ client, openSettings }: { client: MediaClient; openSettings: () => void }) {
  const { page, selected, select, command, refresh, loading, error } = useMedia(client);
  const { floatingAtom, siteModeAtom, sitesAtom, loadingAtom, errorAtom, writeSettingsAtom } = useSettingsAtoms();
  const floating = useAtomValue(floatingAtom);
  const siteMode = useAtomValue(siteModeAtom);
  const sites = useAtomValue(sitesAtom);
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
  const ranges = selected?.seekable ?? [];
  const seekMin = ranges[0]?.start ?? 0;
  const seekMax = ranges[ranges.length - 1]?.end ?? 0;
  const canSeek = seekMax > seekMin;
  const volume = selected ? Math.round((selected.muted ? 0 : selected.volume) * 100) : 0;
  return <section className="w-[400px] max-w-full bg-background px-4" aria-label="媒体控制面板">
    <header className="flex h-[51px] items-center justify-between border-b"><Brand /><Button variant="ghost" size="icon" aria-label="打开设置" onClick={openSettings}><SettingsIcon className="size-[23px]" /></Button></header>
    {page.media.length > 1 && <Field orientation="horizontal" className="border-b py-2.5">
      <FieldLabel htmlFor="popup-media" className="flex-none! text-xs font-normal text-muted-foreground">控制目标</FieldLabel>
      <DropdownMenu onOpenChange={open => { if (open && selected) showMedia(selected.id); }}>
        <DropdownMenuTrigger id="popup-media" render={<Button variant="outline" size="sm" />} className="min-w-0 flex-1 shrink justify-between font-normal">
          <span className="truncate">{selected ? mediaChoiceLabel(selected, page.media.findIndex(media => media.id === selected.id)) : '选择媒体'}</span>
          <ChevronDown data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuRadioGroup value={selected?.id ?? ''} onValueChange={id => { select(id); setSeekDraft(null); showMedia(id); }}>
            {page.media.map((media, index) => <DropdownMenuRadioItem key={media.id} value={media.id}><span className="truncate">{mediaChoiceLabel(media, index)}</span></DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </Field>}
    {selected ? <>
      <div className="pt-3.5 text-center">
        <p className="text-sm text-muted-foreground">{page.host || selected.host}</p>
        <h1 title={selected.label || undefined} className="mt-2 line-clamp-2 min-h-7 text-[22px] leading-7 font-bold tracking-tight">{selected.label || '未命名媒体'}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{selected.kind === 'video' ? '视频' : '音频'} · {selected.paused ? '已暂停' : '正在播放'}</p>
      </div>
      <div className="mt-5 flex items-center justify-center gap-7.5">
        <Button variant="outline" className="relative size-[50px] rounded-full bg-transparent [&_svg:not([class*='size-'])]:size-[26px]" aria-label="后退 10 秒" disabled={!canSeek} onClick={() => void command({ type: 'skip', value: -10 })}><RotateCcw className="-translate-y-0.5" /><span className="absolute top-6 bg-background px-0.5 text-[10px] leading-none font-semibold">10</span></Button>
        <Button className="size-[66px] rounded-full hover:bg-primary/90 [&_svg:not([class*='size-'])]:size-7" aria-label={selected.paused ? '播放' : '暂停'} onClick={() => void command({ type: selected.paused ? 'play' : 'pause' })}>{selected.paused ? <Play fill="currentColor" strokeWidth={0} className="ml-0.5" /> : <Pause fill="currentColor" strokeWidth={0} />}</Button>
        <Button variant="outline" className="relative size-[50px] rounded-full bg-transparent [&_svg:not([class*='size-'])]:size-[26px]" aria-label="前进 10 秒" disabled={!canSeek} onClick={() => void command({ type: 'skip', value: 10 })}><RotateCw className="-translate-y-0.5" /><span className="absolute top-6 bg-background px-0.5 text-[10px] leading-none font-semibold">10</span></Button>
      </div>
      <div className="mt-2 pb-4">
        <Slider aria-label="播放进度" className="py-2.5" min={seekMin} max={Math.max(seekMin + 1, seekMax)} step={1} value={[seekDraft ?? selected.currentTime]} disabled={!canSeek} onValueChange={value => setSeekDraft(first(value) ?? null)} onValueCommitted={value => { void command({ type: 'seek', value: first(value) ?? seekMin }).finally(() => setSeekDraft(null)); }} />
        <div className="mt-1 flex justify-between text-sm text-muted-foreground tabular-nums"><span>{formatTime(seekDraft ?? selected.currentTime)}</span><span>{selected.duration === null ? selected.live ? '直播' : '--:--' : formatTime(selected.duration)}</span></div>
      </div>
      <div className="border-t py-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">音量</span>
          <span className="text-sm font-medium tabular-nums">{volume}%</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="ghost" size="icon" className="[&_svg:not([class*='size-'])]:size-6" aria-label={selected.muted ? '取消静音' : '静音'} aria-pressed={selected.muted} onClick={() => void command({ type: 'mute' })}>{selected.muted || selected.volume === 0 ? <VolumeX /> : <Volume2 />}</Button>
          <Slider size="bar" aria-label="音量" className="flex-1" min={0} max={Math.round(selected.maxVolume * 100)} step={1} value={[volume]} onValueChange={value => void command({ type: 'volume', value: (first(value) ?? 0) / 100 })} />
        </div>
      </div>
      <div className="flex min-h-16 flex-wrap items-center gap-x-6 border-t py-2">
        <span id="speed-label" className="shrink-0 text-sm">倍速</span>
        <ToggleGroup aria-labelledby="speed-label" variant="outline" spacing={0} className="flex-1" value={speeds.includes(selected.rate) ? [String(selected.rate)] : []} onValueChange={value => { if (value[0]) void command({ type: 'rate', value: Number(value[0]) }); }}>
          {speeds.map(speed => <ToggleGroupItem key={speed} value={String(speed)} aria-label={`${speed} 倍速`} className="h-9 flex-1 text-xs aria-pressed:bg-accent aria-pressed:font-bold aria-pressed:text-accent-foreground">{speed}×</ToggleGroupItem>)}
        </ToggleGroup>
        {!speeds.includes(selected.rate) && <span className="w-full text-xs text-muted-foreground">当前 {selected.rate}×</span>}
      </div>
    </> : <Empty className="min-h-[337px] justify-start px-3.5 py-11">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-12 rounded-full bg-accent text-primary [&_svg:not([class*='size-'])]:size-6">{page.enabled ? <Search /> : <Settings2 />}</EmptyMedia>
        <EmptyTitle className="text-lg font-semibold">{loading ? '正在寻找媒体…' : page.enabled ? '此页面还没有媒体' : '此网站已停用'}</EmptyTitle>
        <EmptyDescription className="text-[13px]/[1.8] whitespace-pre-line">{page.enabled ? '打开含有视频或音频的网页，\n开始播放后即可在这里控制。' : '在网站设置中启用当前网站，\n即可恢复媒体控制。'}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent><Button variant="outline" disabled={settingsLoading || outOfSync} onClick={() => { if (page.enabled || outOfSync) { void refresh(); return; } if (siteAction?.settings) void write(siteAction.settings).then(ok => { if (ok) void refresh(); }); else openSettings(); }}>{page.enabled ? <><RefreshCw />重新检测</> : outOfSync ? '正在恢复…' : siteAction?.label ?? '管理支持的网站'}</Button></EmptyContent>
    </Empty>}
    {(error || settingsError) && <Alert variant="destructive" className="my-2.5"><CircleAlert /><AlertDescription>{error || settingsError}</AlertDescription></Alert>}
    <Field orientation="horizontal" className="min-h-14 gap-4 border-t">
      <AppWindow aria-hidden="true" className="size-[23px] shrink-0" />
      <FieldLabel htmlFor="floating-toggle" className="flex-1 font-normal">浮动控制器</FieldLabel>
      <Switch id="floating-toggle" aria-label="浮动控制器" checked={floating} disabled={settingsLoading} onCheckedChange={checked => void write({ floating: checked })} />
    </Field>
    {page.enabled && !outOfSync && siteAction?.settings && <div className="border-t py-1"><Button variant="ghost" className="w-full text-muted-foreground" disabled={settingsLoading} onClick={() => void write(siteAction.settings!).then(ok => { if (ok) void refresh(); })}>{siteAction.label}</Button></div>}
    <footer className="flex min-h-[42px] items-center justify-center gap-2.5 border-t text-xs text-muted-foreground"><Keyboard aria-hidden="true" className="size-[18px]" /><span>Alt+Shift 调节音量</span></footer>
  </section>;
}
