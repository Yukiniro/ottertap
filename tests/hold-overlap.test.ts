import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHoldGesture, type HoldGestureEffect } from '../lib/hold-gesture';
import { holdSkipThresholdMs } from '../lib/hold-skip';
import type { HoldKeyEvent } from '../lib/hold-rate';

const none = { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, repeat: false };
const ready = { boost: true, skip: true, singleKey: true };
const down = (key: string, code = key, extra: Partial<HoldKeyEvent> = {}): HoldKeyEvent => ({ type: 'keydown', key, code, ...none, ...extra });
const up = (key: string, code = key, extra: Partial<HoldKeyEvent> = {}): HoldKeyEvent => ({ type: 'keyup', key, code, ...none, ...extra });
const chordDown: HoldKeyEvent = { type: 'keydown', key: '>', code: 'Period', altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, repeat: false };

/** Messages a page would send. `skip` is a seek, not a hold phase. */
function script() {
  let now = 0;
  const gesture = createHoldGesture(() => now);
  const phases: Array<'start' | 'end' | 'skip'> = [];
  const take = (effect: HoldGestureEffect) => {
    if (effect.type === 'start' || effect.type === 'end' || effect.type === 'skip') phases.push(effect.type);
    return effect;
  };
  const key = (event: HoldKeyEvent) => take(gesture.key(event, ready));
  const elapse = () => {
    const seen: HoldGestureEffect[] = [];
    for (let i = 0; i < 4 && gesture.waiting(); i += 1) {
      now += gesture.remaining();
      const effect = take(gesture.tick());
      seen.push(effect);
      if (effect.type !== 'arm') break;
    }
    return seen;
  };
  return { phases, key, elapse, at: (ms: number) => { now = ms; } };
}

test('快进键已在临时加速时，再按 S 或 Alt+Shift+. 不会提前还原', () => {
  for (const other of [down('s', 'KeyS'), chordDown]) {
    const run = script();
    assert.equal(run.key(down('l', 'KeyL')).type, 'arm');
    assert.equal(run.elapse()[0]?.type, 'start');
    const pressed = run.key(other);
    assert.equal(pressed.type, 'consume');
    if (pressed.type === 'consume') assert.equal(pressed.armAlt, other.altKey);
    assert.equal(run.key({ ...other, type: 'keyup', altKey: false, shiftKey: false, key: other.code === 'Period' ? '.' : 's' }).type, 'consume');
    assert.equal(run.key(up('l', 'KeyL')).type, 'end');
    assert.deepEqual(run.phases, ['start', 'end']);
  }
});

test('独立按住已生效时，再长按快进键不会开始第二段，松开它也不还原', () => {
  for (const first of [down('s', 'KeyS'), chordDown]) {
    const run = script();
    assert.equal(run.key(first).type, 'start');
    assert.equal(run.key(down('l', 'KeyL')).type, 'arm');
    assert.deepEqual(run.elapse().map(effect => effect.type), ['ignore']);
    assert.equal(run.key({ ...down('l', 'KeyL'), repeat: true }).type, 'consume');
    assert.equal(run.key(up('l', 'KeyL')).type, 'consume');
    assert.equal(run.key(up(first.key, first.code ?? first.key, { altKey: false, shiftKey: false })).type, 'end');
    assert.deepEqual(run.phases, ['start', 'end']);
  }
});

test('两路重叠时先松开先按住的键会还原，后按下的键松手不再发一次结束', () => {
  const run = script();
  assert.equal(run.key(down('ArrowRight', 'ArrowRight')).type, 'arm');
  assert.equal(run.elapse()[0]?.type, 'start');
  assert.equal(run.key(down('s', 'KeyS')).type, 'consume');
  assert.equal(run.key(up('ArrowRight', 'ArrowRight')).type, 'end');
  assert.equal(run.key(up('s', 'KeyS')).type, 'consume');
  assert.deepEqual(run.phases, ['start', 'end']);

  const reverse = script();
  assert.equal(reverse.key(chordDown).type, 'start');
  assert.equal(reverse.key(down('j', 'KeyJ')).type, 'arm');
  reverse.elapse();
  assert.equal(reverse.key(up('>', 'Period', { altKey: false, shiftKey: false })).type, 'end');
  assert.equal(reverse.key(up('j', 'KeyJ')).type, 'consume');
  assert.deepEqual(reverse.phases, ['start', 'end']);
});

test('独立按住期间短按快进键仍只跳一次，并且不结束临时加速', () => {
  const run = script();
  assert.equal(run.key(down('s', 'KeyS')).type, 'start');
  assert.equal(run.key(down('l', 'KeyL')).type, 'arm');
  run.at(holdSkipThresholdMs - 1);
  assert.equal(run.key(up('l', 'KeyL')).type, 'skip');
  assert.equal(run.key(up('s', 'KeyS')).type, 'end');
  assert.deepEqual(run.phases, ['start', 'skip', 'end']);
});

test('独立按住在阈值前松开后，仍按着的快进键到点会自己加速', () => {
  const run = script();
  assert.equal(run.key(down('s', 'KeyS')).type, 'start');
  assert.equal(run.key(down('l', 'KeyL')).type, 'arm');
  run.at(40);
  assert.equal(run.key(up('s', 'KeyS')).type, 'end');
  assert.equal(run.elapse()[0]?.type, 'start');
  assert.equal(run.key(up('l', 'KeyL')).type, 'end');
  assert.deepEqual(run.phases, ['start', 'end', 'start', 'end']);
});
