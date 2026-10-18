import assert from 'node:assert/strict';
import { test } from 'node:test';
import { soundingTabChanged, soundingTabs, tabFavicon, type TabSnapshot } from '../lib/tabs';

const tab = (patch: TabSnapshot): TabSnapshot => ({ id: 1, windowId: 1, index: 0, title: 'Tab', ...patch });

test('只保留其他正在发声或已静音的标签，并按能听见、最近使用排序', () => {
  const current = tab({ id: 1, audible: true, title: 'Current', lastAccessed: 99 });
  const heard = tab({ id: 2, audible: true, mutedInfo: { muted: false }, title: '  Live  ', favIconUrl: 'https://cdn.example/favicon.ico', lastAccessed: 10, index: 3 });
  const heardLater = tab({ id: 3, audible: true, title: 'Newer', lastAccessed: 20, index: 1 });
  const muted = tab({ id: 4, audible: false, mutedInfo: { muted: true }, title: 'Muted', lastAccessed: 50, index: 2 });
  const mutedOlder = tab({ id: 5, mutedInfo: { muted: true }, title: 'Older mute', lastAccessed: 5, index: 0, favIconUrl: 'javascript:alert(1)' });
  const silent = tab({ id: 6, audible: false, mutedInfo: { muted: false }, title: 'Silent' });
  const unnamed = tab({ id: 7, audible: true, title: '   ', lastAccessed: 1 });
  const duplicateAudible = tab({ id: 4, audible: true, mutedInfo: { muted: false }, title: '', favIconUrl: 'https://cdn.example/muted.png', lastAccessed: 8 });

  assert.deepEqual(soundingTabs([
    current, silent, heard, muted, heardLater, mutedOlder, unnamed, duplicateAudible, { audible: true }, { id: -1, audible: true },
  ], 1), [
    { id: 3, windowId: 1, title: 'Newer', favIconUrl: '', muted: false },
    { id: 2, windowId: 1, title: 'Live', favIconUrl: 'https://cdn.example/favicon.ico', muted: false },
    { id: 7, windowId: 1, title: '', favIconUrl: '', muted: false },
    { id: 4, windowId: 1, title: 'Muted', favIconUrl: 'https://cdn.example/muted.png', muted: true },
    { id: 5, windowId: 1, title: 'Older mute', favIconUrl: '', muted: true },
  ]);
  assert.deepEqual(soundingTabs([heard], undefined).map(item => item.id), [2]);
  assert.equal(tabFavicon('http://example.test/icon.png'), 'http://example.test/icon.png');
  assert.equal(tabFavicon('chrome://favicon/'), '');
  assert.equal(tabFavicon('not a url'), '');
});

test('发声、静音、标题或图标变化才刷新其他标签列表', () => {
  assert.equal(soundingTabChanged({ audible: true }), true);
  assert.equal(soundingTabChanged({ audible: false }), true);
  assert.equal(soundingTabChanged({ mutedInfo: { muted: false } }), true);
  assert.equal(soundingTabChanged({ title: 'Video' }), true);
  assert.equal(soundingTabChanged({ favIconUrl: 'https://cdn.example/icon.png' }), true);
  assert.equal(soundingTabChanged({}), false);
});
