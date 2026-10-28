import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { readFlatMessages } from '../lib/message-catalog';
import { defaultSettings, type MediaCommand } from '../lib/types';

const sentence: Record<string, string> = {
  'de.yml': 'Nach dem Wechsel in einen anderen Tab',
  'en.yml': 'After you switch tabs, use an extension shortcut for picture-in-picture media.',
  'es.yml': 'Al cambiar de pestaña',
  'fr.yml': "Après avoir changé d'onglet",
  'ja.yml': 'タブを切り替えたあと',
  'ko.yml': '탭을 옮긴 뒤',
  'zh_CN.yml': '切走标签后',
  'zh_TW.yml': '切走分頁後',
};

test('快捷键说明八种语言都写明切走标签后用扩展命令', () => {
  const files = readdirSync(new URL('../locales/', import.meta.url)).filter(name => name.endsWith('.yml')).sort();
  assert.deepEqual(files, Object.keys(sentence).sort());
  for (const file of files) {
    const text = readFlatMessages(readFileSync(new URL(`../locales/${file}`, import.meta.url), 'utf8')).shortcutsDescription ?? '';
    assert.match(text, /OtterTap|小獭|小獺/, file);
    assert.match(text, new RegExp(sentence[file]!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), file);
  }
});

type Clip = { id: string; paused: boolean; muted: boolean; volume: number; maxVolume: number; rate: number; pip: boolean };

test('画中画中的选中媒体在别的标签获焦时仍接收扩展命令', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const listeners: Array<(command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void> = [];
  const commands = fakeBrowser.commands as { onCommand: { addListener(callback: (command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void): void } };
  const original = commands.onCommand;
  commands.onCommand = { addListener(callback) { listeners.push(callback); } };
  await fakeBrowser.windows.create({ focused: true });
  const video = await fakeBrowser.tabs.create({ url: 'https://player.example/watch', active: true });
  const notes = await fakeBrowser.tabs.create({ url: 'https://notes.example/doc', active: true });
  const clips = new Map<number, Clip[]>([
    [video.id!, [{ id: '1', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1, pip: true }]],
    [notes.id!, [{ id: '1', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1.5, pip: false }]],
  ]);
  let videoClosed = false;
  const applied: Array<{ tabId: number; id?: string; command: MediaCommand }> = [];
  const hints: Array<{ tabId: number; key: string }> = [];
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (tabId: number, message: { type: string; command?: MediaCommand; id?: string; key?: string }, _options?: { frameId?: number }) => {
    if (videoClosed && tabId === video.id) throw new Error('Could not establish connection. Receiving end does not exist.');
    if (message.type === 'snapshot') return { media: clips.get(tabId) ?? [], typing: false };
    if (message.type === 'actionHint') { hints.push({ tabId, key: message.key ?? '' }); return { ok: true }; }
    if (message.type === 'command' && message.command) {
      applied.push({ tabId, id: message.id, command: message.command });
      const next = (clips.get(tabId) ?? []).map(item => {
        if (item.id !== message.id) return item;
        if (message.command?.type === 'pause') return { ...item, paused: true };
        if (message.command?.type === 'play') return { ...item, paused: false };
        if (message.command?.type === 'mute') return { ...item, muted: !item.muted };
        if (message.command?.type === 'rate' && 'value' in message.command) return { ...item, rate: message.command.value };
        if (message.command?.type === 'volume' && 'value' in message.command) return { ...item, volume: message.command.value };
        if (message.command?.type === 'pip') return { ...item, pip: !item.pip };
        return item;
      });
      clips.set(tabId, next);
    }
    return { ok: true };
  });
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const fire = (name: string, tab?: { id?: number; url?: string }) => Promise.all(listeners.map(listener => listener(name, tab)));
    const request = (tab: typeof video, message: object) => new Promise<unknown>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, { id: fakeBrowser.runtime.id, tab, frameId: 0 }, resolve);
    });
    await request(video, { type: 'register', volume: 1 });
    await request(notes, { type: 'register', volume: 1 });

    await fire('play-pause', notes);
    assert.deepEqual(applied.at(-1), { tabId: video.id, id: '1', command: { type: 'pause' } });
    assert.equal(hints.at(-1)?.tabId, video.id);
    assert.equal(clips.get(notes.id!)?.[0]?.paused, false, '笔记标签上的媒体不被暂停');

    await fire('skip-forward');
    assert.deepEqual(applied.at(-1), { tabId: video.id, id: '1', command: { type: 'skip', value: 10 } });
    await fire('skip-back', notes);
    assert.deepEqual(applied.at(-1), { tabId: video.id, id: '1', command: { type: 'skip', value: -10 } });
    await fire('mute', notes);
    assert.deepEqual(applied.at(-1), { tabId: video.id, id: '1', command: { type: 'mute' } });
    const storedBeforeRate = (await fakeBrowser.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'];
    assert.equal(storedBeforeRate, undefined, '暂停、跳转和静音不写站点记忆');

    await fire('rate-faster', notes);
    assert.deepEqual(applied.at(-1), { tabId: video.id, id: '1', command: { type: 'rate', value: 1.25 } });
    await fire('volume-up', notes);
    assert.equal(applied.at(-1)?.tabId, video.id);
    assert.equal(applied.at(-1)?.command.type, 'volume');

    await fire('pip', notes);
    assert.deepEqual(applied.at(-1), { tabId: video.id, id: '1', command: { type: 'pip' } });
    assert.equal(hints.filter(item => item.key === 'pipOffHint').length, 1);
    assert.equal(clips.get(video.id!)?.[0]?.pip, false);

    const left = applied.length;
    await fire('play-pause', notes);
    assert.equal(applied.at(-1)?.tabId, notes.id, '没有画中画时仍控制当前标签');
    assert.equal(applied.length, left + 1);

    clips.set(video.id!, [{ id: '1', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1, pip: true }]);
    const builtin = await fakeBrowser.tabs.create({ url: 'chrome://extensions/', active: true });
    await fire('skip-forward', builtin);
    assert.deepEqual(applied.at(-1), { tabId: video.id, id: '1', command: { type: 'skip', value: 10 } });

    videoClosed = true;
    const blocked = applied.length;
    const hinted = hints.length;
    await fire('play-pause', builtin);
    await fire('pip');
    assert.equal(applied.length, blocked, '内置页注入失败时不发送指令');
    assert.equal(hints.length, hinted, '注入失败时不显示成功提示');

    videoClosed = false;
    clips.set(video.id!, [{ id: '1', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1, pip: false }]);
    const idle = applied.length;
    await fire('play-pause', builtin);
    assert.equal(applied.length, idle, '没有画中画且当前是内置页时不假装成功');

    clips.set(video.id!, [{ id: '1', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1, pip: true }]);
    await fakeBrowser.tabs.update(notes.id!, { active: true });
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, siteMode: 'exclude', sites: ['player.example'] } });
    await fire('mute', notes);
    assert.equal(applied.at(-1)?.tabId, notes.id, '画中画所在站被停用时不改投到那里');
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': defaultSettings });

    clips.set(video.id!, [
      { id: '1', paused: true, muted: true, volume: 0, maxVolume: 1, rate: 1, pip: false },
      { id: '2', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1, pip: true },
    ]);
    await request(video, { type: 'select', id: '0:1' });
    await fire('play-pause', notes);
    assert.equal(applied.at(-1)?.tabId, notes.id, '画中画的不是选中媒体时不改投');

    clips.set(video.id!, [{ id: '1', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1, pip: true }]);
    await request(video, { type: 'select', id: '0:1' });
    await request(notes, { type: 'hotkey', action: { type: 'toggle' } });
    assert.equal(applied.at(-1)?.tabId, notes.id, '页内快捷键仍只作用在发出它的标签');
    assert.equal(clips.get(video.id!)?.[0]?.paused, false);
  } finally {
    commands.onCommand = original;
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
