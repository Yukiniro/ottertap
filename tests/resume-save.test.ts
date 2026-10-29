import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { Window } from 'happy-dom';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { createResumeClock, readResume, resumeEntries, resumeEntryKey, resumeLimit, resumeMedia, resumePage, resumePrefix, resumeVerdict, staleResumeKeys, writeResume, type ResumeArea } from '../lib/resume';
import { defaultSettings } from '../lib/types';

Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
fakeBrowser.i18n.getMessage = (name: string) => name;

function media(document: Document, options: { duration: number; src?: string; ranges?: Array<[number, number]>; time?: number; paused?: boolean; parent?: Node }) {
  const element = document.createElement('video') as unknown as HTMLMediaElement;
  if (options.src) element.setAttribute('src', options.src);
  (options.parent ?? document.body).appendChild(element as unknown as Node);
  const ranges = options.ranges ?? [[0, options.duration]];
  Object.defineProperty(element, 'duration', { configurable: true, value: options.duration });
  Object.defineProperty(element, 'currentSrc', { configurable: true, value: options.src ?? '' });
  Object.defineProperty(element, 'paused', { configurable: true, writable: true, value: options.paused ?? false });
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

test('身份：页面地址去掉片段，http(s) 媒体只留来源和路径，blob 和 data 按整秒时长', () => {
  assert.equal(resumePage('https://example.com/watch?v=1#t=30'), 'https://example.com/watch?v=1');
  assert.equal(resumePage('chrome-extension://abc/options.html'), '');
  assert.equal(resumePage('not a url'), '');
  assert.equal(resumeMedia('https://cdn.example.com/v/lecture.mp4?token=abc', 3600), 'src:https://cdn.example.com/v/lecture.mp4');
  assert.equal(resumeMedia('blob:https://example.com/1f2e', 3600.4), 'dur:3600');
  assert.equal(resumeMedia('data:audio/wav;base64,AAAA', 119.6), 'dur:120');
  assert.equal(resumeMedia('', 300), 'dur:300');
  assert.equal(resumeEntryKey('https://example.com/watch?v=1', 'dur:3600'), `${resumePrefix}https://example.com/watch?v=1 dur:3600`);
});

test('判定：短于两分钟、直播和无效时间不记，接近片尾删掉，其余保存', () => {
  assert.equal(resumeVerdict({ time: 30, duration: 119 }), 'skip');
  assert.equal(resumeVerdict({ time: 30, duration: 120 }), 'save');
  assert.equal(resumeVerdict({ time: 30, duration: Infinity }), 'skip');
  assert.equal(resumeVerdict({ time: Number.NaN, duration: 600 }), 'skip');
  assert.equal(resumeVerdict({ time: -1, duration: 600 }), 'skip');
  assert.equal(resumeVerdict({ time: 569, duration: 600 }), 'save');
  assert.equal(resumeVerdict({ time: 570, duration: 600 }), 'drop', '最后 30 秒算看完');
  assert.equal(resumeVerdict({ time: 6500, duration: 7200 }), 'save');
  assert.equal(resumeVerdict({ time: 6850, duration: 7200 }), 'drop', '长片最后 5% 算看完');
});

test('读取：可 seek 的长媒体给出报告，直播、不可 seek、短片和未加载返回空', async () => {
  const window = new Window({ url: 'https://example.com/watch' });
  const document = window.document as unknown as Document;
  const long = media(document, { duration: 1800, src: 'https://cdn.example.com/a.mp4?sig=1', time: 42 });
  assert.deepEqual(readResume(long), { media: 'src:https://cdn.example.com/a.mp4', time: 42, duration: 1800 });
  const blob = media(document, { duration: 900.2, src: 'blob:https://example.com/x', time: 10 });
  assert.deepEqual(readResume(blob), { media: 'dur:900', time: 10, duration: 900.2 });
  assert.equal(readResume(media(document, { duration: Infinity, ranges: [[0, 60]] })), null, '直播');
  assert.equal(readResume(media(document, { duration: 1800, ranges: [] })), null, '不可 seek');
  assert.equal(readResume(media(document, { duration: 1800, ranges: [[0, 0]] })), null, '可 seek 范围为空');
  assert.equal(readResume(media(document, { duration: 90 })), null, '短片');
  assert.equal(readResume(media(document, { duration: Number.NaN, ranges: [] })), null, '还没有元数据');
  await window.happyDOM.close();
});

test('节拍：开始播放先等一个间隔，之后每个间隔报一次，暂停立刻报并重新计时', async () => {
  const window = new Window({ url: 'https://example.com/watch' });
  const element = media(window.document as unknown as Document, { duration: 600 });
  const due = createResumeClock(10_000);
  assert.equal(due(element, false, 0), false, '刚开始播放不记');
  assert.equal(due(element, false, 9_999), false);
  assert.equal(due(element, false, 10_000), true);
  assert.equal(due(element, false, 15_000), false);
  assert.equal(due(element, false, 20_000), true);
  assert.equal(due(element, true, 21_000), true, '暂停立刻记');
  assert.equal(due(element, false, 22_000), false, '暂停后再播放重新等一个间隔');
  assert.equal(due(element, false, 32_000), true);
  await window.happyDOM.close();
});

test('控制器：播放中的进度和暂停都会报给回调，暂停时的 timeupdate 不报，shadow root 里的媒体也报', async () => {
  const { createMediaController } = await import('../lib/media');
  const window = new Window({ url: 'https://example.com/watch' });
  const document = window.document as unknown as Document;
  const seen: Array<{ id: string; paused: boolean; element: HTMLMediaElement }> = [];
  const controller = createMediaController(document, undefined, undefined, undefined, (id, element, paused) => seen.push({ id, element, paused }));
  const light = media(document, { duration: 600 });
  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const inner = media(document, { duration: 600, parent: shadow as unknown as Node });
  const [first, second] = controller.snapshot();
  assert.ok(first && second);

  light.dispatchEvent(new window.Event('timeupdate') as unknown as Event);
  assert.deepEqual(seen.map(item => [item.id, item.paused]), [[first.id, false]]);
  Object.defineProperty(light, 'paused', { configurable: true, value: true });
  light.dispatchEvent(new window.Event('timeupdate') as unknown as Event);
  assert.equal(seen.length, 1, '拖动暂停中的进度不算播放');
  light.dispatchEvent(new window.Event('pause') as unknown as Event);
  assert.deepEqual(seen.at(-1) && [seen.at(-1)!.id, seen.at(-1)!.paused], [first.id, true]);

  inner.dispatchEvent(new window.Event('timeupdate') as unknown as Event);
  assert.equal(seen.at(-1)?.element, inner);
  assert.equal(seen.at(-1)?.id, second.id);

  controller.destroy();
  light.dispatchEvent(new window.Event('pause') as unknown as Event);
  assert.equal(seen.length, 3, '销毁后不再报');
  await window.happyDOM.close();
});

test('写入：同一媒体只留一条，片尾删掉，满 200 条淘汰最旧，坏值一并清掉，设置不动', async () => {
  const page = 'https://example.com/watch?v=1';
  const area = memoryArea({ 'ottertap-settings-v1': { theme: 'dark' }, [`${resumePrefix}broken`]: { time: 'x' } });
  await writeResume(area, page, { media: 'src:https://cdn.example.com/a.mp4', time: 40, duration: 1800 }, 1);
  await writeResume(area, page, { media: 'src:https://cdn.example.com/a.mp4', time: 52, duration: 1800 }, 2);
  assert.deepEqual(resumeEntries(area.data), [{ page, media: 'src:https://cdn.example.com/a.mp4', time: 52, duration: 1800, savedAt: 2 }]);
  assert.equal(`${resumePrefix}broken` in area.data, false, '前缀下的坏值被清掉');
  assert.deepEqual(area.data['ottertap-settings-v1'], { theme: 'dark' });

  await writeResume(area, page, { media: 'src:https://cdn.example.com/a.mp4', time: 1790, duration: 1800 }, 3);
  assert.deepEqual(resumeEntries(area.data), [], '看到片尾就不再留进度');

  await writeResume(area, page, { media: 'dur:60', time: 10, duration: 60 }, 4);
  await writeResume(area, '', { media: 'dur:600', time: 10, duration: 600 }, 4);
  await writeResume(area, page, { media: 'dur:600 extra', time: 10, duration: 600 }, 4);
  await writeResume(area, page, { media: 'src:ftp://x/y', time: 10, duration: 600 }, 4);
  assert.deepEqual(resumeEntries(area.data), [], '短片和无效报告不写');

  for (let index = 0; index <= resumeLimit; index += 1) {
    await writeResume(area, `https://example.com/watch?v=${index}`, { media: 'dur:600', time: 30, duration: 600 }, 100 + index);
  }
  const entries = resumeEntries(area.data);
  assert.equal(entries.length, resumeLimit);
  assert.equal(entries.at(-1)?.page, 'https://example.com/watch?v=1', '最旧的 v=0 被淘汰');
  assert.equal(entries[0]?.page, `https://example.com/watch?v=${resumeLimit}`);
  await writeResume(area, 'https://example.com/watch?v=1', { media: 'dur:600', time: 45, duration: 600 }, 1000);
  await writeResume(area, 'https://example.com/watch?v=new', { media: 'dur:600', time: 45, duration: 600 }, 1001);
  const pages = new Set(resumeEntries(area.data).map(entry => entry.page));
  assert.ok(pages.has('https://example.com/watch?v=1'), '刚更新过的不算最旧');
  assert.ok(!pages.has('https://example.com/watch?v=2'));
  assert.deepEqual(area.data['ottertap-settings-v1'], { theme: 'dark' });
  assert.deepEqual(staleResumeKeys(area.data), []);
});

test('后台：只记启用站点、非隐身标签里当前选中的那一条，页面地址取发消息的框架', async () => {
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch?v=1#chapter', active: true });
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async () => ({ ok: true }));
  const ask = (message: object, sender: object) => new Promise<unknown>(resolve => {
    void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, { id: fakeBrowser.runtime.id, ...sender }, resolve);
  });
  const top = { tab, frameId: 0, url: 'https://example.com/watch?v=1#chapter' };
  const ledger = async () => resumeEntries(await fakeBrowser.storage.local.get(null));
  const report = { media: 'src:https://cdn.example.com/a.mp4', time: 75, duration: 1800 };
  try {
    const background = await import('../entrypoints/background');
    background.default.main();

    await ask({ type: 'resume', id: '1', ...report }, top);
    const [saved] = await ledger();
    assert.equal(saved?.page, 'https://example.com/watch?v=1');
    assert.equal(saved?.time, 75);
    assert.equal(saved?.media, report.media);

    await ask({ type: 'resume', id: '2', media: 'dur:2400', time: 30, duration: 2400 }, { tab, frameId: 3, url: 'https://player.example.net/embed/9' });
    assert.ok((await ledger()).some(entry => entry.page === 'https://player.example.net/embed/9' && entry.media === 'dur:2400'), '框架里的媒体用框架自己的地址');

    await ask({ type: 'select', id: '0:1' }, top);
    await ask({ type: 'resume', id: '7', media: 'dur:3000', time: 30, duration: 3000 }, top);
    assert.ok(!(await ledger()).some(entry => entry.media === 'dur:3000'), '同页另一条不是选中的就不记');
    await ask({ type: 'resume', id: '1', ...report, time: 90 }, top);
    assert.equal((await ledger()).find(entry => entry.media === report.media)?.time, 90);

    await ask({ type: 'resume', id: '1', ...report, time: 30, duration: 100 }, top);
    assert.equal((await ledger()).find(entry => entry.media === report.media)?.time, 90, '短片报告不覆盖');
    await ask({ type: 'resume', id: '1', ...report, time: 1795 }, top);
    assert.ok(!(await ledger()).some(entry => entry.media === report.media), '看到片尾删掉这一条');

    const hidden = await fakeBrowser.tabs.create({ url: 'https://example.com/private', active: false });
    await ask({ type: 'resume', id: '1', ...report }, { tab: { ...hidden, incognito: true }, frameId: 0, url: 'https://example.com/private' });
    assert.ok(!(await ledger()).some(entry => entry.page === 'https://example.com/private'), '隐身窗口不留记录');

    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, siteMode: 'exclude', sites: ['blocked.example'] } });
    await new Promise(resolve => setTimeout(resolve, 20));
    const blocked = await fakeBrowser.tabs.create({ url: 'https://blocked.example/watch', active: false });
    await ask({ type: 'resume', id: '1', ...report }, { tab: blocked, frameId: 0, url: 'https://blocked.example/watch' });
    assert.ok(!(await ledger()).some(entry => entry.page.startsWith('https://blocked.example/')), '停用的网站不记');

    const stored = await fakeBrowser.storage.local.get(null);
    assert.equal(stored['ottertap-settings-v1'] !== undefined, true);
    assert.ok(!JSON.stringify(stored['ottertap-settings-v1']).includes('resume'), '账本不进设置');
  } finally {
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
