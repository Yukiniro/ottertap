import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHoverWheelGesture } from '../lib/hover-wheel';

test('页面起滚后经过视频不接管；按相邻事件间隔判断，停满 300ms 后重新开始', () => {
  const gesture = createHoverWheelGesture();
  assert.equal(gesture(undefined, 0), undefined);
  for (const now of [100, 200, 400, 600, 899]) assert.equal(gesture('1', now), undefined);
  assert.equal(gesture('1', 1199), '1');
  assert.equal(gesture('1', 1200), '1');
});

test('视频内起滚可连续调节；离开或切换后不再接管，停顿后可换目标', () => {
  const gesture = createHoverWheelGesture();
  assert.equal(gesture('1', 0), '1');
  assert.equal(gesture('1', 200), '1');
  assert.equal(gesture(undefined, 210), undefined);
  assert.equal(gesture('1', 220), undefined);
  assert.equal(gesture('2', 520), '2');
  assert.equal(gesture('1', 530), undefined);
  assert.equal(gesture('2', 540), undefined);
});
