import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act, type ReactNode } from 'react';
import { mediaFileName, mediaListLabel, mediaSnapshot } from '../lib/media';
import { defaultSettings, type MediaClient, type MediaState, type SettingsStore } from '../lib/types';

test('短标签用元素名称、文件名，再否则用序号', () => {
  assert.equal(mediaFileName(''), '');
  assert.equal(mediaFileName('blob:https://cdn.test/uuid'), '');
  assert.equal(mediaFileName('data:audio/wav;base64,AAAA'), '');
  assert.equal(mediaFileName('https://cdn.example/a/delta-reel.mp4?token=secret'), 'delta-reel');
  assert.equal(mediaFileName('https://cdn.example/clips/My%20Clip.webm'), 'My Clip');
  assert.equal(mediaFileName('delta-reel.mp4'), 'delta-reel');
  assert.equal(mediaListLabel({ label: '正片', kind: 'video', file: 'ignored' }, 1), '正片');
  assert.equal(mediaListLabel({ label: '', kind: 'video', file: 'delta-reel' }, 3), 'delta-reel');
  assert.equal(mediaListLabel({ label: '  ', kind: 'audio', file: '' }, 1), '音频 2');
  assert.equal(mediaListLabel({ label: '', kind: 'video' }, 4), '视频 5');
  assert.equal(mediaFileName(`https://cdn.example/${'a'.repeat(60)}.mp4`).endsWith('…'), true);
});

test('快照文件名不采用页面标题，blob 地址退回属性上的文件名', () => {
  const window = new Window({ url: 'https://player.test/watch' });
  window.document.title = '整页标题';
  const video = window.document.createElement('video');
  video.setAttribute('src', 'https://cdn.example/preview-clip.mp4?sig=1');
  window.document.body.append(video);
  const named = mediaSnapshot(video as unknown as HTMLMediaElement, '1', window.document as unknown as Document);
  assert.equal(named.label, '');
  assert.equal(named.title, '整页标题');
  assert.equal(named.file, 'preview-clip');
  assert.equal(mediaListLabel(named, 0), 'preview-clip');
  video.setAttribute('title', '预告');
  const titled = mediaSnapshot(video as unknown as HTMLMediaElement, '1', window.document as unknown as Document);
  assert.equal(mediaListLabel(titled, 1), '预告');
  Object.defineProperty(video, 'currentSrc', { configurable: true, value: 'blob:https://player.test/uuid' });
  video.setAttribute('title', '');
  video.setAttribute('src', 'episode-three.webm');
  const blobbed = mediaSnapshot(video as unknown as HTMLMediaElement, '1', window.document as unknown as Document);
  assert.equal(blobbed.label, '');
  assert.equal(blobbed.file, 'episode-three');
  assert.equal(mediaListLabel(blobbed, 0), 'episode-three');
});

const clip = (patch: Partial<MediaState> & Pick<MediaState, 'id'>): MediaState => ({
  host: 'player.test', label: '', title: '页面', file: '', kind: 'video', volume: 1, maxVolume: 1, muted: false, paused: true, rate: 1, currentTime: 0, duration: 10, live: false, seekable: [{ start: 0, end: 10 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true,
  ...patch,
});

async function renderPanel(media: MediaState[], selectedId = media[0]?.id ?? '') {
  const window = new Window({ url: 'https://player.test/watch' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { MediaPanel } = await import('../components/media-panel');
  const selects: string[] = [];
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'player.test', selectedId, media }; },
    async command() {},
    async select(id) { selects.push(id); },
    async highlight() {},
  };
  const store: SettingsStore = { async load() { return defaultSettings; }, async save() {}, watch() { return () => {}; } };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(MediaPanel, { client, openSettings() {} }) as ReactNode })); });
  const rows = () => [...window.document.querySelectorAll('[role="menuitemradio"]')].map(node => ({
    text: (node.textContent || '').replace(/\s+/g, ' ').trim(),
    checked: node.getAttribute('aria-checked'),
    filtered: node.hasAttribute('data-filtered'),
    node,
  }));
  const open = async () => {
    const trigger = window.document.getElementById('popup-media');
    assert.ok(trigger);
    await act(async () => {
      trigger.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
      trigger.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
      trigger.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }));
      trigger.dispatchEvent(new window.MouseEvent('click', { bubbles: true, button: 0 }));
    });
  };
  const type = async (value: string) => {
    const input = window.document.getElementById('popup-media-filter') as HTMLInputElement | null;
    assert.ok(input);
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, value);
      input.dispatchEvent(new window.Event('input', { bubbles: true }) as unknown as Event);
    });
  };
  return {
    window, selects, rows, open, type,
    close: async () => { await act(async () => { root.unmount(); }); await window.happyDOM.close(); },
  };
}

test('一条媒体时不出现列表，四条时能分清播放和选中且没有过滤', async () => {
  const alone = await renderPanel([clip({ id: 'only', label: '正片', title: '正片' })]);
  try {
    assert.equal(alone.window.document.getElementById('popup-media'), null);
    assert.equal(alone.window.document.getElementById('popup-media-filter'), null);
    assert.equal(alone.window.document.querySelector('h1')?.textContent, '正片');
  } finally { await alone.close(); }

  const preview = clip({ id: 'preview', label: '预览', title: '预览', paused: true });
  const feature = clip({ id: 'feature', label: '正片', title: '正片', paused: false });
  const ending = clip({ id: 'ending', label: '片尾', title: '片尾', paused: true });
  const extra = clip({ id: 'extra', label: '花絮', title: '花絮', paused: true });
  const panel = await renderPanel([preview, feature, ending, extra], 'feature');
  try {
    assert.equal(panel.window.document.getElementById('popup-media-filter'), null);
    assert.match(panel.window.document.getElementById('popup-media')?.textContent ?? '', /正片/);
    assert.match(panel.window.document.getElementById('popup-media')?.textContent ?? '', /正在播放/);
    await panel.open();
    const shown = panel.rows().filter(row => !row.filtered);
    assert.deepEqual(shown.map(row => row.text), ['预览已暂停', '正片正在播放', '片尾已暂停', '花絮已暂停']);
    assert.deepEqual(shown.map(row => row.checked), ['false', 'true', 'false', 'false']);
    const before = panel.selects.length;
    await act(async () => { (shown[0]?.node as unknown as { click(): void }).click(); });
    assert.deepEqual(panel.selects.slice(before), ['preview']);
  } finally { await panel.close(); }
});

test('满五条才过滤，过滤只藏起不匹配的行', async () => {
  const media = [
    clip({ id: 'alpha', label: 'Alpha reel', title: 'Alpha reel' }),
    clip({ id: 'beta', label: 'Beta reel', title: 'Beta reel', paused: false }),
    clip({ id: 'gamma', label: 'Gamma reel', title: 'Gamma reel' }),
    clip({ id: 'delta', label: '', title: '页面', file: 'delta-reel' }),
    clip({ id: 'echo', label: '', title: '页面', file: '' }),
  ];
  const panel = await renderPanel(media, 'alpha');
  try {
    assert.ok(panel.window.document.getElementById('popup-media-filter'));
    await panel.open();
    const all = panel.rows().filter(row => !row.filtered);
    assert.deepEqual(all.map(row => row.text), ['Alpha reel已暂停', 'Beta reel正在播放', 'Gamma reel已暂停', 'delta-reel已暂停', '视频 5已暂停']);
    assert.equal(all.some(row => row.text.includes('页面')), false);
    const before = panel.selects.length;
    await panel.type('beta');
    const filtered = panel.rows();
    assert.deepEqual(filtered.filter(row => !row.filtered).map(row => row.text), ['Beta reel正在播放']);
    assert.equal(filtered.filter(row => row.filtered).length, 4);
    assert.equal(filtered.find(row => row.text.startsWith('Alpha'))?.checked, 'true');
    assert.equal(panel.selects.length, before);
    await panel.type('zzzz');
    assert.equal(panel.rows().every(row => row.filtered), true);
    assert.match(panel.window.document.body.textContent ?? '', /没有匹配的媒体/);
    assert.equal(panel.selects.length, before);
    await panel.type('');
    assert.equal(panel.rows().filter(row => !row.filtered).length, 5);
  } finally { await panel.close(); }
});
