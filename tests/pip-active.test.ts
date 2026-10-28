import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { readFlatMessages } from '../lib/message-catalog';
import { pipHint, showsPictureInPicture } from '../lib/media';
import { defaultSettings, type MediaClient, type MediaCommand, type MediaState, type Settings, type SettingsStore } from '../lib/types';

const read = (file: string) => readFlatMessages(readFileSync(new URL(`../locales/${file}`, import.meta.url), 'utf8'));

test('八种语言都有画中画中的短状态和列表短标记', () => {
  const files = readdirSync(new URL('../locales/', import.meta.url)).filter(name => name.endsWith('.yml')).sort();
  assert.deepEqual(files, ['de.yml', 'en.yml', 'es.yml', 'fr.yml', 'ja.yml', 'ko.yml', 'zh_CN.yml', 'zh_TW.yml']);
  for (const file of files) {
    const locale = read(file);
    assert.notEqual(locale.pipActive, '', file);
    assert.notEqual(locale.pipMark, '', file);
    assert.notEqual(locale.pipActive, locale.pictureInPicture, file);
    assert.notEqual(locale.pipActive, locale.exitPictureInPicture, file);
    assert.notEqual(locale.pipActive, locale.pipOnHint, file);
    assert.notEqual(locale.pipActive, locale.pipOffHint, file);
  }
  assert.equal(read('en.yml').pipActive, 'In picture-in-picture');
  assert.equal(read('en.yml').pipMark, 'PiP');
  assert.equal(read('zh_CN.yml').pipActive, '画中画中');
  assert.equal(read('zh_CN.yml').pipMark, '画中画');
});

test('音频即使带着画中画标记也不算正在画中画', () => {
  assert.equal(showsPictureInPicture({ kind: 'video', pip: true }), true);
  assert.equal(showsPictureInPicture({ kind: 'video', pip: false }), false);
  assert.equal(showsPictureInPicture({ kind: 'audio', pip: true }), false);
  assert.equal(showsPictureInPicture({ kind: 'audio', pip: false }), false);
  const audio = { kind: 'audio' as const, pip: true, pipAvailable: false, pipBlock: 'audio' as const };
  assert.equal(pipHint(audio), '音频无法进入画中画。');
  assert.equal(pipHint({ pip: true, pipAvailable: true, pipBlock: '' }), '');
});

const clip = (patch: Partial<MediaState> & Pick<MediaState, 'id'>): MediaState => ({
  host: 'example.com', label: '', title: '正片', file: '', kind: 'video', volume: 1, maxVolume: 1, muted: false, paused: true, rate: 1, currentTime: 0, duration: 10, live: false, seekable: [{ start: 0, end: 10 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true,
  ...patch,
});

function installDom(window: Window) {
  const globals = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'CustomEvent', 'MutationObserver', 'ResizeObserver'] as const;
  for (const name of globals) Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
}

async function openMenu(window: Window, host: HTMLElement) {
  const trigger = host.querySelector('#popup-media');
  assert.ok(trigger);
  const event = (value: unknown) => value as Event;
  await act(async () => {
    trigger.dispatchEvent(event(new window.PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })));
    trigger.dispatchEvent(event(new window.MouseEvent('mousedown', { bubbles: true, button: 0 })));
    trigger.dispatchEvent(event(new window.PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })));
    trigger.dispatchEvent(event(new window.MouseEvent('click', { bubbles: true, button: 0 })));
  });
}

test('面板在画中画中显示退出和短状态，换选中或退出后跟着变，音频不出现', async () => {
  const window = new Window({ url: 'https://example.com/watch' });
  installDom(window);
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { MediaPanel } = await import('../components/media-panel');
  let media = [
    clip({ id: 'a', label: '预览', title: '预览', pip: true }),
    clip({ id: 'b', label: '正片', title: '正片', pip: false }),
  ];
  let selectedId = 'a';
  const sent: MediaCommand[] = [];
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId, media: media.map(item => ({ ...item })) }; },
    async command(current, command) {
      sent.push(command);
      if (command.type !== 'pip') return;
      media = media.map(item => item.id === current.id ? { ...item, pip: !item.pip } : item);
    },
    async select(id) { selectedId = id; },
    async highlight() {},
  };
  const store: SettingsStore = { async load() { return defaultSettings; }, async save() {}, watch() { return () => {}; } };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const button = (label: string) => host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
  let generation = 0;
  const show = async () => {
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(MediaPanel, { key: ++generation, client, openSettings() {} }) })); });
  };
  const menuItems = () => [...window.document.querySelectorAll('[role="menuitemradio"]')];
  const rows = () => menuItems().map(node => (node.textContent || '').replace(/\s+/g, ' ').trim());
  try {
    await show();
    const exit = button('退出画中画');
    assert.ok(exit);
    assert.equal(exit.getAttribute('aria-pressed'), 'true');
    assert.equal(exit.getAttribute('aria-describedby'), 'pip-status');
    assert.equal(host.querySelector('#pip-status')?.textContent, '画中画中');
    assert.equal(host.querySelector('#pip-hint'), null);
    assert.match(host.querySelector('#popup-media')?.textContent ?? '', /画中画/);
    assert.doesNotMatch(host.querySelector('#popup-media')?.textContent ?? '', /画中画中/);
    await openMenu(window, host as unknown as HTMLElement);
    const marked = rows();
    assert.equal(marked.some(text => text.includes('预览') && text.includes('画中画')), true);
    assert.equal(marked.some(text => text.includes('正片') && text.includes('画中画')), false);

    const other = menuItems().find(node => (node.textContent || '').includes('正片'));
    await act(async () => { (other as unknown as { click(): void }).click(); });
    assert.equal(button('画中画')?.getAttribute('aria-pressed'), 'false');
    assert.equal(host.querySelector('#pip-status'), null);
    assert.equal(button('退出画中画'), null);
    if (menuItems().length === 0) await openMenu(window, host as unknown as HTMLElement);
    const afterSwitch = rows();
    assert.equal(afterSwitch.some(text => text.includes('预览') && text.includes('画中画')), true, JSON.stringify(afterSwitch));
    assert.equal(afterSwitch.some(text => text.includes('正片') && text.includes('画中画')), false, JSON.stringify(afterSwitch));

    if (menuItems().length === 0) await openMenu(window, host as unknown as HTMLElement);
    const back = menuItems().find(node => (node.textContent || '').includes('预览'));
    await act(async () => { (back as unknown as { click(): void }).click(); });
    assert.equal(host.querySelector('#pip-status')?.textContent, '画中画中');
    await act(async () => { button('退出画中画')?.click(); });
    assert.deepEqual(sent.at(-1), { type: 'pip' });
    assert.equal(media.find(item => item.id === 'a')?.pip, false);
    assert.equal(button('画中画')?.getAttribute('aria-pressed'), 'false');
    assert.equal(host.querySelector('#pip-status'), null);
    if (menuItems().length === 0) await openMenu(window, host as unknown as HTMLElement);
    assert.equal(rows().some(text => text.includes('画中画')), false, JSON.stringify(rows()));

    media = [clip({ id: 'audio', label: '播客', title: '播客', kind: 'audio', pip: true, pipAvailable: false, pipBlock: 'audio' })];
    selectedId = 'audio';
    await show();
    assert.equal(button('画中画')?.disabled, true);
    assert.equal(button('退出画中画'), null);
    assert.equal(host.querySelector('#pip-status'), null);
    assert.equal(host.querySelector('#pip-hint')?.textContent, '音频无法进入画中画。');
    assert.equal((host.textContent || '').includes('画中画中'), false);
    assert.equal(host.querySelector('#popup-media'), null);
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});

test('展开的音量药丸在画中画中改成退出并显示同一句短状态', async () => {
  const window = new Window({ url: 'https://example.com/watch' });
  installDom(window);
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { FloatingController } = await import('../components/floating');
  let media = [
    clip({ id: 'a', label: '预览', title: '预览', pip: true }),
    clip({ id: 'b', label: '正片', title: '正片', pip: false }),
  ];
  let selectedId = 'a';
  const sent: { id: string; command: MediaCommand }[] = [];
  const saves: unknown[] = [];
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId, media: media.map(item => ({ ...item })) }; },
    async command(current, command) {
      sent.push({ id: current.id, command });
      if (command.type !== 'pip') return;
      media = media.map(item => item.id === current.id ? { ...item, pip: !item.pip } : item);
    },
    async select(id) { selectedId = id; },
    async highlight() {},
  };
  let settings: Settings = { ...defaultSettings, floatingPosition: { side: 'right', y: .8 } };
  const listeners = new Set<(value: Settings) => void>();
  const store: SettingsStore = {
    async load() { return settings; },
    async save(next) { saves.push(next); settings = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const button = (label: string) => host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
  const expand = async () => {
    const trigger = host.querySelector('[data-slot="popover-trigger"]');
    assert.ok(trigger);
    await act(async () => { trigger.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
  };
  try {
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(FloatingController, { client }) })); });
    await expand();
    const exit = button('退出画中画');
    assert.ok(exit);
    assert.equal(exit.getAttribute('aria-pressed'), 'true');
    assert.equal(exit.getAttribute('aria-describedby'), 'floating-pip-status');
    assert.equal(host.querySelector('#floating-pip-status')?.textContent, '画中画中');
    assert.equal(host.querySelector('#floating-pip-hint'), null);
    const beforeSaves = saves.length;
    await act(async () => { button('下一条媒体')?.click(); });
    assert.equal(button('画中画')?.getAttribute('aria-pressed'), 'false');
    assert.equal(host.querySelector('#floating-pip-status'), null);
    assert.equal(button('退出画中画'), null);
    await act(async () => { button('上一条媒体')?.click(); });
    assert.equal(host.querySelector('#floating-pip-status')?.textContent, '画中画中');
    await act(async () => { button('退出画中画')?.click(); });
    assert.deepEqual(sent.at(-1), { id: 'a', command: { type: 'pip' } });
    assert.equal(media.find(item => item.id === 'a')?.pip, false);
    assert.equal(button('画中画')?.getAttribute('aria-pressed'), 'false');
    assert.equal(host.querySelector('#floating-pip-status'), null);
    assert.equal(saves.length, beforeSaves);

    media = [clip({ id: 'audio', label: '播客', title: '播客', kind: 'audio', pip: true, pipAvailable: false, pipBlock: 'audio' })];
    selectedId = 'audio';
    await act(async () => { root.unmount(); });
    const audioRoot = createRoot(host as unknown as HTMLElement);
    await act(async () => { audioRoot.render(createElement(ThemeProvider, { store, children: createElement(FloatingController, { client }) })); });
    await expand();
    const audio = button('画中画');
    assert.ok(audio);
    assert.equal(audio.disabled, true);
    assert.equal(button('退出画中画'), null);
    assert.equal(host.querySelector('#floating-pip-status'), null);
    assert.equal(host.querySelector('#floating-pip-hint')?.textContent, '音频无法进入画中画。');
    assert.equal((host.textContent || '').includes('画中画中'), false);
    await act(async () => { audioRoot.unmount(); });
  } finally {
    await window.happyDOM.close();
  }
});
