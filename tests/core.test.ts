import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { normalizeDomain, normalizeSettings, isSiteEnabled, disableSite, enableSite } from '../lib/settings';
import { defaultSettings } from '../lib/types';
import { applyMediaCommand, createMediaController, isMediaCommand, keptSelection, lockedMedia, mediaChoiceLabel, mediaSnapshot } from '../lib/media';
import { commandForHotkey, hotkeyFromKeyboard, wheelVolumeDelta } from '../lib/hotkey';
import { formatTime } from '../lib/utils';
import { canAmplify, maxGain, splitVolume, type Amplifier } from '../lib/amplifier';
import { dockedPoint, dropPosition, nudgePosition } from '../lib/dock';

test('网站规则匹配域名及子域名，并拒绝内置页和后缀伪装', () => {
  const settings = normalizeSettings({ siteMode: 'allow', sites: ['*.YouTube.COM', 'https://bilibili.com/video/1'] });
  assert.deepEqual(settings.sites, ['youtube.com', 'bilibili.com']);
  assert.equal(isSiteEnabled('https://www.youtube.com/watch?v=1', settings), true);
  assert.equal(isSiteEnabled('https://youtube.com.evil.test/', settings), false);
  assert.equal(isSiteEnabled('https://notyoutube.com/', settings), false);
  assert.equal(isSiteEnabled('chrome://extensions/', settings), false);
  assert.equal(isSiteEnabled('file:///tmp/a.html', settings), false);
  assert.equal(isSiteEnabled('https://m.bilibili.com/', { ...settings, siteMode: 'exclude' }), false);
  assert.equal(isSiteEnabled('https://example.com/', { ...settings, siteMode: 'exclude' }), true);
  assert.equal(isSiteEnabled('https://example.com/', { ...settings, sites: [] }), false);
});
test('设置加载防止无效数据覆盖默认值，域名输入支持网址和国际域名', () => {
  assert.equal(normalizeDomain('https://www.bilibili.com/video/123?q=x'), 'www.bilibili.com');
  assert.equal(normalizeDomain('例子.中国'), 'xn--fsqu00a.xn--fiqs8s');
  for (const value of ['', 'a b.com', 'javascript:alert(1)', 'ftp://example.com', 'https://user:pass@example.com']) assert.throws(() => normalizeDomain(value));
  const settings = normalizeSettings({ theme: 'oops', floating: 'yes', sites: ['x.com', 'x.com', 12, ''], siteMode: 'oops' });
  assert.deepEqual(settings, { theme: 'system', floating: true, floatingPosition: { side: 'right', y: .8 }, siteMode: 'all', sites: ['x.com'] });
  assert.deepEqual(normalizeSettings({ floatingPosition: { side: 'left', y: .3 } }).floatingPosition, { side: 'left', y: .3 });
  for (const floatingPosition of [{ side: 'top', y: .3 }, { side: 'left', y: 2 }, { side: 'left', y: NaN }, 'left']) {
    assert.deepEqual(normalizeSettings({ floatingPosition }).floatingPosition, { side: 'right', y: .8 });
  }
});
test('浮动入口松手吸附到较近一侧，贴边时半隐藏，方向键切换侧边和纵向移动', () => {
  const viewport = { width: 1000, height: 800 };
  assert.deepEqual(dropPosition({ x: 300, y: 376 }, viewport), { side: 'left', y: .5 });
  assert.deepEqual(dropPosition({ x: 600, y: 900 }, viewport), { side: 'right', y: 1 });
  assert.deepEqual(dockedPoint({ side: 'right', y: .5 }, viewport, false), { x: 976, y: 376 });
  assert.deepEqual(dockedPoint({ side: 'right', y: .5 }, viewport, true), { x: 944, y: 376 });
  assert.deepEqual(dockedPoint({ side: 'left', y: 0 }, viewport, false), { x: -24, y: 8 });
  assert.deepEqual(dockedPoint({ side: 'left', y: 1 }, viewport, true), { x: 8, y: 744 });
  assert.deepEqual(nudgePosition({ side: 'right', y: .5 }, 'ArrowLeft', viewport), { side: 'left', y: .5 });
  assert.deepEqual(nudgePosition({ side: 'left', y: .5 }, 'ArrowUp', viewport), { side: 'left', y: .475 });
  assert.deepEqual(nudgePosition({ side: 'left', y: 1 }, 'ArrowDown', viewport), { side: 'left', y: 1 });
  assert.equal(nudgePosition({ side: 'left', y: .5 }, 'Enter', viewport), null);
});
test('音量拆分为元素音量与增益，跨域且无 CORS 的媒体不可放大', () => {
  assert.equal(maxGain, 2);
  assert.deepEqual(splitVolume(.4), { volume: .4, gain: 1 });
  assert.deepEqual(splitVolume(1.5), { volume: 1, gain: 1.5 });
  assert.deepEqual(splitVolume(maxGain), { volume: 1, gain: maxGain });
  assert.deepEqual(splitVolume(0), { volume: 0, gain: 1 });
  const { media, document } = fixture();
  const source = (value: string) => Object.defineProperty(media, 'currentSrc', { value, configurable: true });
  source(''); assert.equal(canAmplify(media, document), false);
  source('https://example.com/a.mp4'); assert.equal(canAmplify(media, document), true);
  source('blob:https://example.com/1'); assert.equal(canAmplify(media, document), true);
  source('https://cdn.test/a.mp4'); assert.equal(canAmplify(media, document), false);
  media.setAttribute('crossorigin', 'anonymous'); assert.equal(canAmplify(media, document), true);
});
function fixture(ranges = [[0, 100]]) {
  const window = new Window({ url: 'https://example.com' });
  window.document.title = '示例媒体';
  const media = window.document.createElement('video');
  window.document.body.append(media);
  Object.defineProperty(media, 'seekable', { value: { length: ranges.length, start: (i: number) => ranges[i]![0], end: (i: number) => ranges[i]![1] } });
  return { window, media: media as unknown as HTMLMediaElement, document: window.document as unknown as Document };
}
test('跳转限于可播放范围，直播窗口和分段空隙不会越界', async () => {
  const { media } = fixture([[20, 40], [60, 100]]);
  media.currentTime = 22;
  await applyMediaCommand(media, { type: 'skip', value: -10 }); assert.equal(media.currentTime, 20);
  await applyMediaCommand(media, { type: 'seek', value: 55 }); assert.equal(media.currentTime, 60);
  await applyMediaCommand(media, { type: 'seek', value: 200 }); assert.equal(media.currentTime, 100);
  await assert.rejects(applyMediaCommand(fixture([]).media, { type: 'seek', value: 10 }), /不可跳转/);
});
test('静音保留音量，调高音量取消静音，非法值不触碰媒体', async () => {
  const { media } = fixture(); media.volume = .75;
  await applyMediaCommand(media, { type: 'mute' }); assert.equal(media.muted, true); assert.equal(media.volume, .75);
  await applyMediaCommand(media, { type: 'mute' }); assert.equal(media.muted, false);
  media.muted = true;
  await applyMediaCommand(media, { type: 'volume', value: .4 }); assert.equal(media.volume, .4); assert.equal(media.muted, false);
  await applyMediaCommand(media, { type: 'rate', value: 1.5 }); assert.equal(media.playbackRate, 1.5);
  await assert.rejects(applyMediaCommand(media, { type: 'volume', value: 1.2 }), /无法放大/);
  assert.equal(isMediaCommand({ type: 'volume', value: maxGain }), true);
  for (const command of [{ type: 'volume', value: -1 }, { type: 'volume', value: maxGain + 0.01 }, { type: 'rate', value: NaN }, { type: 'seek', value: Infinity }, { type: 'evil', value: 1 }]) {
    assert.equal(isMediaCommand(command), false);
    await assert.rejects(applyMediaCommand(media, command as never));
  }
  assert.equal(media.volume, .4);
});
test('可放大媒体能调到增益上限，跨域媒体仍停在 100%', async () => {
  const { media, document } = fixture();
  Object.defineProperty(media, 'currentSrc', { value: 'https://example.com/a.mp4', configurable: true });
  let gain = 1;
  const amplifier: Amplifier = {
    gain: () => gain,
    async set(element, value) { assert.equal(element, media); gain = value; }
  };
  assert.equal(mediaSnapshot(media, '1', document, amplifier).maxVolume, maxGain);
  await applyMediaCommand(media, { type: 'volume', value: maxGain }, amplifier);
  assert.equal(media.volume, 1);
  assert.equal(gain, maxGain);
  assert.equal(mediaSnapshot(media, '1', document, amplifier).volume, maxGain);
  const blocked = fixture();
  Object.defineProperty(blocked.media, 'currentSrc', { value: 'https://cdn.test/a.mp4', configurable: true });
  const blockedGain: Amplifier = { gain: () => 1, async set() { throw new Error('should not connect'); } };
  assert.equal(mediaSnapshot(blocked.media, '1', blocked.document, blockedGain).maxVolume, 1);
  const before = blocked.media.volume;
  await assert.rejects(applyMediaCommand(blocked.media, { type: 'volume', value: 1.2 }, blockedGain), /无法放大/);
  assert.equal(blocked.media.volume, before);
});
test('媒体发现支持开放 Shadow DOM、动态移除和稳定 ID', async () => {
  const { media, document, window } = fixture();
  const host = document.createElement('div'); document.body.append(host);
  document.body.append(document.createElementNS('http://www.w3.org/2000/svg', 'video'));
  const shadow = host.attachShadow({ mode: 'open' }); shadow.append(document.createElement('audio'));
  const controller = createMediaController(document);
  const first = controller.snapshot(); assert.equal(first.length, 2);
  assert.equal(controller.snapshot()[0]!.id, first[0]!.id);
  media.remove(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(controller.snapshot().length, 1);
  await assert.rejects(controller.command(first[0]!.id, { type: 'pause' }), /已移除/);
  controller.destroy(); await window.happyDOM.close();
});
test('播放失败向上传递；未知时长正确序列化为直播', async () => {
  const { media, document } = fixture();
  media.play = async () => { throw new Error('NotAllowedError'); };
  await assert.rejects(applyMediaCommand(media, { type: 'play' }), /NotAllowedError/);
  Object.defineProperty(media, 'duration', { value: Infinity });
  assert.equal(mediaSnapshot(media, '1', document).duration, null);
  assert.equal(mediaSnapshot(media, '1', document).live, true);
  assert.equal(formatTime(272), '04:32'); assert.equal(formatTime(3661), '1:01:01');
  assert.equal(formatTime(Infinity), '直播');
  const unnamed = mediaSnapshot(media, '1', document);
  assert.equal(unnamed.label, '');
  assert.equal(unnamed.title, '示例媒体');
  assert.equal(mediaChoiceLabel(unnamed, 0).includes('示例媒体'), false);
  media.setAttribute('aria-label', '正片');
  assert.match(mediaChoiceLabel(mediaSnapshot(media, '1', document), 0), /正片/);
});
test('多个媒体优先锁定在播且有声的一个，快捷键按锁定目标调节', () => {
  const base = { host: 'example.com', kind: 'video' as const, label: '', title: '页面', maxVolume: maxGain, rate: 1, currentTime: 10, duration: 100, live: false, seekable: [{ start: 0, end: 100 }] };
  const muted = { ...base, id: '1', paused: false, muted: true, volume: .8 };
  const audible = { ...base, id: '2', paused: false, muted: false, volume: .4 };
  const paused = { ...base, id: '3', paused: true, muted: false, volume: .4 };
  assert.equal(lockedMedia([muted, paused, audible], '')?.id, '2');
  assert.equal(lockedMedia([muted, paused, audible], '3')?.id, '3');
  assert.equal(lockedMedia([muted, paused], '')?.id, '1');
  assert.equal(keptSelection('2:5', ['0:1'], new Set([2])), '2:5');
  assert.equal(keptSelection('2:5', ['0:1'], new Set()), '');
  assert.equal(keptSelection('2:5', ['2:5'], new Set()), '2:5');
  assert.equal(keptSelection('', ['0:1'], new Set([0])), '');
  const keys = { altKey: true, shiftKey: true, ctrlKey: false, metaKey: false };
  assert.deepEqual(hotkeyFromKeyboard({ ...keys, key: 'ArrowUp' }), { type: 'volume', delta: 10 });
  assert.equal(hotkeyFromKeyboard({ ...keys, key: 'ArrowLeft' }), null);
  assert.equal(hotkeyFromKeyboard({ ...keys, key: ' ' }), null);
  assert.equal(hotkeyFromKeyboard({ ...keys, key: 'ArrowUp', altKey: false }), null);
  assert.equal(wheelVolumeDelta(-100, 0), 10);
  assert.equal(wheelVolumeDelta(4, 0), -.4);
  assert.equal(wheelVolumeDelta(1, 1), -10);
  assert.deepEqual(commandForHotkey({ type: 'volume', delta: 10 }, { ...audible, muted: true }), { type: 'volume', value: .1 });
  assert.deepEqual(commandForHotkey({ type: 'volume', delta: 10 }, audible), { type: 'volume', value: .5 });
  assert.deepEqual(commandForHotkey({ type: 'volume', delta: 20 }, { ...audible, volume: 1.9 }), { type: 'volume', value: maxGain });
});
test('停用当前网站保留原列表，重新启用不恢复父域名', () => {
  const all = disableSite('www.bilibili.com', { ...defaultSettings, sites: ['old.com'] });
  assert.equal(all.label, '停用 www.bilibili.com');
  assert.deepEqual(all.settings, { siteMode: 'exclude', sites: ['old.com', 'www.bilibili.com'] });
  const allow = disableSite('www.bilibili.com', { ...defaultSettings, siteMode: 'allow', sites: ['bilibili.com', 'example.com'] });
  assert.equal(allow.label, '停用 bilibili.com');
  assert.deepEqual(allow.settings.sites, ['example.com']);
  assert.deepEqual(enableSite('www.bilibili.com', { ...defaultSettings, siteMode: 'exclude', sites: ['www.bilibili.com'] }).settings, { sites: [] });
  assert.equal(enableSite('www.bilibili.com', { ...defaultSettings, siteMode: 'exclude', sites: ['bilibili.com'] }).settings, null);
  assert.deepEqual(enableSite('www.bilibili.com', { ...defaultSettings, siteMode: 'allow', sites: ['example.com'] }).settings, { sites: ['example.com', 'www.bilibili.com'] });
});
