import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { actionHintText } from '../lib/hotkey';
import { createMediaController } from '../lib/media';
import { clearSelectionRings, selectionRingClass, selectionRingCss, selectionRingMs, selectionRingName, showSelectionRing } from '../lib/selection-ring';

const end = (element: HTMLElement) => {
  const view = element.ownerDocument.defaultView ?? globalThis;
  const event = new view.Event('animationend');
  Object.defineProperty(event, 'animationName', { value: selectionRingName });
  element.dispatchEvent(event);
};

test('视频外沿的轮廓会淡出，同一时刻只留在当前那一条上', () => {
  const window = new Window({ url: 'https://example.com/feed' });
  const document = window.document;
  const first = document.createElement('video');
  const second = document.createElement('video');
  first.style.outline = '1px solid blue';
  document.body.append(first, second);
  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const inner = document.createElement('video');
  shadow.append(inner);
  const ring = (element: object) => showSelectionRing(element as unknown as HTMLElement);
  assert.match(selectionRingCss, new RegExp(`${selectionRingMs}ms`));
  assert.equal(selectionRingCss.includes('pointer-events'), false);
  ring(first);
  ring(second);
  assert.equal(first.classList.contains(selectionRingClass), false);
  assert.equal(second.classList.contains(selectionRingClass), true);
  assert.match(first.style.outline, /blue/);
  assert.match(first.style.outline, /1px/);
  assert.equal(second.style.pointerEvents, '');
  const sheet = document.querySelector('#ottertap-selection-ring-style');
  assert.equal(sheet?.textContent, selectionRingCss);
  ring(inner);
  assert.equal(second.classList.contains(selectionRingClass), false);
  assert.equal(inner.classList.contains(selectionRingClass), true);
  assert.equal(shadow.querySelector('#ottertap-selection-ring-style')?.textContent, selectionRingCss);
  end(inner as unknown as HTMLElement);
  assert.equal(inner.classList.contains(selectionRingClass), false);
  clearSelectionRings();
  window.close();
});

test('音频不画轮廓，并清掉还留着的视频轮廓', () => {
  const window = new Window({ url: 'https://example.com/mixed' });
  const document = window.document as unknown as Document;
  const video = document.createElement('video');
  const audio = document.createElement('audio');
  document.body.append(video, audio);
  const controller = createMediaController(document);
  const [videoId, audioId] = controller.snapshot().map(item => item.id);
  assert.equal(controller.flash(videoId!), 'video');
  assert.equal(video.classList.contains(selectionRingClass), true);
  assert.equal(controller.flash(audioId!), 'audio');
  assert.equal(audio.classList.contains(selectionRingClass), false);
  assert.equal(video.classList.contains(selectionRingClass), false);
  assert.equal(actionHintText('audioSelectedHint'), '已选中音频');
  assert.equal(actionHintText('nope'), '');
  controller.destroy();
  window.close();
});
