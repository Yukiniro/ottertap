import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSleepTimer, maxSleepMinutes, sleepMinutes, sleepPresets } from '../lib/sleep-timer';

function fakeClock(start = 1_000_000) {
  let now = start;
  let next = 1;
  const timers = new Map<number, { at: number; callback: () => void }>();
  return {
    clock: {
      now: () => now,
      setTimeout(callback: () => void, ms: number) { const id = next++; timers.set(id, { at: now + ms, callback }); return id; },
      clearTimeout(id: number) { timers.delete(id); },
    },
    pending: () => timers.size,
    /** Move the wall clock without firing anything, as when the computer sleeps. */
    jump(ms: number) { now += ms; },
    /** Fire every timer that is due by `now + ms`, in order. */
    advance(ms: number) {
      const until = now + ms;
      for (;;) {
        const due = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = Math.max(now, due[1].at);
        due[1].callback();
      }
      now = until;
    },
    /** Fire the next timer right away, before its time on the wall clock. */
    fireEarly() {
      const first = [...timers][0];
      if (!first) return;
      timers.delete(first[0]);
      first[1].callback();
    },
  };
}

test('档位是 15 / 30 / 45 / 60，自定义只收 1 到 180 的整分钟', () => {
  assert.deepEqual([...sleepPresets], [15, 30, 45, 60]);
  assert.equal(maxSleepMinutes, 180);
  for (const value of [1, 15, 90, 180]) assert.equal(sleepMinutes(value), value);
  for (const value of [0, -5, 181, 2.5, Number.NaN, Infinity, '30', null, undefined]) assert.equal(sleepMinutes(value), null, String(value));
});

test('到点只触发一次；重新设定替换原来的截止时间', () => {
  const fake = fakeClock();
  let due = 0;
  const timer = createSleepTimer(() => { due += 1; }, fake.clock);
  assert.equal(timer.deadline(), null);

  const at = fake.clock.now() + 15 * 60_000;
  timer.arm(at);
  assert.equal(timer.deadline(), at);
  fake.advance(15 * 60_000 - 1);
  assert.equal(due, 0, '还差一毫秒不触发');
  fake.advance(1);
  assert.equal(due, 1);
  assert.equal(timer.deadline(), null, '触发后不再显示倒计时');
  fake.advance(60 * 60_000);
  assert.equal(due, 1, '不会再触发第二次');

  timer.arm(fake.clock.now() + 30 * 60_000);
  fake.advance(10 * 60_000);
  const later = fake.clock.now() + 5 * 60_000;
  timer.arm(later);
  assert.equal(fake.pending(), 1, '只留一个计时器');
  fake.advance(5 * 60_000);
  assert.equal(due, 2, '按新的截止时间触发');
  fake.advance(30 * 60_000);
  assert.equal(due, 2, '旧的截止时间不再触发');
});

test('计时器早醒时按墙上时间再等；睡眠后晚醒时立刻触发', () => {
  const fake = fakeClock();
  let due = 0;
  const timer = createSleepTimer(() => { due += 1; }, fake.clock);
  const at = fake.clock.now() + 60_000;
  timer.arm(at);
  fake.fireEarly();
  assert.equal(due, 0, '墙上时间还没到');
  assert.equal(timer.deadline(), at);
  assert.equal(fake.pending(), 1, '重新排上剩余时间');

  fake.jump(5 * 60_000);
  fake.fireEarly();
  assert.equal(due, 1, '墙上时间已过就触发');
  assert.equal(timer.deadline(), null);
});

test('dispose 之后不再触发', () => {
  const fake = fakeClock();
  let due = 0;
  const timer = createSleepTimer(() => { due += 1; }, fake.clock);
  timer.arm(fake.clock.now() + 60_000);
  timer.dispose();
  assert.equal(timer.deadline(), null);
  assert.equal(fake.pending(), 0);
  fake.advance(120_000);
  assert.equal(due, 0);
});
