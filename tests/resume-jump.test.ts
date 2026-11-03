import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { Window } from 'happy-dom';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { isResumeEntry, readResumeEntry, removeResumeEntry, clearResumeEntries, resumeContinueFrom, resumeEntryHost, resumeEntryTitle, resumeEntryKey, resumeJumpTarget, resumePrefix, writeResume, type ResumeArea } from '../lib/resume';
import { defaultSettings } from '../lib/types';

Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
fakeBrowser.i18n.getMessage = (name: string) => name;

function media(document: Document, options: { duration: number; src?: string; ranges?: Array<[number, number]>; time?: number; parent?: Node }) {
  const element = document.createElement('video') as unknown as HTMLMediaElement;
  if (options.src) element.setAttribute('src', options.src);
  (options.parent ?? document.body).appendChild(element as unknown as Node);
  const ranges = options.ranges ?? [[0, options.duration]];
  Object.defineProperty(element, 'duration', { configurable: true, value: options.duration });
  Object.defineProperty(element, 'currentSrc', { configurable: true, value: options.src ?? '' });
  Object.defineProperty(element, 'seekable', { configurable: true, value: { length: ranges.length, start: (index: number) => ranges[index]![0], end: (index: number) => ranges[index]![1] } });
  element.currentTime = options.time ?? 0;
  return element;
}

function memoryArea(initial: Record<string, unknown> = {}): ResumeArea & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = { ...initial };
  return {
    data,
    async get() { return structuredClone(data); },
    async set(items) { Object.assign(data, structuredClone(items)); },
    async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key]; }
  };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const page = 'https://example.com/watch?v=1';
const lecture = 'src:https://cdn.example.com/lecture.mp4';
const key = resumeEntryKey(page, lecture);

test('跳回目标：回退三秒，已看过去的不跳；手动跳总是给目标', () => {
  assert.equal(resumeContinueFrom({ time: 120 }), 117);
  assert.equal(resumeContinueFrom({ time: 2 }), 0);
  assert.equal(resumeJumpTarget({ time: 120 }, 0), 117);
  assert.equal(resumeJumpTarget({ time: 120 }, 117), null, '已停在目标附近不跳');
  assert.equal(resumeJumpTarget({ time: 120 }, 200), null, '站方已跳到更后面不往回跳');
});

test('读写单条与清空：地址或标识不符不认，坏值不认，清空只动账本前缀', async () => {
  const area = memoryArea({ [key]: { page, media: lecture, time: 40, duration: 300, savedAt: 1 }, 'ottertap-settings-v1': { theme: 'dark' }, [`${resumePrefix}broken`]: 12 });
  assert.deepEqual(await readResumeEntry(area, page, lecture), { page, media: lecture, time: 40, duration: 300, savedAt: 1 });
  assert.equal(await readResumeEntry(area, page, 'dur:300'), null);
  assert.equal(await readResumeEntry(area, page, ''), null);
  assert.equal(isResumeEntry({ page, media: lecture, time: 'x' }), false);
  await removeResumeEntry(area, page, lecture);
  assert.equal(await readResumeEntry(area, page, lecture), null);
  await clearResumeEntries(area);
  assert.equal(`${resumePrefix}broken` in area.data, false);
  assert.deepEqual(area.data['ottertap-settings-v1'], { theme: 'dark' }, '清空不动设置');
});

test('列表名称：http(s) 来源取文件名，时长标识没有名称，主机名来自页面', () => {
  assert.equal(resumeEntryTitle({ media: 'src:https://cdn.example.com/courses/lecture%20one.mp4?x' }), 'lecture one');
  assert.equal(resumeEntryTitle({ media: 'dur:300' }), '');
  assert.equal(resumeEntryHost({ page: `${page}&x=2` }), 'example.com');
  assert.equal(resumeEntryHost({ page: 'not a url' }), '');
});

test('控制器：新媒体就绪后自动跳到已存进度减三秒，只跳一次，手动 seek 不再触发', async () => {
  const { createMediaController } = await import('../lib/media');
  const window = new Window({ url: page });
  const document = window.document as unknown as Document;
  const area = memoryArea({ [key]: { page, media: lecture, time: 100, duration: 300, savedAt: 1 } });
  const jumped: Array<[string, number]> = [];
  const controller = createMediaController(document, undefined, undefined, undefined, undefined, { area, auto: () => true, onJumped: (id, time) => jumped.push([id, time]) });
  const element = media(document, { duration: 300, src: 'https://cdn.example.com/lecture.mp4?sig=2' });
  const [state] = controller.snapshot();
  assert.ok(state);
  assert.equal(state!.resumeKey, key, '快照带上账本键');

  element.dispatchEvent(new window.Event('durationchange') as unknown as Event);
  await settle();
  assert.equal(element.currentTime, 97, '跳到 100 秒减三秒');
  assert.deepEqual(jumped, [[state!.id, 97]]);

  element.currentTime = 0;
  element.dispatchEvent(new window.Event('durationchange') as unknown as Event);
  await settle();
  assert.equal(element.currentTime, 0, '同一个媒体只跳一次');
  controller.destroy();
  await window.happyDOM.close();
});

test('控制器：关掉自动跳回或已有自己进度时不跳；没有记录也不跳', async () => {
  const { createMediaController } = await import('../lib/media');
  const window = new Window({ url: page });
  const document = window.document as unknown as Document;
  const area = memoryArea({ [key]: { page, media: lecture, time: 100, duration: 300, savedAt: 1 } });
  const controller = createMediaController(document, undefined, undefined, undefined, undefined, { area, auto: () => false, onJumped: () => assert.fail('不应跳') });
  const off = media(document, { duration: 300, src: 'https://cdn.example.com/lecture.mp4' });
  controller.snapshot();
  off.dispatchEvent(new window.Event('loadedmetadata') as unknown as Event);
  await settle();
  assert.equal(off.currentTime, 0, '关掉开关不跳');
  controller.destroy();

  const fresh = createMediaController(document, undefined, undefined, undefined, undefined, { area, auto: () => true, onJumped: () => assert.fail('不应跳') });
  const empty = media(document, { duration: 300, src: 'https://cdn.example.com/lecture.mp4' });
  await removeResumeEntry(area, page, lecture);
  fresh.snapshot();
  empty.dispatchEvent(new window.Event('loadedmetadata') as unknown as Event);
  await settle();
  assert.equal(empty.currentTime, 0, '没有记录不跳');
  const advanced = media(document, { duration: 300, src: 'https://cdn.example.com/lecture.mp4', time: 150 });
  await writeResume(area, page, { media: lecture, time: 100, duration: 300 }, 2);
  advanced.dispatchEvent(new window.Event('loadedmetadata') as unknown as Event);
  await settle();
  assert.equal(advanced.currentTime, 150, '站方已把进度放到更后面时不往回跳');
  fresh.destroy();
  await window.happyDOM.close();
});

test('控制器：面板跳转读最新存储并返回目标，没有记录时说明；清除只删这一条', async () => {
  const { createMediaController, isMediaCommand } = await import('../lib/media');
  assert.equal(isMediaCommand({ type: 'resume', action: 'jump' }), true);
  assert.equal(isMediaCommand({ type: 'resume', action: 'set' }), false);
  const window = new Window({ url: page });
  const document = window.document as unknown as Document;
  const other = resumeEntryKey(page, 'dur:300');
  const area = memoryArea({ [key]: { page, media: lecture, time: 100, duration: 300, savedAt: 1 }, [other]: { page, media: 'dur:300', time: 10, duration: 300, savedAt: 2 } });
  const controller = createMediaController(document, undefined, undefined, undefined, undefined, { area, auto: () => true, onJumped: () => {} });
  const element = media(document, { duration: 300, src: 'https://cdn.example.com/lecture.mp4' });
  const [state] = controller.snapshot();
  assert.ok(state);

  assert.equal(await controller.command(state!.id, { type: 'resume', action: 'jump' }), 97);
  assert.equal(element.currentTime, 97, '面板跳转落到减三秒处');
  element.currentTime = 200;
  assert.equal(await controller.command(state!.id, { type: 'resume', action: 'jump' }), 97);
  assert.equal(element.currentTime, 97, '手动跳即使在更后面也跳回');

  await controller.command(state!.id, { type: 'resume', action: 'clear' });
  assert.equal(await readResumeEntry(area, page, lecture), null, '清除删掉本条');
  assert.ok(await readResumeEntry(area, page, 'dur:300'), '别的条不受影响');
  await assert.rejects(() => controller.command(state!.id, { type: 'resume', action: 'jump' }), /resumeMissing/);
  await controller.command(state!.id, { type: 'resume', action: 'clear' });
  const short = media(document, { duration: 30, src: 'https://cdn.example.com/clip.mp4' });
  await settle();
  assert.equal(controller.snapshot().length, 2, '两段媒体都在');
  const clip = controller.snapshot().at(-1)!;
  assert.notEqual(clip.id, state!.id, '第二段是短片');
  await assert.rejects(() => controller.command(clip.id, { type: 'resume', action: 'jump' }), /markUnavailable/);
  assert.ok(short);
  controller.destroy();
  await window.happyDOM.close();
});

test('后台：排除站不写进度；弹出面板的读取带上接着看，站内浮动不带，排除站不带；跳回成功发页内提示', async () => {
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: `${page}#t=1`, active: true });
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: object) => {
    if ((message as { type: string }).type === 'snapshot') {
      return { typing: false, media: [{ id: '1', label: 'Lecture', title: 'Lecture', host: 'example.com', kind: 'video', paused: true, muted: false, volume: 1, maxVolume: 1, rate: 1, currentTime: 0, duration: 300, live: false, seekable: [{ start: 0, end: 300 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true, resumeKey: key }] };
    }
    return { ok: true, resumeTime: 97 };
  });
  const ask = (message: object, sender: object) => new Promise<unknown>(resolve => {
    void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, { id: fakeBrowser.runtime.id, ...sender }, resolve);
  });
  const top = { tab, frameId: 0, url: `${page}#t=1` };
  const popupSender = { url: fakeBrowser.runtime.getURL('/popup.html') };
  const ledger = async () => readResumeEntry(fakeBrowser.storage.local, page, lecture);
  const hints: Array<{ tabId: number; message: Record<string, unknown> }> = [];
  const report = { media: lecture, time: 75, duration: 300 };
  try {
    const background = await import('../entrypoints/background');
    background.default.main();

    await ask({ type: 'resume', id: '1', ...report }, top);
    assert.equal((await ledger())?.time, 75);

    await ask({ type: 'resumeJumped', time: 72 }, top);
    await new Promise(resolve => setTimeout(resolve, 20));
    const hint = sendMessage.mock.calls.find(call => (call.arguments[1] as { type?: string }).type === 'actionHint');
    assert.ok(hint, '跳回成功应发页内提示');
    hints.push({ tabId: hint.arguments[0] as number, message: hint.arguments[1] as Record<string, unknown> });
    assert.equal(hints[0]!.message.key, 'resumeJumpHint');
    assert.equal(hints[0]!.message.seconds, 72);

    const read = async (sender: object) => ask({ type: 'read', tabId: tab.id }, sender) as Promise<{ media?: Array<{ resume?: number }> }>;
    const fromPopup = await read(popupSender);
    assert.equal(fromPopup.media?.[0]?.resume, 75, '弹出面板读到接着看进度');
    const fromPage = await ask({ type: 'read' }, top) as { media?: Array<{ resume?: number }> };
    assert.equal(fromPage.media?.[0]?.resume, undefined, '站内浮动不读账本');

    const jump = await ask({ type: 'command', tabId: tab.id, id: '0:1', command: { type: 'resume', action: 'jump' } }, popupSender);
    assert.deepEqual(jump, { ok: true });
    const actionHint = sendMessage.mock.calls.filter(call => (call.arguments[1] as { type?: string }).type === 'actionHint').at(-1);
    assert.deepEqual([(actionHint!.arguments[1] as Record<string, unknown>).key, (actionHint!.arguments[1] as Record<string, unknown>).seconds], ['resumeJumpHint', 97], '面板跳转成功也提示');

    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, resumeExcludedSites: ['example.com'] } });
    await new Promise(resolve => setTimeout(resolve, 20));
    await ask({ type: 'resume', id: '1', ...report, time: 90 }, top);
    assert.equal((await ledger())?.time, 75, '排除站不写新进度');
    const excluded = await read(popupSender);
    assert.equal(excluded.media?.[0]?.resume, undefined, '排除站面板不显示接着看');
    const clear = await ask({ type: 'command', tabId: tab.id, id: '0:1', command: { type: 'resume', action: 'clear' } }, popupSender);
    assert.deepEqual(clear, { ok: true });
  } finally {
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
