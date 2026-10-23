import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHoldSkipSession, holdSkipThresholdMs, skipHoldDirection, type HoldSkipDecision } from '../lib/hold-skip';
import { hotkeyFromKeyboard } from '../lib/hotkey';
import type { HoldKeyEvent } from '../lib/hold-rate';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { normalizeSettings } from '../lib/settings';
import { defaultSettings } from '../lib/types';

const none = { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false };
const down = (key: string, code = key): HoldKeyEvent => ({ type: 'keydown', key, code, ...none });
const up = (key: string, code = key, extra: Partial<HoldKeyEvent> = {}): HoldKeyEvent => ({ type: 'keyup', key, code, ...none, ...extra });

test('同键加速默认关闭，旧备份缺这个字段时仍关闭，不改默认倍速和站点记忆', () => {
  assert.equal(defaultSettings.holdSkip, false);
  assert.equal(holdSkipThresholdMs, 300);
  assert.equal(normalizeSettings({}).holdSkip, false);
  assert.equal(normalizeSettings({ holdSkip: true }).holdSkip, true);
  assert.equal(normalizeSettings({ holdSkip: 'yes' }).holdSkip, false);
  assert.equal(normalizeSettings({ holdSkip: 1 }).holdSkip, false);
  const settings = normalizeSettings({ ...defaultSettings, holdBoost: true, holdSkip: true, holdBoostRate: 1.5, defaultRate: 1.25, sitePrefs: { 'example.com': { rate: 1.75 } } });
  assert.equal(settings.holdBoost, true);
  assert.equal(settings.holdSkip, true);
  assert.equal(settings.defaultRate, 1.25);
  const parsed = parseSettingsBackup(serializeSettings(settings, '1.7.0'));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.settings.holdSkip, true);
  assert.equal(parsed.settings.holdBoost, true);
  assert.equal(parsed.settings.defaultRate, 1.25);
  assert.equal(parsed.settings.sitePrefs['example.com']?.rate, 1.75);
  const raw = JSON.parse(serializeSettings(normalizeSettings({ defaultRate: 1.25, sitePrefs: { 'example.com': { rate: 2 } } }), '1.7.0')) as { settings: Record<string, unknown> };
  delete raw.settings.holdSkip;
  const legacy = parseSettingsBackup(JSON.stringify(raw));
  assert.equal(legacy.ok, true);
  if (!legacy.ok) return;
  assert.equal(legacy.settings.holdSkip, false);
  assert.equal(legacy.settings.defaultRate, 1.25);
  assert.equal(legacy.settings.sitePrefs['example.com']?.rate, 2);
});

test('短按只跳一次，按住满阈值才加速，松开不再跳', () => {
  let now = 0;
  const session = createHoldSkipSession(() => now);
  const forward = down('l', 'KeyL');
  assert.deepEqual(session.key(forward, true, true), { phase: 'arm' });
  assert.equal(session.remaining(0), holdSkipThresholdMs);
  now = holdSkipThresholdMs - 1;
  assert.equal(session.tick().phase, 'arm');
  assert.deepEqual(session.key(up('l', 'KeyL'), true, true), { phase: 'skip', direction: 1 });
  assert.equal(session.holding(), false);
  assert.equal(session.tick().phase, 'ignore');
  assert.deepEqual(hotkeyFromKeyboard(forward, { singleKey: true }), { type: 'skip', delta: 10 });

  now = 0;
  const back = down('j', 'KeyJ');
  assert.equal(session.key(back, true, true).phase, 'arm');
  now = 40;
  assert.equal(session.key({ ...back, repeat: true }, true, true).phase, 'repeat');
  assert.equal(session.remaining(), holdSkipThresholdMs - 40);
  now = holdSkipThresholdMs;
  assert.equal(session.tick().phase, 'boost');
  assert.equal(session.boosted(), true);
  assert.equal(session.tick().phase, 'ignore');
  assert.equal(session.key({ ...up('j', 'KeyJ'), shiftKey: true }, false, false).phase, 'release');
  assert.equal(session.holding(), false);
});

test('方向键同样短按跳、长按加速，失焦时未完成的短按不跳、加速中要还原', () => {
  let now = 0;
  const session = createHoldSkipSession(() => now);
  const right = down('ArrowRight', 'ArrowRight');
  assert.equal(skipHoldDirection(right, true), 1);
  assert.equal(skipHoldDirection(down('ArrowLeft', 'ArrowLeft'), true), -1);
  assert.equal(session.key(right, true, true).phase, 'arm');
  now = holdSkipThresholdMs;
  assert.equal(session.tick().phase, 'boost');
  assert.equal(session.key(up('ArrowRight', 'ArrowRight'), true, true).phase, 'release');

  now = 0;
  assert.equal(session.key(down('ArrowLeft', 'ArrowLeft'), true, true).phase, 'arm');
  const dropped: HoldSkipDecision = session.cancel();
  assert.equal(dropped.phase, 'ignore');
  assert.equal(session.key(up('ArrowLeft', 'ArrowLeft'), true, true).phase, 'ignore');

  assert.equal(session.key(right, true, true).phase, 'arm');
  now = holdSkipThresholdMs;
  assert.equal(session.tick().phase, 'boost');
  assert.equal(session.cancel().phase, 'release');
  assert.equal(session.holding(), false);
  assert.equal(session.cancel().phase, 'ignore');
});

test('没开单键、按着修饰键、或不是快进快退键时不接管，另一键也不会抢走这次按住', () => {
  let now = 0;
  const session = createHoldSkipSession(() => now);
  const forward = down('l', 'KeyL');
  assert.equal(session.key(forward, false, true).phase, 'ignore');
  assert.equal(session.key(forward, true, false).phase, 'ignore');
  assert.equal(session.key({ ...forward, ctrlKey: true }, true, true).phase, 'ignore');
  assert.equal(session.key({ ...forward, metaKey: true }, true, true).phase, 'ignore');
  assert.equal(session.key({ ...forward, altKey: true }, true, true).phase, 'ignore');
  assert.equal(session.key({ ...forward, shiftKey: true }, true, true).phase, 'ignore');
  assert.equal(session.key(down('s', 'KeyS'), true, true).phase, 'ignore');
  assert.equal(session.key({ type: 'keydown', key: '>', code: 'Period', altKey: true, shiftKey: true, ctrlKey: false, metaKey: false }, true, true).phase, 'ignore');
  assert.equal(skipHoldDirection(forward, false), null);

  assert.equal(session.key(forward, true, true).phase, 'arm');
  assert.equal(session.key(down('j', 'KeyJ'), true, true).phase, 'ignore');
  now = 20;
  assert.deepEqual(session.key(up('l', 'KeyL'), true, true), { phase: 'skip', direction: 1 });
});
