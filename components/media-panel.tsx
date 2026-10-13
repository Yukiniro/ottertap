import { useState } from 'react';
import { Settings2, Settings as SettingsIcon, Volume2, VolumeX, AppWindow, Pause, Play, RotateCcw, RotateCw, Keyboard, CircleAlert, Search, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Brand } from './brand';
import { useMedia } from '../hooks/use-media';
import { useSettings } from '../hooks/use-settings';
import { formatTime } from '../lib/utils';
import type { MediaClient, SettingsStore } from '../lib/types';

const speeds = [0.75, 1, 1.25, 1.5, 2];
export function MediaPanel({ client, store, openSettings }: { client: MediaClient; store: SettingsStore; openSettings: () => void }) {
  const { page, selected, select, command, refresh, loading, error } = useMedia(client);
  const { settings, update, loading: settingsLoading, error: settingsError } = useSettings(store);
  const [seekDraft, setSeekDraft] = useState<number | null>(null);
  const ranges = selected?.seekable ?? [];
  const seekMin = ranges[0]?.start ?? 0;
  const seekMax = ranges[ranges.length - 1]?.end ?? 0;
  const canSeek = seekMax > seekMin;
  return <section className="media-panel" aria-label="媒体控制面板">
    <header className="panel-header"><Brand /><Button variant="ghost" size="icon" className="settings-button" aria-label="打开设置" onClick={openSettings}><SettingsIcon /></Button></header>
    {page.media.length > 1 && <div className="media-picker"><label htmlFor={'popup-media'}>控制目标</label><select id={'popup-media'} value={selected?.id ?? ''} onChange={event => { select(event.target.value); setSeekDraft(null); }}>{page.media.map((media, index) => <option key={media.id} value={media.id}>{index + 1}. {media.kind === 'video' ? '视频' : '音频'} · {media.title}</option>)}</select></div>}
    {selected ? <>
      <div className="media-heading"><p className="media-domain">{page.host || selected.host}</p><h1 title={selected.title}>{selected.title}</h1><p className="media-status">{selected.kind === 'video' ? '视频' : '音频'} · {selected.paused ? '已暂停' : '正在播放'}</p></div>
      <div className="transport"><Button variant="outline" className="skip-button" aria-label="后退 10 秒" disabled={!canSeek} onClick={() => void command({ type: 'skip', value: -10 })}><RotateCcw /><span>10</span></Button><Button className="play-button" aria-label={selected.paused ? '播放' : '暂停'} onClick={() => void command({ type: selected.paused ? 'play' : 'pause' })}>{selected.paused ? <Play fill="currentColor" /> : <Pause fill="currentColor" />}</Button><Button variant="outline" className="skip-button" aria-label="前进 10 秒" disabled={!canSeek} onClick={() => void command({ type: 'skip', value: 10 })}><RotateCw /><span>10</span></Button></div>
      <div className="timeline"><Slider aria-label="播放进度" min={seekMin} max={Math.max(seekMin + 1, seekMax)} step={1} value={[seekDraft ?? selected.currentTime]} disabled={!canSeek} onValueChange={value => setSeekDraft(Array.isArray(value) ? value[0] : value)} onValueCommitted={value => { void command({ type: 'seek', value: Array.isArray(value) ? value[0] : value }).finally(() => setSeekDraft(null)); }} /><div className="time-labels"><span>{formatTime(seekDraft ?? selected.currentTime)}</span><span>{selected.duration === null ? selected.live ? '直播' : '--:--' : formatTime(selected.duration)}</span></div></div>
      <div className="control-row volume-row"><Button variant="ghost" size="icon" className="volume-button" aria-label={selected.muted ? '取消静音' : '静音'} aria-pressed={selected.muted} onClick={() => void command({ type: 'mute' })}>{selected.muted || selected.volume === 0 ? <VolumeX /> : <Volume2 />}</Button><span className="row-label">音量</span><Slider aria-label="音量" min={0} max={100} step={1} value={[Math.round((selected.muted ? 0 : selected.volume) * 100)]} onValueChange={value => void command({ type: 'volume', value: (Array.isArray(value) ? value[0] : value) / 100 })} /><span className="volume-value">{Math.round((selected.muted ? 0 : selected.volume) * 100)}%</span></div>
      <div className="control-row speed-row"><span className="row-label">倍速</span><div className="speed-options" role="group" aria-label="播放速度">{speeds.map(speed => <Button key={speed} variant="ghost" aria-label={`${speed} 倍速`} aria-pressed={selected.rate === speed} onClick={() => void command({ type: 'rate', value: speed })}>{speed}×</Button>)}</div>{!speeds.includes(selected.rate) && <span className="custom-rate">当前 {selected.rate}×</span>}</div>
    </> : <div className="empty-state"><div className="empty-icon">{page.enabled ? <Search /> : <Settings2 />}</div><h1>{loading ? '正在寻找媒体…' : page.enabled ? '此页面还没有媒体' : '此网站已停用'}</h1><p>{page.enabled ? '打开含有视频或音频的网页，\n开始播放后即可在这里控制。' : '在网站设置中启用当前网站，\n即可恢复媒体控制。'}</p><Button variant="outline" onClick={() => page.enabled ? void refresh() : openSettings()}>{page.enabled ? <><RefreshCw />重新检测</> : '管理支持的网站'}</Button></div>}
    {(error || settingsError) && <div className="error-message" role="alert"><CircleAlert />{error || settingsError}</div>}
    <><div className="control-row floating-row"><AppWindow aria-hidden="true" /><label htmlFor="floating-toggle">页面浮动控制器</label><Switch id="floating-toggle" aria-label="页面浮动控制器" checked={settings.floating} disabled={settingsLoading} onCheckedChange={checked => void update({ ...settings, floating: checked })} /></div><footer className="panel-footer"><Keyboard aria-hidden="true" /><span>随时调整，继续专注</span></footer></>
  </section>;
}
