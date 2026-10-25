import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act, Fragment } from 'react';
import { currentSiteHost, readCurrentSiteHost } from '../lib/current-site';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';

const settingsTab = { id: 2, windowId: 1, active: true, url: 'chrome-extension://abc/options.html', lastAccessed: 500 };

test('当前站主机名只取本窗口能读到的网页，读不到就不猜', () => {
  const older = { id: 3, windowId: 1, active: false, url: 'https://elsewhere.test/watch', lastAccessed: 100 };
  const current = { id: 4, windowId: 1, active: false, url: 'https://Media.Ottertap.test/video?x=1', lastAccessed: 400 };
  const otherWindow = { id: 9, windowId: 2, active: true, url: 'https://other.window/a', lastAccessed: 999 };
  const tabs = [settingsTab, older, current, otherWindow];
  assert.equal(currentSiteHost(tabs, { id: settingsTab.id, windowId: 1 }), 'media.ottertap.test');
  assert.deepEqual(tabs.map(tab => tab.id), [2, 3, 4, 9]);

  assert.equal(currentSiteHost([{ id: 1, windowId: 1, active: true, url: 'https://www.example.com./path' }], { id: 8, windowId: 1 }), 'www.example.com');
  assert.equal(currentSiteHost([{ id: 1, windowId: 1, active: true, url: 'https://例子.中国/watch' }], { id: 8, windowId: 1 }), 'xn--fsqu00a.xn--fiqs8s');
  assert.equal(currentSiteHost([{ id: 1, windowId: 1, url: 'https://kept.example/old', pendingUrl: 'https://next.example/new' }], { id: 8, windowId: 1 }), 'kept.example');
  assert.equal(currentSiteHost([{ id: 1, windowId: 1, url: '', pendingUrl: 'https://pending.example/watch' }], { id: 8, windowId: 1 }), 'pending.example');

  for (const url of ['chrome://newtab', 'chrome-extension://abc/options.html', 'about:blank', 'javascript:alert(1)', 'data:text/html,hi', 'ftp://files.example/a', '']) {
    assert.equal(currentSiteHost([{ id: 1, windowId: 1, active: true, url }], { id: 8, windowId: 1 }), null, url || 'empty');
  }
  assert.equal(currentSiteHost([], { id: 2, windowId: 1 }), null);
  assert.equal(currentSiteHost([
    { id: 1, windowId: 1, url: 'https://a.test/' },
    { id: 3, windowId: 1, url: 'https://b.test/' }
  ], { id: 2, windowId: 1 }), null);
  assert.equal(currentSiteHost([
    { id: 1, windowId: 1, active: false, url: 'https://a.test/', lastAccessed: 10 },
    { id: 3, windowId: 1, active: false, url: 'https://b.test/', lastAccessed: 10 }
  ], { id: 2, windowId: 1 }), null);
  assert.equal(currentSiteHost([
    { id: 1, windowId: 1, active: true, url: 'https://live.example/a' },
    { id: 3, windowId: 1, active: false, url: 'https://old.example/a', lastAccessed: 999 }
  ], { id: 2, windowId: 1 }), 'live.example');
  assert.equal(currentSiteHost([otherWindow], { id: 2, windowId: 1 }), null);
  assert.equal(currentSiteHost([
    { id: 1, windowId: 1, url: 'https://only.example/a' },
    { id: 3, windowId: 1, url: 'https://only.example/b' }
  ], { id: 2, windowId: 1 }), 'only.example');
  assert.equal(currentSiteHost([{ id: 4, windowId: 1, url: 'https://media.ottertap.test/video' }], null), 'media.ottertap.test');
  assert.equal(currentSiteHost([
    { id: 4, windowId: 1, url: 'https://a.test/' },
    { id: 5, windowId: 1, url: 'https://b.test/' }
  ], null), null);
});

test('设置页三处「当前站」只改被点的那一区；读不到主机名时不填', async () => {
  const window = new Window({ url: 'chrome-extension://abc/options.html' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'FocusEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const scrolled: string[] = [];
  window.HTMLElement.prototype.scrollIntoView = function (this: { getAttribute(name: string): string | null }) {
    scrolled.push(this.getAttribute('data-current-site-list') ?? '');
  };
  const events = { removed: new Set<() => void>(), updated: new Set<() => void>(), activated: new Set<() => void>() };
  const eventApi = (bag: Set<() => void>) => ({
    addListener(fn: () => void) { bag.add(fn); },
    removeListener(fn: () => void) { bag.delete(fn); }
  });
  let listed = [
    settingsTab,
    { id: 3, windowId: 1, active: false, url: 'https://elsewhere.test/watch', lastAccessed: 100 },
    { id: 4, windowId: 1, active: false, url: 'https://media.ottertap.test/video', lastAccessed: 400 }
  ];
  const chrome = (globalThis as unknown as { chrome: { tabs?: unknown } }).chrome;
  const previousTabs = chrome.tabs;
  chrome.tabs = {
    async getCurrent() { return settingsTab; },
    async query() { return listed; },
    onRemoved: eventApi(events.removed),
    onUpdated: eventApi(events.updated),
    onActivated: eventApi(events.activated)
  };
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { SettingsPage } = await import('../components/settings-page');
  let value: Settings = {
    ...defaultSettings,
    siteMode: 'allow',
    sites: ['alpha.test', 'beta.example', 'media.ottertap.test'],
    sitePrefs: { 'alpha.test': { volume: .4 }, 'beta.example': { rate: 1.5 }, 'media.ottertap.test': { volume: .8 } },
    floatingHiddenSites: ['alpha.test', 'gamma.example', 'media.ottertap.test']
  };
  const listeners = new Set<(settings: Settings) => void>();
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) { value = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const section = (id: string) => host.querySelector(`#${id}`)!;
  const titles = (id: string) => [...section(id).querySelectorAll('[data-slot="item-title"]')].map(node => node.textContent);
  const filter = (id: string) => section(id).querySelector('input[type="search"]') as unknown as HTMLInputElement;
  const currentSite = (id: string) => [...section(id).querySelectorAll('button')].find(node => node.textContent === '当前站') as unknown as HTMLButtonElement;
  const type = async (id: string, text: string) => {
    await act(async () => {
      const input = filter(id);
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, text);
      input.dispatchEvent(new window.Event('input', { bubbles: true }) as unknown as Event);
    });
  };
  const click = async (id: string) => {
    await act(async () => {
      currentSite(id).click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  };
  const saved = () => ({
    sites: [...value.sites],
    prefs: Object.keys(value.sitePrefs).sort(),
    hidden: [...value.floatingHiddenSites]
  });
  try {
    assert.equal(await readCurrentSiteHost(), 'media.ottertap.test');
    const before = saved();
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(Fragment, null, createElement(SettingsPage)) })); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    for (const id of ['memory', 'sites', 'floating']) {
      const button = currentSite(id);
      assert.equal(button.disabled, false, id);
      assert.equal(button.getAttribute('title'), 'media.ottertap.test');
      assert.equal(button.getAttribute('aria-describedby'), null);
    }
    assert.deepEqual(titles('memory'), ['alpha.test', 'beta.example', 'media.ottertap.test']);
    assert.deepEqual(titles('sites'), ['alpha.test', 'beta.example', 'media.ottertap.test']);
    assert.deepEqual(titles('floating'), ['alpha.test', 'gamma.example', 'media.ottertap.test']);

    await type('sites', 'beta');
    await type('floating', 'gamma');
    assert.deepEqual(titles('sites'), ['beta.example']);
    assert.deepEqual(titles('floating'), ['gamma.example']);
    await click('memory');
    assert.equal(filter('memory').value, 'media.ottertap.test');
    assert.deepEqual(titles('memory'), ['media.ottertap.test']);
    assert.equal(filter('sites').value, 'beta');
    assert.deepEqual(titles('sites'), ['beta.example']);
    assert.equal(filter('floating').value, 'gamma');
    assert.deepEqual(titles('floating'), ['gamma.example']);
    assert.deepEqual(scrolled, ['memory']);
    assert.deepEqual(saved(), before);

    await click('sites');
    assert.equal(filter('sites').value, 'media.ottertap.test');
    assert.deepEqual(titles('sites'), ['media.ottertap.test']);
    assert.equal(filter('memory').value, 'media.ottertap.test');
    assert.equal(filter('floating').value, 'gamma');
    assert.deepEqual(scrolled, ['memory', 'sites']);

    await click('floating');
    assert.equal(filter('floating').value, 'media.ottertap.test');
    assert.deepEqual(titles('floating'), ['media.ottertap.test']);
    assert.equal(filter('memory').value, 'media.ottertap.test');
    assert.equal(filter('sites').value, 'media.ottertap.test');
    assert.deepEqual(scrolled, ['memory', 'sites', 'floating']);
    assert.deepEqual(saved(), before, '定位不写存储');

    listed = [settingsTab];
    for (const fn of events.removed) fn();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    await type('memory', 'alpha');
    for (const id of ['memory', 'sites', 'floating']) {
      const button = currentSite(id);
      assert.equal(button.disabled, true, id);
      assert.equal(button.getAttribute('title'), '当前标签页没有可读的主机名。');
      assert.equal(button.getAttribute('aria-describedby'), button.closest('div')?.querySelector('p')?.id);
    }
    await click('memory');
    assert.equal(filter('memory').value, 'alpha');
    assert.equal(filter('sites').value, 'media.ottertap.test');
    assert.equal(filter('floating').value, 'media.ottertap.test');
    assert.deepEqual(scrolled, ['memory', 'sites', 'floating'], '不可用时不再滚动');
    assert.deepEqual(saved(), before);

    listed = [
      settingsTab,
      { id: 4, windowId: 1, active: false, url: 'https://media.ottertap.test/video', lastAccessed: 400 }
    ];
    for (const fn of events.activated) fn();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(currentSite('memory').disabled, false);
    listed = [settingsTab];
    await click('sites');
    assert.equal(filter('sites').value, 'media.ottertap.test', '重新读取失败时不改已有筛选');
    assert.equal(filter('memory').value, 'alpha');
    assert.equal(filter('floating').value, 'media.ottertap.test');
    assert.equal(currentSite('sites').disabled, true);
    assert.deepEqual(saved(), before);

    chrome.tabs = { async getCurrent() { throw new Error('gone'); }, async query() { throw new Error('gone'); } };
    assert.equal(await readCurrentSiteHost(), null);
    chrome.tabs = { async getCurrent() { return settingsTab; }, async query() { return { not: 'tabs' }; } };
    assert.equal(await readCurrentSiteHost(), null);
    delete chrome.tabs;
    assert.equal(await readCurrentSiteHost(), null);
  } finally {
    chrome.tabs = previousTabs;
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
