import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createDemo } from '../lib/demo';
import { createMediaController } from '../lib/media';
import { nextRate } from '../lib/rate';
import { defaultSettings, type Settings } from '../lib/types';

function installRateEvents(media: HTMLMediaElement, view: Window) {
  let desc: PropertyDescriptor | undefined;
  for (let proto = Object.getPrototypeOf(media); proto; proto = Object.getPrototypeOf(proto)) {
    desc = Object.getOwnPropertyDescriptor(proto, 'playbackRate');
    if (desc) break;
  }
  assert.ok(desc?.get && desc.set);
  Object.defineProperty(media, 'playbackRate', {
    configurable: true,
    get() { return desc!.get!.call(this); },
    set(value: number) {
      const before = desc!.get!.call(this);
      desc!.set!.call(this, value);
      if (desc!.get!.call(this) === before) return;
      media.dispatchEvent(new view.Event('ratechange') as unknown as Event);
    }
  });
}

test('内容脚本按页面记住最近一次非 1×，站点菜单和预设都会刷新它', async () => {
  const view = new Window({ url: 'https://example.com/watch' });
  const document = view.document as unknown as Document;
  const video = view.document.createElement('video');
  const audio = view.document.createElement('audio');
  video.playbackRate = 2;
  audio.playbackRate = 1.5;
  view.document.body.append(video, audio);
  const controller = createMediaController(document);
  try {
    const [first, second] = controller.snapshot();
    assert.ok(first && second);
    assert.equal(controller.recallRate(), 2, '先看到的非 1× 会记下，后一个元素的初次读数不覆盖');
    video.playbackRate = 1.8;
    controller.snapshot();
    assert.equal(controller.recallRate(), 1.8, '站点菜单改到的倍速会成为最新值');
    await controller.command(second.id, { type: 'rate', value: 1.25 });
    assert.equal(controller.recallRate(), 1.25);
    await controller.command(first.id, { type: 'rate', value: 1 });
    assert.equal(video.playbackRate, 1);
    assert.equal(controller.recallRate(), 1.8, '重置记住的是被切换的这一路离开前的倍速');
    assert.equal(nextRate(controller.snapshot()[0]!.rate, 0, controller.recallRate()), 1.8);
    await controller.command(first.id, { type: 'rate', value: 1.8 });
    assert.equal(video.playbackRate, 1.8);
    assert.equal(controller.recallRate(), 1.8);
  } finally {
    controller.destroy();
    await view.happyDOM.close();
  }
});

test('ratechange 晚到且只能看到最终 1× 时，仍记住这一回合里的非 1×', async () => {
  const view = new Window({ url: 'https://example.com/watch' });
  const document = view.document as unknown as Document;
  const media = view.document.createElement('video');
  view.document.body.append(media);
  const controller = createMediaController(document);
  try {
    const id = controller.snapshot()[0]!.id;
    assert.equal(controller.recallRate(), null);
    media.playbackRate = 2;
    media.playbackRate = 1;
    assert.equal(media.playbackRate, 1);
    assert.equal(media.getAttribute('data-ottertap-assigned-rate'), null);
    media.dispatchEvent(new view.Event('ratechange'));
    assert.equal(controller.recallRate(), 2, '晚到的 ratechange 只看到 1×，不能把刚才的 2× 盖掉');
    assert.equal(await controller.command(id, { type: 'rate', value: nextRate(media.playbackRate, 0, controller.recallRate()) }), 2);
  } finally {
    controller.destroy();
    await view.happyDOM.close();
  }
});

test('锁定关闭时，两次快照之间改到非 1× 再改回 1×，记住的是中间的倍速', async () => {
  const view = new Window({ url: 'https://example.com/watch' });
  const document = view.document as unknown as Document;
  const media = view.document.createElement('video');
  view.document.body.append(media);
  installRateEvents(media as unknown as HTMLMediaElement, view);
  const controller = createMediaController(document);
  try {
    const id = controller.snapshot()[0]!.id;
    assert.equal(controller.recallRate(), null);
    media.playbackRate = 2;
    media.playbackRate = 1;
    assert.equal(media.playbackRate, 1);
    assert.equal(controller.recallRate(), 2, '没有再跑快照，2× 再回到 1× 仍要记住 2×');
    assert.equal(await controller.command(id, { type: 'rate', value: nextRate(media.playbackRate, 0, controller.recallRate()) }), 2);
    await controller.command(id, { type: 'rate', value: 1 });
    media.playbackRate = 1.5;
    media.playbackRate = 1;
    assert.equal(controller.recallRate(), 1.5, '更新的非 1× 盖过之前记住的 2×');
  } finally {
    controller.destroy();
    await view.happyDOM.close();
  }
});

test('锁定打开时，站点在回写前改掉的倍速不会变成记忆', async () => {
  const view = new Window({ url: 'https://example.com/watch' });
  const document = view.document as unknown as Document;
  const media = view.document.createElement('video');
  view.document.body.append(media);
  installRateEvents(media as unknown as HTMLMediaElement, view);
  const controller = createMediaController(document);
  controller.setLockRate(true);
  try {
    const id = controller.snapshot()[0]!.id;
    assert.equal(await controller.command(id, { type: 'rate', value: 1.5 }), 1.5);
    assert.equal(await controller.command(id, { type: 'rate', value: nextRate(1.5, 0, controller.recallRate()) }), 1);
    assert.equal(controller.recallRate(), 1.5);
    media.playbackRate = 2;
    await view.happyDOM.waitUntilComplete();
    assert.equal(media.playbackRate, 1, '锁定目标仍是 1×');
    assert.equal(controller.recallRate(), 1.5, '站点改到的 2× 会被写回，不能盖过已经记住的 1.5×');
  } finally {
    controller.destroy();
    await view.happyDOM.close();
  }
});

test('锁定倍速时来回切换会更新锁定目标，不会写回旧倍速', async () => {
  const view = new Window({ url: 'https://example.com/watch' });
  const document = view.document as unknown as Document;
  const media = view.document.createElement('video');
  view.document.body.append(media);
  installRateEvents(media as unknown as HTMLMediaElement, view);
  const controller = createMediaController(document);
  controller.setLockRate(true);
  try {
    const id = controller.snapshot()[0]!.id;
    assert.equal(await controller.command(id, { type: 'rate', value: 1.5 }), 1.5);
    assert.equal(controller.recallRate(), 1.5);
    assert.equal(await controller.command(id, { type: 'rate', value: nextRate(1.5, 0, controller.recallRate()) }), 1);
    assert.equal(controller.recallRate(), 1.5);
    media.playbackRate = 1.5;
    await view.happyDOM.waitUntilComplete();
    assert.equal(media.playbackRate, 1, '锁定目标已是 1×，不会写回 1.5×');
    assert.equal(await controller.command(id, { type: 'rate', value: nextRate(media.playbackRate, 0, controller.recallRate()) }), 1.5);
    media.playbackRate = 1;
    await view.happyDOM.waitUntilComplete();
    assert.equal(media.playbackRate, 1.5, '切回去之后锁定目标跟着变成 1.5×');
  } finally {
    controller.destroy();
    await view.happyDOM.close();
  }
});

test('页内 Alt+0 在单键模式下也在 1× 和之前的倍速间切换，没记过时不动', async () => {
  const view = new Window({ url: 'https://example.com/watch' });
  Object.defineProperty(globalThis, 'window', { value: view, configurable: true });
  let frame: FrameRequestCallback | undefined;
  Object.defineProperty(view, 'requestAnimationFrame', { value: (callback: FrameRequestCallback) => { frame = callback; return 1; } });
  let settings: Settings = { ...defaultSettings, singleKey: true };
  const listeners = new Set<(next: Settings) => void>();
  const demo = createDemo(view.document as unknown as Document, {
    src: '/demo.wav', title: 'Test media',
    store: {
      async load() { return settings; },
      async save(next) { settings = next; for (const listener of listeners) listener(next); },
      watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
    }
  });
  demo.media.playbackRate = 1;
  const dispose = demo.listenHotkeys(view as unknown as globalThis.Window);
  const press = async (key: string, code: string, extra: { altKey?: boolean; shiftKey?: boolean } = {}) => {
    const event = new view.KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true, ...extra });
    view.document.body.dispatchEvent(event);
    frame?.(0);
    frame = undefined;
    await view.happyDOM.waitUntilComplete();
  };
  try {
    await view.happyDOM.waitUntilComplete();
    await press('0', 'Digit0', { altKey: true });
    assert.equal(demo.media.playbackRate, 1, '还没记过倍速时 Alt+0 不改变倍速');
    await press('>', 'Period', { shiftKey: true });
    assert.equal(demo.media.playbackRate, 1.25, '单键模式的 > 仍加快');
    await press('.', 'Period', { altKey: true });
    assert.equal(demo.media.playbackRate, 1.5);
    await press(',', 'Comma', { altKey: true });
    assert.equal(demo.media.playbackRate, 1.25, '最新档位是减速后的 1.25×');
    await press('0', 'Digit0', { altKey: true });
    assert.equal(demo.media.playbackRate, 1);
    await press('0', 'Digit0', { altKey: true });
    assert.equal(demo.media.playbackRate, 1.25);
    demo.media.playbackRate = 1.75;
    await press('0', 'Digit0', { altKey: true });
    assert.equal(demo.media.playbackRate, 1);
    await press('0', 'Digit0', { altKey: true });
    assert.equal(demo.media.playbackRate, 1.75, '站点菜单改过的倍速会被记住');
    const page = await demo.client.read();
    const selected = page.media.find(item => item.id === page.selectedId) ?? page.media[0];
    assert.ok(selected);
    await demo.client.command(selected, { type: 'rate', value: 2 });
    assert.equal(demo.media.playbackRate, 2);
    await press('0', 'Digit0', { altKey: true });
    assert.equal(demo.media.playbackRate, 1);
    await press('0', 'Digit0', { altKey: true });
    assert.equal(demo.media.playbackRate, 2, '弹出面板那种绝对倍速指令也会被记住');
    const stored = JSON.stringify(settings);
    assert.equal(stored.includes('recall'), false);
    assert.equal(settings.sitePrefs['bilibili.com'], undefined);
  } finally {
    dispose();
    demo.destroy();
    await view.happyDOM.close();
  }
});
