import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { createAutoPip } from '../lib/auto-pip';
import { createAutoPipExit } from '../lib/auto-pip-exit';
import { createScrollPip } from '../lib/auto-pip-scroll';
import { allowsAutoPip, excludeAutoPip, includeAutoPip, isAutoPipExcluded, isFloatingHidden, isSiteEnabled, mergeSettingsChange, normalizeSettings } from '../lib/settings';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { defaultSettings, type MediaClient, type MediaState, type Settings, type SettingsStore } from '../lib/types';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('不自动画中画名单单独存储，含子域名，默认空，导出导入与并发合并带上', () => {
  assert.deepEqual(defaultSettings.autoPipExcludedSites, []);
  assert.deepEqual(normalizeSettings(null).autoPipExcludedSites, []);
  assert.deepEqual(normalizeSettings({}).autoPipExcludedSites, [], '老用户没有这一项时为空');
  assert.notEqual(normalizeSettings(null).autoPipExcludedSites, defaultSettings.autoPipExcludedSites, '不能共享默认数组');
  assert.deepEqual(normalizeSettings({ autoPipExcludedSites: ['Feed.test.', 'feed.test', 'https://www.Course.test/watch', 12, '', 'a b', 'ftp://x.com'] }).autoPipExcludedSites, ['feed.test', 'www.course.test']);
  assert.deepEqual(normalizeSettings({ autoPipExcludedSites: 'feed.test' }).autoPipExcludedSites, []);

  const separate = normalizeSettings({ autoPipExcludedSites: ['feed.test'], floatingHiddenSites: ['hidden.test'], resumeExcludedSites: ['resume.test'], siteMode: 'exclude', sites: ['blocked.test'] });
  assert.deepEqual(separate.floatingHiddenSites, ['hidden.test'], '不并进隐藏浮动名单');
  assert.deepEqual(separate.sites, ['blocked.test'], '不并进网站规则');
  assert.equal(isSiteEnabled('https://feed.test/', separate), true, '排除自动画中画不等于停用扩展');
  assert.equal(isFloatingHidden('feed.test', separate.floatingHiddenSites), false, '也不隐藏浮动入口');
  assert.equal(isAutoPipExcluded('hidden.test', separate.autoPipExcludedSites), false);

  const text = serializeSettings(separate, '1.9.0');
  assert.deepEqual((JSON.parse(text) as { settings: Settings }).settings.autoPipExcludedSites, ['feed.test']);
  const parsed = parseSettingsBackup(text);
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.settings.autoPipExcludedSites, ['feed.test']);
  assert.deepEqual(parsed.settings.floatingHiddenSites, ['hidden.test']);
  const legacy = JSON.parse(text) as { settings: Partial<Settings> };
  delete legacy.settings.autoPipExcludedSites;
  const old = parseSettingsBackup(JSON.stringify(legacy));
  assert.ok(old.ok);
  assert.deepEqual(old.settings.autoPipExcludedSites, [], '旧备份导入后名单为空');

  const base = normalizeSettings({ autoPipExcludedSites: ['a.test'] });
  const otherPage = { ...base, autoPipExcludedSites: ['a.test', 'b.test'], floatingHiddenSites: ['hidden.test'] };
  const merged = mergeSettingsChange(otherPage, base, { ...base, autoPipExcludedSites: ['a.test', 'c.test'] });
  assert.deepEqual(merged.autoPipExcludedSites, ['a.test', 'b.test', 'c.test'], '另一页加的站不被这一页覆盖');
  assert.deepEqual(merged.floatingHiddenSites, ['hidden.test']);
});

test('一键加入只写当前主机名；撤销连父域名一起去掉；判断跟着标签地址走', () => {
  const list = excludeAutoPip([], 'WWW.Feed.test.');
  assert.deepEqual(list, ['www.feed.test'], '只写当前主机名，不提升到父域名');
  assert.equal(excludeAutoPip(list, 'www.feed.test'), list, '已在名单里时不重复加入');
  assert.deepEqual(excludeAutoPip([], ''), [], '没有 host 时不写入');
  assert.equal(isAutoPipExcluded('m.www.feed.test', list), true, '域名包含子域名');
  assert.equal(isAutoPipExcluded('feed.test', list), false, '父域名不受影响');
  assert.equal(isAutoPipExcluded('notfeed.test', ['feed.test']), false);
  assert.deepEqual(includeAutoPip(['feed.test', 'www.feed.test', 'other.test'], 'www.feed.test'), ['other.test']);
  const untouched = ['other.test'];
  assert.equal(includeAutoPip(untouched, 'www.feed.test'), untouched);

  assert.equal(allowsAutoPip('https://www.feed.test/watch?v=1', { autoPipExcludedSites: ['feed.test'] }), false);
  assert.equal(allowsAutoPip('https://course.test/lesson', { autoPipExcludedSites: ['feed.test'] }), true, '其他站不受影响');
  assert.equal(allowsAutoPip('https://course.test/lesson', { autoPipExcludedSites: [] }), true, '空名单与现在一致');
  assert.equal(allowsAutoPip('', { autoPipExcludedSites: [] }), false, '还没拿到标签地址时不自动');
});

function page() {
  const window = new Window({ url: 'https://www.feed.test/watch', width: 1280, height: 720 });
  const document = window.document as unknown as Document;
  let current: Element | null = null;
  let visibility: DocumentVisibilityState = 'visible';
  const exits: Element[] = [];
  Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, get: () => current });
  Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, get: () => true });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  Object.defineProperty(document, 'exitPictureInPicture', { configurable: true, value: async () => {
    const element = current;
    if (!element) throw new DOMException('not in picture-in-picture', 'InvalidStateError');
    exits.push(element);
    current = null;
    element.dispatchEvent(new window.Event('leavepictureinpicture', { bubbles: true }) as unknown as Event);
  } });
  const observers: { callback: (entries: IntersectionObserverEntry[]) => void; observed: Set<Element>; disconnected: boolean }[] = [];
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: class {
    observed = new Set<Element>();
    disconnected = false;
    constructor(readonly callback: (entries: IntersectionObserverEntry[]) => void) { observers.push(this); }
    observe(element: Element) { this.observed.add(element); }
    unobserve(element: Element) { this.observed.delete(element); }
    disconnect() { this.observed.clear(); this.disconnected = true; }
  } });
  const scroll = (element: Element, share: number) => {
    const size = { width: 640, height: 360 };
    const entry = { target: element, boundingClientRect: size, intersectionRect: { width: size.width, height: size.height * share }, intersectionRatio: share, isIntersecting: share > 0 } as unknown as IntersectionObserverEntry;
    for (const observer of observers.filter(item => !item.disconnected && item.observed.has(element))) observer.callback([entry]);
  };
  const setVisibility = (next: DocumentVisibilityState) => {
    visibility = next;
    document.dispatchEvent(new window.Event('visibilitychange') as unknown as Event);
  };
  const handlers = new Map<string, (() => void) | null>();
  Object.defineProperty(window.navigator, 'mediaSession', { configurable: true, value: {
    setActionHandler(action: string, handler: (() => void) | null) { handlers.set(action, handler); }
  } });
  const main = document.createElement('video') as HTMLVideoElement;
  document.body.append(main);
  Object.defineProperty(main, 'paused', { configurable: true, get: () => false });
  Object.defineProperty(main, 'readyState', { configurable: true, value: 1 });
  Object.defineProperty(main, 'requestPictureInPicture', { configurable: true, value: async () => { current = main; return {} as PictureInPictureWindow; } });
  return { window, document, main, exits, scroll, setVisibility, handlers, press: () => window.dispatchEvent(new window.Event('pointerup')), pip: () => current };
}

/** The same gate `entrypoints/content.tsx` builds for the three automatic paths. */
function wire(document: Document, main: HTMLVideoElement, read: () => Settings, now: () => number) {
  const url = 'https://www.feed.test/watch';
  const allowed = () => allowsAutoPip(url, read());
  const exit = createAutoPipExit(document, { enabled: () => allowed() && read().autoPipExitOnReturn, delayMs: 30 });
  const hide = createAutoPip(document, { enabled: () => allowed() && read().autoPipOnHide, target: () => main, mediaSession: true, now, onEntered: exit.mark });
  const scrolled = createScrollPip(document, { enabled: () => allowed() && read().autoPipOnScroll, target: () => main, now, onEntered: exit.mark });
  const sync = () => { hide.sync(); scrolled.sync(); exit.sync(); };
  sync();
  return { sync, dispose: () => { hide.dispose(); scrolled.dispose(); exit.dispose(); } };
}

test('名单里的站点不自动进也不自动退；手动画中画照常，移出名单后恢复', async () => {
  const { window, document, main, exits, scroll, setVisibility, handlers, press, pip } = page();
  let settings: Settings = normalizeSettings({ autoPipOnHide: true, autoPipOnScroll: true, autoPipExitOnReturn: true });
  let clock = 100_000;
  const paths = wire(document, main, () => settings, () => clock);
  const update = (next: Partial<Settings>) => { settings = normalizeSettings({ ...settings, ...next }); paths.sync(); };
  try {
    assert.ok(handlers.get('enterpictureinpicture'), '空名单时与现在一样挂上 Media Session');
    setVisibility('hidden');
    await wait(0);
    assert.equal(pip(), main, '空名单：切走自动进入');
    scroll(main, 1);
    setVisibility('visible');
    await wait(80);
    assert.deepEqual(exits, [main], '空名单：回来自动退出');

    update({ autoPipExcludedSites: excludeAutoPip(settings.autoPipExcludedSites, 'www.feed.test') });
    assert.equal(handlers.get('enterpictureinpicture'), null, '加入名单后卸下 Media Session 自动进入');
    clock += 10_100;
    setVisibility('hidden');
    await wait(0);
    assert.equal(pip(), null, '名单内切走不进');
    setVisibility('visible');
    scroll(main, 1);
    scroll(main, 0);
    press();
    await wait(0);
    assert.equal(pip(), null, '名单内滚走不进');
    scroll(main, 1);

    await main.requestPictureInPicture();
    setVisibility('hidden');
    setVisibility('visible');
    await wait(80);
    assert.equal(pip(), main, '手动进入仍可用，回来也不被关');
    await document.exitPictureInPicture();
    assert.equal(exits.length, 2, '手动退出仍可用');

    update({ autoPipExcludedSites: includeAutoPip(settings.autoPipExcludedSites, 'www.feed.test') });
    assert.ok(handlers.get('enterpictureinpicture'), '移出名单后重新挂上');
    clock += 10_100;
    setVisibility('hidden');
    await wait(0);
    assert.equal(pip(), main, '移出名单后切走又会自动进入');

    update({ autoPipExcludedSites: ['feed.test'] });
    scroll(main, 1);
    setVisibility('visible');
    await wait(80);
    assert.equal(pip(), main, '自动进入后才加入名单（父域名也算），回来不自动退');
    assert.equal(exits.length, 2);
  } finally {
    paths.dispose();
    await window.happyDOM.close();
  }
});

test('面板一键加入本站，设置页按主机名筛选、删除，导出导入带上，与隐藏浮动名单分开', async () => {
  const window = new Window({ url: 'https://www.feed.test/watch' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'FocusEvent', 'CustomEvent', 'MutationObserver', 'ResizeObserver', 'File', 'Blob', 'URL', 'FileReader'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { MediaPanel } = await import('../components/media-panel');
  const { SettingsPage } = await import('../components/settings-page');
  let value: Settings = { ...defaultSettings, theme: 'light', floatingHiddenSites: ['hidden.example'], autoPipExcludedSites: ['alpha.test', 'beta.example', 'gamma.example'] };
  const listeners = new Set<(settings: Settings) => void>();
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) { value = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const push = async (next: Partial<Settings>) => { await act(async () => { value = { ...value, ...next }; listeners.forEach(listener => listener(value)); await wait(20); }); };
  const media: MediaState = { id: '1', title: '课程视频', label: '课程视频', host: 'www.feed.test', kind: 'video', paused: false, muted: false, volume: .5, maxVolume: 1, rate: 1, currentTime: 0, duration: 10, live: false, seekable: [{ start: 0, end: 10 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true };
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'www.feed.test', selectedId: '1', media: [media] }; },
    async command() {},
    async select() {},
    async highlight() {}
  };
  const mount = () => {
    const node = window.document.createElement('div');
    window.document.body.append(node);
    return { node, root: createRoot(node as unknown as HTMLElement) };
  };
  const panel = mount();
  const page = mount();
  const panelToggle = () => panel.node.querySelector('button[aria-label="本站不自动画中画"]') as HTMLElement | null;
  const playback = () => page.node.querySelector('#playback')!;
  const titles = () => [...playback().querySelectorAll('[data-slot="item-title"]')].map(node => node.textContent);
  const filter = () => playback().querySelector('#auto-pip-excluded-filter') as HTMLInputElement | null;
  const type = async (input: HTMLInputElement, text: string) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, text);
      input.dispatchEvent(new window.Event('input', { bubbles: true }) as unknown as Event);
    });
  };
  const click = async (element: { click(): void }) => { await act(async () => { element.click(); await wait(20); }); };
  try {
    await act(async () => { panel.root.render(createElement(ThemeProvider, { store, children: createElement(MediaPanel, { client, openSettings() {} }) })); await wait(30); });
    assert.equal(panelToggle(), null, '自动开关都关着时面板不多出按钮');
    await push({ autoPipOnHide: true });
    assert.equal(panelToggle()?.getAttribute('aria-pressed'), 'false');
    assert.equal(panelToggle()?.getAttribute('title'), '本站不自动画中画');
    await click(panelToggle()!);
    assert.deepEqual(value.autoPipExcludedSites, ['alpha.test', 'beta.example', 'gamma.example', 'www.feed.test'], '只追加当前主机名');
    assert.deepEqual(value.floatingHiddenSites, ['hidden.example'], '不碰隐藏浮动名单');
    assert.equal(value.siteMode, 'all');
    assert.deepEqual(value.sites, []);
    assert.equal(value.autoPipOnHide, true, '不动自动开关');
    assert.equal(panelToggle()?.getAttribute('aria-pressed'), 'true');
    await push({ autoPipOnHide: false });
    assert.equal(panelToggle()?.getAttribute('aria-pressed'), 'true', '开关关了也能在面板里撤销本站');
    await click(panelToggle()!);
    assert.deepEqual(value.autoPipExcludedSites, ['alpha.test', 'beta.example', 'gamma.example']);
    assert.equal(panelToggle(), null);

    await act(async () => { page.root.render(createElement(ThemeProvider, { store, children: createElement(SettingsPage) })); await wait(30); });
    assert.equal(playback().querySelector('[role="list"]'), playback().querySelector('[aria-label="不自动画中画的站点"]'));
    assert.deepEqual(titles(), ['alpha.test', 'beta.example', 'gamma.example']);
    assert.match(playback().textContent ?? '', /手动|你自己打开、关掉画中画照常可用/);
    assert.equal(filter()?.getAttribute('placeholder'), '筛选不自动画中画的站点');
    assert.notEqual(filter()?.id, page.node.querySelector('#floating-hidden-filter')?.id);
    assert.deepEqual([...page.node.querySelectorAll('#floating [data-slot="item-title"]')].map(node => node.textContent), ['hidden.example'], '两份名单分开展示');

    await type(filter()!, 'Example');
    assert.deepEqual(titles(), ['beta.example', 'gamma.example']);
    assert.deepEqual(value.autoPipExcludedSites, ['alpha.test', 'beta.example', 'gamma.example'], '筛选不写存储');
    assert.deepEqual(value.floatingHiddenSites, ['hidden.example']);
    await click(playback().querySelector('button[aria-label="在 beta.example 恢复自动画中画"]') as unknown as { click(): void });
    assert.deepEqual(value.autoPipExcludedSites, ['alpha.test', 'gamma.example'], '删除只去掉那一条，被滤掉的站仍在');
    assert.deepEqual(titles(), ['gamma.example']);
    await type(filter()!, 'zzzz');
    assert.ok(playback().querySelector('#auto-pip-excluded-no-match'));
    assert.match(playback().textContent ?? '', /没有匹配的站点。/);
    await type(filter()!, '');

    const captured: Promise<string>[] = [];
    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob: Blob) => { captured.push(blob.text()); return createObjectURL(blob); };
    await click([...page.node.querySelectorAll('button')].find(item => item.textContent === '导出设置')!);
    const exported = JSON.parse((await captured[0])!) as { settings: Settings };
    assert.deepEqual(exported.settings.autoPipExcludedSites, ['alpha.test', 'gamma.example']);
    assert.deepEqual(exported.settings.floatingHiddenSites, ['hidden.example']);

    const file = new File([serializeSettings({ ...value, autoPipExcludedSites: ['alpha.test', 'delta.test'] }, '1.9.0')], 'ottertap-settings.json', { type: 'application/json' });
    const input = page.node.querySelector('input[type="file"]') as unknown as { files: unknown; dispatchEvent(event: Event): void };
    Object.defineProperty(input, 'files', { configurable: true, value: { 0: file, length: 1, item: () => file } });
    await act(async () => { input.dispatchEvent(new window.Event('change', { bubbles: true }) as unknown as Event); await wait(20); });
    await click([...page.node.querySelectorAll('button')].find(item => item.textContent === '确认导入')!);
    assert.deepEqual(value.autoPipExcludedSites, ['alpha.test', 'delta.test'], '导入写回名单');
    assert.deepEqual(titles(), ['alpha.test', 'delta.test']);

    for (const site of ['alpha.test', 'delta.test']) await click(playback().querySelector(`button[aria-label="在 ${site} 恢复自动画中画"]`) as unknown as { click(): void });
    assert.deepEqual(value.autoPipExcludedSites, []);
    assert.match(playback().textContent ?? '', /本站不自动画中画/, '空名单提示从哪里加入');
    assert.equal(filter(), null);
  } finally {
    await act(async () => { panel.root.unmount(); page.root.unmount(); });
    await window.happyDOM.close();
  }
});
