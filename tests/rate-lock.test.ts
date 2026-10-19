import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createMediaController } from '../lib/media';
import { armRateEcho, createRateLockState, noteDesiredRate, observePlaybackRate, rateLockDelayMs, rateLockMaxFights, rateLockWindowMs } from '../lib/rate-lock';
import { createSitePrefSession } from '../lib/settings';

test('自己写入的倍速回声不会再安排回写', () => {
  let state = noteDesiredRate(createRateLockState(), 1.5);
  const echoed = observePlaybackRate(state, 1.5, 0, true);
  assert.equal(echoed.decision.type, 'ignore');
  assert.equal(echoed.state.fights, 0);
  assert.equal(echoed.state.echo, null);
  const again = observePlaybackRate(echoed.state, 1.5, 5, true);
  assert.equal(again.decision.type, 'ignore');
  assert.equal(again.state.fights, 0);

  const fight = observePlaybackRate(again.state, 1, 10, true);
  assert.equal(fight.decision.type, 'rewrite');
  const armed = armRateEcho(fight.state);
  const ownWrite = observePlaybackRate(armed, 1.5, 10 + rateLockDelayMs(1), true);
  assert.equal(ownWrite.decision.type, 'ignore');
  assert.equal(ownWrite.state.fights, 1);
  assert.equal(ownWrite.state.pending, false);
  const stuck = observePlaybackRate(ownWrite.state, 1.5, 20 + rateLockDelayMs(1), true);
  assert.equal(stuck.decision.type, 'ignore');
  assert.equal(stuck.state.fights, 1);
});

test('站点改掉倍速会回写目标，退避期间不另开一轮', () => {
  let state = noteDesiredRate(createRateLockState(), 1.5);
  state = observePlaybackRate(state, 1.5, 0, true).state;
  const fight = observePlaybackRate(state, 1, 30, true);
  assert.deepEqual(fight.decision, { type: 'rewrite', rate: 1.5, delayMs: rateLockDelayMs(1) });
  assert.equal(fight.decision.type === 'rewrite' && fight.decision.delayMs, 200);
  const during = observePlaybackRate(fight.state, 1, 40, true);
  assert.equal(during.decision.type, 'ignore');
  assert.equal(during.state.fights, 1);
  assert.equal(during.state.pending, true);
  const off = observePlaybackRate(state, 1, 30, false);
  assert.equal(off.decision.type, 'ignore');
  assert.equal(off.state, state);
});

test('同一轮拉锯超过上限后认输，安静一段时间后重新计数', () => {
  let state = observePlaybackRate(noteDesiredRate(createRateLockState(), 2), 2, 0, true).state;
  const kinds: string[] = [];
  let now = 0;
  for (let index = 0; index < rateLockMaxFights + 1; index += 1) {
    now += 1;
    const next = observePlaybackRate(state, 1, now, true);
    kinds.push(next.decision.type);
    if (next.decision.type !== 'rewrite') { state = next.state; continue; }
    assert.equal(next.decision.rate, 2);
    assert.equal(next.decision.delayMs, rateLockDelayMs(index + 1));
    const echoed = observePlaybackRate(armRateEcho(next.state), next.decision.rate, now + next.decision.delayMs, true);
    assert.equal(echoed.decision.type, 'ignore');
    state = echoed.state;
    now += next.decision.delayMs;
  }
  assert.deepEqual(kinds, ['rewrite', 'rewrite', 'rewrite', 'rewrite', 'give-up', 'ignore']);
  assert.equal(state.givenUp, true);
  const resumed = noteDesiredRate(state, 1);
  const echo = observePlaybackRate(resumed, 1, now, true);
  assert.equal(echo.decision.type, 'ignore');
  const changed = observePlaybackRate(echo.state, 1.25, now + 10, true);
  assert.deepEqual(changed.decision, { type: 'rewrite', rate: 1, delayMs: 200 });

  const quiet = observePlaybackRate(armRateEcho(changed.state), 1, now + 10 + 200, true).state;
  const later = observePlaybackRate(quiet, 1.5, now + 10 + 200 + rateLockWindowMs + 1, true);
  assert.equal(later.decision.type, 'rewrite');
  assert.equal(later.state.fights, 1);
});

test('站点记忆仍只应用一次，关闭锁定时不回写', () => {
  const session = createSitePrefSession();
  const prefs = { 'bilibili.com': { rate: 1.5 } };
  assert.deepEqual(session.plan('bilibili.com', '1', prefs), [{ type: 'rate', value: 1.5 }]);
  assert.deepEqual(session.plan('bilibili.com', '1', prefs), []);
  const desired = noteDesiredRate(createRateLockState(), 1.5);
  assert.equal(observePlaybackRate(desired, 1, 0, false).decision.type, 'ignore');
});

function installRateEvents(media: HTMLMediaElement, view: Window, fight: boolean) {
  let desc: PropertyDescriptor | undefined;
  for (let proto = Object.getPrototypeOf(media); proto; proto = Object.getPrototypeOf(proto)) {
    desc = Object.getOwnPropertyDescriptor(proto, 'playbackRate');
    if (desc) break;
  }
  assert.ok(desc?.get && desc.set);
  let sets = 0;
  Object.defineProperty(media, 'playbackRate', {
    configurable: true,
    get() { return desc.get!.call(this); },
    set(value: number) {
      const before = desc.get!.call(this);
      desc.set!.call(this, value);
      const after = desc.get!.call(this);
      if (after === before) return;
      sets += 1;
      media.dispatchEvent(new view.Event('ratechange') as unknown as Event);
      if (fight && after !== 1) {
        desc.set!.call(this, 1);
        sets += 1;
        media.dispatchEvent(new view.Event('ratechange') as unknown as Event);
      }
    }
  });
  return () => sets;
}

test('锁定打开时站点覆盖会被写回，自己的写入和关闭时都不会', async () => {
  const view = new Window({ url: 'https://example.com/watch' });
  const document = view.document as unknown as Document;
  const media = view.document.createElement('video');
  view.document.body.append(media);
  const sets = installRateEvents(media as unknown as HTMLMediaElement, view, false);
  const controller = createMediaController(document);
  try {
    const id = controller.snapshot()[0]!.id;
    const pending = controller.command(id, { type: 'rate', value: 1.5 });
    await view.happyDOM.waitUntilComplete();
    assert.equal(await pending, 1.5);
    assert.equal(sets(), 1);
    media.playbackRate = 1;
    await view.happyDOM.waitUntilComplete();
    assert.equal(media.playbackRate, 1);
    controller.setLockRate(true);
    const again = controller.command(id, { type: 'rate', value: 1.5 });
    await view.happyDOM.waitUntilComplete();
    assert.equal(await again, 1.5);
    const before = sets();
    media.playbackRate = 1;
    await view.happyDOM.waitUntilComplete();
    assert.equal(media.playbackRate, 1.5);
    assert.equal(sets(), before + 2);
    assert.equal(controller.snapshot()[0]!.rateLock, undefined);
  } finally {
    controller.destroy();
    await view.happyDOM.close();
  }
});

test('站点持续打回倍速时，超过次数后停止并只提示一次', async () => {
  const view = new Window({ url: 'https://example.com/watch' });
  const document = view.document as unknown as Document;
  const media = view.document.createElement('video');
  view.document.body.append(media);
  installRateEvents(media as unknown as HTMLMediaElement, view, true);
  let notices = 0;
  const controller = createMediaController(document, undefined, () => { notices += 1; });
  controller.setLockRate(true);
  try {
    const id = controller.snapshot()[0]!.id;
    const pending = controller.command(id, { type: 'rate', value: 1.75 });
    await view.happyDOM.waitUntilComplete();
    await pending;
    assert.equal(media.playbackRate, 1);
    assert.equal(notices, 1);
    assert.equal(controller.snapshot()[0]!.rateLock, 'given-up');
    const setsBefore = media.playbackRate;
    media.dispatchEvent(new view.Event('ratechange'));
    media.dispatchEvent(new view.Event('play'));
    await view.happyDOM.waitUntilComplete();
    assert.equal(media.playbackRate, setsBefore);
    assert.equal(notices, 1);
  } finally {
    controller.destroy();
    await view.happyDOM.close();
  }
});
