import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import {
  autoMuteBlocked,
  autoMuteCooldownMs,
  createPlayStartTracker,
  isDirectPlayGesture,
  nextAutoMuteUntil,
  parseAutoMuteUntil,
  playCauseForStart,
  playIntentWindowMs,
} from '../lib/auto-mute';
import { createMediaController } from '../lib/media';

test('播放归因只认暂停或结束后、窗口内的小獭播放或媒体上的手势', () => {
  assert.strictEqual(playIntentWindowMs, 1_000);
  assert.strictEqual(autoMuteCooldownMs, 5_000);
  const start = { enabled: true, previous: 'paused' as const, cause: 'gesture' as const, intentAt: 1_000, now: 2_000 };
  assert.strictEqual(playCauseForStart(start), 'gesture');
  assert.strictEqual(playCauseForStart({ ...start, now: 2_000 }), 'gesture', '满 1 秒仍算');
  assert.strictEqual(playCauseForStart({ ...start, now: 2_001 }), null, '超过 1 秒不算');
  assert.strictEqual(playCauseForStart({ ...start, now: 999 }), null, '时钟倒退不算');
  assert.strictEqual(playCauseForStart({ ...start, enabled: false }), null);
  assert.strictEqual(playCauseForStart({ ...start, previous: 'playing' }), null, '已经在播');
  assert.strictEqual(playCauseForStart({ ...start, previous: 'ended' }), 'gesture', '结束后再播算开始');
  assert.strictEqual(playCauseForStart({ ...start, cause: null }), null);
  assert.strictEqual(playCauseForStart({ ...start, intentAt: null }), null);
  assert.strictEqual(isDirectPlayGesture({ type: 'pointerup', isTrusted: true, button: 0 }), true);
  assert.strictEqual(isDirectPlayGesture({ type: 'pointerup', isTrusted: true }), false);
  assert.strictEqual(isDirectPlayGesture({ type: 'pointerup', isTrusted: false, button: 0 }), false);
  assert.strictEqual(isDirectPlayGesture({ type: 'pointerup', isTrusted: true, button: 2 }), false);
  assert.strictEqual(isDirectPlayGesture({ type: 'keydown', isTrusted: true, key: ' ' }), true);
  assert.strictEqual(isDirectPlayGesture({ type: 'keydown', isTrusted: true, key: 'Enter' }), true);
  assert.strictEqual(isDirectPlayGesture({ type: 'keydown', isTrusted: true, key: 'MediaPlayPause' }), true);
  assert.strictEqual(isDirectPlayGesture({ type: 'keydown', isTrusted: true, key: ' ', repeat: true }), false);
  assert.strictEqual(isDirectPlayGesture({ type: 'keydown', isTrusted: true, key: 'k' }), false);
  assert.strictEqual(isDirectPlayGesture({ type: 'click', isTrusted: true, button: 0 }), false, '站点按钮的 click 不是这条媒体上的播放手势');

  let now = 5_000;
  const tracker = createPlayStartTracker(() => now);
  tracker.see('1', 'paused');
  assert.strictEqual(tracker.arm('1', 'gesture'), true);
  now = 6_000;
  assert.strictEqual(tracker.start('1'), 'gesture');
  assert.strictEqual(tracker.arm('1', 'control'), false, '已经在播时不再记下意图');
  assert.strictEqual(tracker.start('1'), null, '连续的 play 不再算一次开始');
  tracker.see('1', 'paused');
  tracker.arm('1', 'control');
  now = 7_001;
  assert.strictEqual(tracker.start('1'), null, '过期的意图放过这次播放');
  tracker.see('2', 'playing');
  assert.strictEqual(tracker.arm('2', 'gesture'), false);
  assert.strictEqual(tracker.start('2'), null);
  tracker.see('3', 'ended');
  tracker.arm('3', 'control');
  tracker.drop('3');
  assert.strictEqual(tracker.start('3'), null, '播放没有真正开始时丢掉这次意图');
  assert.strictEqual(nextAutoMuteUntil(10_000), 15_000);
  assert.strictEqual(autoMuteBlocked(14_999, 15_000), true);
  assert.strictEqual(autoMuteBlocked(15_000, 15_000), false, '到点即可再次自动静音');
  assert.strictEqual(autoMuteBlocked(15_000, null), false);
  assert.strictEqual(parseAutoMuteUntil({ until: 15_000 }), 15_000);
  assert.strictEqual(parseAutoMuteUntil({ until: '15' }), null);
  assert.strictEqual(parseAutoMuteUntil(null), null);
});

test('没有可靠意图的 play 仍会上报播放，只有小獭的播放控制才归因', async () => {
  const window = new Window({ url: 'https://example.com/watch' });
  const document = window.document;
  const first = document.createElement('video');
  const second = document.createElement('video');
  document.body.append(first, second);
  const played: string[] = [];
  const attributed: string[] = [];
  const controller = createMediaController(
    document as unknown as Document,
    undefined,
    undefined,
    id => { played.push(id); },
    undefined,
    undefined,
    id => { attributed.push(id); },
  );
  try {
    const snap = controller.snapshot();
    const firstId = snap[0]!.id;
    const secondId = snap[1]!.id;
    first.dispatchEvent(new window.Event('play'));
    assert.deepEqual(attributed, []);
    assert.deepEqual(played, [firstId], '无法归因的播放仍交给跟随播放');
    first.dispatchEvent(new window.Event('pause'));
    await controller.command(firstId, { type: 'play' });
    assert.deepEqual(attributed, [firstId]);
    assert.deepEqual(played, [firstId, firstId]);
    first.dispatchEvent(new window.Event('play'));
    assert.deepEqual(attributed, [firstId], '同一次播放的后续事件不再归因');
    second.dispatchEvent(new window.Event('play'));
    assert.deepEqual(attributed, [firstId], '没被点过播放的另一条不算');
    assert.strictEqual(played.at(-1), secondId);
  } finally {
    controller.destroy();
    await window.happyDOM.close();
  }
});
