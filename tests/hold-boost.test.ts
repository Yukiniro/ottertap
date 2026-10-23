import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createHoldKeySession, isHoldRateChord, type HoldKeyEvent } from '../lib/hold-rate';
import { hotkeyFromKeyboard } from '../lib/hotkey';
import { createMediaController } from '../lib/media';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { normalizeHoldRate, normalizeSettings } from '../lib/settings';
import { defaultSettings } from '../lib/types';

const chord: HoldKeyEvent = { type: 'keydown', key: '>', code: 'Period', altKey: true, shiftKey: true, ctrlKey: false, metaKey: false };

test('临时加速默认关闭，档位落在现有 0.25 预设上，缺省是 2×', () => {
  assert.equal(defaultSettings.holdBoost, false);
  assert.equal(defaultSettings.holdBoostRate, 2);
  assert.equal(normalizeSettings({}).holdBoost, false);
  assert.equal(normalizeSettings({}).holdBoostRate, 2);
  assert.equal(normalizeSettings({ holdBoost: true }).holdBoost, true);
  assert.equal(normalizeSettings({ holdBoost: 'yes' }).holdBoost, false);
  assert.equal(normalizeHoldRate(1.5), 1.5);
  assert.equal(normalizeHoldRate(2.1), 2);
  assert.equal(normalizeHoldRate(9), 4);
  assert.equal(normalizeHoldRate(null), 2);
  assert.equal(normalizeSettings({ holdBoost: true, holdBoostRate: 1.5, defaultRate: 1.25 }).defaultRate, 1.25);
  const settings = normalizeSettings({ ...defaultSettings, holdBoost: true, holdBoostRate: 1.5, defaultRate: 1.25, sitePrefs: { 'example.com': { rate: 1.75 } } });
  const parsed = parseSettingsBackup(serializeSettings(settings, '1.7.0'));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.settings.holdBoost, true);
  assert.equal(parsed.settings.holdBoostRate, 1.5);
  assert.equal(parsed.settings.defaultRate, 1.25);
  assert.equal(parsed.settings.sitePrefs['example.com']?.rate, 1.75);
  const raw = JSON.parse(serializeSettings(normalizeSettings({ defaultRate: 1.25, sitePrefs: { 'example.com': { rate: 1.75 } } }), '1.7.0')) as { settings: Record<string, unknown> };
  delete raw.settings.holdBoost;
  delete raw.settings.holdBoostRate;
  const legacy = parseSettingsBackup(JSON.stringify(raw));
  assert.equal(legacy.ok, true);
  if (!legacy.ok) return;
  assert.equal(legacy.settings.holdBoost, false);
  assert.equal(legacy.settings.holdBoostRate, 2);
  assert.equal(legacy.settings.defaultRate, 1.25);
  assert.equal(legacy.settings.sitePrefs['example.com']?.rate, 1.75);
});

test('按住键是 Alt+Shift+.，单键模式另有 S；松开不看修饰键', () => {
  const none = { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false };
  assert.equal(isHoldRateChord(chord, false), true);
  assert.equal(isHoldRateChord({ ...chord, key: '¯' }, false), true);
  assert.equal(isHoldRateChord({ ...chord, shiftKey: false, key: '.' }, false), false);
  assert.equal(isHoldRateChord({ ...chord, ctrlKey: true }, false), false);
  assert.equal(isHoldRateChord({ ...chord, metaKey: true }, false), false);
  assert.equal(isHoldRateChord({ type: 'keydown', key: 's', code: 'KeyS', ...none }, false), false);
  assert.equal(isHoldRateChord({ type: 'keydown', key: 's', code: 'KeyS', ...none }, true), true);
  assert.equal(isHoldRateChord({ type: 'keydown', key: 'ы', code: 'KeyS', ...none }, true), true);
  assert.equal(isHoldRateChord({ type: 'keydown', key: 'S', code: 'KeyS', ...none, shiftKey: true }, true), false);
  assert.deepEqual(hotkeyFromKeyboard({ key: '.', code: 'Period', altKey: true, shiftKey: false, ctrlKey: false, metaKey: false }), { type: 'rate', direction: 1 });
  assert.deepEqual(hotkeyFromKeyboard(chord), { type: 'rate', direction: 1 });

  const session = createHoldKeySession();
  assert.equal(session.key(chord, false, false), 'ignore');
  assert.equal(session.key(chord, true, false), 'start');
  assert.equal(session.key({ ...chord, repeat: true }, true, false), 'repeat');
  assert.equal(session.key({ type: 'keyup', key: '.', code: 'Period', ...none }, false, false), 'end');
  assert.equal(session.holding(), false);

  const single = createHoldKeySession();
  const downS: HoldKeyEvent = { type: 'keydown', key: 's', code: 'KeyS', ...none };
  assert.equal(single.key(downS, true, false), 'ignore');
  assert.equal(single.key(downS, true, true), 'start');
  assert.equal(single.key(downS, false, true), 'repeat');
  assert.equal(single.cancel(), true);
  assert.equal(single.key({ ...downS, type: 'keyup' }, true, true), 'ignore');
});

function bindRateChange(media: HTMLMediaElement, view: Window) {
  const desc = Object.getOwnPropertyDescriptor(view.HTMLMediaElement.prototype, 'playbackRate');
  if (!desc?.get || !desc.set) return;
  Object.defineProperty(media, 'playbackRate', {
    configurable: true,
    get() { return desc.get!.call(this); },
    set(value: number) {
      const before = desc.get!.call(this);
      desc.set!.call(this, value);
      if (desc.get!.call(this) === before) return;
      media.dispatchEvent(new view.Event('ratechange') as unknown as Event);
    }
  });
}

test('按住只改当前倍速，松开还原，不把临时倍速记成可召回的上一档', async () => {
  const view = new Window({ url: 'https://example.com/watch' });
  const document = view.document as unknown as Document;
  const media = view.document.createElement('video');
  view.document.body.append(media);
  bindRateChange(media as unknown as HTMLMediaElement, view);
  const controller = createMediaController(document);
  try {
    const id = controller.snapshot()[0]!.id;
    assert.equal(media.playbackRate, 1);
    assert.equal(controller.beginHold(id, 2), true);
    assert.equal(media.playbackRate, 2);
    assert.equal(controller.recallRate(), null);
    assert.equal(controller.beginHold(id, 3), true);
    assert.equal(media.playbackRate, 2);
    assert.equal(controller.endHold(id), true);
    assert.equal(media.playbackRate, 1);
    assert.equal(controller.recallRate(), null);
    assert.equal(controller.endHold(id), false);
    controller.setLockRate(true);
    media.playbackRate = 0.5;
    await view.happyDOM.waitUntilComplete();
    assert.equal(media.playbackRate, 0.5);
  } finally {
    controller.destroy();
    await view.happyDOM.close();
  }
});

test('锁定倍速时按住用临时值，松开回到按下前的锁定目标', async () => {
  const view = new Window({ url: 'https://example.com/watch' });
  const document = view.document as unknown as Document;
  const media = view.document.createElement('video');
  view.document.body.append(media);
  bindRateChange(media as unknown as HTMLMediaElement, view);
  const controller = createMediaController(document);
  controller.setLockRate(true);
  try {
    const id = controller.snapshot()[0]!.id;
    const applied = controller.command(id, { type: 'rate', value: 1.5 });
    await view.happyDOM.waitUntilComplete();
    assert.equal(await applied, 1.5);
    assert.equal(controller.beginHold(id, 2), true);
    assert.equal(media.playbackRate, 2);
    media.playbackRate = 1;
    await view.happyDOM.waitUntilComplete();
    assert.equal(media.playbackRate, 2);
    assert.equal(controller.endHold(id), true);
    assert.equal(media.playbackRate, 1.5);
    assert.equal(controller.recallRate(), 1.5);
    media.playbackRate = 1;
    await view.happyDOM.waitUntilComplete();
    assert.equal(media.playbackRate, 1.5);
  } finally {
    controller.destroy();
    await view.happyDOM.close();
  }
});
