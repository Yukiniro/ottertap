import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { adjacentFrameTime, canStepFrames, fallbackFrameSeconds, frameStepSeconds, presentedFrameSeconds, readVideoFrameRate, resolveFrameSeconds, stopAllPresentedFrames, usableFrameSeconds, watchPresentedFrames } from '../lib/frame';
import { actionHintKey, actionHintText, commandForHotkey, hotkeyFromKeyboard, isHotkeyAction, planHotkey } from '../lib/hotkey';
import { applyMediaCommand, frameFailureKey, isMediaCommand } from '../lib/media';
import { i18n } from '#i18n';
import type { MediaState, PageState } from '../lib/types';

const none = { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false };
const alt = { ...none, altKey: true };
const frame = fallbackFrameSeconds;
const near = (actual: number, expected: number) => Math.abs(actual - expected) < 1e-6;

const media = {
  id: '1', host: 'example.com', label: '', title: '正片', kind: 'video' as const,
  volume: .5, maxVolume: 1, muted: false, paused: false, rate: 1, currentTime: 1,
  duration: 120, live: false, seekable: [{ start: 0, end: 120 }],
  pip: false, pipAvailable: true, pipBlock: '' as const, channel: 'stereo' as const, channelAvailable: true
} satisfies MediaState;

function fixture(ranges: Array<[number, number]> = [[0, 10]]) {
  const window = new Window({ url: 'https://example.com' });
  const element = window.document.createElement('video');
  window.document.body.append(element);
  Object.defineProperty(element, 'seekable', { configurable: true, value: { length: ranges.length, start: (index: number) => ranges[index]![0], end: (index: number) => ranges[index]![1] } });
  return { window, media: element as unknown as HTMLMediaElement };
}

test('逐帧落在帧边界上，测到的间隔优先于帧率，否则用 1/30', () => {
  assert.equal(usableFrameSeconds(1 / 24), 1 / 24);
  assert.equal(usableFrameSeconds(1 / 8), null);
  assert.equal(usableFrameSeconds(0), null);
  assert.equal(resolveFrameSeconds(1 / 24, 60), 1 / 24);
  assert.equal(resolveFrameSeconds(null, 24), 1 / 24);
  assert.equal(resolveFrameSeconds(null, 4), frame);
  assert.equal(resolveFrameSeconds(undefined, null), frame);
  assert.ok(near(adjacentFrameTime(1, 1, frame), 1 + frame));
  assert.ok(near(adjacentFrameTime(1, -1, frame), 1 - frame));
  assert.ok(near(adjacentFrameTime(0, -1, frame), -frame));
  let time = 0;
  for (let step = 0; step < 30; step += 1) time = adjacentFrameTime(time, 1, frame);
  assert.ok(near(time, 1), String(time));
  for (let step = 0; step < 30; step += 1) time = adjacentFrameTime(time, -1, frame);
  assert.ok(near(time, 0), String(time));
  assert.ok(near(adjacentFrameTime(1.01, 1, frame), Math.ceil(1.01 / frame) * frame));
  assert.equal(canStepFrames(media), true);
  assert.equal(canStepFrames({ ...media, live: true }), false);
  assert.equal(canStepFrames({ ...media, seekable: [] }), false);
  assert.equal(canStepFrames({ ...media, seekable: [{ start: 4, end: 4 }] }), false);
});

test(', 和 . 逐帧，不覆盖 Alt 倍速、单键 Shift 倍速和 JKL', () => {
  const press = (key: string, code: string, extra: Partial<typeof none> = {}, singleKey = false) => hotkeyFromKeyboard({ ...none, ...extra, key, code }, { singleKey });
  assert.deepEqual(press('.', 'Period'), { type: 'frame', direction: 1 });
  assert.deepEqual(press(',', 'Comma'), { type: 'frame', direction: -1 });
  assert.deepEqual(press('.', 'Period', {}, true), { type: 'frame', direction: 1 });
  assert.deepEqual(press(',', 'Comma', {}, true), { type: 'frame', direction: -1 });
  assert.deepEqual(press('.', 'Period', alt), { type: 'rate', direction: 1 });
  assert.deepEqual(press(',', 'Comma', alt), { type: 'rate', direction: -1 });
  assert.deepEqual(press('>', 'Period', { ...alt, shiftKey: true }), { type: 'rate', direction: 1 });
  assert.deepEqual(press('>', 'Period', { shiftKey: true }, true), { type: 'rate', direction: 1 });
  assert.deepEqual(press('<', 'Comma', { shiftKey: true }, true), { type: 'rate', direction: -1 });
  assert.equal(press('>', 'Period', { shiftKey: true }), null);
  assert.equal(press('.', 'Period', { ctrlKey: true }), null);
  assert.equal(press(',', 'Comma', { metaKey: true }), null);
  assert.deepEqual(press('j', 'KeyJ', {}, true), { type: 'skip', delta: -10 });
  assert.deepEqual(press('l', 'KeyL', {}, true), { type: 'skip', delta: 10 });
  assert.deepEqual(press('k', 'KeyK', {}, true), { type: 'toggle' });
  assert.equal(press('j', 'KeyJ'), null);
  assert.equal(isHotkeyAction({ type: 'frame', direction: 1 }), true);
  assert.equal(isHotkeyAction({ type: 'frame', direction: -1 }), true);
  assert.equal(isHotkeyAction({ type: 'frame', direction: 0 }), false);
  assert.deepEqual(commandForHotkey({ type: 'frame', direction: -1 }, media), { type: 'frame', direction: -1 });
  const page: PageState = { host: 'example.com', enabled: true, media: [media], selectedId: '1' };
  assert.deepEqual(planHotkey(page, { type: 'frame', direction: 1 })?.command, { type: 'frame', direction: 1 });
  assert.equal(planHotkey({ ...page, media: [{ ...media, live: true }] }, { type: 'frame', direction: 1 })?.command.type, 'frame');
  assert.equal(actionHintKey({ type: 'frame', direction: -1 }, media), 'shortcutFrameBack');
  assert.equal(actionHintKey({ type: 'frame', direction: 1 }, media), 'shortcutFrameForward');
  assert.equal(actionHintText('shortcutFrameBack'), '暂停后上一帧');
  assert.equal(actionHintText('shortcutFrameForward'), '暂停后下一帧');
  assert.equal(actionHintText('frameStepUnavailable'), '直播和无法跳转的媒体不能逐帧。');
  assert.equal(frameFailureKey(i18n.t('frameStepUnavailable')), 'frameStepUnavailable');
  assert.equal(frameFailureKey('其它'), '');
});

test('逐帧先暂停再按帧长跳转，直播和不可 seek 不改进度', async () => {
  const clip = fixture();
  clip.media.currentTime = 1;
  await clip.media.play();
  assert.equal(clip.media.paused, false);
  await applyMediaCommand(clip.media, { type: 'frame', direction: 1 });
  assert.equal(clip.media.paused, true);
  assert.ok(near(clip.media.currentTime, 1 + frame), String(clip.media.currentTime));
  await applyMediaCommand(clip.media, { type: 'frame', direction: -1 });
  assert.ok(near(clip.media.currentTime, 1));

  clip.media.currentTime = 0;
  await applyMediaCommand(clip.media, { type: 'frame', direction: -1 });
  assert.equal(clip.media.currentTime, 0);

  const ended = fixture([[0, 10]]);
  ended.media.currentTime = 10;
  await applyMediaCommand(ended.media, { type: 'frame', direction: 1 });
  assert.equal(ended.media.currentTime, 10);

  Object.defineProperty(clip.media, 'videoTracks', { configurable: true, value: { length: 1, 0: { frameRate: 24, selected: true } } });
  assert.equal(readVideoFrameRate(clip.media), 24);
  clip.media.currentTime = 1;
  await applyMediaCommand(clip.media, { type: 'frame', direction: 1 });
  assert.ok(near(clip.media.currentTime, 1 + 1 / 24), String(clip.media.currentTime));

  const live = fixture([[0, 100]]);
  Object.defineProperty(live.media, 'duration', { configurable: true, get: () => Infinity });
  live.media.currentTime = 5;
  await live.media.play();
  await assert.rejects(applyMediaCommand(live.media, { type: 'frame', direction: 1 }), /不能逐帧/);
  assert.equal(live.media.paused, false);
  assert.equal(live.media.currentTime, 5);

  const blocked = fixture([]);
  blocked.media.currentTime = 3;
  await assert.rejects(applyMediaCommand(blocked.media, { type: 'frame', direction: -1 }), /不能逐帧/);
  assert.equal(blocked.media.currentTime, 3);
  assert.equal(isMediaCommand({ type: 'frame', direction: 1 }), true);
  assert.equal(isMediaCommand({ type: 'frame', direction: 2 }), false);

  const sampled = fixture();
  let callback: ((now: number, metadata: { mediaTime?: number }) => void) | undefined;
  const video = sampled.media as HTMLMediaElement & { requestVideoFrameCallback?: (cb: typeof callback) => number; cancelVideoFrameCallback?: (handle: number) => void };
  video.requestVideoFrameCallback = cb => { callback = cb; return 7; };
  video.cancelVideoFrameCallback = () => { callback = undefined; };
  await video.play();
  watchPresentedFrames(video);
  callback?.(0, { mediaTime: 1 });
  callback?.(1, { mediaTime: 1 + 1 / 60 });
  assert.ok(near(presentedFrameSeconds(video) ?? 0, 1 / 60));
  assert.ok(near(frameStepSeconds(video), 1 / 60));
  stopAllPresentedFrames();
  await clip.window.happyDOM.close();
  await ended.window.happyDOM.close();
  await live.window.happyDOM.close();
  await blocked.window.happyDOM.close();
  await sampled.window.happyDOM.close();
});
