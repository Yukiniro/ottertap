import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSleepTimer, sleepExtendMinutes } from '../lib/sleep-timer';

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
  };
}

test('续时固定加 15 分钟，没有别的档位', () => {
  assert.equal(sleepExtendMinutes, 15);
});

test('取消后原来的截止时间不再触发，取消之后可以再设', () => {
  const fake = fakeClock();
  let due = 0;
  const timer = createSleepTimer(() => { due += 1; }, fake.clock);
  timer.arm(fake.clock.now() + 60_000);
  timer.cancel();
  assert.equal(timer.deadline(), null);
  assert.equal(fake.pending(), 0);
  fake.advance(120_000);
  assert.equal(due, 0, '取消后到点不再暂停');

  timer.arm(fake.clock.now() + 30_000);
  assert.equal(timer.deadline(), fake.clock.now() + 30_000);
  fake.advance(30_000);
  assert.equal(due, 1, '误触取消后可以再设');
});

test('续时加在剩余截止时间上，不是从现在重算 15 分钟', () => {
  const fake = fakeClock();
  let due = 0;
  const timer = createSleepTimer(() => { due += 1; }, fake.clock);
  const at = fake.clock.now() + 10 * 60_000;
  timer.arm(at);
  assert.equal(timer.extend(0), null, '0 不是续时');
  assert.equal(timer.extend(-1), null);
  assert.equal(timer.deadline(), at);
  assert.equal(timer.extend(sleepExtendMinutes * 60_000), at + 15 * 60_000);
  assert.equal(timer.extend(sleepExtendMinutes * 60_000), at + 30 * 60_000, '再续一次再加 15 分钟');
  fake.advance(10 * 60_000);
  assert.equal(due, 0, '原来的截止时间不再触发');
  fake.advance(15 * 60_000);
  assert.equal(due, 0, '只加过一次的那个点也不触发');
  fake.advance(15 * 60_000);
  assert.equal(due, 1);
  assert.equal(timer.deadline(), null);
});

test('没有定时时不能续', () => {
  const fake = fakeClock();
  const timer = createSleepTimer(() => {}, fake.clock);
  assert.equal(timer.extend(sleepExtendMinutes * 60_000), null);
  assert.equal(fake.pending(), 0);
  timer.cancel();
  assert.equal(timer.deadline(), null);
});
