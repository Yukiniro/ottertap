import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { applyMediaCommand, createMediaController, isMediaCommand, mediaSnapshot, pipHint, togglePictureInPicture } from '../lib/media';
import { defaultSettings, type MediaClient, type MediaState, type SettingsStore } from '../lib/types';

function page() {
  const window = new Window({ url: 'https://example.com/watch' });
  window.document.title = '示例视频';
  return { window, document: window.document as unknown as Document };
}

function installPip(document: Document, video: HTMLVideoElement, enabled = true) {
  let current: Element | null = null;
  Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, get: () => current });
  Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, get: () => enabled });
  document.exitPictureInPicture = async () => {
    if (!current) throw new DOMException('no pip', 'InvalidStateError');
    current = null;
  };
  const request = async () => {
    current = video;
    return {} as PictureInPictureWindow;
  };
  Object.defineProperty(video, 'requestPictureInPicture', { configurable: true, writable: true, value: request });
  Object.defineProperty(video, 'readyState', { configurable: true, value: 1 });
  return {
    get current() { return current; },
    set current(value: Element | null) { current = value; },
    request
  };
}

test('画中画指令切换进入和退出，并替换另一个正在画中画的视频', async () => {
  const { document } = page();
  const video = document.createElement('video') as HTMLVideoElement;
  const other = document.createElement('video') as HTMLVideoElement;
  document.body.append(video, other);
  const pip = installPip(document, video);
  other.requestPictureInPicture = async () => {
    pip.current = other;
    return {} as PictureInPictureWindow;
  };
  assert.equal(isMediaCommand({ type: 'pip' }), true);
  assert.equal(isMediaCommand({ type: 'pip', value: Number.NaN }), true);
  const entered = mediaSnapshot(video, '1', document);
  assert.equal(entered.pip, false);
  assert.equal(entered.pipAvailable, true);
  assert.equal(entered.pipBlock, '');
  assert.equal(pipHint(entered), '');
  await applyMediaCommand(video, { type: 'pip' });
  assert.equal(pip.current, video);
  assert.equal(mediaSnapshot(video, '1', document).pip, true);
  pip.current = other;
  await applyMediaCommand(video, { type: 'pip' });
  assert.equal(pip.current, video);
  await applyMediaCommand(video, { type: 'pip' });
  assert.equal(pip.current, null);
  video.volume = 1;
  await applyMediaCommand(video, { type: 'volume', value: .3 });
  assert.equal(video.volume, .3);
});

test('音频、不支持、站点禁用和未加载时不能进入画中画', async () => {
  const { document } = page();
  const audio = document.createElement('audio');
  document.body.append(audio);
  const audioState = mediaSnapshot(audio, '1', document);
  assert.deepEqual({ pip: audioState.pip, pipAvailable: audioState.pipAvailable, pipBlock: audioState.pipBlock }, { pip: false, pipAvailable: false, pipBlock: 'audio' });
  assert.equal(pipHint(audioState), '音频无法进入画中画。');
  await assert.rejects(togglePictureInPicture(audio), /音频无法进入画中画/);

  const video = document.createElement('video') as HTMLVideoElement;
  document.body.append(video);
  assert.equal(mediaSnapshot(video, '2', document).pipBlock, 'unsupported');
  assert.equal(pipHint(mediaSnapshot(video, '2', document)), '当前浏览器不支持画中画。');
  await assert.rejects(applyMediaCommand(video, { type: 'pip' }), /不支持画中画/);

  const pip = installPip(document, video);
  video.disablePictureInPicture = true;
  assert.equal(mediaSnapshot(video, '2', document).pipBlock, 'disabled');
  assert.equal(pipHint(mediaSnapshot(video, '2', document)), '此网站已关闭画中画。');
  await assert.rejects(applyMediaCommand(video, { type: 'pip' }), /已关闭画中画/);
  assert.equal(pip.current, null);

  video.disablePictureInPicture = false;
  Object.defineProperty(video, 'readyState', { configurable: true, value: 0 });
  await assert.rejects(applyMediaCommand(video, { type: 'pip' }), /等待视频加载/);
  Object.defineProperty(video, 'readyState', { configurable: true, value: 1 });
  video.requestPictureInPicture = async () => { throw new DOMException('gesture', 'NotAllowedError'); };
  await assert.rejects(applyMediaCommand(video, { type: 'pip' }), /没有接受这次点击/);
  video.requestPictureInPicture = async () => { throw new DOMException('invalid', 'InvalidStateError'); };
  await assert.rejects(applyMediaCommand(video, { type: 'pip' }), /无法切换画中画/);
  video.requestPictureInPicture = async () => { throw new DOMException('policy', 'SecurityError'); };
  await assert.rejects(applyMediaCommand(video, { type: 'pip' }), /已关闭画中画/);
});

test('进入和离开画中画的事件会刷新快照', async () => {
  const { window, document } = page();
  const video = document.createElement('video') as HTMLVideoElement;
  document.body.append(video);
  const pip = installPip(document, video);
  let updates = 0;
  const controller = createMediaController(document, () => { updates += 1; });
  assert.equal(controller.snapshot()[0]?.pip, false);
  pip.current = video;
  video.dispatchEvent(new window.Event('enterpictureinpicture', { bubbles: true }) as unknown as Event);
  assert.equal(updates, 1);
  assert.equal(controller.snapshot()[0]?.pip, true);
  await controller.command(controller.snapshot()[0]!.id, { type: 'pip' });
  assert.equal(pip.current, null);
  pip.current = null;
  video.dispatchEvent(new window.Event('leavepictureinpicture', { bubbles: true }) as unknown as Event);
  assert.equal(updates, 2);
  assert.equal(controller.snapshot()[0]?.pip, false);
  controller.destroy();
  video.dispatchEvent(new window.Event('enterpictureinpicture', { bubbles: true }) as unknown as Event);
  assert.equal(updates, 2);
  await window.happyDOM.close();
});

test('面板按钮跟随画中画是否可用，点击发送切换指令', async () => {
  const window = new Window({ url: 'https://example.com' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { MediaPanel } = await import('../components/media-panel');
  const base: MediaState = { id: '1', host: 'example.com', label: '', title: '正片', kind: 'video', volume: .5, maxVolume: 1, muted: false, paused: true, rate: 1, currentTime: 0, duration: 10, live: false, seekable: [], pip: false, pipAvailable: true, pipBlock: '' };
  let media = base;
  const sent: string[] = [];
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId: '1', media: [media] }; },
    async command(_, command) { sent.push(command.type); if (command.type === 'pip') media = { ...media, pip: !media.pip }; },
    async select() {},
    async highlight() {}
  };
  const store: SettingsStore = { async load() { return defaultSettings; }, async save() {}, watch() { return () => {}; } };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const button = () => host.querySelector('button[aria-label="画中画"], button[aria-label="退出画中画"]') as HTMLButtonElement | null;
  let generation = 0;
  const show = () => act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(MediaPanel, { key: ++generation, client, openSettings() {} }) })); });
  try {
    await show();
    assert.equal(button()?.disabled, false);
    assert.equal(host.querySelector('#pip-hint'), null);
    await act(async () => { button()?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }) as unknown as Event); });
    assert.deepEqual(sent, ['pip']);
    assert.equal(button()?.getAttribute('aria-label'), '退出画中画');
    assert.equal(button()?.getAttribute('aria-pressed'), 'true');
    media = { ...base, kind: 'audio', pipAvailable: false, pipBlock: 'audio' };
    await show();
    assert.equal(button()?.disabled, true);
    assert.equal(host.querySelector('#pip-hint')?.textContent, '音频无法进入画中画。');
    media = { ...base, pipAvailable: false, pipBlock: 'disabled' };
    await show();
    assert.equal(button()?.disabled, true);
    assert.equal(host.querySelector('#pip-hint')?.textContent, '此网站已关闭画中画。');
    media = { ...base, pipAvailable: false, pipBlock: 'unsupported' };
    await show();
    assert.equal(host.querySelector('#pip-hint')?.textContent, '当前浏览器不支持画中画。');
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
