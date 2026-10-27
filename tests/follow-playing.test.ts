import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { followPlayingGraceMs, shouldFollowPlaying } from '../lib/follow-playing';
import { createMediaController } from '../lib/media';
import { normalizeSettings } from '../lib/settings';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';

const base = { enabled: true, selectedId: '0:1', playingId: '0:2', manualAt: null as number | null, now: 10_000 };

test('另一条开始播放时跟随，刚手动点选的几秒内不跟随', () => {
  assert.equal(followPlayingGraceMs, 2500);
  assert.equal(shouldFollowPlaying(base), true);
  assert.equal(shouldFollowPlaying({ ...base, enabled: false }), false, '设置关闭');
  assert.equal(shouldFollowPlaying({ ...base, playingId: '0:1' }), false, '已经是这一条');
  assert.equal(shouldFollowPlaying({ ...base, playingId: '' }), false);
  assert.equal(shouldFollowPlaying({ ...base, selectedId: '' }), true, '还没有选中时，播放的那一条成为选中');
  assert.equal(shouldFollowPlaying({ ...base, manualAt: 8_000, now: 10_499 }), false, '2.5 秒内让路');
  assert.equal(shouldFollowPlaying({ ...base, manualAt: 8_000, now: 10_500 }), true, '满 2.5 秒后恢复跟随');
  assert.equal(defaultSettings.followPlaying, true);
  assert.equal(normalizeSettings(null).followPlaying, true);
  assert.equal(normalizeSettings({}).followPlaying, true, '没有这一项时默认开启');
  assert.equal(normalizeSettings({ followPlaying: false }).followPlaying, false);
  assert.equal(normalizeSettings({ followPlaying: true }).followPlaying, true);
  for (const value of ['false', 0, 1, null]) assert.equal(normalizeSettings({ followPlaying: value }).followPlaying, true, String(value));
  const off = normalizeSettings({ ...defaultSettings, followPlaying: false, hoverWheel: false });
  const text = serializeSettings(off, '1.8.0');
  assert.match(text, /"followPlaying": false/);
  const parsed = parseSettingsBackup(text);
  assert.equal(parsed.ok && parsed.settings.followPlaying, false);
  assert.equal(parsed.ok && parsed.settings.hoverWheel, false);
  const legacy = JSON.parse(text) as { settings: { followPlaying?: unknown } };
  delete legacy.settings.followPlaying;
  const restored = parseSettingsBackup(JSON.stringify(legacy));
  assert.equal(restored.ok && restored.settings.followPlaying, true, '旧备份没有这一项时按默认开启');
});

test('播放事件报出对应媒体的本地 id，卸下后不再报', () => {
  const window = new Window({ url: 'https://example.com/feed' });
  const document = window.document;
  const video = document.createElement('video');
  document.body.append(video);
  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const audio = document.createElement('audio');
  shadow.append(audio);
  const played: string[] = [];
  const controller = createMediaController(document as unknown as Document, undefined, undefined, id => { played.push(id); });
  try {
    const snap = controller.snapshot();
    assert.equal(snap.length, 2);
    const videoId = snap[0]!.id;
    const audioId = snap[1]!.id;
    video.dispatchEvent(new window.Event('play'));
    audio.dispatchEvent(new window.Event('play'));
    video.dispatchEvent(new window.Event('play'));
    assert.deepEqual(played, [videoId, audioId, videoId]);
    video.remove();
    video.dispatchEvent(new window.Event('play'));
    assert.deepEqual(played, [videoId, audioId, videoId], '离开文档后不再报');
    controller.snapshot();
    audio.dispatchEvent(new window.Event('play'));
    assert.deepEqual(played, [videoId, audioId, videoId, audioId]);
    controller.destroy();
    audio.dispatchEvent(new window.Event('play'));
    assert.equal(played.length, 4);
  } finally {
    controller.destroy();
    void window.happyDOM.close();
  }
});

test('设置页开关默认开，关掉只改这一项', async () => {
  const window = new Window({ url: 'https://example.com/watch' });
  const globals = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const;
  for (const name of globals) Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { SettingsPage } = await import('../components/settings-page');
  let value: Settings = { ...defaultSettings, theme: 'light', hoverWheel: true };
  const listeners = new Set<(settings: Settings) => void>();
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) { value = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  try {
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(SettingsPage) })); });
    const toggle = host.querySelector('[role="switch"][aria-label="跟随开始播放的媒体"]');
    assert.ok(toggle);
    assert.equal(toggle.getAttribute('aria-checked'), 'true');
    assert.match(host.textContent ?? '', /刚点选的那一条会再保持几秒/);
    assert.match(host.textContent ?? '', /只有一条媒体时，和现在一样/);
    await act(async () => { (toggle as unknown as HTMLElement).click(); });
    assert.equal(value.followPlaying, false);
    assert.equal(value.hoverWheel, true);
    assert.equal(value.floating, true);
    assert.equal(value.floatingWhilePlaying, false);
    assert.equal(value.lockRate, false);
    await act(async () => { (toggle as unknown as HTMLElement).click(); });
    assert.equal(value.followPlaying, true);
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
