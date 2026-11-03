import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { isResumeExcluded, mergeSettingsChange, normalizeSettings } from '../lib/settings';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { resumeEntryKey, resumePrefix } from '../lib/resume';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';

test('接着看设置：开关默认开、坏值回落，排除名单按域名含子域名', () => {
  assert.equal(defaultSettings.resumeJump, true);
  assert.equal(normalizeSettings({}).resumeJump, true);
  assert.equal(normalizeSettings({ resumeJump: false }).resumeJump, false);
  assert.equal(normalizeSettings({ resumeJump: 'off' }).resumeJump, true);
  assert.deepEqual(normalizeSettings({ resumeExcludedSites: ['YouTube.COM', 'youtube.com', 12] }).resumeExcludedSites, ['youtube.com'], '去重并小写');
  assert.equal(isResumeExcluded('www.youtube.com', ['youtube.com']), true);
  assert.equal(isResumeExcluded('notyoutube.com', ['youtube.com']), false);
  assert.equal(isResumeExcluded('', ['youtube.com']), false);
  const current = { ...defaultSettings, resumeExcludedSites: ['b.example'] };
  const next = mergeSettingsChange(current, defaultSettings, { ...defaultSettings, resumeExcludedSites: ['a.example'] });
  assert.deepEqual(next.resumeExcludedSites, ['b.example', 'a.example'], '另一页加的和本页加的都留下');
  assert.equal(next.resumeJump, true);
  const removed = mergeSettingsChange(
    { ...defaultSettings, resumeExcludedSites: ['a.example', 'b.example'] },
    { ...defaultSettings, resumeExcludedSites: ['a.example', 'b.example'] },
    { ...defaultSettings, resumeExcludedSites: ['a.example'] });
  assert.deepEqual(removed.resumeExcludedSites, ['a.example'], '本页删的那条真的删掉');
});

test('导出导入带上排除名单，账本键仍在设置之外', () => {
  const settings = { ...defaultSettings, resumeExcludedSites: ['youtube.com'] };
  const text = serializeSettings(settings, '1.9.0');
  assert.equal(text.includes('"resumeExcludedSites"'), true);
  assert.equal(text.includes(resumePrefix), false, '账本不进备份');
  const restored = parseSettingsBackup(text);
  assert.ok(restored.ok);
  assert.deepEqual(restored.settings.resumeExcludedSites, ['youtube.com']);
  const older = parseSettingsBackup(JSON.stringify({ format: 'ottertap-settings', version: 1, extensionVersion: '1.8.0', settings: { theme: 'dark' } }));
  assert.ok(older.ok);
  assert.deepEqual(older.settings.resumeExcludedSites, [], '旧备份导入后名单为空');
});

function fakeLedger(initial: Record<string, unknown>) {
  const data = new Map(Object.entries(initial));
  const listeners = new Set<(changes: Record<string, unknown>, area: string) => void>();
  const storage = {
    local: {
      async get() { return Object.fromEntries(data); },
      async remove(keys: string[]) {
        for (const key of keys) data.delete(key);
        for (const listener of listeners) listener(Object.fromEntries(keys.map(key => [key, { newValue: undefined }])), 'local');
      }
    },
    onChanged: {
      addListener(listener: (changes: Record<string, unknown>, area: string) => void) { listeners.add(listener); },
      removeListener(listener: (changes: Record<string, unknown>, area: string) => void) { listeners.delete(listener); }
    }
  };
  Object.defineProperty(globalThis, 'browser', { value: { storage }, configurable: true, writable: true });
  return {
    remove(key: string) { data.delete(key); for (const listener of listeners) listener({ [key]: { newValue: undefined } }, 'local'); },
    clear() { const keys = [...data.keys()].filter(key => key.startsWith(resumePrefix)); for (const key of keys) data.delete(key); for (const listener of listeners) listener(Object.fromEntries(keys.map(key => [key, { newValue: undefined }])), 'local'); }
  };
}

test('设置页接着看：开关与排除名单走设置，列表来自账本，删单条与清空带确认', async () => {
  const window = new Window({ url: 'https://player.test/watch' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'FocusEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const lecture = resumeEntryKey('https://lecture.example/watch?v=1', 'src:https://cdn.example.com/course%20one.mp4');
  const talk = resumeEntryKey('https://talk.example/9', 'dur:600');
  fakeLedger({
    [lecture]: { page: 'https://lecture.example/watch?v=1', media: 'src:https://cdn.example.com/course%20one.mp4', time: 600, duration: 1800, savedAt: Date.now() - 90_000 },
    [talk]: { page: 'https://talk.example/9', media: 'dur:600', time: 61, duration: 600, savedAt: Date.now() - 3 * 60_000 }
  });
  let value: Settings = { ...defaultSettings };
  const listeners = new Set<(settings: Settings) => void>();
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) { value = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  try {
    const { createRoot } = await import('react-dom/client');
    const { ThemeProvider } = await import('../components/theme');
    const { SettingsPage } = await import('../components/settings-page');
    const host = window.document.createElement('div');
    window.document.body.append(host);
    const root = createRoot(host as unknown as HTMLElement);
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(SettingsPage) })); });
    const button = (label: string) => host.querySelector(`button[aria-label="${label}"]`) as { textContent: string | null; click(): void } | null;
    const byId = (id: string) => host.querySelector(`#${id}`) as { textContent: string | null; click(): void } | null;
    const section = () => host.querySelector('#resume') as unknown as HTMLElement;
    const buttonsNamed = (name: string) => [...(section() as unknown as { querySelectorAll(selector: string): Iterable<{ textContent: string | null; click(): void }> }).querySelectorAll('button')].filter(node => node.textContent === name);
    const click = async (element: { click(): void }) => { await act(async () => { element.click(); }); };

    const switches = () => [...host.querySelectorAll('[role="switch"]')];
    const jumpSwitch = () => switches().find(item => item.getAttribute('aria-label') === '自动跳回上次进度');
    assert.equal(jumpSwitch()?.getAttribute('aria-checked'), 'true', '默认开');
    await click(jumpSwitch() as unknown as { click(): void });
    assert.equal(value.resumeJump, false, '关掉自动跳回');

    const type = async (text: string) => {
      await act(async () => {
        const input = byId('resume-excluded-domain') as unknown as HTMLInputElement;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        setter?.call(input, text);
        input.dispatchEvent(new window.Event('input', { bubbles: true }) as unknown as Event);
      });
    };
    await type('youtube.com');
    await act(async () => { (section().querySelector('form button[type="submit"]') as unknown as { click(): void }).click(); });
    assert.deepEqual(value.resumeExcludedSites, ['youtube.com'], '按主机名加入排除名单');
    assert.ok(button('移除 youtube.com'), '名单行可移除');
    await click(button('移除 youtube.com')!);
    assert.deepEqual(value.resumeExcludedSites, [], '移出后恢复');

    const rows = () => [...section().querySelectorAll('[role="listitem"]')].map(row => row.textContent ?? '');
    assert.equal(rows().some(text => text.includes('course one') && text.includes('lecture.example') && text.includes('10:00')), true, '列出名称、主机名与时刻');
    assert.equal(rows().some(text => text.includes('talk.example')), true);
    assert.ok(rows().every(text => /\d+ 分钟前|刚刚/.test(text)), '显示更新时间量级');
    assert.ok(button('删除「course one」的接着看进度'), '可删单条');
    await click(button('删除「course one」的接着看进度')!);
    assert.equal(rows().some(text => text.includes('course one')), false, '删单条后消失');

    await click(buttonsNamed('清空全部')[0]!);
    const confirmBox = section().querySelector('#clear-resume-title');
    assert.ok(confirmBox, '清空需二次确认');
    await click(buttonsNamed('取消')[0]!);
    assert.equal(rows().some(text => text.includes('talk.example')), true, '取消不清空');
    await click(buttonsNamed('清空全部')[0]!);
    await click([...(section() as unknown as { querySelectorAll(selector: string): Iterable<{ textContent: string | null; click(): void }> }).querySelectorAll('button')].find(node => node.textContent?.includes('清空全部进度'))!);
    assert.equal(rows().length, 0, '清空后列表为空');
  } finally {
    await window.happyDOM.close();
    Object.defineProperty(globalThis, 'browser', { value: undefined, configurable: true, writable: true });
  }
});
