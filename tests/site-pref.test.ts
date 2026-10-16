import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { createSitePrefSession, forgetMatchingSites, forgetSitePref, normalizeSettings, rememberSite, sitePrefFor, withRememberedCommand } from '../lib/settings';
import { defaultSettings, type MediaClient, type MediaState, type Settings, type SettingsStore } from '../lib/types';

test('站点记忆只保留合法音量和倍速，并按最具体的域名匹配', () => {
  const settings = normalizeSettings({
    sitePrefs: {
      'https://Bilibili.com/video/1': { volume: .4, rate: 9 },
      '*.www.bilibili.com': { volume: 1.5, rate: 1.25 },
      'not a host': { volume: .2 },
      'evil.test': { volume: -1, rate: .2 },
      'ok.com': { rate: 4 },
      'drop.com': { volume: 1.51 }
    }
  });
  assert.deepEqual(settings.sitePrefs, {
    'bilibili.com': { volume: .4 },
    'www.bilibili.com': { volume: 1.5, rate: 1.25 },
    'ok.com': { rate: 4 }
  });
  assert.deepEqual(normalizeSettings(null).sitePrefs, {});
  assert.deepEqual(sitePrefFor('www.bilibili.com', settings.sitePrefs), { host: 'www.bilibili.com', pref: { volume: 1.5, rate: 1.25 } });
  assert.deepEqual(sitePrefFor('m.bilibili.com', settings.sitePrefs)?.pref, { volume: .4 });
  assert.equal(sitePrefFor('bilibili.com.evil.test', settings.sitePrefs), null);
  assert.equal(sitePrefFor('notbilibili.com', settings.sitePrefs), null);
  assert.equal(sitePrefFor('example.com', settings.sitePrefs), null);
});

test('记住、忘记和后续调节只改匹配站点', () => {
  const saved = rememberSite({ 'example.com': { volume: .2 } }, 'WWW.Bilibili.com.', { volume: .8, rate: 1.25 });
  assert.deepEqual(saved, { 'example.com': { volume: .2 }, 'www.bilibili.com': { volume: .8, rate: 1.25 } });
  const tuned = withRememberedCommand(saved, 'player.www.bilibili.com', { type: 'volume', value: .6 });
  assert.deepEqual(tuned?.['www.bilibili.com'], { volume: .6, rate: 1.25 });
  assert.equal(tuned?.['example.com']?.volume, .2);
  assert.equal(withRememberedCommand(saved, 'example.com', { type: 'volume', value: .2 }), null);
  assert.equal(withRememberedCommand(saved, 'example.com', { type: 'mute' }), null);
  assert.equal(withRememberedCommand(saved, 'other.com', { type: 'rate', value: 1.5 }), null);
  assert.deepEqual(forgetMatchingSites(saved, 'www.bilibili.com'), { 'example.com': { volume: .2 } });
  const unrelated = { 'example.com': { volume: .2 } };
  assert.equal(forgetMatchingSites(unrelated, 'www.bilibili.com'), unrelated);
  assert.deepEqual(forgetSitePref(saved, 'example.com'), { 'www.bilibili.com': { volume: .8, rate: 1.25 } });
});

test('进入页面或换媒体时应用一次，同一媒体不再回写', () => {
  const session = createSitePrefSession();
  const bilibili = { 'bilibili.com': { volume: .4, rate: 1.5 } };
  assert.deepEqual(session.plan('www.bilibili.com', '0:1', bilibili), [{ type: 'volume', value: .4 }, { type: 'rate', value: 1.5 }]);
  assert.deepEqual(session.plan('www.bilibili.com', '0:1', { 'bilibili.com': { volume: .9, rate: 2 } }), []);
  assert.deepEqual(session.plan('example.com', '0:1', bilibili), []);
  assert.deepEqual(session.plan('m.bilibili.com', '0:1', bilibili), [{ type: 'volume', value: .4 }, { type: 'rate', value: 1.5 }]);
  assert.deepEqual(session.plan('www.bilibili.com', '0:2', bilibili)[0], { type: 'volume', value: .4 });
  assert.deepEqual(session.plan('', '0:1', bilibili), []);
  session.reset();
  assert.equal(session.plan('www.bilibili.com', '0:1', bilibili).length, 2);
  const fresh = createSitePrefSession();
  assert.deepEqual(fresh.plan('example.com', '0:3', {}), []);
  assert.deepEqual(fresh.plan('example.com', '0:3', bilibili), []);
});

test('控制面板可以记住当前站点，设置页可以忘记', async () => {
  const window = new Window({ url: 'https://www.bilibili.com/video/1' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { MediaPanel } = await import('../components/media-panel');
  const { SettingsPage } = await import('../components/settings-page');
  const media: MediaState = { id: '0:1', title: '正片', label: '正片', host: 'www.bilibili.com', kind: 'video', paused: false, muted: false, volume: .8, maxVolume: 1.5, rate: 1.25, currentTime: 10, duration: 100, live: false, seekable: [{ start: 0, end: 100 }] };
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'www.bilibili.com', selectedId: media.id, media: [{ ...media }] }; },
    async command() {},
    async select() {},
    async highlight() {}
  };
  let value: Settings = { ...defaultSettings, sitePrefs: { 'example.com': { volume: .3 } } };
  const listeners = new Set<(settings: Settings) => void>();
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) { value = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const click = async (element: { click(): void }) => { await act(async () => { element.click(); }); };
  try {
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(MediaPanel, { client, openSettings() {} }) })); });
    const remember = () => [...host.querySelectorAll('[role="switch"]')].find(item => item.getAttribute('aria-label') === '记住此站点')!;
    assert.equal(remember().getAttribute('aria-checked'), 'false');
    await click(remember() as unknown as { click(): void });
    assert.deepEqual(value.sitePrefs, { 'example.com': { volume: .3 }, 'www.bilibili.com': { volume: .8, rate: 1.25 } });
    assert.equal(remember().getAttribute('aria-checked'), 'true');
    await click(remember() as unknown as { click(): void });
    assert.deepEqual(value.sitePrefs, { 'example.com': { volume: .3 } });
    await click(remember() as unknown as { click(): void });
    assert.deepEqual(value.sitePrefs['www.bilibili.com'], { volume: .8, rate: 1.25 });
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(SettingsPage) })); });
    assert.match(host.textContent ?? '', /www\.bilibili\.com/);
    assert.match(host.textContent ?? '', /80%/);
    assert.match(host.textContent ?? '', /1\.25×/);
    const forget = [...host.querySelectorAll('button')].find(item => item.getAttribute('aria-label') === '忘记 www.bilibili.com')!;
    await click(forget);
    assert.deepEqual(value.sitePrefs, { 'example.com': { volume: .3 } });
    assert.doesNotMatch(host.textContent ?? '', /bilibili/);
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
