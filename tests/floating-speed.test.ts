import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act, Fragment } from 'react';
import { maxGain } from '../lib/amplifier';
import { defaultRatePresets } from '../lib/rate';
import { defaultSettings, type MediaClient, type MediaCommand, type MediaState, type Settings, type SettingsStore } from '../lib/types';

test('展开浮动药丸后可按倍速步长和预设改倍速，音量仍可用，且不会记住站点', async () => {
  const window = new Window({ url: 'https://example.com' });
  const globals = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'CustomEvent', 'MutationObserver', 'ResizeObserver'] as const;
  for (const name of globals) Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { FloatingController } = await import('../components/floating');
  const { RateHint } = await import('../components/rate-hint');
  const times = '×';
  let media: MediaState = { id: '1', title: '测试媒体', label: '测试媒体', host: 'example.com', kind: 'video', paused: false, muted: false, volume: .75, maxVolume: maxGain, rate: 1, currentTime: 10, duration: 100, live: false, seekable: [{ start: 0, end: 100 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true };
  const sent: MediaCommand[] = [];
  let gate = Promise.resolve();
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId: '1', media: [{ ...media }] }; },
    async command(_, value) {
      sent.push(value);
      await gate;
      if (value.type === 'mute') media = { ...media, muted: !media.muted };
      else if (value.type === 'volume') media = { ...media, volume: value.value, muted: false };
      else if (value.type === 'rate') media = { ...media, rate: value.value };
    },
    async select() {},
    async highlight() {}
  };
  let settings: Settings = { ...defaultSettings };
  const saves: Settings[] = [];
  const listeners = new Set<(value: Settings) => void>();
  const store: SettingsStore = {
    async load() { return settings; },
    async save(next) { settings = next; saves.push(next); listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const button = (label: string) => host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
  const click = async (element: HTMLButtonElement) => { await act(async () => { element.click(); }); };
  const publish = async (next: Settings) => {
    settings = next;
    await act(async () => { listeners.forEach(listener => listener(next)); });
  };
  try {
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(Fragment, null, createElement(FloatingController, { client }), createElement(RateHint)) })); });
    const trigger = () => host.querySelector('[data-slot="popover-trigger"]')!;
    const slider = () => host.querySelector('input[type="range"]')!;
    await act(async () => { trigger().dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    assert.equal(trigger().getAttribute('aria-expanded'), 'true');
    assert.equal(slider().getAttribute('aria-valuenow'), '75');
    await act(async () => { slider().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true })); });
    assert.equal(media.volume, .76, '音量滑块仍能调节');
    await click(button('静音')!);
    assert.equal(media.muted, true);
    await click(button('取消静音')!);
    assert.equal(media.muted, false);
    assert.equal(media.volume, .76);

    const speed = host.querySelector('[role="group"][aria-labelledby="floating-speed-label"]')!;
    assert.ok(speed);
    assert.equal(speed.querySelector('#floating-speed-label')!.textContent, '倍速');
    assert.deepEqual(defaultRatePresets.map(rate => button(`${rate} 倍速`)?.textContent), defaultRatePresets.map(rate => `${rate}×`));
    assert.equal(button('1 倍速')!.getAttribute('aria-pressed'), 'true');
    assert.equal(button(`减慢 0.25${times}`)!.disabled, false);
    assert.equal(button(`加快 0.25${times}`)!.disabled, false);
    assert.equal(host.textContent?.includes('记住此站点'), false);

    await click(button(`加快 0.25${times}`)!);
    assert.equal(media.rate, 1.25);
    assert.equal(button('1.25 倍速')!.getAttribute('aria-pressed'), 'true');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    assert.equal(host.querySelector('[role="status"]')!.textContent, `倍速 1.25${times}`);

    let release = () => {};
    gate = new Promise(resolve => { release = resolve; });
    const faster = button(`加快 0.25${times}`)!;
    await act(async () => { faster.click(); faster.click(); });
    assert.deepEqual(sent.filter(item => item.type === 'rate'), [{ type: 'rate', value: 1.25 }, { type: 'rate', value: 1.5 }], '连点时第二次按已经发出的倍速继续走');
    release();
    gate = Promise.resolve();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    assert.equal(media.rate, 1.75);
    assert.deepEqual(sent.filter(item => item.type === 'rate'), [{ type: 'rate', value: 1.25 }, { type: 'rate', value: 1.5 }, { type: 'rate', value: 1.75 }]);

    await click(button('2 倍速')!);
    assert.equal(media.rate, 2);
    assert.equal(button('2 倍速')!.getAttribute('aria-pressed'), 'true');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    assert.equal(host.querySelector('[role="status"]')!.textContent, `倍速 2${times}`);
    assert.deepEqual(settings.sitePrefs, {});
    assert.deepEqual(saves, [], '改倍速不应写入设置');

    await publish({ ...settings, rateStep: 0.1 });
    assert.equal(button(`加快 0.25${times}`), null);
    await click(button(`加快 0.1${times}`)!);
    assert.equal(media.rate, 2.1);

    media = { ...media, rate: 4 };
    await act(async () => { slider().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true })); });
    assert.equal(button(`加快 0.1${times}`)!.disabled, true);
    media = { ...media, rate: 0.25 };
    await act(async () => { slider().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true })); });
    assert.equal(button(`减慢 0.1${times}`)!.disabled, true);
    const beforeLimit = sent.length;
    await click(button(`减慢 0.1${times}`)!);
    assert.equal(sent.length, beforeLimit, '停在下限时不再下发');

    await publish({ ...settings, rateStep: 0.5, ratePresets: [1.5, 2] });
    assert.equal(button('1 倍速'), null);
    assert.equal(button('4 倍速'), null);
    assert.ok(button('1.5 倍速'));
    assert.ok(button('2 倍速'));
    media = { ...media, rate: 1 };
    await act(async () => { slider().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true })); });
    await click(button(`加快 0.5${times}`)!);
    assert.equal(media.rate, 1.5);
    assert.deepEqual(settings.sitePrefs, {});
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
