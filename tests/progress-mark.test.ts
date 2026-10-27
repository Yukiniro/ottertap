import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { applyMediaCommand, createMediaController, isMediaCommand, mediaSnapshot } from '../lib/media';
import { withRememberedCommand } from '../lib/settings';

function seekable(element: HTMLMediaElement, ranges: Array<[number, number]>) {
  Object.defineProperty(element, 'seekable', {
    configurable: true,
    value: { length: ranges.length, start: (index: number) => ranges[index]![0], end: (index: number) => ranges[index]![1] }
  });
}

function clip(document: Document, time: number, label = '') {
  const element = document.createElement('video');
  if (label) element.setAttribute('aria-label', label);
  document.body.append(element);
  seekable(element, [[0, 120]]);
  element.currentTime = time;
  return element as unknown as HTMLMediaElement;
}

test('设标记后再跳回去，清除后不能跳，快进和逐帧不擦掉标记', async () => {
  const window = new Window({ url: 'https://example.com/watch' });
  const document = window.document as unknown as Document;
  const video = clip(document, 12, '正片');
  assert.equal(mediaSnapshot(video, '1', document).mark, undefined);
  assert.equal(isMediaCommand({ type: 'mark', action: 'set' }), true);
  assert.equal(isMediaCommand({ type: 'mark', action: 'jump' }), true);
  assert.equal(isMediaCommand({ type: 'mark', action: 'clear' }), true);
  assert.equal(isMediaCommand({ type: 'mark', action: 'list' }), false);
  assert.equal(isMediaCommand({ type: 'mark' }), false);

  await applyMediaCommand(video, { type: 'mark', action: 'set' });
  assert.equal(mediaSnapshot(video, '1', document).mark, 12);
  await applyMediaCommand(video, { type: 'skip', value: 10 });
  assert.equal(video.currentTime, 22);
  assert.equal(mediaSnapshot(video, '1', document).mark, 12);
  await applyMediaCommand(video, { type: 'frame', direction: 1 });
  assert.equal(video.paused, true);
  assert.ok(video.currentTime > 22);
  assert.equal(mediaSnapshot(video, '1', document).mark, 12);
  await applyMediaCommand(video, { type: 'seek', value: 40 });
  assert.equal(video.currentTime, 40);
  assert.equal(mediaSnapshot(video, '1', document).mark, 12);

  await applyMediaCommand(video, { type: 'mark', action: 'jump' });
  assert.equal(video.currentTime, 12);
  assert.equal(mediaSnapshot(video, '1', document).mark, 12);

  video.currentTime = 30;
  await applyMediaCommand(video, { type: 'mark', action: 'set' });
  assert.equal(mediaSnapshot(video, '1', document).mark, 30);
  video.currentTime = 8;
  await applyMediaCommand(video, { type: 'mark', action: 'jump' });
  assert.equal(video.currentTime, 30);

  await applyMediaCommand(video, { type: 'mark', action: 'clear' });
  assert.equal(mediaSnapshot(video, '1', document).mark, undefined);
  assert.equal(video.currentTime, 30);
  await assert.rejects(applyMediaCommand(video, { type: 'mark', action: 'jump' }), /没有标记/);
  assert.equal(video.currentTime, 30);
  await window.happyDOM.close();
});

test('标记跟着这一条媒体走，另一条和后出现的媒体没有标记', async () => {
  const window = new Window({ url: 'https://example.com/watch' });
  const document = window.document as unknown as Document;
  const first = clip(document, 12, '甲');
  const second = clip(document, 3, '乙');
  const controller = createMediaController(document);
  const [left, right] = controller.snapshot();
  assert.equal(left?.label, '甲');
  assert.equal(right?.label, '乙');
  assert.equal(left?.mark, undefined);
  assert.equal(right?.mark, undefined);

  await controller.command(left!.id, { type: 'mark', action: 'set' });
  const marked = controller.snapshot();
  assert.equal(marked.find(item => item.id === left!.id)?.mark, 12);
  assert.equal(marked.find(item => item.id === right!.id)?.mark, undefined);
  await assert.rejects(controller.command(right!.id, { type: 'mark', action: 'jump' }), /没有标记/);
  assert.equal(second.currentTime, 3);
  assert.equal(first.currentTime, 12);

  await controller.command(left!.id, { type: 'skip', value: 5 });
  await controller.command(left!.id, { type: 'mark', action: 'jump' });
  assert.equal(first.currentTime, 12);
  assert.equal(second.currentTime, 3);
  assert.equal(controller.snapshot().find(item => item.id === right!.id)?.mark, undefined);

  const added = clip(document, 7, '新片');
  await new Promise(resolve => setTimeout(resolve, 0));
  const fresh = controller.snapshot().find(item => item.label === '新片');
  assert.ok(fresh);
  assert.equal(fresh.mark, undefined);
  assert.notEqual(fresh.id, left!.id);
  assert.equal(controller.snapshot().find(item => item.id === left!.id)?.mark, 12);
  assert.equal(added.currentTime, 7);

  await controller.command(right!.id, { type: 'mark', action: 'set' });
  await controller.command(left!.id, { type: 'mark', action: 'clear' });
  const split = controller.snapshot();
  assert.equal(split.find(item => item.id === left!.id)?.mark, undefined);
  assert.equal(split.find(item => item.id === right!.id)?.mark, 3);
  controller.destroy();
  await window.happyDOM.close();
});

test('直播和不可跳转不能设标记，标记也不写入站点记忆', async () => {
  const window = new Window({ url: 'https://example.com/watch' });
  const document = window.document as unknown as Document;
  const live = clip(document, 5, '直播');
  Object.defineProperty(live, 'duration', { configurable: true, get: () => Infinity });
  seekable(live, [[20, 40]]);
  live.currentTime = 25;
  await live.play();
  await assert.rejects(applyMediaCommand(live, { type: 'mark', action: 'set' }), /不能设标记/);
  assert.equal(live.paused, false);
  assert.equal(live.currentTime, 25);
  assert.equal(mediaSnapshot(live, 'live', document).mark, undefined);
  assert.equal(mediaSnapshot(live, 'live', document).live, true);

  const blocked = document.createElement('video') as unknown as HTMLMediaElement;
  document.body.append(blocked);
  seekable(blocked, []);
  blocked.currentTime = 4;
  await assert.rejects(applyMediaCommand(blocked, { type: 'mark', action: 'set' }), /不能设标记/);
  await assert.rejects(applyMediaCommand(blocked, { type: 'mark', action: 'jump' }), /不能设标记/);
  await assert.rejects(applyMediaCommand(blocked, { type: 'mark', action: 'clear' }), /不能设标记/);
  assert.equal(blocked.currentTime, 4);
  assert.equal(mediaSnapshot(blocked, 'blocked', document).mark, undefined);

  const audio = document.createElement('audio') as unknown as HTMLMediaElement;
  document.body.append(audio);
  seekable(audio, [[0, 30]]);
  audio.currentTime = 6;
  await applyMediaCommand(audio, { type: 'mark', action: 'set' });
  assert.equal(mediaSnapshot(audio, 'audio', document).mark, 6);
  audio.currentTime = 1;
  await applyMediaCommand(audio, { type: 'mark', action: 'jump' });
  assert.equal(audio.currentTime, 6);

  const prefs = { 'example.com': { volume: 0.4, rate: 1.5 } };
  const before = JSON.stringify(prefs);
  for (const action of ['set', 'jump', 'clear'] as const) {
    assert.equal(withRememberedCommand(prefs, 'example.com', { type: 'mark', action }), null);
  }
  assert.equal(JSON.stringify(prefs), before);
  await window.happyDOM.close();
});
