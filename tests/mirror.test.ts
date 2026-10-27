import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { applyMediaCommand, createMediaController, isMediaCommand, mediaSnapshot } from '../lib/media';
import { isHorizontallyMirrored } from '../lib/mirror';
import { withRememberedCommand } from '../lib/settings';

function page() {
  const window = new Window({ url: 'https://example.com/watch' });
  const document = window.document;
  document.body.append(document.createElement('video'));
  const video = document.body.querySelector('video') as unknown as HTMLVideoElement;
  video.volume = .4;
  video.playbackRate = 1.5;
  video.currentTime = 12;
  return { window, document: document as unknown as Document, video };
}

function scaleOf(element: HTMLElement) {
  return element.style.getPropertyValue('scale');
}

test('水平镜像只翻转当前视频画面，关闭后还原，声音和布局变换不动', async () => {
  const { video, window } = page();
  video.style.setProperty('transform', 'rotate(0deg)');
  video.style.setProperty('scale', '1.2');
  assert.equal(isHorizontallyMirrored(video), false);
  assert.equal(mediaSnapshot(video, '1', video.ownerDocument).mirrored, false);

  await applyMediaCommand(video, { type: 'mirror', value: true });
  assert.equal(isHorizontallyMirrored(video), true);
  assert.equal(scaleOf(video), '-1 1');
  assert.equal(video.style.getPropertyValue('transform'), 'rotate(0deg)');
  assert.equal(video.volume, .4);
  assert.equal(video.muted, false);
  assert.equal(video.playbackRate, 1.5);
  assert.equal(video.currentTime, 12);
  assert.equal(mediaSnapshot(video, '1', video.ownerDocument).mirrored, true);

  await applyMediaCommand(video, { type: 'mirror', value: true });
  assert.equal(scaleOf(video), '-1 1');
  await applyMediaCommand(video, { type: 'mirror', value: false });
  assert.equal(isHorizontallyMirrored(video), false);
  assert.equal(scaleOf(video), '1.2');
  assert.equal(video.style.getPropertyValue('transform'), 'rotate(0deg)');
  assert.equal(video.volume, .4);
  assert.equal(video.playbackRate, 1.5);
  await window.happyDOM.close();
});

test('另一条视频和后出现的视频默认不镜像', async () => {
  const { document, video, window } = page();
  const other = document.createElement('video');
  document.body.append(other);
  const controller = createMediaController(document);
  const [first, second] = controller.snapshot();
  assert.equal(first?.mirrored, false);
  assert.equal(second?.mirrored, false);
  await controller.command(first!.id, { type: 'mirror', value: true });
  const flipped = controller.snapshot();
  assert.equal(flipped[0]?.mirrored, true);
  assert.equal(flipped[1]?.mirrored, false);
  assert.equal(isHorizontallyMirrored(other as unknown as HTMLVideoElement), false);
  assert.equal(isHorizontallyMirrored(video), true);

  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const inner = document.createElement('video');
  shadow.append(inner);
  await new Promise(resolve => setTimeout(resolve, 0));
  const added = controller.snapshot().find(item => item.id !== first!.id && item.id !== second!.id);
  assert.equal(added?.mirrored, false);
  assert.equal(added?.kind, 'video');
  await controller.command(added!.id, { type: 'mirror', value: true });
  assert.equal(isHorizontallyMirrored(inner as unknown as HTMLVideoElement), true);
  assert.equal(controller.snapshot().find(item => item.id === second!.id)?.mirrored, false);
  controller.destroy();
  await window.happyDOM.close();
});

test('音频和非法指令不翻转，直播视频可以翻转', async () => {
  const { document, window } = page();
  const audio = document.createElement('audio');
  audio.volume = .8;
  document.body.append(audio);
  const element = audio as unknown as HTMLMediaElement;
  await assert.rejects(applyMediaCommand(element, { type: 'mirror', value: true }), /没有画面/);
  assert.equal(element.hasAttribute('data-ottertap-mirror'), false);
  assert.equal(scaleOf(element), '');
  assert.equal(element.volume, .8);
  assert.equal(mediaSnapshot(element, 'a', document).mirrored, false);

  const live = document.createElement('video') as unknown as HTMLVideoElement;
  Object.defineProperty(live, 'duration', { value: Infinity });
  live.volume = .3;
  document.body.append(live);
  await applyMediaCommand(live, { type: 'mirror', value: true });
  assert.equal(isHorizontallyMirrored(live), true);
  assert.equal(live.volume, .3);
  assert.equal(mediaSnapshot(live, 'live', document).live, true);

  assert.equal(isMediaCommand({ type: 'mirror', value: true }), true);
  assert.equal(isMediaCommand({ type: 'mirror', value: false }), true);
  for (const value of [1, 'yes', undefined, null]) assert.equal(isMediaCommand({ type: 'mirror', value }), false);
  await window.happyDOM.close();
});

test('水平镜像不写入记住此站点', () => {
  const prefs = { 'example.com': { volume: .4, rate: 1.5, channel: 'left' as const } };
  assert.equal(withRememberedCommand(prefs, 'example.com', { type: 'mirror', value: true }), null);
  assert.equal(withRememberedCommand(prefs, 'example.com', { type: 'mirror', value: false }), null);
  assert.deepEqual(prefs, { 'example.com': { volume: .4, rate: 1.5, channel: 'left' } });
  assert.equal(withRememberedCommand({}, 'example.com', { type: 'mirror', value: true }), null);
});
