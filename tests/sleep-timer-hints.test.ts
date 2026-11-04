import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actionHintText } from '../lib/hotkey';
import { createSleepTimer, sleepSoonLeadMs } from '../lib/sleep-timer';

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
    jump(ms: number) { now += ms; },
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
    fireEarly() {
      const first = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!first) return;
      timers.delete(first[0]);
      first[1].callback();
    },
  };
}

test('页内提示文案：开始带分钟，取消、到期和临近各一句，坏分钟不出字', () => {
  assert.equal(actionHintText('sleepStartHint', 30), '睡眠 30 分钟');
  assert.equal(actionHintText('sleepStartHint', 1), '睡眠 1 分钟');
  assert.equal(actionHintText('sleepStartHint', 0), '');
  assert.equal(actionHintText('sleepStartHint', 181), '');
  assert.equal(actionHintText('sleepStartHint'), '');
  assert.equal(actionHintText('sleepCancelHint'), '已取消睡眠');
  assert.equal(actionHintText('sleepDueHint'), '睡眠定时到，已暂停');
  assert.equal(actionHintText('sleepSoonHint'), '还剩约 1 分钟');
});

test('超过 1 分钟的定时，在到期前约 1 分钟提示一次；1 分钟整不开时不另提示', () => {
  const fake = fakeClock();
  let due = 0;
  let soon = 0;
  const timer = createSleepTimer(() => { due += 1; }, fake.clock, () => { soon += 1; });
  const start = fake.clock.now();
  timer.arm(start + 30 * 60_000);
  assert.equal(fake.pending(), 2, '到期和临近各留一个计时器');
  fake.advance(30 * 60_000 - sleepSoonLeadMs - 1);
  assert.equal(soon, 0, '还差一毫秒不提示');
  assert.equal(due, 0);
  fake.advance(1);
  assert.equal(soon, 1);
  assert.equal(due, 0, '临近提示不暂停');
  fake.advance(sleepSoonLeadMs);
  assert.equal(due, 1);
  assert.equal(soon, 1, '同一次定时只提示一次');
  assert.equal(timer.deadline(), null);

  timer.arm(fake.clock.now() + sleepSoonLeadMs);
  assert.equal(fake.pending(), 1, '正好 1 分钟时不再排临近提示');
  fake.advance(sleepSoonLeadMs);
  assert.equal(soon, 1);
  assert.equal(due, 2);
});

test('取消清掉临近提示；续时把提示挪到新的截止时间前 1 分钟，提示过之后再续会再提示', () => {
  const fake = fakeClock();
  let due = 0;
  let soon = 0;
  const timer = createSleepTimer(() => { due += 1; }, fake.clock, () => { soon += 1; });
  timer.arm(fake.clock.now() + 10 * 60_000);
  fake.advance(60_000);
  timer.cancel();
  assert.equal(timer.deadline(), null);
  assert.equal(fake.pending(), 0);
  fake.advance(20 * 60_000);
  assert.equal(soon, 0);
  assert.equal(due, 0);

  timer.arm(fake.clock.now() + 5 * 60_000);
  fake.advance(60_000);
  const extended = timer.extend(15 * 60_000);
  assert.equal(extended, fake.clock.now() + 4 * 60_000 + 15 * 60_000);
  fake.advance(4 * 60_000 + 15 * 60_000 - sleepSoonLeadMs - 1);
  assert.equal(soon, 0, '续时前排的那一次不再响');
  fake.advance(1);
  assert.equal(soon, 1);
  assert.equal(due, 0);

  timer.extend(15 * 60_000);
  fake.advance(15 * 60_000 - 1);
  assert.equal(soon, 1, '还没到新的 1 分钟不再提示');
  fake.advance(1);
  assert.equal(soon, 2, '续过之后，新的到期前再提示一次');
  fake.advance(sleepSoonLeadMs);
  assert.equal(due, 1);
  assert.equal(soon, 2);
});

test('临近计时器早醒会再等；睡过了 1 分钟窗口才醒就不再提示，直接等到期', () => {
  const fake = fakeClock();
  let due = 0;
  let soon = 0;
  const timer = createSleepTimer(() => { due += 1; }, fake.clock, () => { soon += 1; });
  const at = fake.clock.now() + 10 * 60_000;
  timer.arm(at);
  fake.fireEarly();
  assert.equal(soon, 0, '墙上时间还没到 1 分钟');
  assert.equal(fake.pending(), 2, '重新排上临近提示');
  fake.advance(10 * 60_000 - sleepSoonLeadMs);
  assert.equal(soon, 1);
  assert.equal(due, 0);

  timer.arm(fake.clock.now() + 10 * 60_000);
  fake.jump(10 * 60_000 + 5_000);
  fake.advance(0);
  assert.equal(soon, 1, '醒来时已经过了截止时间，不再补临近提示');
  assert.equal(due, 1);
  assert.equal(timer.deadline(), null);
});

test('dispose 之后临近提示和到期都不再触发', () => {
  const fake = fakeClock();
  let due = 0;
  let soon = 0;
  const timer = createSleepTimer(() => { due += 1; }, fake.clock, () => { soon += 1; });
  timer.arm(fake.clock.now() + 5 * 60_000);
  timer.dispose();
  assert.equal(timer.deadline(), null);
  assert.equal(fake.pending(), 0);
  fake.advance(10 * 60_000);
  assert.equal(soon, 0);
  assert.equal(due, 0);
});
