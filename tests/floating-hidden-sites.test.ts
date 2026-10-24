import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act, Fragment } from 'react';
import { volumeGestureEvent } from '../lib/hotkey';
import { mediaPresenceEvent } from '../lib/media';
import { hideFloating, isFloatingHidden, isSiteEnabled, normalizeSettings, showFloating } from '../lib/settings';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { defaultSettings, type MediaClient, type MediaState, type Settings, type SettingsStore } from '../lib/types';

test('隐藏浮动名单单独存储，含子域名，可撤销，且不影响整站启停', () => {
  assert.deepEqual(defaultSettings.floatingHiddenSites, []);
  assert.deepEqual(normalizeSettings(null).floatingHiddenSites, []);
  assert.deepEqual(normalizeSettings({}).floatingHiddenSites, [], '老用户没有这一项时为空');
  assert.notEqual(normalizeSettings(null).floatingHiddenSites, defaultSettings.floatingHiddenSites, '不能共享默认数组');
  assert.deepEqual(normalizeSettings({ floatingHiddenSites: ['Example.com.', 'example.com', 'https://www.Video.test/watch', 12, '', 'a b', 'ftp://x.com'] }).floatingHiddenSites, ['example.com', 'www.video.test']);
  assert.deepEqual(normalizeSettings({ floatingHiddenSites: 'example.com' }).floatingHiddenSites, []);

  const list = hideFloating([], 'www.example.com');
  assert.deepEqual(list, ['www.example.com']);
  assert.equal(hideFloating(list, 'WWW.example.com.'), list, '已隐藏时不重复加入');
  assert.equal(isFloatingHidden('www.example.com', list), true);
  assert.equal(isFloatingHidden('m.www.example.com', list), true, '域名包含子域名');
  assert.equal(isFloatingHidden('example.com', list), false, '父域名不受影响');
  assert.equal(isFloatingHidden('other.test', list), false);
  assert.equal(isFloatingHidden('', list), false);
  assert.deepEqual(hideFloating([], ''), [], '没有 host 时不写入');

  const nested = ['example.com', 'www.example.com', 'other.test'];
  assert.deepEqual(showFloating(nested, 'www.example.com'), ['other.test'], '撤销时连父域名条目一起移除，入口才会真正回来');
  assert.equal(showFloating(nested, 'none.test'), nested);

  const settings = normalizeSettings({ ...defaultSettings, floatingHiddenSites: ['example.com'], siteMode: 'exclude', sites: ['blocked.test'] });
  assert.equal(isSiteEnabled('https://example.com/watch', settings), true, '隐藏浮动不等于停用扩展');
  assert.equal(isSiteEnabled('https://blocked.test/', settings), false);
  assert.equal(isFloatingHidden('blocked.test', settings.floatingHiddenSites), false, '整站停用也不会写进隐藏浮动名单');
});

test('导出导入包含隐藏浮动名单，旧备份导入后名单为空', () => {
  const settings = normalizeSettings({ ...defaultSettings, floatingHiddenSites: ['example.com', 'video.test'], sites: ['blocked.test'], siteMode: 'exclude' });
  const text = serializeSettings(settings, '1.7.0');
  assert.deepEqual((JSON.parse(text) as { settings: Settings }).settings.floatingHiddenSites, ['example.com', 'video.test']);
  const parsed = parseSettingsBackup(text);
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.settings.floatingHiddenSites, ['example.com', 'video.test']);
  assert.deepEqual(parsed.settings.sites, ['blocked.test']);
  assert.equal(parsed.settings.siteMode, 'exclude');
  const legacy = JSON.parse(text) as { settings: Partial<Settings> };
  delete legacy.settings.floatingHiddenSites;
  const old = parseSettingsBackup(JSON.stringify(legacy));
  assert.ok(old.ok);
  assert.deepEqual(old.settings.floatingHiddenSites, []);
  assert.deepEqual(old.settings.sites, ['blocked.test']);
});

test('浮动药丸与弹出面板一键隐藏本站浮动，设置页可查看与撤销', async () => {
  const window = new Window({ url: 'https://example.com/watch' });
  const globals = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'CustomEvent', 'MutationObserver', 'ResizeObserver'] as const;
  for (const name of globals) Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { FloatingController } = await import('../components/floating');
  const { MediaPanel } = await import('../components/media-panel');
  const { SettingsPage } = await import('../components/settings-page');
  const { RateHint } = await import('../components/rate-hint');
  let value: Settings = { ...defaultSettings, theme: 'light', floatingHiddenSites: ['other.test'] };
  const listeners = new Set<(settings: Settings) => void>();
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) { value = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  let pageHost = 'www.example.com';
  const media: MediaState = { id: '1', title: '测试媒体', label: '测试媒体', host: 'www.example.com', kind: 'video', paused: true, muted: false, volume: .5, maxVolume: 1, rate: 1, currentTime: 0, duration: 10, live: false, seekable: [{ start: 0, end: 10 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true };
  const commands: unknown[] = [];
  const client: MediaClient = {
    async read() { return { enabled: true, host: pageHost, selectedId: '1', media: [{ ...media, host: pageHost }] }; },
    async command(_media, command) { commands.push(command); },
    async select() {},
    async highlight() {}
  };
  const mount = () => {
    const node = window.document.createElement('div');
    window.document.body.append(node);
    return { node, root: createRoot(node as unknown as HTMLElement) };
  };
  const floater = mount();
  const panel = mount();
  const page = mount();
  const aside = () => floater.node.querySelector('aside');
  const expand = async () => {
    const trigger = floater.node.querySelector('[data-slot="popover-trigger"]')!;
    await act(async () => { trigger.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
  };
  const hideButton = () => floater.node.querySelector('button[aria-label="本站隐藏浮动"]') as HTMLButtonElement | null;
  const panelSwitch = () => panel.node.querySelector('[role="switch"][aria-label="本站隐藏浮动"]') as HTMLElement | null;
  const refresh = async () => {
    window.dispatchEvent(new window.Event(mediaPresenceEvent));
    await new Promise(resolve => setTimeout(resolve, 30));
  };
  try {
    await act(async () => { floater.root.render(createElement(ThemeProvider, { store, children: createElement(FloatingController, { client, openPanel: async () => true }) })); });
    await expand();
    assert.ok(aside(), '名单里只有别的站点时，本站照常显示');
    assert.equal(hideButton(), null, '演示与预览不传 hideOnSite，不放这个按钮');

    await act(async () => { floater.root.render(createElement(ThemeProvider, { store, children: createElement(Fragment, null, createElement(FloatingController, { client, openPanel: async () => true, hideOnSite: true }), createElement(RateHint)) })); });
    if (!hideButton()) await expand();
    assert.ok(floater.node.querySelector('button[aria-label="打开面板"]'), '打开面板仍在');
    assert.equal(hideButton()?.title, '本站隐藏浮动');
    await act(async () => { hideButton()!.click(); await new Promise(resolve => setTimeout(resolve, 20)); });
    assert.deepEqual(value.floatingHiddenSites, ['other.test', 'www.example.com']);
    assert.equal(value.floating, true, '不动全局浮动开关');
    assert.equal(value.siteMode, 'all', '不动整站启停规则');
    assert.deepEqual(value.sites, []);
    assert.equal(aside(), null, '本站入口马上消失');
    assert.match(floater.node.textContent ?? '', /本站已隐藏浮动入口/);

    await act(async () => { window.dispatchEvent(new window.Event(volumeGestureEvent)); });
    assert.equal(aside(), null, '隐藏时的音量手势不会让入口出现');

    await act(async () => { panel.root.render(createElement(ThemeProvider, { store, children: createElement(MediaPanel, { client, openSettings() {} }) })); await new Promise(resolve => setTimeout(resolve, 30)); });
    assert.ok(panel.node.querySelector('button[aria-label="播放"]'), '面板仍能控制本站媒体');
    assert.equal(panelSwitch()?.getAttribute('aria-checked'), 'true');
    await act(async () => { (panel.node.querySelector('button[aria-label="播放"]') as unknown as HTMLElement).click(); });
    assert.deepEqual(commands, [{ type: 'play' }]);
    await act(async () => { panelSwitch()!.click(); await new Promise(resolve => setTimeout(resolve, 20)); });
    assert.deepEqual(value.floatingHiddenSites, ['other.test'], '面板里关掉即撤销本站');
    await act(refresh);
    assert.ok(aside(), '撤销后入口回来');
    assert.equal(floater.node.querySelector('[role="dialog"]'), null, '回来时不会自己展开药丸');

    await act(async () => { panelSwitch()!.click(); await new Promise(resolve => setTimeout(resolve, 20)); });
    assert.deepEqual(value.floatingHiddenSites, ['other.test', 'www.example.com'], '面板也能一键隐藏');
    await act(refresh);
    assert.equal(aside(), null);

    pageHost = 'video.test';
    await act(refresh);
    assert.ok(aside(), '其他站点不受影响');
    pageHost = 'www.example.com';
    await act(refresh);

    await act(async () => { value = { ...value, floating: false }; listeners.forEach(listener => listener(value)); await new Promise(resolve => setTimeout(resolve, 20)); });
    assert.equal(panelSwitch(), null, '全局关掉浮动时不显示本站开关');
    await act(async () => { value = { ...value, floating: true }; listeners.forEach(listener => listener(value)); await new Promise(resolve => setTimeout(resolve, 20)); });

    await act(async () => { page.root.render(createElement(ThemeProvider, { store, children: createElement(SettingsPage) })); });
    const list = page.node.querySelector('[aria-label="隐藏浮动入口的站点"]');
    assert.ok(list);
    assert.deepEqual([...list.querySelectorAll('[role="listitem"]')].map(item => item.textContent?.trim()), ['other.test', 'www.example.com']);
    assert.match(page.node.textContent ?? '', /工具栏面板和页内快捷键照常可用/);
    const restore = page.node.querySelector('button[aria-label="在 www.example.com 恢复浮动入口"]') as HTMLButtonElement | null;
    assert.ok(restore);
    await act(async () => { restore.click(); await new Promise(resolve => setTimeout(resolve, 20)); });
    assert.deepEqual(value.floatingHiddenSites, ['other.test']);
    await act(refresh);
    assert.ok(aside(), '设置页撤销后入口回来');
    await act(async () => { (page.node.querySelector('button[aria-label="在 other.test 恢复浮动入口"]') as unknown as HTMLElement).click(); await new Promise(resolve => setTimeout(resolve, 20)); });
    assert.deepEqual(value.floatingHiddenSites, []);
    assert.match(page.node.textContent ?? '', /还没有站点/);
  } finally {
    await act(async () => { floater.root.unmount(); panel.root.unmount(); page.root.unmount(); });
    await window.happyDOM.close();
  }
});
