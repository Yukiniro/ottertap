import './install-i18n';
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, AppWindow, Settings, PanelTop, Play, Pause, Plus, Minus } from 'lucide-react';
import { ThemeProvider } from '../components/theme';
import { MediaPanel } from '../components/media-panel';
import { SettingsPage } from '../components/settings-page';
import { FloatingController } from '../components/floating';
import { Brand } from '../components/brand';
import { Button } from '../components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';
import { createDemo, createDemoStore } from '../lib/demo';
import '../assets/style.css';
import './preview.css';

const store = createDemoStore('ottertap-preview-settings-v1');
const demo = createDemo(document, { src: './demo.wav', title: '把日常剪成一部电影', store });
const { media, client } = demo;

function Preview() {
  const [route, setRoute] = useState<'popup' | 'floating' | 'settings'>(new URLSearchParams(location.search).has('floating') ? 'floating' : 'popup');
  const [playing, setPlaying] = useState(false);
  const [extra, setExtra] = useState(false);
  useEffect(() => {
    const sync = () => setPlaying(!media.paused);
    media.addEventListener('play', sync); media.addEventListener('pause', sync);
    return () => { media.removeEventListener('play', sync); media.removeEventListener('pause', sync); };
  }, []);
  useEffect(() => demo.listenHotkeys(window), []);
  const focusOnly = new URLSearchParams(location.search).has('panel');
  if (new URLSearchParams(location.search).has('settings')) return <div className={new URLSearchParams(location.search).has('capture') ? 'settings-capture' : ''}><SettingsPage /></div>;
  const openSettings = () => setRoute('settings');
  if (focusOnly) return <div className={new URLSearchParams(location.search).has('capture') ? 'capture-canvas' : ''}>{route === 'settings' ? <SettingsPage back={() => setRoute('popup')} /> : <MediaPanel client={client} openSettings={openSettings} />}</div>;
  if (route === 'settings') return <SettingsPage back={() => setRoute('popup')} />;
  return <div className="preview-shell"><nav className="preview-nav"><Brand /><span className="preview-label">浏览器扩展</span><ToggleGroup aria-label="预览界面" className="preview-tabs" value={[route]} onValueChange={value => { const next = value[0] as typeof route | undefined; if (next) setRoute(next); }}>{([{ value: 'popup', label: '弹出面板', icon: PanelTop }, { value: 'floating', label: '浮动控制器', icon: AppWindow }, { value: 'settings', label: '设置', icon: Settings }] as const).map(({ value, label, icon: Icon }) => <ToggleGroupItem key={value} value={value} className="h-9 px-3.5 text-[13px] text-muted-foreground aria-pressed:bg-accent aria-pressed:text-accent-foreground"><Icon />{label}</ToggleGroupItem>)}</ToggleGroup><a href="https://wxt.dev/" target="_blank" rel="noreferrer">WXT <ArrowUpRight /></a></nav>
    <main className="preview-main"><div className="preview-intro"><p className="eyebrow">播放，随你。</p><h1>把控制权<br />留在手边。</h1><p>音量、进度、倍速。<br />一个轻巧的面板，专注正在看的内容。</p><div className="demo-actions"><Button onClick={() => { if (media.paused) void media.play().then(() => setPlaying(true)); else { media.pause(); setPlaying(false); } }}>{playing ? <Pause /> : <Play />}{playing ? '暂停演示媒体' : '播放演示媒体'}</Button><Button variant="outline" onClick={() => void demo.reset().then(() => setPlaying(true))}>重置演示</Button></div><Button className="extra-media" variant="ghost" onClick={() => { demo.setSecond(extra ? null : '第二个音频 · 多媒体切换演示'); setExtra(!extra); }}>{extra ? <Minus /> : <Plus />}{extra ? '移除第二个媒体' : '添加第二个媒体'}</Button><p className="demo-note">交互预览使用本地静音媒体。<br />安装扩展后，控制的是当前网页里的实际媒体。</p></div><div className="preview-stage">{route === 'popup' ? <><div className="stage-caption"><span className="caption-line" />弹出面板 · 400 px<span className="caption-line" /></div><div className="popup-preview"><MediaPanel client={client} openSettings={openSettings} /></div></> : <div className="floating-hint"><AppWindow /><h2>控制跟着页面走。</h2><p>浮动入口半隐藏在页面侧边，悬停时完整显示。<br />点击浮动入口，在旁边展开音量药丸，最高 200%。<br />拖动音量药丸调节音量，底部按钮切换静音。<br />拖动浮动入口，松手后吸附到较近一侧。</p></div>}</div>{route === 'floating' && <FloatingController client={client} />}</main>
    <footer className="preview-footer"><span>小獭 OtterTap · 网页媒体控制</span><span>WXT / React / shadcn Base UI</span></footer>
  </div>;
}
const root = createRoot(document.getElementById('root')!);
root.render(<ThemeProvider store={store}><Preview /></ThemeProvider>);
import.meta.hot?.dispose(() => { root.unmount(); demo.destroy(); });
