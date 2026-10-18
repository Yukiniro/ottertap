import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const directory = new URL('../.output/chrome-mv3/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.name, '__MSG_extName__');
assert.equal(manifest.default_locale, 'en');
const locales = readdirSync(new URL('../locales/', import.meta.url)).filter(name => name.endsWith('.yml')).map(name => name.slice(0, -4));
for (const required of ['en', 'zh_CN', 'zh_TW', 'ja', 'ko', 'de', 'es', 'fr']) assert.ok(locales.includes(required), required);
for (const locale of locales) {
  const messages = JSON.parse(await readFile(new URL(`_locales/${locale}/messages.json`, directory), 'utf8'));
  assert.equal(typeof messages.extName.message, 'string');
  assert.ok(messages.extName.message.length > 0, `${locale} extName must be present`);
  assert.equal(messages.locale.message, locale.replace('_', '-'));
}
assert.equal(manifest.options_ui.open_in_tab, true);
assert.equal(manifest.action.default_popup, 'popup.html');
assert.equal(manifest.content_scripts[0].all_frames, true);
assert.deepEqual(manifest.permissions, ['storage']);
assert.deepEqual(manifest.host_permissions.sort(), ['http://*/*', 'https://*/*']);
for (const file of ['popup.html', 'options.html', 'background.js', 'content-scripts/content.js', 'content-scripts/content.css', 'LICENSE', ...Object.values(manifest.icons)]) {
  assert.ok((await readFile(new URL(file, directory))).length > 0, `${file} must exist`);
}
for (const [size, file] of Object.entries(manifest.icons)) {
  const png = await readFile(new URL(file, directory));
  assert.equal(png.readUInt32BE(16), Number(size));
  assert.equal(png.readUInt32BE(20), Number(size));
  assert.equal(png[25], 6, 'Brand icons must retain RGBA transparency');
}
assert.match(await readFile(new URL('content-scripts/content.js', directory), 'utf8'), /data:image\/png;base64,/);
let handler;
let settings = { siteMode: 'all', sites: [], floating: true, theme: 'light' };
const storageListeners = new Set();
function applySettings(next) {
  settings = next;
  const changes = { 'ottertap-settings-v1': { newValue: settings } };
  for (const listener of storageListeners) listener(changes, 'local');
}
let tabUrl = 'https://www.bilibili.com/video/example';
let removed;
let updated;
const commands = [];
let holdCommand = null;
let failCommands = 0;
const chrome = {
  runtime: { id: 'test-id', getURL: path => `chrome-extension://test-id${path}`, onMessage: { addListener: listener => { handler = listener; } }, openOptionsPage: async () => {} },
  i18n: { getMessage: name => name },
  storage: {
    local: { get: async key => { assert.equal(key, 'ottertap-settings-v1', 'Settings use the ottertap storage key'); return { [key]: settings }; } },
    onChanged: { addListener(listener) { storageListeners.add(listener); }, removeListener(listener) { storageListeners.delete(listener); } }
  },
  tabs: {
    get: async id => ({ id, url: tabUrl }),
    onRemoved: { addListener: listener => { removed = listener; } },
    onUpdated: { addListener: listener => { updated = listener; } },
    sendMessage: async (id, message, options) => {
      if (message.type === 'snapshot') return { media: [{ id: '1', title: `frame ${options.frameId}`, paused: true }] };
      commands.push({ id, message, options });
      if (message.type === 'command' && holdCommand) await holdCommand;
      if (message.type === 'command' && failCommands > 0) { failCommands -= 1; throw new Error('frame send failed'); }
      return { ok: true };
    }
  }
};
vm.runInNewContext(await readFile(new URL('background.js', directory), 'utf8'), { chrome, URL, console }, { timeout: 3000 });
assert.equal(typeof handler, 'function');
const sender = { id: 'test-id', url: 'chrome-extension://test-id/popup.html' };
const invoke = (message, source = sender) => new Promise(resolve => {
  const keepOpen = handler({ namespace: 'ottertap', tabId: 7, ...message }, source, resolve);
  assert.equal(keepOpen, true, 'Reply channels must stay open synchronously for Chromium compatibility');
});
const request = message => invoke(message);
assert.equal(handler({ namespace: 'ottertap', type: 'read', tabId: 7 }, { id: 'other-extension' }, () => assert.fail('untrusted sender')), undefined);
assert.equal(handler({ namespace: 'ottertap', type: 'unknown', tabId: 7 }, sender, () => assert.fail('unknown message')), undefined);
await invoke({ type: 'register' }, { id: 'test-id', tab: { id: 7 }, frameId: 4 });
let result = await request({ type: 'read' });
assert.equal(result.media.length, 2);
assert.equal(result.media[1].id, '4:1');
await request({ type: 'command', id: '4:1', command: { type: 'rate', value: 1.5 } });
assert.equal(commands.at(-1).options.frameId, 4);
assert.equal(commands.at(-1).message.id, '1');
applySettings({ ...settings, siteMode: 'exclude', sites: ['bilibili.com'] });
assert.equal((await request({ type: 'read' })).enabled, false);
assert.equal((await request({ type: 'read' })).media.length, 0);
const count = commands.length;
assert.ok((await request({ type: 'command', id: '4:1', command: { type: 'play' } })).error);
assert.equal(commands.length, count);
applySettings({ ...settings, siteMode: 'all' });
assert.equal((await request({ type: 'command', id: '4:1', command: { type: 'volume', value: 2 } })).ok, true);
assert.equal(commands.at(-1).message.command.value, 2);
assert.ok((await request({ type: 'command', id: '4:1', command: { type: 'volume', value: 2.01 } })).error);
let releaseHold = () => {};
holdCommand = new Promise(resolve => { releaseHold = resolve; });
const queued = commands.length;
const earlier = request({ type: 'command', id: '4:1', command: { type: 'volume', value: 0.4 } });
for (let attempt = 0; attempt < 30 && commands.length === queued; attempt += 1) await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(commands.length, queued + 1);
assert.equal(commands.at(-1).message.command.value, 0.4);
const later = request({ type: 'command', id: '4:1', command: { type: 'volume', value: 0.9 } });
await new Promise(resolve => setTimeout(resolve, 20));
assert.equal(commands.length, queued + 1, 'A later command must wait until the earlier one finishes');
releaseHold();
holdCommand = null;
assert.equal((await earlier).ok, true);
assert.equal((await later).ok, true);
assert.equal(commands[queued].message.command.value, 0.4);
assert.equal(commands[queued + 1].message.command.value, 0.9);
failCommands = 1;
const failed = request({ type: 'command', id: '4:1', command: { type: 'volume', value: 0.3 } });
const followed = request({ type: 'command', id: '4:1', command: { type: 'volume', value: 0.6 } });
assert.ok((await failed).error);
assert.equal((await followed).ok, true);
assert.equal(commands.at(-2).message.command.value, 0.3);
assert.equal(commands.at(-1).message.command.value, 0.6);
updated(7, { status: 'loading' });
assert.equal((await request({ type: 'read' })).media.length, 1);
removed(7);
tabUrl = undefined;
assert.ok((await request({ type: 'read' })).error);
console.log('OtterTap branding, RGBA icons, settings storage, MV3 manifest, iframe routing, sender validation, command order and website rules passed.');
