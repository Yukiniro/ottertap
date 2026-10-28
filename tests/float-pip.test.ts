import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { i18n } from '#i18n';
import { maxGain } from '../lib/amplifier';
import { pipFields, pipHint } from '../lib/media';
import { defaultSettings, type MediaClient, type MediaCommand, type MediaState, type Settings, type SettingsStore } from '../lib/types';

test('未加载的视频标成尚未就绪，说明与面板相同，且不盖过音频、禁用或不支持', () => {
  const window = new Window({ url: 'https://example.com/watch' });
  const document = window.document as unknown as Document;
  const video = document.createElement('video') as HTMLVideoElement;
  document.body.append(video);
  Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, get: () => true });
  Object.defineProperty(video, 'requestPictureInPicture', { configurable: true, value: async () => ({}) });
  Object.defineProperty(video, 'readyState', { configurable: true, value: 0 });
  const waiting = pipFields(video, document);
  assert.deepEqual(waiting, { pip: false, pipAvailable: false, pipBlock: 'not-ready' });
  assert.equal(pipHint(waiting), i18n.t('pipNotReady'));

  Object.defineProperty(video, 'readyState', { configurable: true, value: 1 });
  const ready = pipFields(video, document);
  assert.equal(ready.pipBlock, '');
  assert.equal(ready.pipAvailable, true);
  assert.equal(pipHint(ready), '');

  video.disablePictureInPicture = true;
  Object.defineProperty(video, 'readyState', { configurable: true, value: 0 });
  assert.equal(pipFields(video, document).pipBlock, 'disabled');
  assert.equal(pipHint(pipFields(video, document)), i18n.t('pipDisabledBySite'));

  Object.defineProperty(video, 'requestPictureInPicture', { configurable: true, value: undefined });
  assert.equal(pipFields(video, document).pipBlock, 'unsupported');
  assert.equal(pipHint(pipFields(video, document)), i18n.t('pipUnsupported'));

  const audio = document.createElement('audio');
  document.body.append(audio);
  assert.equal(pipFields(audio, document).pipBlock, 'audio');
  assert.equal(pipHint(pipFields(audio, document)), i18n.t('pipUnavailableAudio'));
  void window.happyDOM.close();
});

test('展开音量药丸后，画中画在播放控制旁切换进入和退出，失败原因与面板相同', async () => {
  const window = new Window({ url: 'https://example.com' });
  const globals = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'CustomEvent', 'MutationObserver', 'ResizeObserver'] as const;
  for (const name of globals) Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { FloatingController } = await import('../components/floating');
  const item = (patch: Partial<MediaState> = {}): MediaState => ({
    id: '0:1', title: '正片', label: '正片', host: 'example.com', kind: 'video', paused: true, muted: false, volume: 1, maxVolume: maxGain, rate: 1, currentTime: 0, duration: 30, live: false, seekable: [{ start: 0, end: 30 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true, ...patch
  });
  let media = [item()];
  let pipError = '';
  const commands: { id: string; command: MediaCommand }[] = [];
  const saves: unknown[] = [];
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId: media[0]?.id ?? '', media: media.map(entry => ({ ...entry })) }; },
    async command(current, command) {
      commands.push({ id: current.id, command });
      if (command.type !== 'pip') return;
      if (pipError) throw new Error(pipError);
      const index = media.findIndex(entry => entry.id === current.id);
      if (index >= 0) media[index] = { ...media[index]!, pip: !media[index]!.pip };
    },
    async select() {},
    async highlight() {}
  };
  let settings: Settings = { ...defaultSettings, floatingPosition: { side: 'right', y: .8 } };
  const listeners = new Set<(value: Settings) => void>();
  const store: SettingsStore = {
    async load() { return settings; },
    async save(next) { saves.push(next); settings = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  let root = createRoot(host as unknown as HTMLElement);
  const button = (label: string) => host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
  const expand = async () => {
    const trigger = host.querySelector('[data-slot="popover-trigger"]')!;
    await act(async () => { trigger.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
  };
  const mount = async () => {
    await act(async () => { root.unmount(); });
    root = createRoot(host as unknown as HTMLElement);
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(FloatingController, { client, openPanel: async () => true }) })); });
    await expand();
  };
  const click = async (element: HTMLButtonElement) => { await act(async () => { element.click(); }); };
  try {
    await mount();
    const playback = host.querySelector('[role="group"][aria-label="播放"]');
    const enter = button('画中画');
    const open = button('打开面板');
    assert.ok(enter && open && playback);
    assert.equal(enter.disabled, false);
    assert.equal(enter.getAttribute('aria-pressed'), 'false');
    assert.ok(playback.querySelector('button[aria-label="画中画"]'), '画中画在播放那一组');
    assert.equal(playback.querySelector('button[aria-label="打开面板"]'), null, '画中画不放进打开面板那一栏');
    assert.equal(host.querySelector('#floating-pip-hint'), null);
    assert.equal(button('上一条媒体'), null);

    await click(enter);
    assert.deepEqual(commands, [{ id: '0:1', command: { type: 'pip' } }]);
    assert.equal(media[0]?.pip, true);
    const exit = button('退出画中画');
    assert.ok(exit);
    assert.equal(exit.getAttribute('aria-pressed'), 'true');
    assert.equal(host.querySelector('[role="alert"]'), null);
    await click(exit);
    assert.equal(media[0]?.pip, false);
    assert.equal(button('画中画')?.getAttribute('aria-pressed'), 'false');
    assert.deepEqual(commands.map(entry => entry.command), [{ type: 'pip' }, { type: 'pip' }]);

    pipError = i18n.t('pipFailed');
    await click(button('画中画')!);
    assert.equal(host.querySelector('[role="alert"]')?.textContent, i18n.t('pipFailed'));
    assert.equal(media[0]?.pip, false, '失败时不假装已经进入');
    pipError = i18n.t('pipNeedsGesture');
    await click(button('画中画')!);
    assert.equal(host.querySelector('[role="alert"]')?.textContent, i18n.t('pipNeedsGesture'));

    const blocked = async (patch: Partial<MediaState>, label: string, hint: string) => {
      media = [item(patch)];
      pipError = '';
      const before = commands.length;
      await mount();
      const control = button(label);
      assert.ok(control, label);
      assert.equal(control.disabled, true, `${label} 应禁用`);
      assert.equal(control.getAttribute('aria-describedby'), 'floating-pip-hint');
      assert.equal(host.querySelector('#floating-pip-hint')?.textContent, hint);
      assert.equal(playbackGroupHas(host, '打开面板'), false);
      await click(control);
      assert.equal(commands.length, before, `${label} 禁用时不下发画中画`);
    };
    await blocked({ kind: 'audio', pip: false, pipAvailable: false, pipBlock: 'audio' }, '画中画', i18n.t('pipUnavailableAudio'));
    await blocked({ pip: false, pipAvailable: false, pipBlock: 'disabled' }, '画中画', i18n.t('pipDisabledBySite'));
    await blocked({ pip: false, pipAvailable: false, pipBlock: 'unsupported' }, '画中画', i18n.t('pipUnsupported'));
    await blocked({ pip: false, pipAvailable: false, pipBlock: 'not-ready' }, '画中画', i18n.t('pipNotReady'));

    media = [item(), item({ id: '0:2', title: '下一条', label: '下一条' })];
    await mount();
    const group = host.querySelector('[role="group"][aria-label="播放"]');
    assert.ok(group?.querySelector('button[aria-label="上一条媒体"]'));
    assert.ok(group?.querySelector('button[aria-label="下一条媒体"]'));
    assert.ok(group?.querySelector('button[aria-label="画中画"]'));
    assert.equal(group?.querySelector('button[aria-label="打开面板"]'), null);
    assert.deepEqual(saves, [], '画中画不写位置或站点记忆');
    assert.deepEqual(settings.floatingPosition, { side: 'right', y: .8 });
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});

function playbackGroupHas(host: { querySelector(selector: string): { querySelector(selector: string): unknown } | null }, label: string) {
  return host.querySelector('[role="group"][aria-label="播放"]')?.querySelector(`button[aria-label="${label}"]`) != null;
}
