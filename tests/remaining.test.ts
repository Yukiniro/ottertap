import assert from 'node:assert/strict';
import { test } from 'node:test';
import { remainingWallSeconds, type RemainingMedia } from '../lib/remaining';

const clip = (patch: Partial<RemainingMedia> = {}): RemainingMedia => ({
  currentTime: 40,
  duration: 120,
  rate: 1,
  live: false,
  seekable: [{ start: 0, end: 120 }],
  ...patch,
});

test('2× 时墙钟剩余是媒体时钟剩余的一半', () => {
  assert.equal(remainingWallSeconds(clip({ rate: 1 })), 80);
  assert.equal(remainingWallSeconds(clip({ rate: 2 })), 40);
  assert.equal(remainingWallSeconds(clip({ currentTime: 0, rate: 2 })), 60);
  assert.equal(remainingWallSeconds(clip({ rate: 1.5 })), 80 / 1.5);
});

test('倍速或进度一变，剩余跟着变', () => {
  const atOne = remainingWallSeconds(clip({ currentTime: 10, rate: 1 }));
  const atTwo = remainingWallSeconds(clip({ currentTime: 10, rate: 2 }));
  const later = remainingWallSeconds(clip({ currentTime: 70, rate: 2 }));
  assert.equal(atOne, 110);
  assert.equal(atTwo, 55);
  assert.equal(later, 25);
  assert.ok(atTwo < atOne);
  assert.ok(later < atTwo);
});

test('播完、倒着的进度和很慢的倍速仍给出有限秒数', () => {
  assert.equal(remainingWallSeconds(clip({ currentTime: 130, rate: 2 })), 0);
  assert.equal(remainingWallSeconds(clip({ currentTime: Number.NaN, rate: 2 })), 60);
  assert.equal(remainingWallSeconds(clip({ rate: 0.5 })), 160);
});

test('直播、未知时长、不可 seek 或无效倍速不估算', () => {
  assert.equal(remainingWallSeconds(clip({ live: true, duration: null })), null);
  assert.equal(remainingWallSeconds(clip({ live: true })), null, '即便带了时长，直播也不显示');
  assert.equal(remainingWallSeconds(clip({ duration: null })), null);
  assert.equal(remainingWallSeconds(clip({ duration: Number.POSITIVE_INFINITY })), null);
  assert.equal(remainingWallSeconds(clip({ duration: 0 })), null);
  assert.equal(remainingWallSeconds(clip({ seekable: [] })), null);
  assert.equal(remainingWallSeconds(clip({ seekable: [{ start: 10, end: 10 }] })), null);
  assert.equal(remainingWallSeconds(clip({ duration: null, seekable: [{ start: 0, end: 30 }] })), null, '能 seek 但不知道总时长');
  assert.equal(remainingWallSeconds(clip({ rate: 0 })), null);
  assert.equal(remainingWallSeconds(clip({ rate: Number.NaN })), null);
});
