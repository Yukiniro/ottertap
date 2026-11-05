#!/usr/bin/env node
// OtterTap verification session. From the repo root:
//   node .cursor/skills/verify-ottertap/scripts/session.mjs launch
//   node .cursor/skills/verify-ottertap/scripts/session.mjs doctor
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive popup-playback
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive skip-step
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive skip-with-rate
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive volume-step
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive fine-wheel
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive coarse-step
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive rate-step
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive extension-pip
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive default-rate
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive hold-boost
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive hold-skip-combo
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive frame-step
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive hotkey-remap
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-speed
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-playback
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-entry-note
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-open-panel
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-while-playing
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-hidden-sites
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive wheel-direction
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive fullscreen-wheel
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive sidebar-ignore
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-memory-filter
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-sites-filter
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-floating-hidden-filter
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-current-site
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-clear-remembered
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive horizontal-mirror
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive progress-mark
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive mute-other-tabs
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive mirror-mark-commands
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive mirror-mark-feedback
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive auto-follow-playing
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive selection-highlight
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive prev-next-media
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive panel-media-list
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive float-prev-next
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive float-pip
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive page-pip
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-feedback
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-active
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-away-tab
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-hide
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-scroll
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-exit
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-excluded-sites
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-feedback
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive resume-save
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive sleep-timer
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive sleep-timer-cancel
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive sleep-timer-hints
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive remaining-at-rate
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-sleep-note
//   node .cursor/skills/verify-ottertap/scripts/session.mjs cleanup

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { openSync, closeSync, readFileSync, readlinkSync, readdirSync, unlinkSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const extensionPath = path.join(root, '.output', 'chrome-mv3');
const evidenceRoot = '/opt/cursor/artifacts/verify-ottertap';
const stateRoot = '/tmp/ottertap-verify';
const host = 'media.ottertap.test';
const origin = `https://${host}`;
const fixturePath = '/video';
const supportedFeatures = ['popup-playback', 'wheel-volume', 'skip-step', 'skip-with-rate', 'volume-step', 'fine-wheel', 'coarse-step', 'rate-step', 'extension-pip', 'default-rate', 'hold-boost', 'hold-skip-combo', 'frame-step', 'hotkey-remap', 'floating-speed', 'floating-playback', 'floating-entry-note', 'floating-open-panel', 'floating-while-playing', 'floating-hidden-sites', 'wheel-direction', 'fullscreen-wheel', 'sidebar-ignore', 'settings-memory-filter', 'settings-sites-filter', 'settings-floating-hidden-filter', 'settings-current-site', 'settings-clear-remembered', 'horizontal-mirror', 'progress-mark', 'mute-other-tabs', 'mirror-mark-commands', 'mirror-mark-feedback', 'auto-follow-playing', 'selection-highlight', 'prev-next-media', 'panel-media-list', 'float-prev-next', 'float-pip', 'page-pip', 'pip-feedback', 'pip-active', 'pip-away-tab', 'pip-auto-hide', 'pip-auto-scroll', 'pip-auto-exit', 'pip-auto-excluded-sites', 'pip-auto-feedback', 'resume-save', 'sleep-timer', 'sleep-timer-cancel', 'sleep-timer-hints', 'sleep-hotkeys', 'remaining-at-rate', 'floating-sleep-note'];

const id = sessionId();
const stateDir = path.join(stateRoot, id);
const profileDir = path.join(stateDir, 'profile');
const sessionPath = path.join(stateDir, 'session.json');
const logPath = path.join(stateDir, 'launch.log');

function sessionId() {
  const raw = process.env.OTTERTAP_VERIFY_ID || 'current';
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(raw)) throw new Error(`OTTERTAP_VERIFY_ID 只能是小写字母、数字和连字符：${raw}`);
  return raw;
}

function evidenceDir(feature) {
  return path.join(evidenceRoot, id === 'current' ? feature : `${id}-${feature}`);
}

function cmdline(pid) {
  try { return readFileSync(`/proc/${pid}/cmdline`).toString('utf8').replaceAll('\0', ' '); }
  catch { return ''; }
}

function alive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error?.code === 'EPERM'; }
}

function descendantPids(pid) {
  const result = [];
  const walk = current => {
    let raw = '';
    try { raw = readFileSync(`/proc/${current}/task/${current}/children`, 'utf8'); }
    catch { return; }
    for (const part of raw.trim().split(/\s+/)) {
      if (!part) continue;
      const child = Number(part);
      result.push(child);
      walk(child);
    }
  };
  walk(pid);
  return result;
}

function pidsUsingProfile(profile) {
  const found = [];
  let entries = [];
  try { entries = readdirSync('/proc'); }
  catch { return found; }
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = Number(entry);
    if (cmdline(pid).includes(profile)) found.push(pid);
  }
  return found;
}

function listeningInodes(port) {
  const hex = port.toString(16).toUpperCase().padStart(4, '0');
  const inodes = new Set();
  for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
    let text = '';
    try { text = readFileSync(file, 'utf8'); }
    catch { continue; }
    for (const line of text.split('\n').slice(1)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 10) continue;
      const portHex = parts[1]?.split(':')[1];
      if (portHex === hex && parts[3] === '0A') inodes.add(parts[9]);
    }
  }
  return inodes;
}

function pidListens(pid, port) {
  const inodes = listeningInodes(port);
  let fds = [];
  try { fds = readdirSync(`/proc/${pid}/fd`); }
  catch { return false; }
  for (const fd of fds) {
    let link = '';
    try { link = readlinkSync(`/proc/${pid}/fd/${fd}`); }
    catch { continue; }
    const match = /^socket:\[(\d+)\]$/.exec(link);
    if (match && inodes.has(match[1])) return true;
  }
  return false;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2));
  await rename(temporary, file);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function silentWav(seconds = 1) {
  const samples = 8000 * seconds;
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) bytes[offset + index] = value.charCodeAt(index);
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples * 2, true);
  return `data:audio/wav;base64,${Buffer.from(bytes).toString('base64')}`;
}

const wav = silentWav();
const longWav = silentWav(120);

function toneWav() {
  const rate = 8000;
  const frames = rate;
  const bytes = new Uint8Array(44 + frames * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) bytes[offset + index] = value.charCodeAt(index);
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + frames * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, frames * 2, true);
  for (let frame = 0; frame < frames; frame += 1) {
    view.setInt16(44 + frame * 2, Math.round(Math.sin((2 * Math.PI * 440 * frame) / rate) * 0.5 * 32767), true);
  }
  return `data:audio/wav;base64,${Buffer.from(bytes).toString('base64')}`;
}

const tone = toneWav();

function tonePage(title) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body style="min-height:100vh;margin:0;background:#f4f1ea"><audio id="media" aria-label="${title}" src="${tone}" preload="auto" loop></audio></body></html>`;
}

function fixtureHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>OtterTap fixture</title></head><body style="min-height:100vh;margin:0;background:#f4f1ea"><video id="media" aria-label="Fixture video" src="${wav}" preload="auto" playsinline loop controls style="display:block;width:640px;height:360px;margin:48px"></video></body></html>`;
}

function routedHtml(pathname) {
  if (pathname === '/video') return fixtureHtml();
  if (pathname === '/keys') return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>OtterTap fixture</title></head><body style="min-height:100vh;margin:0;background:#f4f1ea"><video id="media" src="${wav}" preload="auto" playsinline style="display:block;width:640px;height:360px;margin:24px"></video><input id="field" aria-label="Field" style="margin-top:1200px"></body></html>`;
  if (pathname === '/long') return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>OtterTap fixture</title></head><body style="min-height:100vh;margin:0;background:#f4f1ea"><video id="media" aria-label="Long video" src="${longWav}" preload="auto" playsinline style="display:block;width:640px;height:360px;margin:48px"></video></body></html>`;
  if (pathname === '/feed') return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>OtterTap fixture</title></head><body style="min-height:100vh;margin:0;background:#f4f1ea"><video id="preview" aria-label="Feed preview" src="${wav}" preload="auto" playsinline loop style="display:block;width:240px;height:135px;margin:24px"></video><video id="media" aria-label="Main player" src="${wav}" preload="auto" playsinline loop style="display:block;width:640px;height:360px;margin:24px"></video><div style="height:1600px"></div></body></html>`;
  if (pathname === '/cards') return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>OtterTap fixture</title></head><body style="min-height:100vh;margin:0;background:#f4f1ea"><video id="card" aria-label="Feed card" src="${wav}" preload="auto" playsinline loop style="display:block;width:240px;height:135px;margin:24px"></video><div style="height:1600px"></div></body></html>`;
  if (pathname === '/audio') return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>OtterTap fixture</title></head><body style="min-height:100vh;margin:0;background:#f4f1ea"><audio id="media" aria-label="Fixture audio" src="${wav}" preload="auto"></audio></body></html>`;
  if (pathname === '/mixed') return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>OtterTap fixture</title></head><body style="min-height:100vh;margin:0;background:#f4f1ea"><video id="media" aria-label="Fixture video" src="${wav}" preload="auto" playsinline loop style="display:block;width:640px;height:360px;margin:48px"></video><audio id="clip" aria-label="Fixture audio" src="${wav}" preload="auto"></audio></body></html>`;
  if (pathname === '/playlist') return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Playlist page</title></head><body style="min-height:100vh;margin:0;background:#f4f1ea"><video id="alpha" title="Alpha reel" src="${wav}" preload="auto" playsinline style="display:block;width:160px;height:90px;margin:8px"></video><video id="beta" title="Beta reel" src="${wav}" preload="auto" playsinline style="display:block;width:160px;height:90px;margin:8px"></video><video id="gamma" title="Gamma reel" src="${wav}" preload="auto" playsinline style="display:block;width:160px;height:90px;margin:8px"></video><video id="delta" src="delta-reel.mp4" preload="none" style="display:block;width:160px;height:90px;margin:8px"></video><video id="echo" preload="none" style="display:block;width:160px;height:90px;margin:8px"></video></body></html>`;
  if (pathname === '/pip-off') return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>OtterTap fixture</title></head><body style="min-height:100vh;margin:0;background:#f4f1ea"><video id="media" aria-label="Fixture video" src="${wav}" preload="auto" playsinline disablepictureinpicture style="display:block;width:640px;height:360px;margin:48px"></video></body></html>`;
  if (pathname === '/unseekable') return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Unseekable</title></head><body style="min-height:100vh;margin:0;background:#f4f1ea"><video id="media" aria-label="Unseekable video" preload="none" style="display:block;width:640px;height:360px;margin:48px"></video></body></html>`;
  if (pathname === '/silent') return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>No media</title></head><body style="min-height:100vh;margin:0;background:#f4f1ea"><p>Plain text page.</p></body></html>`;
  if (pathname === '/tone-current') return tonePage('Current show');
  if (pathname === '/tone-music') return tonePage('Music tab');
  if (pathname === '/tone-meeting') return tonePage('Meeting tab');
  if (pathname === '/chat') return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>OtterTap fixture</title></head><body style="min-height:100vh;margin:0;background:#f4f1ea"><div id="stage" style="position:relative;width:960px;height:540px;margin:24px"><video id="media" aria-label="Main player" src="${wav}" preload="auto" playsinline loop style="display:block;width:960px;height:540px;background:#111"></video><div id="chat" data-test-selector="chat-scrollable-area__message-container" class="chat-scrollable-area__message-container" style="position:absolute;top:0;right:0;width:280px;height:540px;overflow:auto;z-index:2;background:#fff;color:#111"><div style="height:2400px;padding:12px">live chat</div></div><aside id="outline" class="VPDocAside" style="position:absolute;top:16px;left:16px;width:180px;height:160px;overflow:auto;z-index:2;background:#fff;color:#111"><div style="height:800px;padding:8px">outline</div></aside><div id="overlay" style="position:absolute;left:16px;bottom:16px;width:140px;height:64px;z-index:2;background:#ddd">notes</div></div></body></html>`;
  return null;
}

async function packageVersion() {
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  return manifest.version;
}

async function backgroundMtime() {
  return (await stat(path.join(extensionPath, 'background.js'))).mtimeMs;
}

async function assertBuild() {
  try { await stat(path.join(extensionPath, 'manifest.json')); }
  catch { throw new Error('没有 .output/chrome-mv3。先在仓库根目录运行 pnpm build'); }
  const manifest = JSON.parse(await readFile(path.join(extensionPath, 'manifest.json'), 'utf8'));
  if (manifest.manifest_version !== 3) throw new Error(`构建产物不是 MV3：${manifest.manifest_version}`);
  const version = await packageVersion();
  if (manifest.version !== version) throw new Error(`构建版本 ${manifest.version} 与 package.json ${version} 不一致，重新 pnpm build`);
}

async function serviceWorker(context) {
  return context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 20_000 });
}

/** Every key OtterTap writes to extension storage. A key outside this list means a feature persisted something it should not. */
const knownStorageKeys = { local: ['ottertap-settings-v1'], localPrefix: 'ottertap-resume-v1:', session: ['ottertap-frames-v1', 'ottertap-holds-v1'] };

async function unknownStorageKeys(worker) {
  const { local, session } = await worker.evaluate(async () => {
    let session = [];
    try { session = Object.keys(await chrome.storage.session.get(null)); } catch { session = []; }
    return { local: Object.keys(await chrome.storage.local.get(null)), session };
  });
  return [
    ...local.filter(key => !knownStorageKeys.local.includes(key) && !key.startsWith(knownStorageKeys.localPrefix)).map(key => `local:${key}`),
    ...session.filter(key => !knownStorageKeys.session.includes(key)).map(key => `session:${key}`)
  ];
}

async function openFixture(context) {
  const page = await context.newPage();
  const response = await page.goto(`${origin}${fixturePath}`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  if (!response?.ok()) throw new Error(`${fixturePath} 没有被会话拦截，status=${response?.status()}`);
  const toggle = page.getByRole('button', { name: /volume pill/i });
  try {
    await toggle.waitFor({ state: 'visible', timeout: 15_000 });
  } catch (error) {
    const labels = await page.locator('button').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label'))).catch(() => []);
    throw new Error(`页面上没有英语浮动入口。按钮：${JSON.stringify(labels)}。${error instanceof Error ? error.message : error}`);
  }
  await page.locator('#media').evaluate(element => element.readyState).then(async state => {
    if (state >= 1) return;
    await page.waitForFunction(() => document.querySelector('#media')?.readyState >= 1, null, { timeout: 8_000 });
  });
  return page;
}

const popupView = `(() => {
  const button = [...document.querySelectorAll('button')].find(item => {
    const label = item.getAttribute('aria-label');
    return label === 'Play' || label === 'Pause';
  });
  const statusNode = [...document.querySelectorAll('p')].find(item => {
    const text = item.textContent?.trim();
    return text === 'Video · Playing' || text === 'Video · Paused';
  });
  return {
    button: button?.getAttribute('aria-label') ?? '',
    heading: document.querySelector('h1')?.textContent?.trim() ?? '',
    status: statusNode?.textContent?.trim() ?? '',
    alert: document.querySelector('[role="alert"]')?.textContent?.trim() ?? '',
    region: Boolean(document.querySelector('[aria-label="Media controls"]')),
  };
})()`;

function clickLabel(label) {
  return `(() => {
    const button = [...document.querySelectorAll('button')].find(item => item.getAttribute('aria-label') === ${JSON.stringify(label)});
    if (!button) return false;
    button.click();
    return true;
  })()`;
}

async function openActionPopup(context, fixture, options = {}) {
  const timeout = options.timeout ?? 8_000;
  await fixture.bringToFront();
  const cdp = await context.newCDPSession(fixture);
  if (!options.alreadyOpen) {
    const worker = await serviceWorker(context);
    await worker.evaluate(async () => { await chrome.action.openPopup(); });
  }
  let targetId = '';
  let targets = [];
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const listed = await cdp.send('Target.getTargets');
    targets = listed.targetInfos ?? [];
    targetId = targets.find(item => item.type === 'page' && item.url.endsWith('/popup.html'))?.targetId ?? '';
    if (targetId) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!targetId) {
    await cdp.detach().catch(() => {});
    if (options.alreadyOpen) return null;
    const brief = targets.map(item => ({ type: item.type, url: item.url }));
    throw new Error(`chrome.action.openPopup() 没有打开 popup.html。targets=${JSON.stringify(brief)}。不要改用地址栏打开 popup.html，那会把弹出面板变成活动标签。`);
  }
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: false });
  let next = 1;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = next++;
    const timer = setTimeout(() => {
      cdp.off('Target.receivedMessageFromTarget', onMessage);
      reject(new Error(`弹出面板没有响应 ${method}`));
    }, 8_000);
    const onMessage = event => {
      if (event.sessionId !== sessionId) return;
      const message = JSON.parse(event.message);
      if (message.id !== id) return;
      clearTimeout(timer);
      cdp.off('Target.receivedMessageFromTarget', onMessage);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    };
    cdp.on('Target.receivedMessageFromTarget', onMessage);
    void cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) });
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'popup evaluate failed');
    return result.result?.value;
  };
  const screenshot = async file => {
    const result = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(file, Buffer.from(result.data, 'base64'));
  };
  const view = await poll(() => evaluate(popupView), value => value?.region && (options.empty || value.button), options.empty ? '弹出面板应出现 Media controls' : '弹出面板应出现 Media controls 和播放按钮');
  return {
    evaluate,
    view: () => evaluate(popupView),
    click: async label => {
      const clicked = await evaluate(clickLabel(label));
      if (!clicked) throw new Error(`弹出面板里没有按钮 ${label}：${JSON.stringify(await evaluate(popupView))}`);
    },
    screenshot,
    seen: view,
    close: async () => {
      try {
        await cdp.send('Target.closeTarget', { targetId });
        await poll(async () => (await cdp.send('Target.getTargets')).targetInfos.some(item => item.targetId === targetId), value => !value, '旧弹出面板应已关闭');
      } finally { await cdp.detach().catch(() => {}); }
    },
  };
}

async function mediaState(page) {
  return page.locator('#media').evaluate(element => ({
    paused: element.paused,
    ended: element.ended,
    currentTime: element.currentTime,
    readyState: element.readyState,
  }));
}

async function poll(read, check, label, timeout = 8_000) {
  const start = Date.now();
  let last;
  let failure;
  while (Date.now() - start < timeout) {
    try {
      last = await read();
      if (check(last)) return last;
    } catch (error) { failure = error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const detail = failure instanceof Error ? failure.message : JSON.stringify(last);
  throw new Error(`${label}：${detail}`);
}

async function centerOf(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${await locator.evaluate(element => element.id || element.tagName)} 没有位置`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function driveWheelVolume(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const page = await context.newPage();
  const readMedia = selector => page.locator(selector).evaluate(element => ({ paused: element.paused, muted: element.muted, volume: element.volume }));
  const play = (selector, muted, volume) => page.locator(selector).evaluate(async (element, options) => {
    element.muted = true;
    await element.play();
    element.muted = options.muted;
    element.volume = options.volume;
  }, { muted, volume });
  try {
    await page.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
    const toggle = page.getByRole('switch', { name: 'Scroll over the main player to change volume' });
    await toggle.waitFor({ state: 'visible', timeout: 15_000 });
    if (await toggle.getAttribute('aria-checked') !== 'true') throw new Error('悬停滚轮默认应开启');
    await toggle.scrollIntoViewIfNeeded();
    const row = toggle.locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
    await row.screenshot({ path: path.join(dir, 'settings-hover-after.png'), animations: 'disabled' });
    await row.screenshot({ path: path.join(evidenceRoot, 'settings-hover-toggle-after.png'), animations: 'disabled' });
    note('settings toggle says main player and is on');

    await page.goto(`${origin}/feed`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await play('#preview', true, 1);
    await play('#media', false, 0.5);
    await poll(() => readMedia('#preview'), value => value.paused === false && value.muted === true, '预览应静音播放');
    await poll(() => readMedia('#media'), value => value.paused === false && value.muted === false && Math.abs(value.volume - 0.5) < 0.02, '主播放器应有声播放');
    await page.evaluate(() => window.scrollTo(0, 0));
    const previewAt = await centerOf(page.locator('#preview'));
    await page.mouse.move(previewAt.x, previewAt.y);
    await page.screenshot({ path: path.join(dir, 'feed-preview-before.png'), animations: 'disabled' });
    await page.mouse.wheel(0, 120);
    const previewScroll = await poll(() => page.evaluate(() => window.scrollY), value => value > 0, '静音预览上滚轮应滚动页面');
    const afterPreview = { preview: await readMedia('#preview'), main: await readMedia('#media'), scrollY: previewScroll };
    if (Math.abs(afterPreview.preview.volume - 1) > 0.02 || Math.abs(afterPreview.main.volume - 0.5) > 0.02) throw new Error(`静音预览改变了音量 ${JSON.stringify(afterPreview)}`);
    await page.screenshot({ path: path.join(dir, 'feed-preview-scrolled.png'), animations: 'disabled' });
    note(`muted preview scrolled to ${previewScroll} without changing volume`);

    await page.evaluate(() => window.scrollTo(0, 0));
    const mainAt = await centerOf(page.locator('#media'));
    await page.mouse.move(mainAt.x, mainAt.y);
    await page.waitForTimeout(300);
    await page.mouse.wheel(0, -100);
    const mainVolume = await poll(() => page.locator('#media').evaluate(element => element.volume), value => Math.abs(value - 0.6) < 0.02, '有声主播放器上裸滚轮应调音量');
    const mainScroll = await page.evaluate(() => window.scrollY);
    if (mainScroll !== 0) throw new Error(`主播放器上滚轮滚动了页面 scrollY=${mainScroll}`);
    await page.screenshot({ path: path.join(dir, 'feed-main-after.png'), animations: 'disabled' });
    note(`main player volume ${mainVolume} scrollY ${mainScroll}`);

    await page.goto(`${origin}/cards`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await play('#card', false, 0.5);
    await poll(() => readMedia('#card'), value => value.paused === false && value.muted === false && Math.abs(value.volume - 0.5) < 0.02, '小卡片应有声播放');
    await page.evaluate(() => window.scrollTo(0, 0));
    const cardAt = await centerOf(page.locator('#card'));
    await page.mouse.move(cardAt.x, cardAt.y);
    await page.screenshot({ path: path.join(dir, 'cards-before.png'), animations: 'disabled' });
    await page.mouse.wheel(0, 120);
    const cardScroll = await poll(() => page.evaluate(() => window.scrollY), value => value > 0, '小卡片上裸滚轮应滚动页面');
    const cardVolume = await page.locator('#card').evaluate(element => element.volume);
    if (Math.abs(cardVolume - 0.5) > 0.02) throw new Error(`小卡片改变了音量 ${cardVolume}`);
    await page.screenshot({ path: path.join(dir, 'cards-scrolled.png'), animations: 'disabled' });
    note(`small card scrolled to ${cardScroll} volume ${cardVolume}`);
    await page.evaluate(() => window.scrollTo(0, 0));
    const cardAltAt = await centerOf(page.locator('#card'));
    await page.mouse.move(cardAltAt.x, cardAltAt.y);
    await page.keyboard.down('Alt');
    try { await page.mouse.wheel(0, -100); }
    finally { await page.keyboard.up('Alt'); }
    const cardAlt = await poll(() => page.locator('#card').evaluate(element => element.volume), value => Math.abs(value - 0.6) < 0.02, '小卡片上 Alt+滚轮仍应调音量');
    const cardAltScroll = await page.evaluate(() => window.scrollY);
    if (cardAltScroll !== 0) throw new Error(`小卡片上 Alt+滚轮滚动了页面 scrollY=${cardAltScroll}`);
    note(`small card alt volume ${cardAlt} scrollY ${cardAltScroll}`);

    await page.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
    const off = page.getByRole('switch', { name: 'Scroll over the main player to change volume' });
    await off.waitFor({ state: 'visible', timeout: 15_000 });
    await off.click();
    await poll(() => off.getAttribute('aria-checked'), value => value === 'false', '应能关闭悬停滚轮');
    note('hover wheel turned off');
    await page.goto(`${origin}/keys`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#media').evaluate(element => { element.volume = 0.5; });
    const keysAt = await centerOf(page.locator('#media'));
    await page.mouse.move(keysAt.x, keysAt.y);
    await page.mouse.wheel(0, -100);
    await new Promise(resolve => setTimeout(resolve, 400));
    const bare = await page.locator('#media').evaluate(element => element.volume);
    if (Math.abs(bare - 0.5) > 0.02) throw new Error(`关闭后裸滚轮仍改了音量 ${bare}`);
    await page.keyboard.down('Alt');
    try { await page.mouse.wheel(0, -100); }
    finally { await page.keyboard.up('Alt'); }
    const alt = await poll(() => page.locator('#media').evaluate(element => element.volume), value => Math.abs(value - 0.6) < 0.02, '关闭悬停后 Alt+滚轮仍应调音量');
    note(`hover off bare ${bare} alt ${alt}`);
    const state = { ok: true, preview: afterPreview, main: { volume: mainVolume, scrollY: mainScroll }, card: { volume: cardVolume, scrollY: cardScroll, alt: cardAlt }, hoverOff: { bare, alt } };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally { await page.close(); }
}

async function driveSidebarIgnore(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const page = await context.newPage();
  const near = expected => value => Math.abs(value - expected) < 0.02;
  const volume = () => page.locator('#media').evaluate(element => element.volume);
  const chatScroll = () => page.locator('#chat').evaluate(element => element.scrollTop);
  const outlineScroll = () => page.locator('#outline').evaluate(element => element.scrollTop);
  const scrollY = () => page.evaluate(() => window.scrollY);
  try {
    await page.goto(`${origin}/chat`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
      element.muted = true;
      await element.play();
      element.muted = false;
      element.volume = 0.5;
    });
    await poll(async () => page.locator('#media').evaluate(element => ({ paused: element.paused, muted: element.muted, volume: element.volume })), value => value.paused === false && value.muted === false && near(0.5)(value.volume), '主画面应有声播放');
    const stage = await page.locator('#media').boundingBox();
    if (!stage || stage.width * 3 < 1280 || stage.height * 3 < 720) throw new Error(`主画面不够大 ${JSON.stringify(stage)}`);
    const chatAt = await centerOf(page.locator('#chat'));
    if (chatAt.x <= stage.x || chatAt.x >= stage.x + stage.width) throw new Error('聊天应盖在主画面上');
    await page.mouse.move(chatAt.x, chatAt.y);
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(dir, 'chat-before.png'), animations: 'disabled' });
    await page.mouse.wheel(0, 160);
    const chatMoved = await poll(chatScroll, value => value > 20, '聊天上的裸滚轮应滚动列表');
    const chatVolume = await volume();
    if (!near(0.5)(chatVolume)) throw new Error(`聊天上的裸滚轮改了音量 ${chatVolume}`);
    if (await scrollY() !== 0) throw new Error('聊天滚动时页面也动了');
    await page.screenshot({ path: path.join(dir, 'chat-scrolled.png'), animations: 'disabled' });
    note(`chat scrollTop ${chatMoved} volume ${chatVolume}`);

    const outlineAt = await centerOf(page.locator('#outline'));
    await page.mouse.move(outlineAt.x, outlineAt.y);
    await page.waitForTimeout(350);
    await page.mouse.wheel(0, 120);
    const outlineMoved = await poll(outlineScroll, value => value > 20, '大纲上的裸滚轮应滚动大纲');
    const outlineVolume = await volume();
    if (!near(0.5)(outlineVolume)) throw new Error(`大纲上的裸滚轮改了音量 ${outlineVolume}`);
    if (await chatScroll() !== chatMoved) throw new Error('大纲滚动带动了聊天');
    await page.screenshot({ path: path.join(dir, 'outline-scrolled.png'), animations: 'disabled' });
    note(`outline scrollTop ${outlineMoved} volume ${outlineVolume}`);

    await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
    await page.waitForTimeout(350);
    await page.mouse.wheel(0, -100);
    const playerVolume = await poll(volume, near(0.6), '主画面上的裸滚轮应调音量');
    if (await scrollY() !== 0) throw new Error('主画面上的滚轮滚动了页面');
    if (await chatScroll() !== chatMoved) throw new Error('主画面滚轮带动了聊天');
    await page.screenshot({ path: path.join(dir, 'player-after.png'), animations: 'disabled' });
    note(`player volume ${playerVolume}`);

    const overlayAt = await centerOf(page.locator('#overlay'));
    await page.mouse.move(overlayAt.x, overlayAt.y);
    await page.waitForTimeout(350);
    await page.mouse.wheel(0, -100);
    const overlayVolume = await poll(volume, near(0.7), '认不出的叠层仍应按主画面调音');
    await page.screenshot({ path: path.join(dir, 'overlay-after.png'), animations: 'disabled' });
    note(`overlay volume ${overlayVolume}`);

    const chatAltAt = await centerOf(page.locator('#chat'));
    await page.mouse.move(chatAltAt.x, chatAltAt.y);
    await page.waitForTimeout(350);
    await page.keyboard.down('Alt');
    try { await page.mouse.wheel(0, -100); }
    finally { await page.keyboard.up('Alt'); }
    const altVolume = await poll(volume, near(0.8), '聊天上的 Alt+滚轮仍应调音量');
    if (await chatScroll() !== chatMoved) throw new Error('Alt+滚轮滚动了聊天');
    await page.screenshot({ path: path.join(dir, 'chat-alt.png'), animations: 'disabled' });
    note(`chat alt volume ${altVolume}`);

    await page.waitForTimeout(350);
    await page.keyboard.down('Shift');
    try { await page.mouse.wheel(0, -100); }
    finally { await page.keyboard.up('Shift'); }
    const shiftVolume = await poll(volume, near(1), '聊天上的 Shift+滚轮仍应按粗调步长调音');
    if (await chatScroll() !== chatMoved) throw new Error('Shift+滚轮滚动了聊天');
    if (await scrollY() !== 0) throw new Error('修饰键滚轮滚动了页面');
    await page.screenshot({ path: path.join(dir, 'chat-shift.png'), animations: 'disabled' });
    note(`chat shift volume ${shiftVolume}`);
    const state = { ok: true, chat: { scrollTop: chatMoved, volume: chatVolume }, outline: { scrollTop: outlineMoved, volume: outlineVolume }, player: playerVolume, overlay: overlayVolume, alt: altVolume, shift: shiftVolume };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally { await page.close(); }
}

async function drivePopupPlayback(context, dir, note) {
  await mkdir(dir, { recursive: true });
  const fixture = await openFixture(context);
  try {
    await fixture.screenshot({ path: path.join(dir, 'fixture-ready.png'), animations: 'disabled' });
    note('fixture ready, floating controller visible');
    const popup = await openActionPopup(context, fixture);
    try {
      const beforeMedia = await mediaState(fixture);
      const opened = await popup.view();
      const before = {
        paused: beforeMedia.paused,
        button: opened.button,
        status: opened.status,
        heading: opened.heading,
        currentTime: beforeMedia.currentTime,
      };
      if (!before.paused || before.button !== 'Play' || before.status !== 'Video · Paused' || before.heading !== 'Fixture video') {
        throw new Error(`打开面板时期望暂停：${JSON.stringify(before)}`);
      }
      await popup.screenshot(path.join(dir, 'popup-paused.png'));
      note(`before ${JSON.stringify(before)}`);
      await popup.click('Play');
      const playing = await poll(async () => ({ media: await mediaState(fixture), popup: await popup.view() }), value => value.media.paused === false && value.popup.button === 'Pause' && value.popup.status === 'Video · Playing' && !value.popup.alert, '点击 Play 后弹出面板和视频都应进入播放');
      const advanced = await poll(async () => mediaState(fixture), media => media.paused === false && media.currentTime > playing.media.currentTime + 0.05, '播放中 currentTime 应前进');
      await popup.screenshot(path.join(dir, 'popup-playing.png'));
      await fixture.screenshot({ path: path.join(dir, 'fixture-playing.png'), animations: 'disabled' });
      note(`playing currentTime=${advanced.currentTime}`);
      await popup.click('Pause');
      const paused = await poll(async () => ({ media: await mediaState(fixture), popup: await popup.view() }), value => value.media.paused === true && value.popup.button === 'Play' && value.popup.status === 'Video · Paused', '点击 Pause 后应回到暂停');
      const heldAt = paused.media.currentTime;
      await new Promise(resolve => setTimeout(resolve, 400));
      const later = await mediaState(fixture);
      if (!later.paused || later.currentTime > heldAt + 0.25) throw new Error(`暂停后进度仍在走：${JSON.stringify(later)} held=${heldAt}`);
      const state = {
        ok: true,
        feature: 'popup-playback',
        fixture: `${origin}${fixturePath}`,
        before,
        playing: { paused: false, button: 'Pause', status: 'Video · Playing', currentTime: advanced.currentTime },
        afterPause: { paused: true, button: 'Play', status: 'Video · Paused', currentTime: later.currentTime },
      };
      await writeFile(path.join(dir, 'state.json'), JSON.stringify(state, null, 2));
      note('paused again, currentTime held');
      return state;
    } finally {
      await popup.close().catch(() => {});
    }
  } finally {
    await fixture.close().catch(() => {});
  }
}

const skipButtons = `[...document.querySelectorAll('button')].filter(item => /^(Back|Forward) \\d+ seconds$/.test(item.getAttribute('aria-label') ?? '')).map(item => ({ name: item.getAttribute('aria-label'), disabled: item.disabled, badge: item.textContent?.trim() }))`;

async function driveSkipStep(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const near = expected => value => Math.abs(value - expected) < 0.05;

  const openLong = async () => {
    const fixture = await context.newPage();
    await fixture.goto(`${origin}/long`, { waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await fixture.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
      element.currentTime = 60;
    });
    const time = () => fixture.locator('#media').evaluate(element => element.currentTime);
    const duration = await fixture.locator('#media').evaluate(element => element.duration);
    if (!(duration > 100)) throw new Error(`/long 的时长应约 120 秒：${duration}`);
    await poll(time, near(60), '起点应是 60 秒');
    return { fixture, time };
  };
  const popupSkip = async (fixture, time, step, shot) => {
    const popup = await openActionPopup(context, fixture);
    try {
      const buttons = await popup.evaluate(skipButtons);
      const names = [`Back ${step} seconds`, `Forward ${step} seconds`];
      if (JSON.stringify(buttons.map(item => item.name)) !== JSON.stringify(names) || buttons.some(item => item.disabled || item.badge !== String(step))) {
        throw new Error(`弹出面板进退按钮应是 ${step} 秒：${JSON.stringify(buttons)}`);
      }
      await popup.screenshot(path.join(dir, shot));
      await popup.click(names[1]);
      await poll(time, near(60 + step), `${names[1]} 后应到 ${60 + step} 秒`);
      await popup.click(names[0]);
      await poll(time, near(60), `${names[0]} 后应回到 60 秒`);
      note(`popup ${names[1]} / ${names[0]} moved 60 -> ${60 + step} -> 60`);
      return buttons;
    } finally { await popup.close().catch(() => {}); }
  };

  const base = await openLong();
  let defaultButtons;
  try {
    defaultButtons = await popupSkip(base.fixture, base.time, 10, 'popup-10.png');
    await base.fixture.bringToFront();
    await base.fixture.mouse.click(1000, 600);
    await base.fixture.keyboard.press('l');
    await new Promise(resolve => setTimeout(resolve, 500));
    const idle = await base.time();
    if (!near(60)(idle)) throw new Error(`单键模式关着时 L 不应跳秒：${idle}`);
    note('single-key mode off: L left currentTime at 60');
  } finally { await base.fixture.close(); }

  const settings = await context.newPage();
  try {
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    const group = settings.getByRole('group', { name: 'Skip step' });
    await group.waitFor({ state: 'visible', timeout: 15_000 });
    const steps = await group.getByRole('button').allInnerTexts();
    const pressedBefore = await group.locator('[aria-pressed="true"]').allInnerTexts();
    if (steps.join() !== '5s,10s,15s,30s' || pressedBefore.join() !== '10s') throw new Error(`步长默认值或档位不对：${JSON.stringify({ steps, pressedBefore })}`);
    await settings.getByText('Popup buttons, the on-page floater, page shortcuts, and browser shortcuts all jump by this step.', { exact: true }).waitFor({ state: 'visible' });
    await group.screenshot({ path: path.join(dir, 'settings-default.png'), animations: 'disabled' });
    note(`settings Skip step steps=${steps} pressed=${pressedBefore}`);

    const target = group.getByRole('button', { name: '30s', exact: true });
    await target.click();
    await poll(() => target.getAttribute('aria-pressed'), value => value === 'true', '点 30s 后应按下');
    const savedStep = await poll(stored, value => value.skipSeconds === 30, '设置里应存下 skipSeconds=30');
    await group.screenshot({ path: path.join(dir, 'settings-30.png'), animations: 'disabled' });
    note(`saved skipSeconds=${savedStep.skipSeconds}`);

    await settings.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
    const singleKey = settings.getByRole('switch', { name: 'Single-key mode' });
    await singleKey.waitFor({ state: 'visible', timeout: 15_000 });
    if (await singleKey.getAttribute('aria-checked') !== 'false') throw new Error('单键模式默认应关闭');
    await singleKey.click();
    await poll(() => singleKey.getAttribute('aria-checked'), value => value === 'true', '应能打开单键模式');
    await poll(stored, value => value.singleKey === true && value.skipSeconds === 30, '设置里应存下 singleKey=true');
    const back = settings.getByRole('term').filter({ hasText: /^J \/ ←$/ }).locator('xpath=following-sibling::dd');
    await poll(() => back.innerText(), value => value === 'Back 30 seconds', '快捷键说明应跟着步长变成 Back 30 seconds');
    note('single-key mode on, shortcut list says Back 30 seconds');
  } finally { await settings.close(); }

  const changed = await openLong();
  try {
    await changed.fixture.screenshot({ path: path.join(dir, 'fixture-start.png'), animations: 'disabled' });
    const popupButtons = await popupSkip(changed.fixture, changed.time, 30, 'popup-30.png');

    await changed.fixture.bringToFront();
    await changed.fixture.mouse.click(1000, 600);
    const keys = [];
    for (const [key, expected] of [['l', 90], ['j', 60], ['ArrowRight', 90], ['ArrowLeft', 60]]) {
      await changed.fixture.keyboard.press(key);
      keys.push({ key, currentTime: await poll(changed.time, near(expected), `${key} 后应在 ${expected} 秒`) });
    }
    note(`page keys ${JSON.stringify(keys)}`);

    const state = { ok: true, defaultButtons, popupButtons, keys };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally { await changed.fixture.close(); }
}

async function driveSkipWithRate(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const near = expected => value => Math.abs(value - expected) < 0.05;
  const scaleCopy = 'When on, each skip is the step times the current speed. A 10s step at 2× jumps about 20s. Speeds outside 0.5×-3× use those limits, and the hint shows the actual seconds.';

  const openLong = async rate => {
    const fixture = await context.newPage();
    await fixture.goto(`${origin}/long`, { waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await fixture.locator('#media').evaluate(async (element, nextRate) => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
      element.pause();
      element.currentTime = 60;
      element.playbackRate = nextRate;
    }, rate);
    const time = () => fixture.locator('#media').evaluate(element => element.currentTime);
    const speed = () => fixture.locator('#media').evaluate(element => element.playbackRate);
    await poll(time, near(60), '起点应是 60 秒');
    await poll(speed, value => Math.abs(value - rate) < 0.01, `倍速应是 ${rate}`);
    return { fixture, time, speed };
  };
  const retarget = async (page, rate) => {
    await page.fixture.locator('#media').evaluate((element, nextRate) => {
      element.pause();
      element.currentTime = 60;
      element.playbackRate = nextRate;
    }, rate);
    await poll(page.time, near(60), '起点应回到 60 秒');
    await poll(page.speed, value => Math.abs(value - rate) < 0.01, `倍速应改成 ${rate}`);
  };
  const popupSkip = async (fixture, time, step, from, shot) => {
    const popup = await openActionPopup(context, fixture);
    try {
      const buttons = await popup.evaluate(skipButtons);
      const names = [`Back ${step} seconds`, `Forward ${step} seconds`];
      if (JSON.stringify(buttons.map(item => item.name)) !== JSON.stringify(names) || buttons.some(item => item.disabled || item.badge !== String(step))) {
        throw new Error(`弹出面板进退按钮应是 ${step} 秒：${JSON.stringify(buttons)}`);
      }
      await popup.screenshot(path.join(dir, shot));
      await popup.click(names[1]);
      await poll(time, near(from + step), `${names[1]} 后应到 ${from + step} 秒`);
      await popup.click(names[0]);
      await poll(time, near(from), `${names[0]} 后应回到 ${from} 秒`);
      note(`popup ${names[1]} / ${names[0]} moved ${from} -> ${from + step} -> ${from}`);
      return buttons;
    } finally { await popup.close().catch(() => {}); }
  };
  const press = async (fixture, time, key, expected, hint, shot) => {
    const status = fixture.getByRole('status').filter({ hasText: hint }).first();
    const shown = status.waitFor({ state: 'visible', timeout: 4_000 });
    await fixture.keyboard.press(key);
    await shown;
    if (shot) await fixture.screenshot({ path: path.join(dir, shot), animations: 'disabled' });
    const currentTime = await poll(time, near(expected), `${key} 后应在 ${expected} 秒`);
    note(`${key} -> ${currentTime}, hint ${hint}`);
    return { key, currentTime, hint };
  };

  const off = await openLong(2);
  let offButtons;
  try {
    offButtons = await popupSkip(off.fixture, off.time, 10, 60, 'popup-off.png');
  } finally { await off.fixture.close(); }

  const settings = await context.newPage();
  try {
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    const toggle = settings.getByRole('switch', { name: 'Scale skip with speed' });
    await toggle.waitFor({ state: 'visible', timeout: 15_000 });
    if (await toggle.getAttribute('aria-checked') !== 'false') throw new Error('随倍速放大默认应关闭');
    await settings.getByText(scaleCopy, { exact: true }).waitFor({ state: 'visible' });
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-off.png'), animations: 'disabled' });
    await toggle.click();
    await poll(() => toggle.getAttribute('aria-checked'), value => value === 'true', '应能打开随倍速放大');
    await poll(stored, value => value.skipWithRate === true && value.skipSeconds === 10, '设置里应存下 skipWithRate=true，步长仍是 10');
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-on.png'), animations: 'disabled' });
    note('skipWithRate on, skipSeconds stays 10');

    await settings.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
    const singleKey = settings.getByRole('switch', { name: 'Single-key mode' });
    await singleKey.waitFor({ state: 'visible', timeout: 15_000 });
    if (await singleKey.getAttribute('aria-checked') !== 'false') throw new Error('单键模式默认应关闭');
    await singleKey.click();
    await poll(stored, value => value.singleKey === true && value.skipWithRate === true, '设置里应同时打开单键模式');
    note('single-key mode on');
  } finally { await settings.close(); }

  const on = await openLong(2);
  try {
    const onButtons = await popupSkip(on.fixture, on.time, 20, 60, 'popup-on.png');
    await on.fixture.bringToFront();
    await on.fixture.mouse.click(1000, 600);
    const keys = [
      await press(on.fixture, on.time, 'l', 80, 'Forward 20 seconds', 'toast-20.png'),
      await press(on.fixture, on.time, 'j', 60, 'Back 20 seconds')
    ];

    await retarget(on, 4);
    const clampedButtons = await popupSkip(on.fixture, on.time, 30, 60, 'popup-clamped.png');

    await retarget(on, 0.25);
    await on.fixture.bringToFront();
    await on.fixture.mouse.click(1000, 600);
    const slow = await press(on.fixture, on.time, 'j', 55, 'Back 5 seconds');

    const state = { ok: true, offButtons, onButtons, keys, clampedButtons, slow };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally { await on.fixture.close(); }
}

async function driveVolumeStep(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const near = expected => value => Math.abs(value - expected) < 0.02;
  const page = await context.newPage();
  let settings;
  const volume = () => page.locator('#media').evaluate(element => element.volume);
  const setVolume = async value => {
    await page.locator('#media').evaluate((element, next) => { element.volume = next; }, value);
    await poll(volume, near(value), `应能把音量设成 ${value}`);
  };
  const hoverUp = async () => {
    const at = await centerOf(page.locator('#media'));
    await page.mouse.move(at.x, at.y);
    await page.waitForTimeout(350);
    await page.mouse.wheel(0, -100);
  };
  const altUp = async () => {
    const at = await centerOf(page.locator('#media'));
    await page.mouse.move(at.x, at.y);
    await page.keyboard.down('Alt');
    try { await page.mouse.wheel(0, -100); }
    finally { await page.keyboard.up('Alt'); }
  };
  const shown = () => page.getByRole('slider', { name: 'Volume' }).getAttribute('aria-valuenow').then(value => Number(value));
  const openPill = async () => {
    const slider = page.getByRole('slider', { name: 'Volume' });
    if (!(await slider.isVisible())) {
      const toggle = page.getByRole('button', { name: /volume pill/i });
      const box = await toggle.boundingBox();
      if (!box) throw new Error('浮动入口没有位置');
      await page.mouse.move(box.x + Math.min(8, box.width / 4), box.y + box.height / 2);
      await toggle.click();
    }
    await slider.waitFor({ state: 'visible', timeout: 5_000 });
  };
  try {
    await page.goto(`${origin}/keys`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
    });
    await setVolume(0.5);
    await hoverUp();
    const afterDefault = await poll(volume, near(0.6), '默认步长下悬停滚轮一格应到 60%');
    await page.screenshot({ path: path.join(dir, 'fixture-10.png'), animations: 'disabled' });
    note(`default hover wheel volume=${afterDefault}`);

    settings = await context.newPage();
    try {
      await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
      const group = settings.getByRole('group', { name: 'Volume step' });
      await group.waitFor({ state: 'visible', timeout: 15_000 });
      const steps = await group.getByRole('button').allInnerTexts();
      const pressedBefore = await group.locator('[aria-pressed="true"]').allInnerTexts();
      if (steps.join() !== '5%,10%,20%' || pressedBefore.join() !== '10%') throw new Error(`音量步长默认值或档位不对：${JSON.stringify({ steps, pressedBefore })}`);
      await settings.getByText('The scroll wheel, single-key arrow keys, and browser extension commands all change volume by this step.', { exact: true }).waitFor({ state: 'visible' });
      await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-default.png'), animations: 'disabled' });
      await settings.locator('#playback').screenshot({ path: '/opt/cursor/artifacts/volume-step-ui/settings-playback-after.png', animations: 'disabled' });
      note(`settings Volume step steps=${steps} pressed=${pressedBefore}`);

      const five = group.getByRole('button', { name: '5%', exact: true });
      await five.click();
      await poll(() => five.getAttribute('aria-pressed'), value => value === 'true', '点 5% 后应按下');
      await poll(stored, value => value.volumeStep === 5, '设置里应存下 volumeStep=5');
      await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-5.png'), animations: 'disabled' });
      await settings.locator('#playback').screenshot({ path: '/opt/cursor/artifacts/volume-step-ui/settings-playback-5.png', animations: 'disabled' });
      note('saved volumeStep=5 without reloading the fixture');
    } finally { /* keep settings open so the fixture is not reloaded */ }

    await page.bringToFront();
    await hoverUp();
    const afterFive = await poll(volume, near(0.65), '改成 5% 后同一页悬停滚轮一格应到 65%');
    await page.screenshot({ path: path.join(dir, 'fixture-5.png'), animations: 'disabled' });
    note(`5% hover wheel volume=${afterFive}`);

    await settings.bringToFront();
    const twenty = settings.getByRole('group', { name: 'Volume step' }).getByRole('button', { name: '20%', exact: true });
    await twenty.click();
    await poll(() => twenty.getAttribute('aria-pressed'), value => value === 'true', '点 20% 后应按下');
    await poll(stored, value => value.volumeStep === 20, '设置里应存下 volumeStep=20');
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-20.png'), animations: 'disabled' });
    await settings.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
    const singleKey = settings.getByRole('switch', { name: 'Single-key mode' });
    if (await singleKey.getAttribute('aria-checked') !== 'false') throw new Error('单键模式默认应关闭');
    await singleKey.click();
    await poll(stored, value => value.singleKey === true && value.volumeStep === 20, '设置里应存下 singleKey=true 且 volumeStep=20');
    const upLabel = settings.getByRole('term').filter({ hasText: /^↑$/ }).locator('xpath=following-sibling::dd');
    await poll(() => upLabel.innerText(), value => value === 'Increase volume by 20 percentage points', '快捷键说明应跟着步长变成 20');
    note('single-key mode on, shortcut list says 20 percentage points');
    await settings.close();
    settings = undefined;

    await page.bringToFront();
    const at = await centerOf(page.locator('#media'));
    await page.mouse.move(at.x, at.y);
    await page.waitForTimeout(350);
    await altUp();
    const afterTwenty = await poll(volume, near(0.85), '20% 的 Alt+滚轮一格应到 85%');
    await page.screenshot({ path: path.join(dir, 'fixture-20.png'), animations: 'disabled' });
    note(`20% alt wheel volume=${afterTwenty}`);

    await page.keyboard.up('Alt');
    const arrowAt = await centerOf(page.locator('#media'));
    await page.mouse.click(arrowAt.x, arrowAt.y);
    await page.keyboard.press('ArrowDown');
    const afterDown = await poll(volume, near(0.65), '单键 ↓ 应按 20% 回到 65%');
    await page.keyboard.press('ArrowUp');
    const afterUp = await poll(volume, near(0.85), '单键 ↑ 应按 20% 回到 85%');
    note(`single-key arrows down=${afterDown} up=${afterUp}`);

    await setVolume(0.95);
    await page.waitForTimeout(400);
    await altUp();
    await openPill();
    const snapped = await poll(shown, value => value === 100, '从 95% 按 20% 向上应先停在 100%');
    await page.screenshot({ path: path.join(dir, 'fixture-snap-100.png'), animations: 'disabled' });
    await page.mouse.move(at.x, at.y);
    await altUp();
    const boosted = await poll(shown, value => value === 120, '停在 100% 后再按 20% 应到 120%');
    const capped = await volume();
    if (capped > 1.02) throw new Error(`媒体元素音量不应超过 1：${capped}`);
    await page.screenshot({ path: path.join(dir, 'fixture-snap-120.png'), animations: 'disabled' });
    note(`snap ${snapped} then ${boosted}, element volume ${capped}`);

    const state = {
      ok: true,
      defaultHover: afterDefault,
      step5: afterFive,
      step20: afterTwenty,
      arrows: { down: afterDown, up: afterUp },
      snap: { at100: snapped, at120: boosted, elementVolume: capped },
    };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await settings?.close().catch(() => {});
    await page.close().catch(() => {});
  }
}

async function driveFineWheel(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const near = expected => value => Math.abs(value - expected) < 0.02;
  const page = await context.newPage();
  let settings;
  let popup;
  const volume = () => page.locator('#media').evaluate(element => element.volume);
  const settle = async value => {
    await page.locator('#media').evaluate((element, next) => { element.volume = next; element.muted = false; }, value);
    await poll(volume, near(value), `应能把音量设成 ${value}`);
    await page.waitForTimeout(400);
  };
  const hoverUp = async () => {
    const at = await centerOf(page.locator('#media'));
    await page.mouse.move(at.x, at.y);
    await page.waitForTimeout(350);
    await page.mouse.wheel(0, -100);
  };
  const altUp = async () => {
    const at = await centerOf(page.locator('#media'));
    await page.mouse.move(at.x, at.y);
    await page.keyboard.down('Alt');
    try { await page.mouse.wheel(0, -100); }
    finally { await page.keyboard.up('Alt'); }
  };
  const shown = () => page.getByRole('slider', { name: 'Volume' }).getAttribute('aria-valuenow').then(value => Number(value));
  const openPill = async () => {
    const slider = page.getByRole('slider', { name: 'Volume' });
    if (!(await slider.isVisible())) {
      const toggle = page.getByRole('button', { name: /volume pill/i });
      const box = await toggle.boundingBox();
      if (!box) throw new Error('浮动入口没有位置');
      await page.mouse.move(box.x + Math.min(8, box.width / 4), box.y + box.height / 2);
      await toggle.click();
    }
    await slider.waitFor({ state: 'visible', timeout: 5_000 });
  };
  try {
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    const toggle = settings.getByRole('switch', { name: 'Finer wheel steps below 25%' });
    await toggle.waitFor({ state: 'visible', timeout: 15_000 });
    if (await toggle.getAttribute('aria-checked') !== 'true') throw new Error('低音量细档默认应开启');
    await settings.getByText('When volume is under 25%, hovering and Alt + wheel change it by 1% instead of the volume step. At 25% and above they use the volume step. Arrow keys, extension commands, and the volume slider stay as they are. On by default.', { exact: true }).waitFor({ state: 'visible' });
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-on.png'), animations: 'disabled' });
    note('fine wheel defaults on');

    await page.goto(`${origin}/keys`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
    });
    await settle(0.1);
    await hoverUp();
    const afterOne = await poll(volume, near(0.11), '10% 上悬停滚轮一格应到 11%');
    await openPill();
    const pill = await poll(shown, value => value === 11, '音量药丸应显示 11%');
    await page.screenshot({ path: path.join(dir, 'pill-11.png'), animations: 'disabled' });
    note(`fine hover volume=${afterOne} pill=${pill}`);
    popup = await openActionPopup(context, page);
    const popupPercent = await poll(() => popup.evaluate(`document.querySelector('input[aria-label="Volume"]')?.getAttribute('aria-valuenow') ?? null`), value => Number(value) === 11, '弹出面板音量应显示 11%');
    await popup.screenshot(path.join(dir, 'popup-11.png'));
    note(`popup volume=${popupPercent}`);
    await popup.close();
    popup = undefined;

    const burstAt = await centerOf(page.locator('#media'));
    await page.mouse.move(burstAt.x, burstAt.y);
    await page.waitForTimeout(350);
    for (let step = 0; step < 4; step += 1) await page.mouse.wheel(0, -100);
    const afterBurst = await poll(volume, near(0.15), '低音量连滚四格应到 15%');
    await page.screenshot({ path: path.join(dir, 'fixture-15.png'), animations: 'disabled' });
    note(`burst volume=${afterBurst}`);

    await settle(0.4);
    await hoverUp();
    const afterCoarse = await poll(volume, near(0.5), '40% 上悬停滚轮一格应到 50%');
    await page.screenshot({ path: path.join(dir, 'fixture-50.png'), animations: 'disabled' });
    note(`coarse hover volume=${afterCoarse}`);

    await settle(0.15);
    await altUp();
    const afterAlt = await poll(volume, near(0.16), '15% 上 Alt+滚轮一格应到 16%');
    note(`fine alt volume=${afterAlt}`);

    await settings.bringToFront();
    await settings.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
    const singleKey = settings.getByRole('switch', { name: 'Single-key mode' });
    await singleKey.waitFor({ state: 'visible', timeout: 15_000 });
    if (await singleKey.getAttribute('aria-checked') !== 'false') throw new Error('单键模式默认应关闭');
    await singleKey.click();
    await poll(stored, value => value.singleKey === true && value.fineWheel !== false, '应打开单键模式且细档仍开');
    await page.bringToFront();
    await settle(0.1);
    const arrowAt = await centerOf(page.locator('#media'));
    await page.mouse.click(arrowAt.x, arrowAt.y);
    await page.keyboard.press('ArrowUp');
    const afterArrow = await poll(volume, near(0.2), '低音量上单键 ↑ 仍应按 10% 到 20%');
    note(`arrow volume=${afterArrow}`);

    await settings.bringToFront();
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    const off = settings.getByRole('switch', { name: 'Finer wheel steps below 25%' });
    await off.waitFor({ state: 'visible', timeout: 15_000 });
    await off.click();
    await poll(stored, value => value.fineWheel === false && value.volumeStep === 10, '应关掉细档且音量步长仍是 10');
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-off.png'), animations: 'disabled' });
    note('fine wheel off');
    await page.bringToFront();
    await settle(0.1);
    await hoverUp();
    const offHover = await poll(volume, near(0.2), '关掉细档后 10% 上悬停滚轮应到 20%');
    await altUp();
    const offAlt = await poll(volume, near(0.3), '关掉细档后 Alt+滚轮应再到 30%');
    await page.screenshot({ path: path.join(dir, 'fixture-off.png'), animations: 'disabled' });
    note(`off hover=${offHover} alt=${offAlt}`);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
    });
    await settle(0.5);
    await openPill();
    await poll(shown, value => value === 50, '重载后音量药丸应显示 50%');
    await page.getByRole('slider', { name: 'Volume' }).press('ArrowUp');
    const slider = await poll(volume, near(0.51), '滑块方向键仍应按 1% 到 51%');
    const sliderShown = await poll(shown, value => value === 51, '滑块应显示 51%');
    await page.screenshot({ path: path.join(dir, 'slider-51.png'), animations: 'disabled' });
    note(`slider volume=${slider} shown=${sliderShown}`);

    const state = {
      ok: true,
      fine: { one: afterOne, pill, popup: Number(popupPercent), burst: afterBurst, coarse: afterCoarse, alt: afterAlt },
      arrow: afterArrow,
      off: { hover: offHover, alt: offAlt },
      slider,
    };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await popup?.close().catch(() => {});
    await settings?.close().catch(() => {});
    await page.close().catch(() => {});
  }
}

async function driveCoarseStep(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const near = expected => value => Math.abs(value - expected) < 0.02;
  const page = await context.newPage();
  let settings;
  const volume = () => page.locator('#media').evaluate(element => element.volume);
  const scrollY = () => page.evaluate(() => window.scrollY);
  const settle = async value => {
    await page.locator('#media').evaluate((element, next) => { element.volume = next; element.muted = false; }, value);
    await poll(volume, near(value), `应能把音量设成 ${value}`);
    await page.waitForTimeout(400);
  };
  const onVideo = async () => {
    const at = await centerOf(page.locator('#media'));
    await page.mouse.move(at.x, at.y);
    await page.waitForTimeout(350);
    return at;
  };
  const hoverUp = async () => {
    await onVideo();
    await page.mouse.wheel(0, -100);
  };
  const shiftUp = async () => {
    await onVideo();
    await page.keyboard.down('Shift');
    try { await page.mouse.wheel(0, -100); }
    finally { await page.keyboard.up('Shift'); }
  };
  const unchanged = async (before, label) => {
    await page.waitForTimeout(400);
    const after = await volume();
    if (!near(before)(after)) throw new Error(`${label}：${before} -> ${after}`);
    return after;
  };
  try {
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    const volumeGroup = settings.getByRole('group', { name: 'Volume step' });
    const coarseGroup = settings.getByRole('group', { name: 'Coarse step' });
    await coarseGroup.waitFor({ state: 'visible', timeout: 15_000 });
    const volumePressed = await volumeGroup.locator('[aria-pressed="true"]').allInnerTexts();
    const coarsePressed = await coarseGroup.locator('[aria-pressed="true"]').allInnerTexts();
    if (volumePressed.join() !== '10%' || coarsePressed.join() !== '20%') throw new Error(`默认步长不对：${JSON.stringify({ volumePressed, coarsePressed })}`);
    await settings.getByText('The scroll wheel, single-key arrow keys, and browser extension commands all change volume by this step.', { exact: true }).waitFor({ state: 'visible' });
    await settings.getByText('Hold Shift and scroll to change volume by this step. It wins over the finer steps below 25%. Let go of Shift to use the volume step again. Arrow keys, extension commands, and the volume slider stay on the volume step. Alt + wheel still changes volume anywhere; hold Shift with it to use this step.', { exact: true }).waitFor({ state: 'visible' });
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-default.png'), animations: 'disabled' });
    note('volume step 10%, coarse step 20%');

    await page.goto(`${origin}/keys`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
    });
    await settle(0.5);
    await hoverUp();
    const plain = await poll(volume, near(0.6), '不按 Shift 的悬停滚轮一格应到 60%');
    if (await scrollY() !== 0) throw new Error('播放器上的滚轮不应滚动页面');
    await page.screenshot({ path: path.join(dir, 'fixture-10.png'), animations: 'disabled' });
    note(`plain hover volume=${plain}`);
    await shiftUp();
    const shifted = await poll(volume, near(0.8), '按住 Shift 的一格应到 80%');
    if (await scrollY() !== 0) throw new Error('播放器上的 Shift+滚轮不应滚动页面');
    await page.screenshot({ path: path.join(dir, 'fixture-shift.png'), animations: 'disabled' });
    note(`shift hover volume=${shifted}`);

    const box = await page.locator('#media').boundingBox();
    if (!box) throw new Error('视频没有位置');
    const offPlayer = { x: box.x + box.width / 2, y: box.y + box.height + 80 };
    await page.mouse.move(offPlayer.x, offPlayer.y);
    await page.waitForTimeout(350);
    const beforeScroll = await scrollY();
    await page.mouse.wheel(0, 120);
    const afterScroll = await poll(scrollY, value => value > beforeScroll + 20, '视频外向下滚轮应让页面往下走');
    const heldOff = await volume();
    if (!near(shifted)(heldOff)) throw new Error(`视频外滚动改了音量 ${shifted} -> ${heldOff}`);
    note(`off-player scroll ${beforeScroll} -> ${afterScroll}`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await poll(scrollY, value => value === 0, '应滚回顶部');
    await page.evaluate(() => {
      window.__otterWheel = null;
      window.addEventListener('wheel', event => {
        window.__otterWheel = { x: event.deltaX, y: event.deltaY, shift: event.shiftKey, prevented: event.defaultPrevented };
      }, { capture: true });
    });
    await page.mouse.move(offPlayer.x, offPlayer.y);
    await page.waitForTimeout(350);
    await page.keyboard.down('Shift');
    try { await page.mouse.wheel(0, 120); }
    finally { await page.keyboard.up('Shift'); }
    const seen = await page.evaluate(() => window.__otterWheel);
    if (!seen?.shift || seen.prevented) throw new Error(`视频外的 Shift+滚轮不应被取消：${JSON.stringify(seen)}`);
    const shiftOff = await unchanged(shifted, '视频外的 Shift+滚轮不应改音量');
    note(`off-player shift wheel=${JSON.stringify(seen)} volume=${shiftOff}`);

    await settle(0.1);
    await hoverUp();
    const fine = await poll(volume, near(0.11), '10% 上不按 Shift 应到 11%');
    await shiftUp();
    const fineShift = await poll(volume, near(0.31), '10% 上按住 Shift 应到 31%，而不是 12%');
    await page.screenshot({ path: path.join(dir, 'fixture-fine.png'), animations: 'disabled' });
    note(`fine ${fine} then shift ${fineShift}`);

    await page.locator('#field').evaluate(element => element.focus({ preventScroll: true }));
    const focused = await page.evaluate(() => document.activeElement?.id === 'field');
    if (!focused) throw new Error('输入框没有聚焦');
    const beforeTyping = await volume();
    await onVideo();
    await page.keyboard.down('Shift');
    try { await page.mouse.wheel(0, -100); }
    finally { await page.keyboard.up('Shift'); }
    const whileTyping = await unchanged(beforeTyping, '输入框聚焦时 Shift+滚轮不应改音量');
    await page.screenshot({ path: path.join(dir, 'fixture-typing.png'), animations: 'disabled' });
    note(`typing shift volume=${whileTyping}`);
    await onVideo();
    await page.keyboard.down('Alt');
    await page.keyboard.down('Shift');
    try { await page.mouse.wheel(0, -100); }
    finally { await page.keyboard.up('Shift'); await page.keyboard.up('Alt'); }
    const altShift = await poll(volume, near(0.51), '输入框聚焦时 Alt+Shift 仍应按粗档到 51%');
    note(`typing alt+shift volume=${altShift}`);
    await page.locator('#field').evaluate(element => element.blur());

    await settings.bringToFront();
    const five = settings.getByRole('group', { name: 'Coarse step' }).getByRole('button', { name: '5%', exact: true });
    await five.click();
    await poll(stored, value => value.coarseStep === 5 && value.volumeStep === 10, '粗调步长应存成 5%，音量步长仍是 10%');
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-5.png'), animations: 'disabled' });
    note('saved coarseStep=5');
    await page.bringToFront();
    await settle(0.5);
    await hoverUp();
    const afterFivePlain = await poll(volume, near(0.6), '粗档改成 5% 后，不按 Shift 仍应到 60%');
    await shiftUp();
    const afterFiveShift = await poll(volume, near(0.65), '粗档 5% 时 Shift 一格应到 65%');
    await page.keyboard.down('Alt');
    try { await page.mouse.wheel(0, -100); }
    finally { await page.keyboard.up('Alt'); }
    const afterAlt = await poll(volume, near(0.75), '松开 Shift 的 Alt+滚轮应回到 10%，到 75%');
    await page.screenshot({ path: path.join(dir, 'fixture-5.png'), animations: 'disabled' });
    note(`coarse 5 plain=${afterFivePlain} shift=${afterFiveShift} alt=${afterAlt}`);

    const state = {
      ok: true,
      plain,
      shifted,
      fine,
      fineShift,
      whileTyping,
      altShift,
      coarse5: { plain: afterFivePlain, shift: afterFiveShift, alt: afterAlt }
    };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await page.keyboard.up('Shift').catch(() => {});
    await page.keyboard.up('Alt').catch(() => {});
    await settings?.close().catch(() => {});
    await page.close().catch(() => {});
  }
}

async function driveRateStep(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const near = expected => value => Math.abs(value - expected) < 0.02;
  const times = '\u00d7';
  const page = await context.newPage();
  let settings;
  const rate = () => page.locator('#media').evaluate(element => element.playbackRate);
  const setRate = async value => {
    await page.locator('#media').evaluate((element, next) => { element.playbackRate = next; }, value);
    await poll(rate, near(value), `应能把倍速设成 ${value}`);
  };
  const blank = async () => {
    await page.bringToFront();
    await page.mouse.click(800, 400);
  };
  try {
    await page.goto(`${origin}/keys`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
    });
    await blank();
    await page.keyboard.press('Alt+Period');
    const afterDefault = await poll(rate, near(1.25), '默认步长下 Alt+. 应到 1.25');
    await page.screenshot({ path: path.join(dir, 'fixture-default.png'), animations: 'disabled' });
    await page.keyboard.press('Alt+Comma');
    await poll(rate, near(1), 'Alt+, 应回到 1');
    note(`default alt+. playbackRate=${afterDefault}`);

    settings = await context.newPage();
    try {
      await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
      const group = settings.getByRole('group', { name: 'Speed step' });
      await group.waitFor({ state: 'visible', timeout: 15_000 });
      const steps = await group.getByRole('button').allInnerTexts();
      const pressedBefore = await group.locator('[aria-pressed="true"]').allInnerTexts();
      if (steps.join() !== `0.1${times},0.25${times},0.5${times}` || pressedBefore.join() !== `0.25${times}`) {
        throw new Error(`倍速步长默认值或档位不对：${JSON.stringify({ steps, pressedBefore })}`);
      }
      await settings.getByText('On-page shortcuts, the popup faster and slower buttons, and browser extension commands all change speed by this step.', { exact: true }).waitFor({ state: 'visible' });
      await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-default.png'), animations: 'disabled' });
      note(`settings Speed step steps=${steps} pressed=${pressedBefore}`);

      const tenth = group.getByRole('button', { name: `0.1${times}`, exact: true });
      await tenth.click();
      await poll(() => tenth.getAttribute('aria-pressed'), value => value === 'true', '点 0.1× 后应按下');
      await poll(stored, value => value.rateStep === 0.1, '设置里应存下 rateStep=0.1');
      await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-0.1.png'), animations: 'disabled' });
      note('saved rateStep=0.1 without reloading the fixture');
    } finally { /* keep settings open so the fixture is not reloaded */ }

    await page.bringToFront();
    await setRate(1);
    await blank();
    await page.keyboard.press('Alt+Period');
    const afterTenth = await poll(rate, near(1.1), '改成 0.1× 后同一页 Alt+. 应到 1.1');
    await page.screenshot({ path: path.join(dir, 'fixture-0.1.png'), animations: 'disabled' });
    note(`0.1 alt+. playbackRate=${afterTenth}`);

    const popup = await openActionPopup(context, page);
    let afterPopup;
    let afterPopupDown;
    try {
      await popup.click(`Increase speed by 0.1${times}`);
      afterPopup = await poll(rate, near(1.2), '弹出面板加快一档应到 1.2');
      await popup.screenshot(path.join(dir, 'popup-0.1.png'));
      await popup.click(`Decrease speed by 0.1${times}`);
      afterPopupDown = await poll(rate, near(1.1), '弹出面板减慢一档应回到 1.1');
      note(`popup 0.1 up=${afterPopup} down=${afterPopupDown}`);
    } finally { await popup.close().catch(() => {}); }

    await settings.bringToFront();
    const half = settings.getByRole('group', { name: 'Speed step' }).getByRole('button', { name: `0.5${times}`, exact: true });
    await half.click();
    await poll(() => half.getAttribute('aria-pressed'), value => value === 'true', '点 0.5× 后应按下');
    await poll(stored, value => value.rateStep === 0.5, '设置里应存下 rateStep=0.5');
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-0.5.png'), animations: 'disabled' });
    await settings.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
    const singleKey = settings.getByRole('switch', { name: 'Single-key mode' });
    if (await singleKey.getAttribute('aria-checked') !== 'false') throw new Error('单键模式默认应关闭');
    await singleKey.click();
    await poll(stored, value => value.singleKey === true && value.rateStep === 0.5, '设置里应存下 singleKey=true 且 rateStep=0.5');
    const upLabel = settings.getByRole('term').filter({ hasText: /^>$/ }).locator('xpath=following-sibling::dd');
    await poll(() => upLabel.innerText(), value => value === `Increase speed by 0.5${times}`, '快捷键说明应跟着步长变成 0.5×');
    note('single-key mode on, shortcut list says 0.5×');
    await settings.close();
    settings = undefined;

    await page.bringToFront();
    await setRate(1);
    await blank();
    await page.keyboard.press('Shift+Period');
    const afterHalf = await poll(rate, near(1.5), '单键 > 应按 0.5× 到 1.5');
    await page.screenshot({ path: path.join(dir, 'fixture-0.5.png'), animations: 'disabled' });
    note(`0.5 single-key playbackRate=${afterHalf}`);

    await setRate(4);
    await blank();
    await page.keyboard.press('Alt+Period');
    await page.waitForTimeout(400);
    const capped = await rate();
    if (!near(4)(capped)) throw new Error(`4× 再加快应停在 4：${capped}`);
    const limitPopup = await openActionPopup(context, page);
    let fasterDisabled;
    let slowerDisabled;
    try {
      fasterDisabled = await limitPopup.evaluate(`(() => {
        const button = [...document.querySelectorAll('button')].find(item => item.getAttribute('aria-label') === ${JSON.stringify(`Increase speed by 0.5${times}`)});
        return button ? button.disabled : null;
      })()`);
      if (fasterDisabled !== true) throw new Error(`4× 时加快按钮应禁用：${fasterDisabled}`);
      await limitPopup.screenshot(path.join(dir, 'popup-limit.png'));
    } finally { await limitPopup.close().catch(() => {}); }

    await setRate(0.25);
    await blank();
    await page.keyboard.press('Alt+Comma');
    await page.waitForTimeout(400);
    const floored = await rate();
    if (!near(0.25)(floored)) throw new Error(`0.25× 再减慢应停在 0.25：${floored}`);
    const floorPopup = await openActionPopup(context, page);
    try {
      slowerDisabled = await floorPopup.evaluate(`(() => {
        const button = [...document.querySelectorAll('button')].find(item => item.getAttribute('aria-label') === ${JSON.stringify(`Decrease speed by 0.5${times}`)});
        return button ? button.disabled : null;
      })()`);
      if (slowerDisabled !== true) throw new Error(`0.25× 时减慢按钮应禁用：${slowerDisabled}`);
    } finally { await floorPopup.close().catch(() => {}); }
    note(`limits capped=${capped} floored=${floored} fasterDisabled=${fasterDisabled} slowerDisabled=${slowerDisabled}`);

    const state = {
      ok: true,
      defaultAlt: afterDefault,
      step01: afterTenth,
      popup: { up: afterPopup, down: afterPopupDown },
      step05: afterHalf,
      limits: { capped, floored, fasterDisabled, slowerDisabled },
    };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await settings?.close().catch(() => {});
    await page.close().catch(() => {});
  }
}

async function driveDefaultRate(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const near = expected => value => Math.abs(value - expected) < 0.02;
  const manifest = await worker.evaluate(() => {
    const listed = chrome.runtime.getManifest();
    return { permissions: listed.permissions ?? [], hostPermissions: listed.host_permissions ?? [] };
  });
  if (JSON.stringify(manifest.permissions) !== JSON.stringify(['storage']) || JSON.stringify(manifest.hostPermissions) !== JSON.stringify(['http://*/*', 'https://*/*'])) {
    throw new Error(`权限应保持原样：${JSON.stringify(manifest)}`);
  }
  const openVideo = async () => {
    const fixture = await context.newPage();
    await fixture.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await fixture.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
    });
    return fixture;
  };
  const rateOf = fixture => fixture.locator('#media').evaluate(element => element.playbackRate);
  let settings;
  let followed;
  let applied;
  try {
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    const group = settings.getByRole('group', { name: 'Default speed' });
    await group.waitFor({ state: 'visible', timeout: 15_000 });
    const choices = await group.getByRole('button').allInnerTexts();
    const pressedBefore = await group.locator('[aria-pressed="true"]').allInnerTexts();
    const expectedChoices = ['Follow the page', '0.75×', '1×', '1.25×', '1.5×', '2×', '2.5×', '3×', '4×'];
    if (choices.join() !== expectedChoices.join() || pressedBefore.join() !== 'Follow the page') {
      throw new Error(`默认倍速档位或默认值不对：${JSON.stringify({ choices, pressedBefore })}`);
    }
    await settings.getByText('On sites that have not remembered a speed, new media uses this speed once. A speed remembered for the site comes first.', { exact: true }).waitFor({ state: 'visible' });
    const lock = settings.getByRole('switch', { name: 'Lock playback speed' });
    if (await lock.getAttribute('aria-checked') !== 'false') throw new Error('锁定倍速默认应关闭');
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-follow.png'), animations: 'disabled' });
    const followStored = await stored();
    if (followStored.defaultRate != null) throw new Error(`跟随网页时 defaultRate 应为 null：${followStored.defaultRate}`);
    note(`settings Default speed choices=${choices} pressed=${pressedBefore}`);

    followed = await openVideo();
    await followed.locator('#media').evaluate(element => { element.playbackRate = 1.75; });
    await followed.waitForTimeout(1200);
    const stayed = await poll(rateOf.bind(null, followed), near(1.75), '跟随网页时不应改写 1.75×');
    await followed.screenshot({ path: path.join(dir, 'fixture-follow.png'), animations: 'disabled' });
    note(`follow page left playbackRate=${stayed}`);
    await followed.close();
    followed = undefined;

    const target = group.getByRole('button', { name: '1.5×', exact: true });
    await target.click();
    await poll(() => target.getAttribute('aria-pressed'), value => value === 'true', '点 1.5× 后应按下');
    const savedRate = await poll(stored, value => value.defaultRate === 1.5 && value.lockRate !== true, '设置里应存下 defaultRate=1.5，且锁定仍关');
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-1.5.png'), animations: 'disabled' });
    note(`saved defaultRate=${savedRate.defaultRate} lockRate=${savedRate.lockRate}`);

    applied = await openVideo();
    const once = await poll(rateOf.bind(null, applied), near(1.5), '新页面的新媒体应应用一次 1.5×');
    await applied.screenshot({ path: path.join(dir, 'fixture-1.5.png'), animations: 'disabled' });
    await applied.locator('#media').evaluate(element => { element.playbackRate = 1; });
    await applied.waitForTimeout(800);
    const unlocked = await rateOf(applied);
    if (!near(1)(unlocked)) throw new Error(`锁定关着时，站点把倍速改成 1 后不应写回：${unlocked}`);
    note(`applied 1.5 then stayed at ${unlocked} with lock off`);

    const popup = await openActionPopup(context, applied);
    try {
      await popup.click('2× speed');
      await poll(() => popup.evaluate(`(() => document.querySelector('[aria-label="2× speed"]')?.getAttribute('aria-pressed') ?? '')()`), value => value === 'true', '弹出面板应按下 2×');
      await poll(rateOf.bind(null, applied), near(2), '点 2× 后媒体应为 2×');
      const remembered = await popup.evaluate(`(() => {
        const node = document.querySelector('[role="switch"][aria-label="Remember this site"]');
        if (!node) return false;
        node.click();
        return true;
      })()`);
      if (!remembered) throw new Error('弹出面板里没有 Remember this site');
      await poll(stored, value => value.sitePrefs?.['media.ottertap.test']?.rate === 2 && value.defaultRate === 1.5, '记住此站点应写下 2×，默认倍速仍是 1.5');
      note('remembered media.ottertap.test at 2×');
    } finally { await popup.close().catch(() => {}); }

    await applied.reload({ waitUntil: 'domcontentloaded' });
    await applied.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    const siteRate = await poll(rateOf.bind(null, applied), near(2), '已记住的 2× 应盖过默认 1.5×');
    await applied.screenshot({ path: path.join(dir, 'fixture-site.png'), animations: 'disabled' });
    note(`reloaded site rate=${siteRate}`);

    const state = { ok: true, choices, follow: stayed, applied: once, unlocked, siteRate, permissions: manifest.permissions };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await settings?.close().catch(() => {});
    await followed?.close().catch(() => {});
    await applied?.close().catch(() => {});
  }
}

async function driveHoldBoost(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const near = expected => value => Math.abs(value - expected) < 0.02;
  const times = '\u00d7';
  const rateOf = fixture => fixture.locator('#media').evaluate(element => element.playbackRate);
  const siteRate = value => value.sitePrefs?.[host]?.rate;
  const temporaryVisible = fixture => fixture.getByText(/Temporary speed/).isVisible().catch(() => false);
  const downChord = async fixture => {
    await fixture.keyboard.down('Alt');
    await fixture.keyboard.down('Shift');
    await fixture.keyboard.down('Period');
  };
  const upChord = async fixture => {
    await fixture.keyboard.up('Period').catch(() => {});
    await fixture.keyboard.up('Shift').catch(() => {});
    await fixture.keyboard.up('Alt').catch(() => {});
  };
  const focusMedia = async fixture => {
    await fixture.bringToFront();
    await fixture.mouse.click(8, 8);
  };
  let settings;
  let fixture;
  let keys;
  try {
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    const holdSwitch = settings.getByRole('switch', { name: 'Hold for a temporary speed' });
    await holdSwitch.waitFor({ state: 'visible', timeout: 15_000 });
    if (await holdSwitch.getAttribute('aria-checked') !== 'false') throw new Error('按住临时加速默认应关闭');
    const temporary = settings.getByRole('group', { name: 'Temporary speed' });
    const pressed = await temporary.locator('[aria-pressed="true"]').allInnerTexts();
    if (pressed.join() !== `2${times}`) throw new Error(`临时倍速默认应按下 2×：${JSON.stringify(pressed)}`);
    const defaults = settings.getByRole('group', { name: 'Default speed' });
    const defaultPressed = await defaults.locator('[aria-pressed="true"]').allInnerTexts();
    if (defaultPressed.join() !== 'Follow the page') throw new Error(`默认倍速应仍是跟随网页：${JSON.stringify(defaultPressed)}`);
    await settings.getByText('hold Alt + Shift + .').waitFor({ state: 'visible' });
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-off.png'), animations: 'disabled' });
    const offStored = await stored();
    if (offStored.holdBoost === true || offStored.defaultRate != null || siteRate(offStored) != null) {
      throw new Error(`关闭时不应写下临时加速或倍速记忆：${JSON.stringify({ holdBoost: offStored.holdBoost, defaultRate: offStored.defaultRate, site: siteRate(offStored) })}`);
    }
    note('settings hold boost off, temporary speed 2×, default follows the page');

    fixture = await context.newPage();
    await fixture.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await fixture.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
    });
    await focusMedia(fixture);
    const initial = await poll(rateOf.bind(null, fixture), near(1), '夹具初始倍速应是 1');
    await downChord(fixture);
    await upChord(fixture);
    const stepped = await poll(rateOf.bind(null, fixture), near(1.25), '关闭时 Alt+Shift+. 仍应步进到 1.25');
    if (await temporaryVisible(fixture)) throw new Error('关闭时不应出现临时倍速提示');
    const afterStep = await stored();
    if (afterStep.holdBoost === true || afterStep.defaultRate != null || siteRate(afterStep) != null) {
      throw new Error(`步进不应打开临时加速或写入记忆：${JSON.stringify({ holdBoost: afterStep.holdBoost, defaultRate: afterStep.defaultRate, site: siteRate(afterStep) })}`);
    }
    await fixture.screenshot({ path: path.join(dir, 'fixture-off.png'), animations: 'disabled' });
    note(`off chord stepped ${initial} -> ${stepped}`);

    await settings.bringToFront();
    await holdSwitch.click();
    await poll(() => holdSwitch.getAttribute('aria-checked'), value => value === 'true', '应能打开按住临时加速');
    const choice = temporary.getByRole('button', { name: `1.5${times}`, exact: true });
    await choice.click();
    await poll(() => choice.getAttribute('aria-pressed'), value => value === 'true', '临时倍速应改成 1.5×');
    const armed = await poll(stored, value => value.holdBoost === true && value.holdBoostRate === 1.5 && value.defaultRate == null, '存储里应是 holdBoost 开、临时档 1.5、默认倍速仍空');
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-on.png'), animations: 'disabled' });
    note(`saved holdBoost=${armed.holdBoost} holdBoostRate=${armed.holdBoostRate}`);

    await focusMedia(fixture);
    await fixture.locator('#media').evaluate(element => { element.playbackRate = 1; });
    await poll(rateOf.bind(null, fixture), near(1), '应按住前把倍速设回 1');
    await downChord(fixture);
    const held = await poll(rateOf.bind(null, fixture), near(1.5), '按住后应立刻变成临时 1.5×');
    await fixture.getByText(`Temporary speed 1.5${times}`, { exact: true }).waitFor({ state: 'visible', timeout: 8_000 });
    const during = await stored();
    if (during.defaultRate != null || siteRate(during) != null || during.holdBoostRate !== 1.5) {
      throw new Error(`按住不应写默认倍速或站点记忆：${JSON.stringify({ defaultRate: during.defaultRate, site: siteRate(during), holdBoostRate: during.holdBoostRate })}`);
    }
    await fixture.screenshot({ path: path.join(dir, 'fixture-hold.png'), animations: 'disabled' });
    await upChord(fixture);
    const released = await poll(rateOf.bind(null, fixture), near(1), '松开后应回到按住前的 1×');
    await fixture.getByText(`Temporary speed 1.5${times}`, { exact: true }).waitFor({ state: 'hidden', timeout: 8_000 });
    await fixture.screenshot({ path: path.join(dir, 'fixture-release.png'), animations: 'disabled' });
    note(`held=${held} released=${released}`);

    await worker.evaluate(async () => {
      const key = 'ottertap-settings-v1';
      const current = (await chrome.storage.local.get(key))[key] ?? {};
      const sitePrefs = { ...(current.sitePrefs ?? {}) };
      sitePrefs['media.ottertap.test'] = { ...(sitePrefs['media.ottertap.test'] ?? {}), rate: 2 };
      await chrome.storage.local.set({ [key]: { ...current, defaultRate: 1.25, sitePrefs } });
    });
    await poll(stored, value => value.defaultRate === 1.25 && siteRate(value) === 2 && value.holdBoostRate === 1.5, '应写入站点 2× 和默认 1.25×，临时档仍是 1.5');
    await fixture.reload({ waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    const remembered = await poll(rateOf.bind(null, fixture), near(2), '重新加载应使用站点记住的 2×');
    await focusMedia(fixture);
    await downChord(fixture);
    await poll(rateOf.bind(null, fixture), near(1.5), '记住 2× 后按住仍应是临时 1.5×');
    await fixture.keyboard.up('Shift');
    await fixture.keyboard.up('Period');
    await fixture.keyboard.up('Alt');
    const restoredMemory = await poll(rateOf.bind(null, fixture), near(2), '先松开 Shift 再松开 . 也应回到站点的 2×');
    const memoryStored = await poll(stored, value => value.defaultRate === 1.25 && siteRate(value) === 2 && value.holdBoostRate === 1.5 && value.holdBoost === true, '按住前后站点倍速和默认倍速都不应被改写');
    note(`remembered=${remembered} restored=${restoredMemory} storedDefault=${memoryStored.defaultRate} storedSite=${siteRate(memoryStored)}`);

    await settings.bringToFront();
    const lock = settings.getByRole('switch', { name: 'Lock playback speed' });
    if (await lock.getAttribute('aria-checked') !== 'false') throw new Error('锁定倍速此时应仍关闭');
    await lock.click();
    await poll(() => lock.getAttribute('aria-checked'), value => value === 'true', '应能打开锁定倍速');
    await poll(stored, value => value.lockRate === true && siteRate(value) === 2, '锁定不应改站点记住的 2×');
    await focusMedia(fixture);
    await fixture.locator('#media').evaluate(element => { element.playbackRate = 1; });
    const locked = await poll(rateOf.bind(null, fixture), near(2), '锁定开着时站点改成 1 应写回 2×');
    await downChord(fixture);
    await poll(rateOf.bind(null, fixture), near(1.5), '锁定开着时按住应改用临时 1.5×');
    await upChord(fixture);
    await poll(rateOf.bind(null, fixture), near(2), '松开应回到锁定目标 2×，而不是刚才的 1×');
    note(`locked rewrite back to ${locked}`);

    keys = await context.newPage();
    await keys.goto(`${origin}/keys`, { waitUntil: 'domcontentloaded' });
    await keys.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    const typedRate = await poll(rateOf.bind(null, keys), near(2), '同一站点的输入框页也应先用记住的 2×');
    const field = keys.getByRole('textbox', { name: 'Field' });
    await field.click();
    await downChord(keys);
    await keys.waitForTimeout(300);
    const typed = await rateOf(keys);
    if (!near(typedRate)(typed)) throw new Error(`输入框里按住不应改倍速：${typed}`);
    await upChord(keys);
    const typedAfter = await rateOf(keys);
    if (!near(typedRate)(typedAfter)) throw new Error(`输入框里松开后倍速变了：${typedAfter}`);
    note(`typing left playbackRate=${typedAfter}`);

    await settings.bringToFront();
    const singleKey = settings.getByRole('switch', { name: 'Single-key mode' });
    await singleKey.click();
    await poll(stored, value => value.singleKey === true && value.holdBoost === true && value.holdBoostRate === 1.5 && value.lockRate === true && value.defaultRate === 1.25 && siteRate(value) === 2, '单键模式应打开，其余倍速设置保持不变');
    await keys.waitForTimeout(400);
    await focusMedia(keys);
    await keys.keyboard.down('s');
    const singleHeld = await poll(rateOf.bind(null, keys), near(1.5), '单键模式按住 S 应到临时 1.5×');
    await keys.keyboard.up('s');
    const singleReleased = await poll(rateOf.bind(null, keys), near(2), '松开 S 应回到锁定的 2×');
    note(`single-key held=${singleHeld} released=${singleReleased}`);

    const state = { ok: true, stepped, held, released, remembered: restoredMemory, locked, typed: typedAfter, singleHeld, singleReleased };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    if (fixture) await upChord(fixture);
    if (keys) {
      await keys.keyboard.up('s').catch(() => {});
      await upChord(keys);
    }
    await settings?.close().catch(() => {});
    await fixture?.close().catch(() => {});
    await keys?.close().catch(() => {});
  }
}

async function driveHoldSkipCombo(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const near = expected => value => Math.abs(value - expected) < 0.05;
  const nearRate = expected => value => Math.abs(value - expected) < 0.02;
  const times = '\u00d7';
  const siteRate = value => value.sitePrefs?.[host]?.rate;
  const releaseKeys = async page => {
    for (const key of ['l', 'j', 'ArrowRight', 'ArrowLeft', 'Period', 'Shift', 'Alt']) await page.keyboard.up(key).catch(() => {});
  };
  const settle = async (page, time, rate) => {
    await page.locator('#media').evaluate(async (element, next) => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
      element.pause();
      element.currentTime = next.time;
      element.playbackRate = next.rate;
    }, { time, rate });
  };

  let settings;
  let fixture;
  let keys;
  try {
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    const holdSwitch = settings.getByRole('switch', { name: 'Hold for a temporary speed' });
    const combo = settings.getByRole('switch', { name: 'Short press skips, hold speeds up' });
    await holdSwitch.waitFor({ state: 'visible', timeout: 15_000 });
    await combo.waitFor({ state: 'visible', timeout: 15_000 });
    if (await holdSwitch.getAttribute('aria-checked') !== 'false') throw new Error('按住临时加速默认应关闭');
    if (await combo.getAttribute('aria-checked') !== 'false') throw new Error('同键加速默认应关闭');
    if (!await combo.isDisabled()) throw new Error('按住临时加速关闭时，同键开关应不可用');
    await settings.getByText('Turn on hold for a temporary speed first.').waitFor({ state: 'visible' });
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-before.png'), animations: 'disabled' });
    const before = await stored();
    if (before.holdSkip === true || before.holdBoost === true || before.defaultRate != null || siteRate(before) != null) {
      throw new Error(`默认不应打开同键加速或写下倍速记忆：${JSON.stringify({ holdSkip: before.holdSkip, holdBoost: before.holdBoost, defaultRate: before.defaultRate })}`);
    }
    note('settings hold boost off, same-key switch disabled and off');

    await holdSwitch.click();
    await poll(() => holdSwitch.getAttribute('aria-checked'), value => value === 'true', '应能打开按住临时加速');
    await poll(() => combo.isDisabled(), value => value === false, '打开按住临时加速后，同键开关应可点');
    if (await combo.getAttribute('aria-checked') !== 'false') throw new Error('打开按住临时加速不应顺带打开同键');
    await settings.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
    const singleKey = settings.getByRole('switch', { name: 'Single-key mode' });
    await singleKey.waitFor({ state: 'visible', timeout: 15_000 });
    if (await singleKey.getAttribute('aria-checked') !== 'false') throw new Error('单键模式默认应关闭');
    await singleKey.click();
    await poll(stored, value => value.holdBoost === true && value.holdSkip !== true && value.singleKey === true && value.defaultRate == null, '应只打开按住临时加速和单键模式');

    fixture = await context.newPage();
    await fixture.goto(`${origin}/long`, { waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    const read = () => fixture.locator('#media').evaluate(element => ({ time: element.currentTime, rate: element.playbackRate }));
    await settle(fixture, 60, 1);
    await poll(async () => (await read()).time, near(60), '起点应是 60 秒');
    await fixture.mouse.click(1000, 600);
    await fixture.keyboard.down('l');
    const immediate = await poll(async () => (await read()).time, near(70), '同键关闭时按下 L 应立刻跳到 70 秒');
    const immediateRate = (await read()).rate;
    if (!nearRate(1)(immediateRate)) throw new Error(`同键关闭时跳转不应改倍速：${immediateRate}`);
    await fixture.keyboard.up('l');
    await fixture.waitForTimeout(400);
    const afterImmediate = await read();
    if (!near(70)(afterImmediate.time) || !nearRate(1)(afterImmediate.rate)) throw new Error(`松开后不应再跳或加速：${JSON.stringify(afterImmediate)}`);
    note(`combo off: keydown L seeked to ${immediate}, rate stayed ${immediateRate}`);

    await settings.bringToFront();
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    const comboOn = settings.getByRole('switch', { name: 'Short press skips, hold speeds up' });
    await comboOn.waitFor({ state: 'visible', timeout: 15_000 });
    await poll(() => comboOn.isDisabled(), value => value === false, '同键开关应可点');
    await comboOn.click();
    await poll(stored, value => value.holdSkip === true && value.holdBoost === true && value.singleKey === true && value.defaultRate == null && siteRate(value) == null, '应存下 holdSkip，且不写默认倍速或站点记忆');
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-after.png'), animations: 'disabled' });
    note('same-key switch on');

    await fixture.bringToFront();
    await fixture.reload({ waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await settle(fixture, 60, 1);
    await poll(async () => (await read()).time, near(60), '短按前应回到 60 秒');
    await fixture.mouse.click(1000, 600);
    await fixture.keyboard.down('l');
    await fixture.waitForTimeout(80);
    const tapping = await read();
    if (!near(60)(tapping.time) || !nearRate(1)(tapping.rate)) throw new Error(`短按过程中不应跳转或加速：${JSON.stringify(tapping)}`);
    if (await fixture.getByText(/Temporary speed/).isVisible().catch(() => false)) throw new Error('短按不应出现临时倍速提示');
    await fixture.keyboard.up('l');
    const tapped = await poll(async () => (await read()).time, near(70), '松开短按应跳到 70 秒');
    const tappedRate = (await read()).rate;
    if (!nearRate(1)(tappedRate)) throw new Error(`短按不应改倍速：${tappedRate}`);
    await fixture.screenshot({ path: path.join(dir, 'fixture-tap.png'), animations: 'disabled' });
    note(`short L -> ${tapped} at rate ${tappedRate}`);

    await settle(fixture, 60, 1);
    await poll(async () => (await read()).time, near(60), '长按前应回到 60 秒');
    await fixture.mouse.click(1000, 600);
    await fixture.keyboard.down('l');
    const held = await poll(async () => (await read()).rate, nearRate(2), '按住超过阈值后应到临时 2×');
    const heldTime = (await read()).time;
    if (!near(60)(heldTime)) throw new Error(`长按加速不应额外跳进度：${heldTime}`);
    await fixture.getByText(`Temporary speed 2${times}`, { exact: true }).waitFor({ state: 'visible', timeout: 8_000 });
    await fixture.screenshot({ path: path.join(dir, 'fixture-hold.png'), animations: 'disabled' });
    await fixture.keyboard.up('l');
    const released = await poll(async () => (await read()).rate, nearRate(1), '松开后应回到 1×');
    const releasedTime = (await read()).time;
    if (!near(60)(releasedTime)) throw new Error(`松开后不应再跳一段：${releasedTime}`);
    await fixture.getByText(`Temporary speed 2${times}`, { exact: true }).waitFor({ state: 'hidden', timeout: 8_000 });
    await fixture.screenshot({ path: path.join(dir, 'fixture-release.png'), animations: 'disabled' });
    const memory = await stored();
    if (memory.defaultRate != null || siteRate(memory) != null || memory.holdBoostRate !== 2) {
      throw new Error(`长按不应写默认倍速或站点记忆：${JSON.stringify({ defaultRate: memory.defaultRate, site: siteRate(memory), holdBoostRate: memory.holdBoostRate })}`);
    }
    note(`held rate=${held} time=${heldTime}; released rate=${released} time=${releasedTime}`);

    await settle(fixture, 60, 1);
    await fixture.mouse.click(1000, 600);
    await fixture.keyboard.down('j');
    await fixture.waitForTimeout(80);
    const backHeld = await read();
    if (!near(60)(backHeld.time) || !nearRate(1)(backHeld.rate)) throw new Error(`短按 J 过程中不应跳或加速：${JSON.stringify(backHeld)}`);
    await fixture.keyboard.up('j');
    const backed = await poll(async () => (await read()).time, near(50), '短按 J 应回到 50 秒');
    note(`short J -> ${backed}`);

    await settle(fixture, 60, 1);
    await fixture.mouse.click(1000, 600);
    await fixture.keyboard.down('ArrowRight');
    const arrowHeld = await poll(async () => (await read()).rate, nearRate(2), '按住 → 应到临时 2×');
    const arrowTime = (await read()).time;
    if (!near(60)(arrowTime)) throw new Error(`按住 → 不应跳进度：${arrowTime}`);
    await fixture.keyboard.up('ArrowRight');
    await poll(async () => (await read()).rate, nearRate(1), '松开 → 应回到 1×');
    const arrowAfter = (await read()).time;
    if (!near(60)(arrowAfter)) throw new Error(`松开 → 不应再跳：${arrowAfter}`);
    note(`arrow hold rate=${arrowHeld} time stayed ${arrowAfter}`);

    await fixture.locator('#media').evaluate(element => { element.playbackRate = 1; });
    await poll(async () => (await read()).rate, nearRate(1), '独立键之前应回到 1×');
    await fixture.mouse.click(1000, 600);
    await fixture.keyboard.down('Alt');
    await fixture.keyboard.down('Shift');
    await fixture.keyboard.down('Period');
    const chord = await poll(async () => (await read()).rate, nearRate(2), '独立键 Alt+Shift+. 仍应立刻加速');
    await fixture.keyboard.up('Period');
    await fixture.keyboard.up('Shift');
    await fixture.keyboard.up('Alt');
    await poll(async () => (await read()).rate, nearRate(1), '松开独立键应回到 1×');
    note(`dedicated chord held=${chord}`);

    keys = await context.newPage();
    await keys.goto(`${origin}/keys`, { waitUntil: 'domcontentloaded' });
    await keys.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await settle(keys, 0.2, 1);
    const field = keys.getByRole('textbox', { name: 'Field' });
    await field.click();
    const keysRead = () => keys.locator('#media').evaluate(element => ({ time: element.currentTime, rate: element.playbackRate }));
    await poll(async () => (await keysRead()).time, near(0.2), '输入框页的短视频应停在 0.2 秒');
    await keys.keyboard.down('l');
    await keys.waitForTimeout(450);
    const typed = await keysRead();
    if (!near(0.2)(typed.time) || !nearRate(1)(typed.rate)) throw new Error(`输入框里按住 L 不应跳或加速：${JSON.stringify(typed)}`);
    await keys.keyboard.up('l');
    await keys.waitForTimeout(200);
    const typedAfter = await keysRead();
    if (!near(0.2)(typedAfter.time) || !nearRate(1)(typedAfter.rate)) throw new Error(`输入框里松开 L 后不应跳或加速：${JSON.stringify(typedAfter)}`);
    note(`typing left time=${typedAfter.time} rate=${typedAfter.rate}`);

    const state = { ok: true, immediate, tapped, held, heldTime, released, releasedTime, backed, arrowHeld, arrowAfter, chord, typed: typedAfter };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    if (fixture) await releaseKeys(fixture);
    if (keys) await releaseKeys(keys);
    await settings?.close().catch(() => {});
    await fixture?.close().catch(() => {});
    await keys?.close().catch(() => {});
  }
}

const pipButtonState = `(() => {
  const button = [...document.querySelectorAll('button')].find(item => item.getAttribute('aria-label') === 'Picture-in-picture' || item.getAttribute('aria-label') === 'Exit picture-in-picture');
  if (!button) return null;
  return { label: button.getAttribute('aria-label'), disabled: button.disabled, hint: document.getElementById('pip-hint')?.textContent ?? '', alert: document.querySelector('[role="alert"]')?.textContent?.trim() ?? '' };
})()`;

const pipHintText = {
  audio: "Audio can't use picture-in-picture.",
  disabled: 'This site has turned off picture-in-picture.',
  unsupported: "This browser can't use picture-in-picture.",
  gesture: 'The browser blocked picture-in-picture for this click. Try again.',
  failed: "Couldn't switch picture-in-picture. Try again.",
  notReady: 'Wait for the video to load, then try picture-in-picture again.',
};

function readablePipAlert(alert) {
  return Object.values(pipHintText).includes(alert);
}

async function driveExtensionPip(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const registered = await worker.evaluate(async () => {
    const manifest = chrome.runtime.getManifest();
    const listed = await chrome.commands.getAll();
    const commands = manifest.commands ?? {};
    const suggested = Object.entries(commands).filter(([, command]) => command.suggested_key).map(([name]) => name);
    return {
      permissions: manifest.permissions ?? [],
      hostPermissions: manifest.host_permissions ?? [],
      pip: commands.pip ?? null,
      suggested,
      listed: listed.map(item => ({ name: item.name ?? '', shortcut: item.shortcut ?? '', description: item.description ?? '' })),
    };
  });
  const pipCommand = registered.listed.find(item => item.name === 'pip');
  if (JSON.stringify(registered.permissions) !== JSON.stringify(['storage'])) throw new Error(`权限应仍只有 storage：${JSON.stringify(registered.permissions)}`);
  if (JSON.stringify([...registered.hostPermissions].sort()) !== JSON.stringify(['http://*/*', 'https://*/*'])) throw new Error(`主机权限不应扩大：${JSON.stringify(registered.hostPermissions)}`);
  if (!registered.pip || registered.pip.suggested_key) throw new Error(`pip 不应占用建议键：${JSON.stringify(registered.pip)}`);
  if (registered.suggested.length !== 4 || !['play-pause', 'skip-back', 'skip-forward', 'mute'].every(name => registered.suggested.includes(name))) {
    throw new Error(`建议键应仍是原来四个：${JSON.stringify(registered.suggested)}`);
  }
  if (!pipCommand || pipCommand.description !== 'Enter or exit picture-in-picture' || pipCommand.shortcut !== '') {
    throw new Error(`扩展命令 pip 未按未绑定登记：${JSON.stringify(pipCommand)}`);
  }
  note(`commands pip shortcut=${JSON.stringify(pipCommand.shortcut)} suggested=${registered.suggested.join(',')}`);

  const settings = await context.newPage();
  try {
    await settings.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
    const section = settings.locator('#shortcuts');
    await section.getByRole('heading', { name: 'Keyboard shortcuts' }).waitFor({ state: 'visible', timeout: 15_000 });
    const extensionList = section.getByRole('heading', { name: 'Extension shortcuts', exact: true }).locator('xpath=following-sibling::dl[1]');
    const label = extensionList.getByText('Enter or exit picture-in-picture', { exact: true });
    await label.waitFor({ state: 'visible' });
    if (await label.count() !== 1) throw new Error('扩展快捷键列表里应有一行画中画');
    const row = label.locator('xpath=ancestor::div[contains(@class,"py-3")][1]');
    const shortcut = (await row.locator('dt').innerText()).trim();
    if (shortcut !== 'Not set') throw new Error(`未绑定的画中画命令应显示 Not set：${shortcut}`);
    await section.getByRole('button', { name: 'Edit shortcuts' }).waitFor({ state: 'visible' });
    await row.scrollIntoViewIfNeeded();
    await section.locator('dl').first().screenshot({ path: path.join(dir, 'settings-shortcuts.png'), animations: 'disabled' });
    note('settings lists Enter or exit picture-in-picture as Not set');
  } finally { await settings.close(); }

  const openPanel = async (pathname, shot) => {
    const page = await context.newPage();
    try {
      await page.goto(`${origin}${pathname}`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
      const capability = await page.locator('#media').evaluate(element => ({
        kind: element.localName,
        enabled: document.pictureInPictureEnabled === true,
        request: typeof element.requestPictureInPicture === 'function',
        disabledBySite: element.disablePictureInPicture === true,
      }));
      const popup = await openActionPopup(context, page);
      try {
        const button = await poll(() => popup.evaluate(pipButtonState), value => Boolean(value?.label), `${pathname} 的弹出面板应有画中画按钮`);
        await popup.screenshot(path.join(dir, shot));
        return { page, popup, capability, button };
      } catch (error) {
        await popup.close().catch(() => {});
        throw error;
      }
    } catch (error) {
      await page.close().catch(() => {});
      throw error;
    }
  };
  const closePanel = async opened => {
    await opened.popup.close().catch(() => {});
    await opened.page.close().catch(() => {});
  };

  const video = await openPanel('/video', 'popup-video.png');
  let videoAfter = null;
  try {
    const available = video.capability.enabled && video.capability.request && !video.capability.disabledBySite && video.capability.kind === 'video';
    if (!available) {
      if (video.button.label !== 'Picture-in-picture' || video.button.disabled !== true || video.button.hint !== pipHintText.unsupported) {
        throw new Error(`浏览器不支持画中画时，面板应说明原因：${JSON.stringify(video)}`);
      }
      note('panel video: picture-in-picture unavailable, hint shown');
    } else {
      if (video.button.label !== 'Picture-in-picture' || video.button.disabled !== false || video.button.hint !== '') {
        throw new Error(`视频可进画中画时按钮应可点：${JSON.stringify(video.button)}`);
      }
      if (!await video.popup.evaluate(clickLabel('Picture-in-picture'))) throw new Error('点不到 Picture-in-picture');
      videoAfter = await poll(async () => ({
        button: await video.popup.evaluate(pipButtonState),
        pip: await video.page.locator('#media').evaluate(element => document.pictureInPictureElement === element),
      }), value => value.pip === true || value.button?.label === 'Exit picture-in-picture' || readablePipAlert(value.button?.alert ?? ''), '点击画中画后应进入画中画，或显示和面板相同的失败说明');
      await video.popup.screenshot(path.join(dir, 'popup-video-after.png'));
      note(`panel video click ${JSON.stringify(videoAfter)}`);
    }
  } finally { await closePanel(video); }

  const audio = await openPanel('/audio', 'popup-audio.png');
  try {
    if (audio.button.label !== 'Picture-in-picture' || audio.button.disabled !== true || audio.button.hint !== pipHintText.audio) {
      throw new Error(`音频应禁用画中画并说明原因：${JSON.stringify(audio.button)}`);
    }
    note('panel audio shows the picture-in-picture hint');
  } finally { await closePanel(audio); }

  const blocked = await openPanel('/pip-off', 'popup-pip-off.png');
  try {
    const hint = blocked.capability.enabled && blocked.capability.request ? pipHintText.disabled : pipHintText.unsupported;
    if (blocked.button.label !== 'Picture-in-picture' || blocked.button.disabled !== true || blocked.button.hint !== hint) {
      throw new Error(`站点关闭画中画时应显示对应说明：${JSON.stringify({ button: blocked.button, capability: blocked.capability })}`);
    }
    note(`panel pip-off hint=${hint}`);
  } finally { await closePanel(blocked); }

  const state = {
    ok: true,
    command: pipCommand,
    suggested: registered.suggested,
    permissions: registered.permissions,
    video: { capability: video.capability, before: video.button, after: videoAfter },
    audio: audio.button,
    pipOff: { capability: blocked.capability, button: blocked.button },
  };
  await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
  return state;
}

async function driveFrameStep(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const uiDir = '/opt/cursor/artifacts/frame-step-ui';
  await mkdir(uiDir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const frame = 1 / 30;
  const near = expected => value => Math.abs(value - expected) < 0.012;
  const page = await context.newPage();
  const time = () => page.locator('#media').evaluate(element => element.currentTime);
  const paused = () => page.locator('#media').evaluate(element => element.paused);
  const rateOf = () => page.locator('#media').evaluate(element => element.playbackRate);
  const blank = async () => {
    await page.bringToFront();
    await page.mouse.click(12, 12);
  };
  try {
    await page.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
      element.pause();
      element.currentTime = 0.5;
    });
    await poll(time, near(0.5), '夹具应停在 0.5 秒');
    await blank();
    await page.keyboard.press('Period');
    const forward = await poll(time, near(0.5 + frame), '. 应前进约一帧');
    if (await paused() !== true) throw new Error('逐帧后应保持暂停');
    await page.keyboard.press('Comma');
    const back = await poll(time, near(0.5), ', 应退回约 0.5 秒');
    await page.screenshot({ path: path.join(dir, 'fixture-step.png'), animations: 'disabled' });
    await page.screenshot({ path: path.join(uiDir, 'after-fixture.png'), animations: 'disabled' });
    note(`step forward=${forward} back=${back}`);

    const popup = await openActionPopup(context, page);
    let panelStep;
    try {
      await popup.click('Next frame');
      panelStep = await poll(time, near(0.5 + frame), '弹出面板下一帧应再前进约一帧');
      const hint = await popup.evaluate(`document.querySelector('#frame-step-hint')?.textContent ?? ''`);
      if (hint !== 'Pauses playback, then moves one frame.') throw new Error(`逐帧说明不对：${hint}`);
      await popup.screenshot(path.join(dir, 'popup-frame.png'));
      await popup.screenshot(path.join(uiDir, 'after-popup.png'));
      note(`popup next=${panelStep} hint=${hint}`);
    } finally { await popup.close().catch(() => {}); }

    await page.locator('#media').evaluate(element => { element.currentTime = 0.2; return element.play(); });
    await poll(paused, value => value === false, '应开始播放');
    const playingAt = await time();
    await blank();
    await page.keyboard.press('Period');
    const stepped = await poll(async () => ({ paused: await paused(), currentTime: await time() }), value => value.paused === true && value.currentTime > playingAt - 0.02 && value.currentTime < playingAt + 0.5, '播放中逐帧应先暂停，并且不按 10 秒跳');
    note(`pause-then-step from=${playingAt} to=${stepped.currentTime}`);
    await page.keyboard.press('Alt+Period');
    const faster = await poll(rateOf, value => Math.abs(value - 1.25) < 0.02, 'Alt+. 仍应按 0.25× 加快到 1.25');
    note(`alt+. playbackRate=${faster}`);

    const settings = await context.newPage();
    try {
      await settings.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
      await settings.getByRole('heading', { name: 'On-page shortcuts' }).waitFor({ state: 'visible', timeout: 15_000 });
      const pageShortcuts = settings.getByLabel('On-page shortcuts');
      await pageShortcuts.getByText('Pause, then previous frame', { exact: true }).waitFor({ state: 'visible' });
      await pageShortcuts.getByText('Pause, then next frame', { exact: true }).waitFor({ state: 'visible' });
      await pageShortcuts.getByText('Increase speed by 0.25×', { exact: true }).waitFor({ state: 'visible' });
      await settings.getByText("Frame step uses , and . with no extra key. Playback pauses, then moves one frame. Live streams and media that can't be seeked stay put.", { exact: true }).waitFor({ state: 'visible' });
      await settings.locator('#shortcuts').screenshot({ path: path.join(dir, 'settings-shortcuts.png'), animations: 'disabled' });
      await settings.locator('#shortcuts').screenshot({ path: path.join(uiDir, 'after-shortcuts.png'), animations: 'disabled' });
      note('settings list , and . without replacing Alt speed keys');
    } finally { await settings.close().catch(() => {}); }

    const keys = await context.newPage();
    try {
      await keys.goto(`${origin}/keys`, { waitUntil: 'domcontentloaded' });
      await keys.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
      await keys.locator('#media').evaluate(async element => {
        if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
        element.pause();
        element.currentTime = 0.4;
      });
      const typedAt = await poll(() => keys.locator('#media').evaluate(element => element.currentTime), near(0.4), '输入框页应停在 0.4 秒');
      await keys.getByRole('textbox', { name: 'Field' }).click();
      await keys.keyboard.press('Period');
      await keys.waitForTimeout(400);
      const typed = await keys.locator('#media').evaluate(element => element.currentTime);
      if (!near(typedAt)(typed)) throw new Error(`输入框里 . 不应逐帧：${typed}`);
      note(`typing left currentTime=${typed}`);
    } finally { await keys.close().catch(() => {}); }

    const blocked = await context.newPage();
    try {
      await blocked.goto(`${origin}/unseekable`, { waitUntil: 'domcontentloaded' });
      await blocked.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
      const blockedPopup = await openActionPopup(context, blocked);
      try {
        const state = await blockedPopup.evaluate(`(() => {
          const back = document.querySelector('button[aria-label="Previous frame"]');
          const forward = document.querySelector('button[aria-label="Next frame"]');
          return { back: !!back?.disabled, forward: !!forward?.disabled, hint: document.querySelector('#frame-step-hint')?.textContent ?? '' };
        })()`);
        if (!state.back || !state.forward || state.hint !== "Live streams and media that can't be seeked don't support frame step.") {
          throw new Error(`不可 seek 时按钮或说明不对：${JSON.stringify(state)}`);
        }
        await blockedPopup.screenshot(path.join(dir, 'unseekable-popup.png'));
        await blockedPopup.screenshot(path.join(uiDir, 'after-unseekable.png'));
        note(`unseekable hint=${state.hint}`);
      } finally { await blockedPopup.close().catch(() => {}); }
      await blocked.mouse.click(12, 12);
      await blocked.keyboard.press('Period');
      await blocked.getByText("Live streams and media that can't be seeked don't support frame step.", { exact: true }).waitFor({ state: 'visible', timeout: 8_000 });
      const stuck = await blocked.locator('#media').evaluate(element => element.currentTime);
      if (stuck !== 0) throw new Error(`不可 seek 时进度被改成 ${stuck}`);
      await blocked.screenshot({ path: path.join(dir, 'toast-unavailable.png'), animations: 'disabled' });
      note(`unseekable toast currentTime=${stuck}`);
    } finally { await blocked.close().catch(() => {}); }

    const state = { ok: true, forward, back, panelStep, pauseThenStep: stepped, rate: faster };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await page.close().catch(() => {});
  }
}

async function driveHotkeyRemap(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const frame = 1 / 30;
  const near = expected => value => Math.abs(value - expected) < 0.012;
  const keyButton = action => settings.getByRole('button', { name: new RegExp(`^Change the key for ${action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\. Now `) });
  const recording = () => settings.getByRole('button', { name: 'Press a key', exact: true });
  const reset = () => settings.getByRole('button', { name: 'Restore default keys', exact: true });
  const shortcuts = () => settings.locator('#shortcuts');
  const paused = () => fixture.locator('#media').evaluate(element => element.paused);
  const time = () => fixture.locator('#media').evaluate(element => element.currentTime);
  const focusFixture = async () => {
    await fixture.bringToFront();
    await fixture.mouse.click(12, 12);
  };
  const expectToggle = async (key, label) => {
    await focusFixture();
    const before = await paused();
    await fixture.keyboard.press(key);
    return poll(paused, value => value === !before, label);
  };
  const expectIgnored = async (key, label) => {
    await focusFixture();
    const before = { paused: await paused(), currentTime: await time() };
    await fixture.keyboard.press(key);
    await fixture.waitForTimeout(400);
    const after = { paused: await paused(), currentTime: await time() };
    if (after.paused !== before.paused || !near(before.currentTime)(after.currentTime)) throw new Error(`${label}：${JSON.stringify({ before, after })}`);
    return after;
  };
  let settings;
  let fixture;
  try {
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
    await keyButton('Play or pause').waitFor({ state: 'visible', timeout: 15_000 });
    const defaults = {};
    for (const [action, label] of [['Play or pause', 'K'], ['Back 10 seconds', 'J'], ['Forward 10 seconds', 'L'], ['Mute or unmute', 'M'], ['Increase speed by 0.25×', '>'], ['Decrease speed by 0.25×', '<'], ['Hold for a temporary speed', 'S'], ['Pause, then previous frame', ','], ['Pause, then next frame', '.']]) {
      const text = (await keyButton(action).innerText()).trim();
      if (text !== label) throw new Error(`${action} 默认键应是 ${label}，实际 ${text}`);
      defaults[action] = text;
    }
    if (!await reset().isDisabled()) throw new Error('默认键位时「Restore default keys」应禁用');
    await shortcuts().getByText('Changes apply right away on open pages.', { exact: false }).waitFor({ state: 'visible' });
    await settings.getByRole('switch', { name: 'Single-key mode' }).click();
    await poll(stored, value => value.singleKey === true, '应打开单键模式');
    await shortcuts().screenshot({ path: path.join(dir, 'settings-default.png'), animations: 'disabled' });
    note(`defaults ${JSON.stringify(defaults)}; single-key mode on`);

    fixture = await context.newPage();
    await fixture.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await fixture.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
      element.pause();
      element.currentTime = 0.5;
    });
    await expectToggle('KeyK', '默认 K 应开始播放');
    await expectToggle('KeyK', '默认 K 应暂停');
    note('default K toggles playback on /video');

    await settings.bringToFront();
    await keyButton('Play or pause').click();
    await recording().waitFor({ state: 'visible' });
    await settings.keyboard.press('KeyJ');
    const conflict = (await settings.locator('#keybind-error').innerText()).trim();
    const conflictCopy = 'J is already used for “Back 10 seconds”. Press another key, or change that one first.';
    if (conflict !== conflictCopy) throw new Error(`撞键提示不对：${conflict}`);
    if ((await stored()).keybinds?.toggle !== 'k') throw new Error('撞键时不应保存');
    if (!await recording().isVisible()) throw new Error('撞键后应继续等待新键');
    await shortcuts().screenshot({ path: path.join(dir, 'settings-conflict.png'), animations: 'disabled' });
    note(`conflict tip: ${conflict}`);
    await settings.keyboard.press('KeyP');
    await poll(stored, value => value.keybinds?.toggle === 'p' && value.singleKey === true, '应保存 Play or pause = p，且单键模式仍开');
    await keyButton('Pause, then next frame').click();
    await settings.keyboard.press('KeyE');
    const remapped = await poll(stored, value => value.keybinds?.frameForward === 'e', '应保存 Pause, then next frame = e');
    if (await settings.locator('#keybind-error').count()) throw new Error('改键成功后不应留着冲突提示');
    await keyButton('Play or pause').filter({ hasText: 'P' }).waitFor({ state: 'visible' });
    await shortcuts().getByText('Frame step uses , and E with no extra key.', { exact: false }).waitFor({ state: 'visible' });
    await shortcuts().screenshot({ path: path.join(dir, 'settings-remapped.png'), animations: 'disabled' });
    note(`saved keybinds ${JSON.stringify(remapped.keybinds)}`);

    await expectIgnored('KeyK', '改键后 K 应留给网站，不再播放');
    await expectToggle('KeyP', '未刷新页面，P 应立即开始播放');
    await expectToggle('KeyP', 'P 应暂停');
    await fixture.locator('#media').evaluate(element => { element.pause(); element.currentTime = 0.5; });
    await poll(time, near(0.5), '夹具应停在 0.5 秒');
    await expectIgnored('Period', '改键后 . 不应逐帧');
    await focusFixture();
    await fixture.keyboard.press('KeyE');
    const stepped = await poll(time, near(0.5 + frame), 'E 应前进约一帧');
    await fixture.screenshot({ path: path.join(dir, 'fixture-remapped.png'), animations: 'disabled' });
    note(`live on open page: K ignored, P toggles, . ignored, E steps to ${stepped}`);

    await settings.bringToFront();
    await settings.goto(`chrome-extension://${extensionId}/options.html#backup`, { waitUntil: 'domcontentloaded' });
    const [download] = await Promise.all([settings.waitForEvent('download'), settings.getByRole('button', { name: 'Export settings', exact: true }).click()]);
    const exportPath = path.join(dir, 'export.json');
    await download.saveAs(exportPath);
    const exported = JSON.parse(await readFile(exportPath, 'utf8'));
    if (exported.settings?.keybinds?.toggle !== 'p' || exported.settings?.keybinds?.frameForward !== 'e') throw new Error(`导出文件应带自定义键位：${JSON.stringify(exported.settings?.keybinds)}`);
    note(`export keybinds ${JSON.stringify(exported.settings.keybinds)}`);

    await settings.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
    await keyButton('Mute or unmute').click();
    await settings.keyboard.press('Escape');
    if (await recording().count()) throw new Error('Esc 应取消录键');
    await reset().click();
    const restored = await poll(stored, value => value.keybinds?.toggle === 'k' && value.keybinds?.frameForward === '.', '恢复默认后应回到 K 和 .');
    await keyButton('Play or pause').filter({ hasText: 'K' }).waitFor({ state: 'visible' });
    if (!await reset().isDisabled()) throw new Error('恢复默认后按钮应禁用');
    await shortcuts().screenshot({ path: path.join(dir, 'settings-restored.png'), animations: 'disabled' });
    await expectToggle('KeyK', '恢复默认后 K 应立即播放');
    await expectToggle('KeyK', '恢复默认后 K 应暂停');
    await expectIgnored('KeyP', '恢复默认后 P 应留给网站');
    note(`restored ${JSON.stringify(restored.keybinds)}; K toggles again, P ignored`);

    await settings.bringToFront();
    await settings.goto(`chrome-extension://${extensionId}/options.html#backup`, { waitUntil: 'domcontentloaded' });
    await settings.locator('#backup input[type="file"]').setInputFiles(exportPath);
    await settings.getByRole('button', { name: 'Replace settings', exact: true }).click();
    const imported = await poll(stored, value => value.keybinds?.toggle === 'p' && value.keybinds?.frameForward === 'e', '导入后应回到自定义键位');
    await expectToggle('KeyP', '导入后 P 应播放');
    await expectToggle('KeyP', '导入后 P 应暂停');
    note(`import restored keybinds ${JSON.stringify(imported.keybinds)}`);

    const state = { ok: true, defaults, conflict, remapped: remapped.keybinds, steppedTo: stepped, exported: exported.settings.keybinds, restored: restored.keybinds, imported: imported.keybinds };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await fixture?.close().catch(() => {});
    await settings?.close().catch(() => {});
  }
}

async function driveFloatingSpeed(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await mkdir('/opt/cursor/artifacts/floating-speed-ui', { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const near = expected => value => Math.abs(value - expected) < 0.02;
  const times = '\u00d7';
  const page = await context.newPage();
  let settings;
  const rate = () => page.locator('#media').evaluate(element => element.playbackRate);
  const volume = () => page.locator('#media').evaluate(element => element.volume);
  const dialog = () => page.getByRole('dialog', { name: 'Volume pill' });
  const hint = (text) => page.getByRole('status').filter({ hasText: text });
  const openPill = async () => {
    const slider = dialog().getByRole('slider', { name: 'Volume' });
    if (!(await slider.isVisible())) {
      const toggle = page.getByRole('button', { name: /volume pill/i });
      const box = await toggle.boundingBox();
      if (!box) throw new Error('浮动入口没有位置');
      await page.mouse.move(box.x + Math.min(8, box.width / 4), box.y + box.height / 2);
      await toggle.click();
    }
    await slider.waitFor({ state: 'visible', timeout: 5_000 });
  };
  try {
    await page.goto(`${origin}/keys`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
    });
    await openPill();
    const shown = () => dialog().getByRole('slider', { name: 'Volume' }).getAttribute('aria-valuenow').then(value => Number(value));
    const beforeVolume = await poll(shown, value => value === 100, '药丸应先显示 100%');
    await dialog().getByRole('slider', { name: 'Volume' }).press('ArrowDown');
    const afterVolume = await poll(volume, near(0.99), '展开后音量滑块下方向键仍应调低音量');
    if (beforeVolume !== 100) throw new Error(`音量起点不是 100%：${beforeVolume}`);
    await dialog().getByRole('button', { name: 'Mute', exact: true }).click();
    await poll(() => page.locator('#media').evaluate(element => element.muted), value => value === true, '药丸静音按钮仍应静音');
    await dialog().getByRole('button', { name: 'Unmute', exact: true }).click();
    await poll(() => page.locator('#media').evaluate(element => element.muted), value => value === false, '取消静音后应恢复出声');
    if (!near(0.99)(await volume())) throw new Error('取消静音不应把音量改掉');
    note(`volume path still works, volume=${afterVolume}`);

    const speedGroup = dialog().getByRole('group', { name: 'Speed' });
    await speedGroup.waitFor({ state: 'visible' });
    const presets = ['0.75', '1', '1.25', '1.5', '2', '2.5', '3', '4'];
    for (const preset of presets) await speedGroup.getByRole('button', { name: `${preset}${times} speed`, exact: true }).waitFor({ state: 'visible' });
    if (await speedGroup.getByRole('button', { name: `1${times} speed`, exact: true }).getAttribute('aria-pressed') !== 'true') throw new Error('默认 1× 预设应按下');
    await speedGroup.getByRole('button', { name: `Increase speed by 0.25${times}`, exact: true }).click();
    const stepped = await poll(rate, near(1.25), '加快一档应到 1.25');
    await hint(`Speed 1.25${times}`).waitFor({ state: 'visible', timeout: 5_000 });
    await page.screenshot({ path: path.join(dir, 'fixture-step.png'), animations: 'disabled' });
    await dialog().screenshot({ path: path.join(dir, 'pill-step.png'), animations: 'disabled' });
    await copyFile(path.join(dir, 'pill-step.png'), '/opt/cursor/artifacts/floating-speed-ui/after-expanded.png');
    await copyFile(path.join(dir, 'fixture-step.png'), '/opt/cursor/artifacts/floating-speed-ui/after-page.png');
    note(`step + playbackRate=${stepped}`);

    await speedGroup.getByRole('button', { name: `2${times} speed`, exact: true }).click();
    const presetRate = await poll(rate, near(2), '点 2× 预设应到 2');
    await hint(`Speed 2${times}`).waitFor({ state: 'visible', timeout: 5_000 });
    await dialog().screenshot({ path: path.join(dir, 'pill-preset.png'), animations: 'disabled' });
    const prefs = (await stored()).sitePrefs ?? {};
    if (Object.keys(prefs).length) throw new Error(`改倍速不应记住站点：${JSON.stringify(prefs)}`);
    note(`preset playbackRate=${presetRate}, sitePrefs empty`);

    const field = page.locator('#field');
    await field.focus();
    await page.keyboard.type('hi');
    if (await field.inputValue() !== 'hi') throw new Error(`输入框聚焦时应能打字：${await field.inputValue()}`);
    await page.keyboard.press('Alt+Period');
    await page.waitForTimeout(400);
    const whileTyping = await rate();
    if (!near(2)(whileTyping)) throw new Error(`输入框聚焦时 Alt+. 不应改倍速：${whileTyping}`);
    note('typing in Field is not blocked and does not change speed');

    settings = await context.newPage();
    try {
      await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
      const half = settings.getByRole('group', { name: 'Speed step' }).getByRole('button', { name: `0.5${times}`, exact: true });
      await half.click();
      await poll(stored, value => value.rateStep === 0.5, '设置里应存下 rateStep=0.5');
      await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-step.png'), animations: 'disabled' });
      note('saved rateStep=0.5 without reloading the fixture');
    } finally { /* keep settings open so the fixture is not reloaded */ }

    await page.bringToFront();
    await openPill();
    await dialog().getByRole('button', { name: `Increase speed by 0.5${times}`, exact: true }).click();
    const halfStep = await poll(rate, near(2.5), '同一页加快应按 0.5× 到 2.5');
    await page.locator('#media').evaluate(element => { element.playbackRate = 4; });
    await poll(() => dialog().getByRole('button', { name: `Increase speed by 0.5${times}`, exact: true }).isDisabled(), value => value === true, '4× 时加快按钮应禁用');
    note(`0.5 step playbackRate=${halfStep}, increase disabled at 4`);

    await settings.bringToFront();
    await settings.goto(`chrome-extension://${extensionId}/options.html#presets`, { waitUntil: 'domcontentloaded' });
    await settings.getByRole('button', { name: `Remove 4${times}`, exact: true }).click();
    await poll(stored, value => Array.isArray(value.ratePresets) && !value.ratePresets.includes(4), '设置里应去掉 4× 预设');
    await page.bringToFront();
    await openPill();
    if (await dialog().getByRole('button', { name: `4${times} speed`, exact: true }).count()) throw new Error('去掉的预设不应还出现在浮动药丸里');
    await dialog().screenshot({ path: path.join(dir, 'pill-presets.png'), animations: 'disabled' });
    note('removed 4× preset disappeared from the pill');

    await settings.bringToFront();
    await settings.getByRole('button', { name: 'Restore defaults', exact: true }).click();
    await poll(stored, value => Array.isArray(value.ratePresets) && value.ratePresets.includes(4), '应恢复默认预设');
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    await settings.getByRole('group', { name: 'Speed step' }).getByRole('button', { name: `0.25${times}`, exact: true }).click();
    const restored = await poll(stored, value => value.rateStep === 0.25 && Array.isArray(value.ratePresets) && value.ratePresets.includes(4) && Object.keys(value.sitePrefs ?? {}).length === 0, '应恢复默认步长和预设，且没有站点记忆');
    note(`restored rateStep=${restored.rateStep}`);

    const state = {
      ok: true,
      volume: afterVolume,
      step: stepped,
      preset: presetRate,
      typed: 'hi',
      whileTyping,
      halfStep,
      remembered: false,
    };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await settings?.close().catch(() => {});
    await page.close().catch(() => {});
  }
}

async function driveFloatingPlayback(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await mkdir('/opt/cursor/artifacts/floating-playback-ui', { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const near = expected => value => Math.abs(value - expected) < 0.05;
  const nearRate = expected => value => Math.abs(value - expected) < 0.02;
  const times = '\u00d7';
  const page = await context.newPage();
  let settings;
  let blocked;
  let popup;
  const time = () => page.locator('#media').evaluate(element => element.currentTime);
  const paused = () => page.locator('#media').evaluate(element => element.paused);
  const rate = () => page.locator('#media').evaluate(element => element.playbackRate);
  const dialog = () => page.getByRole('dialog', { name: 'Volume pill' });
  const openPill = async () => {
    const play = dialog().getByRole('button', { name: 'Play', exact: true }).or(dialog().getByRole('button', { name: 'Pause', exact: true }));
    if (!(await play.isVisible())) {
      const toggle = page.getByRole('button', { name: /volume pill/i });
      const box = await toggle.boundingBox();
      if (!box) throw new Error('浮动入口没有位置');
      await page.mouse.move(box.x + Math.min(8, box.width / 4), box.y + box.height / 2);
      await toggle.click();
    }
    await play.waitFor({ state: 'visible', timeout: 5_000 });
  };
  const park = async (seconds) => {
    await page.locator('#media').evaluate((element, next) => { element.pause(); element.currentTime = next; }, seconds);
    await poll(time, near(seconds), `夹具应停在 ${seconds} 秒`);
    await poll(paused, value => value === true, '夹具应暂停');
  };
  try {
    await page.goto(`${origin}/long`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
      element.pause();
    });
    await openPill();
    const volume = () => page.locator('#media').evaluate(element => element.volume);
    await dialog().getByRole('slider', { name: 'Volume' }).press('ArrowDown');
    const afterVolume = await poll(volume, value => value < 1 && Math.abs(value - 0.99) < 0.02, '展开后音量滑块下方向键仍应调低音量');
    await dialog().getByRole('button', { name: `Increase speed by 0.25${times}`, exact: true }).click();
    const stepped = await poll(rate, nearRate(1.25), '加快一档应到 1.25');
    await page.getByRole('status').filter({ hasText: `Speed 1.25${times}` }).waitFor({ state: 'visible', timeout: 5_000 });
    await dialog().getByRole('button', { name: `1${times} speed`, exact: true }).click();
    await poll(rate, nearRate(1), '点 1× 应回到 1');
    note(`volume=${afterVolume}, speed step=${stepped}, restored to 1`);

    await dialog().getByRole('button', { name: 'Play', exact: true }).click();
    await poll(paused, value => value === false, '点播放后应开始播放');
    const moved = await poll(time, value => value > 0.2, '播放后进度应前进');
    await page.screenshot({ path: path.join(dir, 'fixture-playing.png'), animations: 'disabled' });
    await dialog().screenshot({ path: path.join(dir, 'pill-playing.png'), animations: 'disabled' });
    await copyFile(path.join(dir, 'pill-playing.png'), '/opt/cursor/artifacts/floating-playback-ui/after-expanded.png');
    await copyFile(path.join(dir, 'fixture-playing.png'), '/opt/cursor/artifacts/floating-playback-ui/after-page.png');
    await dialog().getByRole('button', { name: 'Pause', exact: true }).click();
    await poll(paused, value => value === true, '点暂停后应停住');
    const held = await time();
    await page.waitForTimeout(400);
    const still = await time();
    if (Math.abs(still - held) > 0.05) throw new Error(`暂停后进度仍在走：${held} -> ${still}`);
    note(`played to ${moved}, paused at ${still}`);

    await park(40);
    await openPill();
    await dialog().getByRole('button', { name: 'Forward 10 seconds', exact: true }).click();
    const forwarded = await poll(time, near(50), '默认应前进 10 秒');
    await dialog().getByRole('button', { name: 'Back 10 seconds', exact: true }).click();
    const backed = await poll(time, near(40), '默认应后退 10 秒');
    note(`default skip forward=${forwarded} back=${backed}`);

    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    await settings.getByRole('group', { name: 'Skip step' }).getByRole('button', { name: '30s', exact: true }).click();
    await poll(stored, value => value.skipSeconds === 30, '设置里应存下 skipSeconds=30');
    await page.bringToFront();
    await openPill();
    await dialog().getByRole('button', { name: 'Forward 30 seconds', exact: true }).waitFor({ state: 'visible' });
    await dialog().screenshot({ path: path.join(dir, 'pill-30.png'), animations: 'disabled' });
    await park(40);
    await dialog().getByRole('button', { name: 'Forward 30 seconds', exact: true }).click();
    const jumped = await poll(time, near(70), '30 秒步长应前进到 70 秒');
    note(`30s skip landed at ${jumped}`);

    await settings.bringToFront();
    await settings.getByRole('group', { name: 'Skip step' }).getByRole('button', { name: '10s', exact: true }).click();
    await settings.getByRole('switch', { name: 'Scale skip with speed' }).click();
    await poll(stored, value => value.skipSeconds === 10 && value.skipWithRate === true, '应回到 10 秒并打开步长随倍速');
    await page.bringToFront();
    await openPill();
    await dialog().getByRole('button', { name: `2${times} speed`, exact: true }).click();
    await poll(rate, nearRate(2), '点 2× 预设应到 2');
    await dialog().getByRole('button', { name: 'Forward 20 seconds', exact: true }).waitFor({ state: 'visible' });
    await dialog().screenshot({ path: path.join(dir, 'pill-20.png'), animations: 'disabled' });
    await park(40);
    await dialog().getByRole('button', { name: 'Forward 20 seconds', exact: true }).click();
    const scaled = await poll(time, near(60), '2× 打开随倍速后应前进 20 秒');
    note(`scaled skip landed at ${scaled}`);
    popup = await openActionPopup(context, page);
    const popupLabels = await poll(
      () => popup.evaluate(`(() => [...document.querySelectorAll('button')].map(button => button.getAttribute('aria-label')).filter(Boolean))()`),
      value => Array.isArray(value) && value.includes('Forward 20 seconds') && value.includes('Back 20 seconds'),
      '弹出面板在 2× 且步长随倍速打开时也应是 20 秒',
    );
    await popup.screenshot(path.join(dir, 'popup-20.png'));
    await popup.close();
    popup = undefined;
    note(`popup labels include 20s: ${popupLabels.filter(label => String(label).includes('20 seconds')).join(', ')}`);

    blocked = await context.newPage();
    await blocked.goto(`${origin}/unseekable`, { waitUntil: 'domcontentloaded' });
    const blockedDialog = blocked.getByRole('dialog', { name: 'Volume pill' });
    const blockedToggle = blocked.getByRole('button', { name: /volume pill/i });
    await blockedToggle.waitFor({ state: 'visible', timeout: 15_000 });
    const box = await blockedToggle.boundingBox();
    if (!box) throw new Error('不可跳转页的浮动入口没有位置');
    await blocked.mouse.move(box.x + Math.min(8, box.width / 4), box.y + box.height / 2);
    await blockedToggle.click();
    const unavailable = 'Live streams and media that can\'t be seeked can\'t jump.';
    const forward = blockedDialog.getByRole('button', { name: 'Forward 10 seconds', exact: true });
    const back = blockedDialog.getByRole('button', { name: 'Back 10 seconds', exact: true });
    await forward.waitFor({ state: 'visible', timeout: 5_000 });
    if (!(await forward.isDisabled()) || !(await back.isDisabled())) throw new Error('不可跳转时前进和后退应禁用');
    await blockedDialog.getByText(unavailable, { exact: true }).waitFor({ state: 'visible' });
    const stuck = await blocked.locator('#media').evaluate(element => element.currentTime);
    if (stuck !== 0) throw new Error(`不可跳转页进度应停在 0：${stuck}`);
    await blockedDialog.screenshot({ path: path.join(dir, 'pill-unseekable.png'), animations: 'disabled' });
    await copyFile(path.join(dir, 'pill-unseekable.png'), '/opt/cursor/artifacts/floating-playback-ui/after-unseekable.png');
    note(`unseekable hint visible, currentTime=${stuck}`);

    await settings.bringToFront();
    await settings.getByRole('switch', { name: 'Scale skip with speed' }).click();
    const restored = await poll(stored, value => value.skipSeconds === 10 && value.skipWithRate === false && Object.keys(value.sitePrefs ?? {}).length === 0, '应关闭步长随倍速，且没有站点记忆');
    note(`restored skipSeconds=${restored.skipSeconds} skipWithRate=${restored.skipWithRate}`);

    const state = { ok: true, volume: afterVolume, speed: stepped, playedTo: moved, pausedAt: still, forwarded, backed, thirty: jumped, scaled, popup: ['Back 20 seconds', 'Forward 20 seconds'], unseekable: stuck, remembered: false };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await popup?.close().catch(() => {});
    await blocked?.close().catch(() => {});
    await settings?.close().catch(() => {});
    await page.close().catch(() => {});
  }
}

async function driveFloatingEntryNote(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const times = '\u00d7';
  const near = expected => value => Math.abs(value - expected) < 0.02;
  const page = await context.newPage();
  let settings;
  const floater = () => page.getByRole('complementary', { name: 'Floating controller' });
  const toggle = () => page.getByRole('button', { name: /volume pill/i });
  const entry = () => page.getByRole('status', { name: /^On-page / });
  const volume = () => page.locator('#media').evaluate(element => element.volume);
  const rate = () => page.locator('#media').evaluate(element => element.playbackRate);
  const inside = async label => {
    const box = await entry().boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) throw new Error(`${label}：旁注没有位置`);
    if (box.x < -1 || box.y < -1 || box.x + box.width > viewport.width + 1 || box.y + box.height > viewport.height + 1) {
      throw new Error(`${label}：旁注超出视口 ${JSON.stringify({ box, viewport })}`);
    }
    return box;
  };
  const collapse = async () => {
    if ((await toggle().getAttribute('aria-expanded')) !== 'true') return;
    await page.mouse.click(80, 80);
    await poll(() => toggle().getAttribute('aria-expanded'), value => value !== 'true', '点页面空白应收起药丸');
  };
  const wheel = async (deltaY) => {
    const at = await centerOf(page.locator('#media'));
    await page.mouse.move(at.x, at.y);
    await page.keyboard.down('Alt');
    try { await page.mouse.wheel(0, deltaY); }
    finally { await page.keyboard.up('Alt'); }
  };
  try {
    await page.goto(`${origin}/keys`, { waitUntil: 'domcontentloaded' });
    await toggle().waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
    });
    await poll(() => entry().innerText(), value => value === '100%', '默认应收起并显示 100%');
    if ((await toggle().getAttribute('aria-expanded')) === 'true') throw new Error('读旁注时药丸不应展开');
    if ((await floater().getAttribute('data-revealed')) !== 'false') throw new Error('默认应半隐藏');
    const hiddenBox = await inside('半隐藏');
    await page.screenshot({ path: path.join(dir, 'half-hidden.png'), animations: 'disabled' });
    note(`half-hidden ${JSON.stringify(hiddenBox)} label=${await entry().getAttribute('aria-label')}`);

    const button = await toggle().boundingBox();
    if (!button) throw new Error('浮动入口没有位置');
    await page.mouse.move(button.x + Math.min(8, button.width / 4), button.y + button.height / 2);
    await poll(() => floater().getAttribute('data-revealed'), value => value === 'true', '悬停应完全显示');
    const hoverBox = await inside('悬停');
    if ((await entry().innerText()) !== '100%') throw new Error('悬停时旁注不应改成别的状态');
    await page.screenshot({ path: path.join(dir, 'hover.png'), animations: 'disabled' });
    await page.mouse.move(80, 80);
    await poll(() => floater().getAttribute('data-revealed'), value => value === 'false', '离开后应回到半隐藏');
    note(`hover ${JSON.stringify(hoverBox)}`);

    await page.mouse.click(80, 80);
    await page.keyboard.press('Alt+Period');
    const sped = await poll(rate, near(1.25), 'Alt+. 应到 1.25');
    await poll(() => entry().getAttribute('aria-label'), value => value === `On-page speed 1.25${times}`, '100% 且倍速不是 1× 时应改显页内倍速');
    if ((await entry().innerText()) !== `1.25${times}`) throw new Error('旁注正文应是 1.25×');
    if ((await toggle().getAttribute('aria-expanded')) === 'true') throw new Error('改倍速后仍应不展开');
    await inside('倍速');
    await page.screenshot({ path: path.join(dir, 'speed.png'), animations: 'disabled' });
    note(`speed ${sped}`);

    await page.keyboard.press('Alt+Comma');
    await poll(rate, near(1), 'Alt+, 应回到 1');
    await poll(() => entry().innerText(), value => value === '100%', '回到 1× 后应恢复音量百分比');

    await wheel(100);
    const lowered = await poll(volume, near(0.9), 'Alt+滚轮向下应到 90%');
    await collapse();
    await poll(() => entry().getAttribute('aria-label'), value => value === 'On-page volume 90%', '离开 100% 后优先音量应显示百分比');
    await inside('90%');
    await page.screenshot({ path: path.join(dir, 'volume.png'), animations: 'disabled' });
    await page.keyboard.press('Alt+Period');
    await poll(rate, near(1.25), '90% 时再加快应到 1.25');
    await poll(() => entry().innerText(), value => value === '90%', '音量不是 100% 时优先音量不改显倍速');
    note(`volume ${lowered}`);

    await wheel(-100);
    await poll(volume, value => value > 0.98, '从 90% 向上应先回到 100%');
    await collapse();
    await poll(() => entry().getAttribute('aria-label'), value => value === `On-page speed 1.25${times}`, '回到 100% 且倍速不是 1× 时应再显示倍速');
    await wheel(-100);
    await collapse();
    await poll(() => entry().getAttribute('aria-label'), value => value === 'On-page volume 110%', '超过 100% 应显示页内音量');
    if ((await entry().getAttribute('data-boost')) !== 'true') throw new Error('超过 100% 应用强调色');
    if ((await entry().innerText()) !== '110%') throw new Error('旁注正文应带百分号');
    const toolbar = await poll(async () => {
      const url = page.url();
      return worker.evaluate(async pageUrl => {
        const tabId = (await chrome.tabs.query({ url: pageUrl })).find(tab => tab.url === pageUrl)?.id;
        if (tabId == null) return null;
        const [text, title] = await Promise.all([chrome.action.getBadgeText({ tabId }), chrome.action.getTitle({ tabId })]);
        return { text, title };
      }, url);
    }, value => value?.text === '110' && value.title === 'Volume is boosted to 110%', '工具栏角标应是不带百分号的 110，标题是放大文案');
    if (toolbar.title === 'On-page volume 110%') throw new Error('工具栏标题不应使用页内旁注文案');
    await inside('110%');
    await page.screenshot({ path: path.join(dir, 'boost.png'), animations: 'disabled' });
    note(`toolbar ${toolbar.text} / ${toolbar.title}`);

    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#floating`, { waitUntil: 'domcontentloaded' });
    const group = settings.getByRole('group', { name: 'Entry note' });
    await group.waitFor({ state: 'visible', timeout: 15_000 });
    await settings.getByText('This is separate from the toolbar badge above 100%.', { exact: false }).waitFor({ state: 'visible' });
    const preferVolume = group.getByRole('button', { name: 'Prefer volume', exact: true });
    const preferSpeed = group.getByRole('button', { name: 'Prefer speed', exact: true });
    const hide = group.getByRole('button', { name: 'Hide', exact: true });
    if ((await preferVolume.getAttribute('aria-pressed')) !== 'true') throw new Error('默认应按下优先音量');
    await settings.locator('#floating').screenshot({ path: path.join(dir, 'settings-volume.png'), animations: 'disabled' });
    await preferSpeed.click();
    await poll(stored, value => value.floatingNote === 'rate', '设置里应存下 floatingNote=rate');
    await settings.locator('#floating').screenshot({ path: path.join(dir, 'settings-rate.png'), animations: 'disabled' });
    await page.bringToFront();
    await poll(() => entry().getAttribute('aria-label'), value => value === `On-page speed 1.25${times}`, '优先倍速应显示倍速，即使音量超过 100%');
    if ((await entry().getAttribute('data-boost')) !== 'false') throw new Error('显示倍速时不用音量强调色');
    await page.screenshot({ path: path.join(dir, 'prefer-speed.png'), animations: 'disabled' });
    await settings.bringToFront();
    await hide.click();
    await poll(stored, value => value.floatingNote === 'off', '设置里应存下 floatingNote=off');
    await settings.locator('#floating').screenshot({ path: path.join(dir, 'settings-off.png'), animations: 'disabled' });
    await page.bringToFront();
    await poll(() => entry().count(), value => value === 0, '关闭后旁注应消失');
    if ((await toggle().getAttribute('aria-expanded')) === 'true') throw new Error('关闭旁注不应展开药丸');
    await page.screenshot({ path: path.join(dir, 'hidden.png'), animations: 'disabled' });
    await settings.bringToFront();
    await preferVolume.click();
    const restored = await poll(stored, value => value.floatingNote === 'volume' && Object.keys(value.sitePrefs ?? {}).length === 0, '应恢复优先音量，且没有站点记忆');
    await page.bringToFront();
    await poll(() => entry().getAttribute('aria-label'), value => value === 'On-page volume 110%', '恢复后应回到页内音量');
    note(`restored floatingNote=${restored.floatingNote}`);

    const state = { ok: true, halfHidden: hiddenBox, hover: hoverBox, speed: sped, volume: lowered, toolbar, floatingNote: restored.floatingNote };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await settings?.close().catch(() => {});
    await page.close().catch(() => {});
  }
}

async function driveFloatingOpenPanel(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const page = await context.newPage();
  const dialog = () => page.getByRole('dialog', { name: 'Volume pill' });
  const trigger = () => page.getByRole('button', { name: /volume pill/i });
  const hint = () => dialog().getByRole('status').filter({ hasText: 'Click the toolbar icon' });
  const toolbarPopup = async () => {
    const url = await worker.evaluate(async () => chrome.action.getPopup({}));
    if (typeof url !== 'string' || !url.endsWith('/popup.html')) throw new Error(`工具栏弹出页被换掉了：${String(url)}`);
    return url;
  };
  try {
    const beforePopup = await toolbarPopup();
    note(`toolbar popup before ${beforePopup}`);
    await page.goto(`${origin}/feed`, { waitUntil: 'domcontentloaded' });
    await trigger().waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
    });
    const mediaTitle = await poll(async () => (await trigger().getAttribute('title'))?.split(' · ')[0] ?? '', name => name === 'Feed preview' || name === 'Main player', '浮动入口应绑定 Feed preview 或 Main player');
    const other = mediaTitle === 'Feed preview' ? 'Main player' : 'Feed preview';
    const box = await trigger().boundingBox();
    if (!box) throw new Error('浮动入口没有位置');
    await page.mouse.move(box.x + Math.min(8, box.width / 4), box.y + box.height / 2);
    await trigger().click();
    const openButton = dialog().getByRole('button', { name: 'Open panel', exact: true });
    await openButton.waitFor({ state: 'visible', timeout: 5_000 });
    if (await hint().count() && await hint().isVisible()) throw new Error('还没点就出现了降级提示');
    await dialog().screenshot({ path: path.join(dir, 'pill-button.png'), animations: 'disabled' });
    await page.screenshot({ path: path.join(dir, 'fixture.png'), animations: 'disabled' });
    note(`pill controls ${mediaTitle}`);
    await openButton.click();
    const popup = await openActionPopup(context, page, { alreadyOpen: true, timeout: 6_000 });
    let mode = 'hint';
    let heading = '';
    if (popup) {
      mode = 'opened';
      heading = popup.seen?.heading ?? (await popup.view()).heading;
      if (heading !== mediaTitle) throw new Error(`弹出面板标题是 ${heading}，药丸绑定的是 ${mediaTitle}`);
      if (heading === other) throw new Error(`弹出面板选中了另一条媒体 ${other}`);
      if (!popup.seen?.region) throw new Error('弹出面板没有 Media controls');
      if (await hint().count() && await hint().isVisible()) throw new Error('面板已经打开时不应再提示点工具栏');
      if (await openButton.isVisible() !== true) throw new Error('打开面板按钮不应消失');
      await popup.screenshot(path.join(dir, 'popup-selected.png'));
      await popup.close();
      note(`opened popup heading=${heading}`);
    } else {
      await hint().waitFor({ state: 'visible', timeout: 2_000 });
      const text = (await hint().innerText()).trim();
      if (text !== 'Click the toolbar icon') throw new Error(`降级文案不是 Click the toolbar icon：${text}`);
      if (await openButton.isVisible() !== true) throw new Error('打开面板按钮不应消失');
      await dialog().screenshot({ path: path.join(dir, 'pill-hint.png'), animations: 'disabled' });
      const direct = await worker.evaluate(async () => {
        try {
          await chrome.action.openPopup();
          return 'opened';
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      }).catch(error => error instanceof Error ? error.message : String(error));
      note(`degraded; direct openPopup => ${direct}`);
    }
    const afterPopup = await toolbarPopup();
    const state = { ok: true, mode, mediaTitle, heading, toolbarPopup: beforePopup, toolbarPopupAfter: afterPopup };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    note(`mode=${mode} toolbar still ${afterPopup}`);
    return state;
  } finally {
    await page.close().catch(() => {});
  }
}

async function driveFloatingWhilePlaying(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const pill = page => page.getByRole('button', { name: /volume pill/i });
  const pausedOf = page => page.locator('#media').evaluate(element => element.paused);
  const volumeOf = page => page.locator('#media').evaluate(element => element.volume);
  const play = async page => {
    await page.locator('#media').evaluate(async element => { await element.play(); });
    await poll(() => pausedOf(page), value => value === false, '媒体应开始播放');
  };
  const pause = async page => {
    await page.locator('#media').evaluate(element => { element.pause(); });
    await poll(() => pausedOf(page), value => value === true, '媒体应暂停');
  };
  let settings;
  let fixture;
  try {
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#floating`, { waitUntil: 'domcontentloaded' });
    const toggle = settings.getByRole('switch', { name: 'Show only while the selected media is playing' });
    await toggle.waitFor({ state: 'visible', timeout: 15_000 });
    if (await toggle.getAttribute('aria-checked') !== 'false') throw new Error('仅播放时显示默认应关闭');
    await settings.getByText('quick pause and play').waitFor({ state: 'visible' });
    await settings.getByText('Scrolling over the main player').waitFor({ state: 'visible' });
    const hover = settings.getByRole('switch', { name: 'Scroll over the main player to change volume' });
    if (await hover.getAttribute('aria-checked') !== 'true') throw new Error('悬停滚轮应仍默认开启');
    await settings.locator('#floating').screenshot({ path: path.join(dir, 'settings-off.png'), animations: 'disabled' });
    const offStored = await stored();
    if (offStored.floatingWhilePlaying === true || offStored.hoverWheel === false || offStored.floating === false) {
      throw new Error(`关闭时不应改浮动或悬停滚轮：${JSON.stringify({ floatingWhilePlaying: offStored.floatingWhilePlaying, hoverWheel: offStored.hoverWheel, floating: offStored.floating })}`);
    }
    note('settings off, hover wheel still on');

    fixture = await context.newPage();
    await fixture.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await pill(fixture).waitFor({ state: 'visible', timeout: 15_000 });
    await fixture.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
    });
    if (await pausedOf(fixture) !== true) throw new Error('夹具视频开头应是暂停，开关关闭时入口仍应在');
    await fixture.screenshot({ path: path.join(dir, 'fixture-paused-off.png'), animations: 'disabled' });
    note('paused with setting off, floater visible');
    await fixture.locator('#media').click({ position: { x: 24, y: 24 } });
    await play(fixture);
    await pill(fixture).waitFor({ state: 'visible' });
    note('playing with setting off, floater still visible');

    await settings.bringToFront();
    await toggle.click();
    await poll(() => toggle.getAttribute('aria-checked'), value => value === 'true', '应能打开仅播放时显示');
    const onStored = await poll(stored, value => value.floatingWhilePlaying === true && value.hoverWheel !== false && value.floating !== false, '存储里应打开 floatingWhilePlaying，且不关掉浮动和悬停滚轮');
    await settings.locator('#floating').screenshot({ path: path.join(dir, 'settings-on.png'), animations: 'disabled' });
    note(`saved floatingWhilePlaying=${onStored.floatingWhilePlaying} hoverWheel=${onStored.hoverWheel}`);

    await fixture.bringToFront();
    await play(fixture);
    await pill(fixture).waitFor({ state: 'visible', timeout: 8_000 });
    await fixture.screenshot({ path: path.join(dir, 'fixture-playing.png'), animations: 'disabled' });
    note('playing shows the floater');

    const hideStarted = Date.now();
    await pause(fixture);
    await fixture.waitForTimeout(180);
    if (!(await pill(fixture).isVisible())) throw new Error('暂停后短时间内入口不应马上消失');
    await pill(fixture).waitFor({ state: 'hidden', timeout: 8_000 });
    const hideMs = Date.now() - hideStarted;
    await fixture.screenshot({ path: path.join(dir, 'fixture-paused.png'), animations: 'disabled' });
    note(`paused hid the floater after ${hideMs}ms`);

    await fixture.locator('#media').evaluate(element => { element.volume = 0.5; });
    const at = await centerOf(fixture.locator('#media'));
    await fixture.mouse.move(at.x, at.y);
    await fixture.waitForTimeout(320);
    await fixture.mouse.wheel(0, -100);
    const wheeled = await poll(() => volumeOf(fixture), value => Math.abs(value - 0.6) < 0.02, '入口隐藏时，主播放区悬停滚轮仍应调音量');
    if (await pill(fixture).isVisible()) throw new Error('调音量时暂停中的入口不应出现');
    const wheelStored = await stored();
    if (wheelStored.hoverWheel === false || wheelStored.floatingWhilePlaying !== true) throw new Error('滚轮不应改这两个开关');
    note(`hover wheel while hidden volume=${wheeled}`);

    await play(fixture);
    await pill(fixture).waitFor({ state: 'visible', timeout: 8_000 });
    await fixture.screenshot({ path: path.join(dir, 'fixture-playing-again.png'), animations: 'disabled' });
    note('play brings the floater back');

    const samples = await fixture.locator('#media').evaluate(async element => {
      const visible = () => {
        const host = document.querySelector('ottertap-controller');
        return !!host?.shadowRoot?.querySelector('aside');
      };
      const seen = [];
      for (let index = 0; index < 4; index += 1) {
        element.pause();
        await new Promise(resolve => setTimeout(resolve, 250));
        seen.push(visible());
        await element.play();
        await new Promise(resolve => setTimeout(resolve, 120));
        seen.push(visible());
      }
      return seen;
    });
    if (samples.some(value => value !== true)) throw new Error(`快速暂停/播放时入口闪掉了：${JSON.stringify(samples)}`);
    if (await pausedOf(fixture) !== false) throw new Error('快速切换应停在播放');
    await pill(fixture).waitFor({ state: 'visible' });
    note(`rapid pause/play stayed visible ${JSON.stringify(samples)}`);

    const state = { ok: true, hideMs, wheeled, rapid: samples };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await settings?.close().catch(() => {});
    await fixture?.close().catch(() => {});
  }
}

async function driveFloatingHiddenSites(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const otherOrigin = 'https://elsewhere.test';
  const serveOther = async route => {
    const body = routedHtml(new URL(route.request().url()).pathname);
    if (!body) { await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }); return; }
    await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers: { 'cache-control': 'no-store' }, body });
  };
  const hostName = new URL(origin).hostname;
  const sameList = (value, expected) => JSON.stringify(value?.floatingHiddenSites ?? []) === JSON.stringify(expected);
  const rulesUntouched = value => value.floating !== false && (value.siteMode ?? 'all') === 'all' && (value.sites ?? []).length === 0;
  const pill = page => page.getByRole('button', { name: /volume pill/i });
  const shadowAside = page => page.evaluate(() => !!document.querySelector('ottertap-controller')?.shadowRoot?.querySelector('aside'));
  const rateOf = page => page.locator('#media').evaluate(element => element.playbackRate);
  const near = target => value => Math.abs(value - target) < 0.01;
  const ready = async page => page.locator('#media').evaluate(async element => {
    if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
  });
  const shortcutWorks = async (page, label) => {
    await page.bringToFront();
    await page.mouse.click(1000, 600);
    await page.keyboard.press('Alt+Period');
    const faster = await poll(() => rateOf(page), near(1.25), `${label}：Alt+. 应把倍速调到 1.25`);
    await page.keyboard.press('Alt+Digit0');
    await poll(() => rateOf(page), near(1), `${label}：Alt+0 应回到 1`);
    return faster;
  };
  const popupToggle = popup => popup.evaluate(`(() => document.querySelector('button[aria-label="Hide floating on this site"]')?.getAttribute('aria-pressed') ?? '')()`);
  let settings;
  let fixture;
  let other;
  await context.route(`${otherOrigin}/**`, serveOther);
  try {
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#floating`, { waitUntil: 'domcontentloaded' });
    await settings.locator('#floating').getByText('Sites without the floating button', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
    await settings.locator('#floating').getByText('No sites yet.', { exact: false }).waitFor({ state: 'visible' });
    await settings.locator('#floating').getByText('separate from Site rules', { exact: false }).waitFor({ state: 'visible' });
    if (!sameList(await stored(), [])) throw new Error('名单默认应为空');
    await settings.locator('#floating').screenshot({ path: path.join(dir, 'settings-empty.png'), animations: 'disabled' });
    note('settings list empty by default');

    fixture = await context.newPage();
    await fixture.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await pill(fixture).waitFor({ state: 'visible', timeout: 15_000 });
    await ready(fixture);
    await pill(fixture).click();
    const dialog = fixture.getByRole('dialog', { name: 'Volume pill' });
    const hide = dialog.getByRole('button', { name: 'Hide floating on this site', exact: true });
    await hide.waitFor({ state: 'visible', timeout: 5_000 });
    await dialog.getByRole('button', { name: 'Open panel', exact: true }).waitFor({ state: 'visible' });
    await dialog.screenshot({ path: path.join(dir, 'pill-hide-button.png'), animations: 'disabled' });
    await hide.click();
    await pill(fixture).waitFor({ state: 'hidden', timeout: 5_000 });
    await fixture.getByRole('status').filter({ hasText: 'Floating button hidden on this site' }).waitFor({ state: 'visible', timeout: 3_000 });
    await fixture.screenshot({ path: path.join(dir, 'fixture-hidden.png'), animations: 'disabled' });
    const hidden = await poll(stored, value => sameList(value, [hostName]) && rulesUntouched(value), `存储里应只多出 ${hostName}，且不动全局浮动和网站规则`);
    note(`pill hid ${hostName}; stored ${JSON.stringify(hidden.floatingHiddenSites)} siteMode=${hidden.siteMode ?? 'all'} sites=${JSON.stringify(hidden.sites ?? [])}`);

    const hiddenRate = await shortcutWorks(fixture, '隐藏后的同一页');
    note(`on-page shortcut still works while hidden (rate ${hiddenRate})`);
    await fixture.reload({ waitUntil: 'domcontentloaded' });
    await ready(fixture);
    const reloadedRate = await shortcutWorks(fixture, '刷新后');
    await fixture.waitForTimeout(1_500);
    if (await shadowAside(fixture)) throw new Error('刷新后本站不应再出现浮动入口');
    note(`after reload: no floater, Alt+. still ${reloadedRate}`);

    const popup = await openActionPopup(context, fixture);
    try {
      if (await popupToggle(popup) !== 'true') throw new Error('弹出面板里的本站隐藏浮动按钮应为按下');
      await popup.screenshot(path.join(dir, 'popup-hidden.png'));
      await popup.click('Play');
      await poll(() => fixture.locator('#media').evaluate(element => element.paused), value => value === false, '弹出面板仍应能播放本站媒体');
      await popup.click('Pause');
      await poll(() => fixture.locator('#media').evaluate(element => element.paused), value => value === true, '弹出面板仍应能暂停');
    } finally { await popup.close(); }
    note('popup still controls media; eye toggle shows hidden');

    other = await context.newPage();
    const response = await other.goto(`${otherOrigin}/video`, { waitUntil: 'domcontentloaded' });
    if (!response?.ok()) throw new Error(`第二个站点没有被拦截：${response?.status()}`);
    await pill(other).waitFor({ state: 'visible', timeout: 15_000 });
    await other.screenshot({ path: path.join(dir, 'other-site.png'), animations: 'disabled' });
    note('elsewhere.test still shows the floater');

    await settings.bringToFront();
    await settings.goto(`chrome-extension://${extensionId}/options.html#backup`, { waitUntil: 'domcontentloaded' });
    const [download] = await Promise.all([settings.waitForEvent('download'), settings.getByRole('button', { name: 'Export settings', exact: true }).click()]);
    const exportPath = path.join(dir, 'export.json');
    await download.saveAs(exportPath);
    const exported = JSON.parse(await readFile(exportPath, 'utf8'));
    if (JSON.stringify(exported.settings?.floatingHiddenSites) !== JSON.stringify([hostName])) throw new Error(`导出文件应带名单：${JSON.stringify(exported.settings?.floatingHiddenSites)}`);
    note(`export floatingHiddenSites ${JSON.stringify(exported.settings.floatingHiddenSites)}`);

    await settings.goto(`chrome-extension://${extensionId}/options.html#floating`, { waitUntil: 'domcontentloaded' });
    const list = settings.locator('[aria-label="Sites without the floating button"]');
    await list.getByText(hostName, { exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
    await settings.locator('#floating').screenshot({ path: path.join(dir, 'settings-listed.png'), animations: 'disabled' });
    await settings.getByRole('button', { name: `Show the floating button on ${hostName} again`, exact: true }).click();
    await settings.locator('#floating').getByText('No sites yet.', { exact: false }).waitFor({ state: 'visible', timeout: 5_000 });
    await poll(stored, value => sameList(value, []), '设置页撤销后名单应为空');
    await pill(fixture).waitFor({ state: 'visible', timeout: 8_000 });
    await fixture.screenshot({ path: path.join(dir, 'fixture-restored.png'), animations: 'disabled' });
    note('settings undo brought the floater back without reload');

    await settings.goto(`chrome-extension://${extensionId}/options.html#backup`, { waitUntil: 'domcontentloaded' });
    await settings.locator('#backup input[type="file"]').setInputFiles(exportPath);
    await settings.getByRole('button', { name: 'Replace settings', exact: true }).click();
    const imported = await poll(stored, value => sameList(value, [hostName]) && rulesUntouched(value), '导入后名单应回来');
    await pill(fixture).waitFor({ state: 'hidden', timeout: 8_000 });
    note(`import restored ${JSON.stringify(imported.floatingHiddenSites)}; floater hidden again`);

    const undo = await openActionPopup(context, fixture);
    try {
      if (await popupToggle(undo) !== 'true') throw new Error('导入后弹出面板按钮应为按下');
      const clicked = await undo.evaluate(`(() => { const node = document.querySelector('button[aria-label="Hide floating on this site"]'); if (!node) return false; node.click(); return true; })()`);
      if (!clicked) throw new Error('弹出面板里没有 Hide floating on this site');
      await poll(() => popupToggle(undo), value => value === 'false', '弹出面板按钮应抬起');
      await undo.evaluate('new Promise(resolve => setTimeout(resolve, 300))');
      await undo.screenshot(path.join(dir, 'popup-restored.png'));
    } finally { await undo.close(); }
    const final = await poll(stored, value => sameList(value, []) && rulesUntouched(value), '弹出面板撤销后名单应为空');
    await pill(fixture).waitFor({ state: 'visible', timeout: 8_000 });
    note('popup toggle undo brought the floater back');

    const state = { ok: true, host: hostName, hidden: hidden.floatingHiddenSites, shortcutRate: hiddenRate, reloadedRate, exported: exported.settings.floatingHiddenSites, imported: imported.floatingHiddenSites, final: final.floatingHiddenSites ?? [], siteMode: final.siteMode ?? 'all', sites: final.sites ?? [] };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await context.unroute(`${otherOrigin}/**`, serveOther).catch(() => {});
    await settings?.close().catch(() => {});
    await fixture?.close().catch(() => {});
    await other?.close().catch(() => {});
  }
}

async function inspect(context) {
  const worker = await serviceWorker(context);
  const runtime = await worker.evaluate(() => ({
    version: chrome.runtime.getManifest().version,
    language: chrome.i18n.getUILanguage(),
    id: chrome.runtime.id,
  }));
  return {
    extensionId: new URL(worker.url()).host,
    serviceWorker: worker.url(),
    version: runtime.version,
    uiLanguage: runtime.language,
    runtimeId: runtime.id,
    backgroundMtimeMs: await backgroundMtime(),
  };
}

async function serve() {
  await assertBuild();
  const controlPort = await freePort();
  const token = randomBytes(24).toString('hex');
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
    deviceScaleFactor: 1,
    ignoreDefaultArgs: ['--disable-extensions', '--mute-audio'],
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--lang=en-US',
    ],
  });
  let closing = false;
  const closeAll = async () => {
    if (closing) return;
    closing = true;
    await context.close().catch(() => {});
  };
  process.on('SIGTERM', () => { void closeAll().finally(() => process.exit(0)); });
  process.on('SIGINT', () => { void closeAll().finally(() => process.exit(0)); });
  try {
    await serviceWorker(context);
    await context.route(`${origin}/**`, async route => {
      const pathname = new URL(route.request().url()).pathname;
      const body = routedHtml(pathname);
      if (!body) {
        await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers: { 'cache-control': 'no-store' }, body });
    });
    const probe = await openFixture(context);
    await mkdir(evidenceRoot, { recursive: true });
    await probe.screenshot({ path: path.join(evidenceRoot, 'launch-probe.png'), animations: 'disabled' }).catch(() => {});
    await probe.close();
    const info = await inspect(context);
    if (!info.uiLanguage.toLowerCase().startsWith('en')) throw new Error(`浏览器 UI 语言是 ${info.uiLanguage}，本技能的选择器按 en-US 编写`);
    if (info.version !== await packageVersion()) throw new Error(`扩展版本 ${info.version} 与 package.json 不一致`);
    let queue = Promise.resolve();
    const enqueue = fn => {
      const run = queue.then(fn, fn);
      queue = run.then(() => {}, () => {});
      return run;
    };
    const server = createServer((request, response) => {
      void enqueue(async () => {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const text = Buffer.concat(chunks).toString('utf8');
        let body = {};
        if (text) body = JSON.parse(text);
        const send = (status, payload) => {
          response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
          response.end(JSON.stringify(payload));
        };
        if (request.headers['x-ottertap-verify-token'] !== token) { send(401, { ok: false, error: 'bad token' }); return; }
        if (request.method === 'GET' && request.url === '/doctor') {
          const live = await inspect(context);
          send(200, { ok: true, ...live, pid: process.pid, controlPort, profileDir, extensionPath });
          return;
        }
        if (request.method === 'POST' && request.url === '/drive') {
          const feature = body.feature;
          if (!supportedFeatures.includes(feature)) {
            send(404, { ok: false, error: `没有脚本化旅程 ${feature}。已实现：${supportedFeatures.join(', ')}` });
            return;
          }
          const dir = evidenceDir(feature);
          const lines = [];
          const note = line => { lines.push(`${new Date().toISOString()} ${line}`); console.log(line); };
          try {
            const drivers = { 'popup-playback': drivePopupPlayback, 'wheel-volume': driveWheelVolume, 'skip-step': driveSkipStep, 'skip-with-rate': driveSkipWithRate, 'volume-step': driveVolumeStep, 'fine-wheel': driveFineWheel, 'coarse-step': driveCoarseStep, 'rate-step': driveRateStep, 'extension-pip': driveExtensionPip, 'default-rate': driveDefaultRate, 'hold-boost': driveHoldBoost, 'hold-skip-combo': driveHoldSkipCombo, 'frame-step': driveFrameStep, 'hotkey-remap': driveHotkeyRemap, 'floating-speed': driveFloatingSpeed, 'floating-playback': driveFloatingPlayback, 'floating-entry-note': driveFloatingEntryNote, 'floating-open-panel': driveFloatingOpenPanel, 'floating-while-playing': driveFloatingWhilePlaying, 'floating-hidden-sites': driveFloatingHiddenSites, 'wheel-direction': driveWheelDirection, 'fullscreen-wheel': driveFullscreenWheel, 'sidebar-ignore': driveSidebarIgnore, 'settings-memory-filter': driveSettingsMemoryFilter, 'settings-sites-filter': driveSettingsSitesFilter, 'settings-floating-hidden-filter': driveSettingsFloatingHiddenFilter, 'settings-current-site': driveSettingsCurrentSite, 'settings-clear-remembered': driveSettingsClearRemembered, 'horizontal-mirror': driveHorizontalMirror, 'progress-mark': driveProgressMark, 'mute-other-tabs': driveMuteOtherTabs, 'mirror-mark-commands': driveMirrorMarkCommands, 'mirror-mark-feedback': driveMirrorMarkFeedback, 'auto-follow-playing': driveAutoFollowPlaying, 'selection-highlight': driveSelectionHighlight, 'prev-next-media': drivePrevNextMedia, 'panel-media-list': drivePanelMediaList, 'float-prev-next': driveFloatPrevNext, 'float-pip': driveFloatPip, 'page-pip': drivePagePip, 'pip-feedback': drivePipFeedback, 'pip-active': drivePipActive, 'pip-away-tab': drivePipAwayTab, 'pip-auto-hide': drivePipAutoHide, 'pip-auto-scroll': drivePipAutoScroll, 'pip-auto-exit': drivePipAutoExit, 'pip-auto-excluded-sites': drivePipAutoExcludedSites, 'pip-auto-feedback': drivePipAutoFeedback, 'resume-save': driveResumeSave, 'sleep-timer': driveSleepTimer, 'sleep-timer-cancel': driveSleepTimerCancel, 'sleep-timer-hints': driveSleepTimerHints, 'sleep-hotkeys': driveSleepHotkeys, 'remaining-at-rate': driveRemainingAtRate, 'floating-sleep-note': driveFloatingSleepNote };
            const state = await drivers[feature](context, dir, note);
            await writeFile(path.join(dir, 'transcript.txt'), `${lines.join('\n')}\n`);
            send(200, { ok: true, feature, evidenceDir: dir, state });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            note(`FAIL ${message}`);
            await mkdir(dir, { recursive: true });
            await writeFile(path.join(dir, 'transcript.txt'), `${lines.join('\n')}\n`);
            await writeFile(path.join(dir, 'error.txt'), message);
            send(500, { ok: false, feature, evidenceDir: dir, error: message });
          }
          return;
        }
        if (request.method === 'POST' && request.url === '/shutdown') {
          send(200, { ok: true });
          setTimeout(() => { void closeAll().finally(() => process.exit(0)); }, 30);
          return;
        }
        send(404, { ok: false, error: 'not found' });
      }).catch(error => {
        const message = error instanceof Error ? error.message : String(error);
        response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ ok: false, error: message }));
      });
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(controlPort, '127.0.0.1', resolve);
    });
    const session = {
      id,
      pid: process.pid,
      controlPort,
      controlToken: token,
      profileDir,
      extensionPath,
      extensionId: info.extensionId,
      version: info.version,
      uiLanguage: info.uiLanguage,
      serviceWorker: info.serviceWorker,
      backgroundMtimeMs: info.backgroundMtimeMs,
      browserPids: descendantPids(process.pid),
    };
    await writeJson(sessionPath, session);
    console.log(`ottertap-verify ready id=${id} pid=${process.pid} control=127.0.0.1:${controlPort} extension=${info.extensionId} version=${info.version} profile=${profileDir}`);
  } catch (error) {
    await closeAll();
    const message = error instanceof Error ? error.stack || error.message : String(error);
    await mkdir(stateDir, { recursive: true });
    await writeFile(path.join(stateDir, 'failed.txt'), message);
    console.error(message);
    process.exit(1);
  }
}

async function callSession(session, method, pathname, body) {
  const response = await fetch(`http://127.0.0.1:${session.controlPort}${pathname}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-ottertap-verify-token': session.controlToken },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

function printTail(file) {
  try {
    const text = readFileSync(file, 'utf8').trim().split('\n').slice(-40).join('\n');
    if (text) console.error(text);
  } catch { /* no log yet */ }
}

async function launch() {
  await mkdir(stateDir, { recursive: true });
  let existing = null;
  try { existing = await readJson(sessionPath); }
  catch { /* no session */ }
  if (existing?.pid && alive(existing.pid)) {
    throw new Error(`会话 ${id} 已在运行（pid ${existing.pid}）。不要再开一个共享实例；先 cleanup，或换 OTTERTAP_VERIFY_ID`);
  }
  const holders = pidsUsingProfile(profileDir).filter(pid => pid !== process.pid);
  if (holders.length) throw new Error(`用户目录仍被 pid ${holders.join(', ')} 占用。先 cleanup`);
  await rm(profileDir, { recursive: true, force: true });
  try { unlinkSync(sessionPath); } catch { /* already gone */ }
  try { unlinkSync(path.join(stateDir, 'failed.txt')); } catch { /* none */ }
  await mkdir(profileDir, { recursive: true });
  const logFd = openSync(logPath, 'a');
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'serve'], {
    cwd: root,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env, OTTERTAP_VERIFY_ID: id },
  });
  closeSync(logFd);
  const stop = () => { if (alive(child.pid)) process.kill(child.pid, 'SIGTERM'); };
  process.on('SIGINT', () => { stop(); process.exit(1); });
  process.on('SIGTERM', () => { stop(); process.exit(1); });
  const deadline = Date.now() + 90_000;
  let exited = false;
  child.on('exit', () => { exited = true; });
  child.unref();
  while (Date.now() < deadline) {
    try {
      const session = await readJson(sessionPath);
      if (session.pid === child.pid) {
        console.log(`ottertap-verify ready id=${session.id} pid=${session.pid} control=127.0.0.1:${session.controlPort} extension=${session.extensionId} version=${session.version} profile=${session.profileDir}`);
        return;
      }
    } catch { /* not ready */ }
    if (exited) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  stop();
  printTail(logPath);
  let failure = '';
  try { failure = await readFile(path.join(stateDir, 'failed.txt'), 'utf8'); }
  catch { /* none */ }
  throw new Error(failure || 'launch 在 90 秒内没有就绪');
}

async function doctor() {
  const session = await readJson(sessionPath).catch(() => null);
  if (!session) throw new Error('没有会话。先 launch');
  if (!alive(session.pid)) throw new Error(`会话 pid ${session.pid} 不在了。scratch 还在 ${stateDir}，运行 cleanup`);
  const command = cmdline(session.pid);
  if (!command.includes('verify-ottertap/scripts/session.mjs')) throw new Error(`pid ${session.pid} 不是这次验证会话：${command}`);
  if (!pidListens(session.pid, session.controlPort)) throw new Error(`127.0.0.1:${session.controlPort} 不是 pid ${session.pid} 在监听`);
  const live = await callSession(session, 'GET', '/doctor');
  const version = await packageVersion();
  const mtime = await backgroundMtime();
  const problems = [];
  if (live.version !== version) problems.push(`运行中的扩展是 ${live.version}，package.json 是 ${version}`);
  if (live.extensionId !== session.extensionId) problems.push(`extension id 从 ${session.extensionId} 变成 ${live.extensionId}`);
  if (!String(live.uiLanguage).toLowerCase().startsWith('en')) problems.push(`UI 语言是 ${live.uiLanguage}，选择器按英语编写`);
  if (mtime !== session.backgroundMtimeMs) problems.push('background.js 在 launch 之后变了。先 cleanup，再 pnpm build，然后重新 launch');
  if (live.profileDir !== profileDir) problems.push(`profile 不是本会话目录：${live.profileDir}`);
  if (!live.serviceWorker.startsWith(`chrome-extension://${live.extensionId}/`)) problems.push(`service worker 地址异常：${live.serviceWorker}`);
  if (problems.length) throw new Error(problems.join('\n'));
  console.log(`ottertap-verify doctor ok id=${id} pid=${session.pid} control=127.0.0.1:${session.controlPort} extension=${live.extensionId} version=${live.version} language=${live.uiLanguage} profile=${live.profileDir}`);
}

async function driveWheelDirection(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const near = expected => value => Math.abs(value - expected) < 0.02;
  const page = await context.newPage();
  let settings;
  const volume = () => page.locator('#media').evaluate(element => element.volume);
  const scrollY = () => page.evaluate(() => window.scrollY);
  const settle = async value => {
    await page.locator('#media').evaluate((element, next) => { element.volume = next; element.muted = false; }, value);
    await poll(volume, near(value), `应能把音量设成 ${value}`);
    await page.waitForTimeout(400);
  };
  const hover = async deltaY => {
    const at = await centerOf(page.locator('#media'));
    await page.mouse.move(at.x, at.y);
    await page.waitForTimeout(350);
    await page.mouse.wheel(0, deltaY);
  };
  const alt = async deltaY => {
    const at = await centerOf(page.locator('#media'));
    await page.mouse.move(at.x, at.y);
    await page.keyboard.down('Alt');
    try { await page.mouse.wheel(0, deltaY); }
    finally { await page.keyboard.up('Alt'); }
  };
  const scrollPage = async () => {
    const box = await page.locator('#media').boundingBox();
    if (!box) throw new Error('视频没有位置');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height + 80);
    await page.waitForTimeout(350);
    const before = await scrollY();
    const loud = await volume();
    await page.mouse.wheel(0, 120);
    const after = await poll(scrollY, value => value > before + 20, '视频外向下滚轮应让页面往下走');
    const held = await volume();
    if (Math.abs(held - loud) > 0.02) throw new Error(`视频外滚动改了音量 ${loud} -> ${held}`);
    return { before, after, held };
  };
  try {
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    const group = settings.getByRole('group', { name: 'Wheel direction' });
    await group.waitFor({ state: 'visible', timeout: 15_000 });
    const up = group.getByRole('button', { name: 'Up increases', exact: true });
    const down = group.getByRole('button', { name: 'Down increases', exact: true });
    if (await up.getAttribute('aria-pressed') !== 'true') throw new Error('滚轮方向默认应是向上增大');
    if (await down.getAttribute('aria-pressed') !== 'false') throw new Error('向下增大默认不应按下');
    await settings.getByText('Choose whether scrolling up or scrolling down raises the volume. Only the wheel over the main player and Alt + wheel follow this. The page still scrolls the usual way. Arrow keys, extension commands, and the volume slider stay as they are. Up increases is the default.', { exact: true }).waitFor({ state: 'visible' });
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-up.png'), animations: 'disabled' });
    note('wheel direction defaults to up');

    await page.goto(`${origin}/keys`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
    });
    await settle(0.5);
    const scrollBefore = await scrollY();
    await hover(-100);
    const upVolume = await poll(volume, near(0.6), '默认向上滚轮应加到 60%');
    const scrollHeld = await scrollY();
    if (scrollHeld !== scrollBefore) throw new Error(`悬停调音时页面滚动了 ${scrollBefore} -> ${scrollHeld}`);
    await page.screenshot({ path: path.join(dir, 'fixture-up.png'), animations: 'disabled' });
    note(`default up volume=${upVolume} scroll=${scrollHeld}`);

    const pageDown = await scrollPage();
    await page.screenshot({ path: path.join(dir, 'page-scroll-up.png'), animations: 'disabled' });
    note(`page scroll while up ${pageDown.before}->${pageDown.after} volume=${pageDown.held}`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await poll(scrollY, value => value === 0, '应滚回顶部');
    await page.waitForTimeout(400);

    await settings.bringToFront();
    await down.click();
    await poll(stored, value => value.wheelDirection === 'down', '应改成向下增大');
    if (await up.getAttribute('aria-pressed') !== 'false' || await down.getAttribute('aria-pressed') !== 'true') throw new Error('按下状态没有跟着选项变');
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-down.png'), animations: 'disabled' });
    note('wheel direction down');

    await page.bringToFront();
    await hover(-100);
    const reversed = await poll(volume, near(0.5), '同一向上手势在向下增大时应减回 50%');
    await page.screenshot({ path: path.join(dir, 'fixture-down.png'), animations: 'disabled' });
    note(`reversed hover volume=${reversed}`);
    await alt(-100);
    const altDown = await poll(volume, near(0.4), 'Alt+向上滚轮在向下增大时应再到 40%');
    note(`reversed alt volume=${altDown}`);
    await hover(100);
    const downIncreases = await poll(volume, near(0.5), '向下滚轮在向下增大时应加回 50%');
    note(`down gesture volume=${downIncreases}`);

    const pageDownAgain = await scrollPage();
    await page.screenshot({ path: path.join(dir, 'page-scroll-down.png'), animations: 'disabled' });
    note(`page scroll while down ${pageDownAgain.before}->${pageDownAgain.after} volume=${pageDownAgain.held}`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await poll(scrollY, value => value === 0, '应再次滚回顶部');
    await page.waitForTimeout(400);

    await settings.bringToFront();
    await up.click();
    await poll(stored, value => value.wheelDirection === 'up', '应改回向上增大');
    await page.bringToFront();
    await hover(-100);
    const restored = await poll(volume, near(0.6), '改回向上增大后同一向上手势应加到 60%');
    note(`restored volume=${restored}`);

    const state = {
      ok: true,
      up: upVolume,
      reversed,
      alt: altDown,
      downGesture: downIncreases,
      restored,
      pageScroll: { up: pageDown.after - pageDown.before, down: pageDownAgain.after - pageDownAgain.before }
    };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await settings?.close().catch(() => {});
    await page.close().catch(() => {});
  }
}

async function driveFullscreenWheel(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const near = expected => value => Math.abs(value - expected) < 0.02;
  const page = await context.newPage();
  let options;
  const volume = () => page.locator('#media').evaluate(element => element.volume);
  const scrollY = () => page.evaluate(() => window.scrollY);
  const settle = async value => {
    await page.locator('#media').evaluate((element, next) => { element.volume = next; element.muted = false; }, value);
    await poll(volume, near(value), `应能把音量设成 ${value}`);
    await page.waitForTimeout(400);
  };
  const hoverAt = async deltaY => {
    const at = await centerOf(page.locator('#media'));
    await page.mouse.move(at.x, at.y);
    await page.mouse.wheel(0, deltaY);
  };
  const hover = async deltaY => {
    await page.waitForTimeout(350);
    await hoverAt(deltaY);
  };
  const fullscreenSwitch = () => options.getByRole('switch', { name: 'Only use the hover wheel in fullscreen', exact: true });
  const setPseudo = async enabled => {
    await page.evaluate(on => {
      const video = document.querySelector('#media');
      if (!(video instanceof HTMLVideoElement)) throw new Error('没有夹具视频');
      const shell = document.getElementById('pseudo-shell');
      if (on) {
        if (shell) return;
        const next = document.createElement('div');
        next.id = 'pseudo-shell';
        next.className = 'bpx-state-web-fullscreen';
        next.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#111;display:flex;align-items:center;justify-content:center;';
        video.before(next);
        next.append(video);
        video.style.width = '100%';
        video.style.height = '100%';
        return;
      }
      if (!shell) return;
      shell.replaceWith(video);
      video.style.width = '640px';
      video.style.height = '360px';
    }, enabled);
  };
  try {
    options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
    const toggle = fullscreenSwitch();
    await toggle.waitFor({ state: 'visible', timeout: 15_000 });
    if (await toggle.getAttribute('aria-checked') !== 'false') throw new Error('全屏滚轮开关默认应关闭');
    const hoverWheel = options.getByRole('switch', { name: 'Scroll over the main player to change volume', exact: true });
    if (await hoverWheel.getAttribute('aria-checked') !== 'true') throw new Error('悬停滚轮应保持开启');
    await options.getByText('Off by default, so scrolling over the main player still changes volume. When this is on, the bare wheel changes volume only while the page or the video is fullscreen, including a player that fills the window without browser fullscreen. Otherwise the bare wheel scrolls the page. Alt + wheel still changes volume outside fullscreen.', { exact: true }).waitFor({ state: 'visible' });
    await options.locator('#shortcuts').screenshot({ path: path.join(dir, 'settings-default.png'), animations: 'disabled' });
    note('fullscreen wheel defaults off');

    await page.goto(`${origin}/keys`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
    });
    await settle(0.5);
    const scrollBefore = await scrollY();
    await hover(-100);
    const openVolume = await poll(volume, near(0.6), '开关关闭时悬停滚轮应加到 60%');
    const scrollHeld = await scrollY();
    if (scrollHeld !== scrollBefore) throw new Error(`开关关闭时页面滚动了 ${scrollBefore} -> ${scrollHeld}`);
    await page.screenshot({ path: path.join(dir, 'fixture-default.png'), animations: 'disabled' });
    note(`default volume=${openVolume} scroll=${scrollHeld}`);

    await options.bringToFront();
    await toggle.click();
    await poll(stored, value => value.fullscreenWheel === true && value.hoverWheel !== false, '应只打开全屏滚轮开关');
    if (await toggle.getAttribute('aria-checked') !== 'true') throw new Error('开关按下状态没有变成开');
    await options.locator('#shortcuts').screenshot({ path: path.join(dir, 'settings-on.png'), animations: 'disabled' });
    note('fullscreen wheel on');

    await page.bringToFront();
    await page.evaluate(() => window.scrollTo(0, 0));
    await poll(scrollY, value => value === 0, '应回到顶部');
    await settle(0.6);
    const loud = await volume();
    await hover(120);
    const scrolled = await poll(scrollY, value => value > 20, '非全屏时悬停裸滚轮应让页面往下走');
    const held = await volume();
    if (Math.abs(held - loud) > 0.02) throw new Error(`非全屏裸滚轮改了音量 ${loud} -> ${held}`);
    await page.screenshot({ path: path.join(dir, 'fixture-scroll.png'), animations: 'disabled' });
    note(`window scroll=${scrolled} volume=${held}`);

    await page.evaluate(() => window.scrollTo(0, 0));
    await poll(scrollY, value => value === 0, 'Alt 之前应回到顶部');
    await page.waitForTimeout(400);
    const at = await centerOf(page.locator('#media'));
    await page.mouse.move(at.x, at.y);
    await page.keyboard.down('Alt');
    try { await page.mouse.wheel(0, -100); }
    finally { await page.keyboard.up('Alt'); }
    const altVolume = await poll(volume, near(0.7), '非全屏时 Alt+滚轮仍应加到 70%');
    const altScroll = await scrollY();
    if (altScroll !== 0) throw new Error(`Alt+滚轮时页面滚动了 ${altScroll}`);
    await page.screenshot({ path: path.join(dir, 'fixture-alt.png'), animations: 'disabled' });
    note(`alt volume=${altVolume} scroll=${altScroll}`);

    await setPseudo(true);
    await page.waitForTimeout(400);
    const pseudoBefore = await scrollY();
    await hover(-100);
    const pseudoVolume = await poll(volume, near(0.8), '网页全屏后悬停滚轮应加到 80%');
    const pseudoScroll = await scrollY();
    if (pseudoScroll !== pseudoBefore) throw new Error(`网页全屏时页面滚动了 ${pseudoBefore} -> ${pseudoScroll}`);
    await page.screenshot({ path: path.join(dir, 'fixture-pseudo.png'), animations: 'disabled' });
    note(`pseudo volume=${pseudoVolume} scroll=${pseudoScroll}`);

    await setPseudo(false);
    const exitBefore = await scrollY();
    const exitLoud = await volume();
    await hoverAt(120);
    const exitScroll = await poll(scrollY, value => value > exitBefore + 20, '退出网页全屏后裸滚轮应立刻让页面往下走');
    const exitVolume = await volume();
    if (Math.abs(exitVolume - exitLoud) > 0.02) throw new Error(`退出全屏后裸滚轮改了音量 ${exitLoud} -> ${exitVolume}`);
    await page.screenshot({ path: path.join(dir, 'fixture-exit.png'), animations: 'disabled' });
    note(`pseudo exit scroll=${exitScroll} volume=${exitVolume}`);

    await page.evaluate(() => window.scrollTo(0, 0));
    await poll(scrollY, value => value === 0, '全屏 API 之前应回到顶部');
    await page.evaluate(() => {
      const video = document.querySelector('#media');
      if (!(video instanceof HTMLVideoElement)) throw new Error('没有夹具视频');
      const button = document.createElement('button');
      button.id = 'api-fullscreen';
      button.type = 'button';
      button.textContent = 'Enter fullscreen';
      button.addEventListener('click', () => { void video.requestFullscreen(); });
      document.body.append(button);
    });
    await page.locator('#api-fullscreen').click();
    await poll(() => page.evaluate(() => document.fullscreenElement?.id ?? ''), value => value === 'media', '点击后视频应进入全屏');
    await page.waitForTimeout(400);
    const apiBefore = await scrollY();
    await hover(-100);
    const apiVolume = await poll(volume, near(0.9), '全屏 API 里悬停滚轮应加到 90%');
    const apiScroll = await scrollY();
    if (apiScroll !== apiBefore) throw new Error(`全屏 API 时页面滚动了 ${apiBefore} -> ${apiScroll}`);
    await page.screenshot({ path: path.join(dir, 'fixture-api.png'), animations: 'disabled' });
    note(`api volume=${apiVolume} scroll=${apiScroll}`);

    await page.evaluate(async () => { if (document.fullscreenElement) await document.exitFullscreen(); });
    await poll(() => page.evaluate(() => document.fullscreenElement == null), value => value === true, '应退出全屏');
    const apiExitBefore = await scrollY();
    const apiExitLoud = await volume();
    await hoverAt(120);
    const apiExitScroll = await poll(scrollY, value => value > apiExitBefore + 20, '退出全屏 API 后裸滚轮应立刻让页面往下走');
    const apiExitVolume = await volume();
    if (Math.abs(apiExitVolume - apiExitLoud) > 0.02) throw new Error(`退出全屏 API 后裸滚轮改了音量 ${apiExitLoud} -> ${apiExitVolume}`);
    await page.screenshot({ path: path.join(dir, 'fixture-api-exit.png'), animations: 'disabled' });
    note(`api exit scroll=${apiExitScroll} volume=${apiExitVolume}`);

    await options.bringToFront();
    await toggle.click();
    await poll(stored, value => value.fullscreenWheel !== true, '成功后应把开关关回去');
    const state = {
      ok: true,
      openVolume,
      scrolled,
      altVolume,
      pseudoVolume,
      exitScroll,
      apiVolume,
      apiExitScroll,
    };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await options?.close().catch(() => {});
    await page.close().catch(() => {});
  }
}

async function driveSettingsMemoryFilter(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const hostsOf = value => Object.keys(value.sitePrefs ?? {}).sort();
  const sameHosts = expected => value => hostsOf(value).join() === expected.join();
  let settings;
  let fixture;
  let popup;
  try {
    await worker.evaluate(async () => {
      const key = 'ottertap-settings-v1';
      const current = (await chrome.storage.local.get(key))[key] ?? {};
      await chrome.storage.local.set({
        [key]: {
          ...current,
          sitePrefs: {
            'alpha.test': { volume: 0.5 },
            'beta.example': { rate: 1.5 },
            'gamma.example': { volume: 1 },
          },
        },
      });
    });
    await poll(stored, sameHosts(['alpha.test', 'beta.example', 'gamma.example']), '应先写入三条记住站点');
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#memory`, { waitUntil: 'domcontentloaded' });
    const memory = settings.locator('#memory');
    const filter = settings.getByRole('searchbox', { name: 'Filter by hostname' });
    await filter.waitFor({ state: 'visible', timeout: 15_000 });
    const titles = () => memory.locator('[data-slot="item-title"]').allTextContents();
    const listed = expected => poll(titles, value => value.join() === expected.join(), `列表应为 ${expected.join(', ')}`);
    await listed(['alpha.test', 'beta.example', 'gamma.example']);
    await memory.getByText('A domain includes its subdomains.').waitFor({ state: 'visible' });
    await memory.screenshot({ path: path.join(dir, 'list-all.png'), animations: 'disabled' });
    note('memory list shows alpha.test, beta.example, gamma.example');

    await filter.fill('example');
    await listed(['beta.example', 'gamma.example']);
    if ((await titles()).includes('alpha.test')) throw new Error('过滤 example 时不应显示 alpha.test');
    const whileFiltered = await stored();
    if (!sameHosts(['alpha.test', 'beta.example', 'gamma.example'])(whileFiltered)) throw new Error(`过滤不应改存储：${hostsOf(whileFiltered).join()}`);
    await memory.screenshot({ path: path.join(dir, 'filtered.png'), animations: 'disabled' });
    note('filter example hides alpha.test');

    fixture = await context.newPage();
    await fixture.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    popup = await openActionPopup(context, fixture);
    const remembered = await popup.evaluate(`(() => {
      const node = document.querySelector('[role="switch"][aria-label="Remember this site"]');
      if (!node || node.getAttribute('aria-checked') === 'true') return false;
      node.click();
      return true;
    })()`);
    if (!remembered) throw new Error('弹出面板里没有未打开的 Remember this site');
    await popup.close();
    popup = undefined;
    const afterRemember = await poll(stored, value => sameHosts(['alpha.test', 'beta.example', 'gamma.example', 'media.ottertap.test'])(value) && value.sitePrefs?.['alpha.test']?.volume === 0.5, '记住此站点应追加 media.ottertap.test，并留下未显示的 alpha.test');
    await settings.bringToFront();
    await listed(['beta.example', 'gamma.example']);
    if ((await titles()).includes('media.ottertap.test')) throw new Error('不匹配 example 的新站点不应出现在过滤结果里');
    await memory.screenshot({ path: path.join(dir, 'remembered.png'), animations: 'disabled' });
    note(`remembered media.ottertap.test; stored=${hostsOf(afterRemember).join()}`);

    await filter.fill('');
    await listed(['alpha.test', 'beta.example', 'gamma.example', 'media.ottertap.test']);
    await filter.fill('example');
    await listed(['beta.example', 'gamma.example']);
    await memory.getByRole('button', { name: 'Forget beta.example' }).click();
    await listed(['gamma.example']);
    const afterForget = await poll(stored, sameHosts(['alpha.test', 'gamma.example', 'media.ottertap.test']), '忘记 beta.example 只应去掉这一条');
    if (afterForget.sitePrefs?.['beta.example']) throw new Error('beta.example 应已从记住表删除');
    await memory.screenshot({ path: path.join(dir, 'forgotten.png'), animations: 'disabled' });
    note(`forgot beta.example; stored=${hostsOf(afterForget).join()}`);

    await filter.fill('zzzz');
    await listed([]);
    await memory.getByText('No remembered sites match.', { exact: true }).waitFor({ state: 'visible' });
    if (await memory.locator('[role="list"]').count()) throw new Error('无匹配时不应留下空白列表');
    const unmatched = await stored();
    if (!sameHosts(['alpha.test', 'gamma.example', 'media.ottertap.test'])(unmatched)) throw new Error(`无匹配文案不应改存储：${hostsOf(unmatched).join()}`);
    await memory.screenshot({ path: path.join(dir, 'no-match.png'), animations: 'disabled' });
    note('no match shows a sentence');

    await filter.fill('');
    await listed(['alpha.test', 'gamma.example', 'media.ottertap.test']);
    const state = { ok: true, filtered: ['beta.example', 'gamma.example'], afterRemember: hostsOf(afterRemember), afterForget: hostsOf(afterForget) };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await popup?.close().catch(() => {});
    await settings?.close().catch(() => {});
    await fixture?.close().catch(() => {});
  }
}

async function driveSettingsSitesFilter(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const sitesOf = value => value.sites ?? [];
  const sameSites = expected => value => sitesOf(value).join() === expected.join();
  const prefsOf = value => Object.keys(value.sitePrefs ?? {}).sort();
  let settings;
  try {
    await worker.evaluate(async () => {
      const key = 'ottertap-settings-v1';
      const current = (await chrome.storage.local.get(key))[key] ?? {};
      await chrome.storage.local.set({
        [key]: {
          ...current,
          siteMode: 'allow',
          sites: ['alpha.test', 'beta.example', 'gamma.example'],
          sitePrefs: {
            'kept.example': { volume: 0.4 },
            'other.test': { volume: 0.2 },
          },
        },
      });
    });
    const seeded = ['alpha.test', 'beta.example', 'gamma.example'];
    await poll(stored, value => value.siteMode === 'allow' && sameSites(seeded)(value) && prefsOf(value).join() === ['kept.example', 'other.test'].join(), '应先写入允许名单和两条记住站点');
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#sites`, { waitUntil: 'domcontentloaded' });
    const sites = settings.locator('#sites');
    const memory = settings.locator('#memory');
    const filter = sites.getByRole('searchbox', { name: 'Filter site list' });
    const memoryFilter = memory.getByRole('searchbox', { name: 'Filter by hostname' });
    await filter.waitFor({ state: 'visible', timeout: 15_000 });
    await memoryFilter.waitFor({ state: 'visible', timeout: 15_000 });
    const titles = () => sites.locator('[data-slot="item-title"]').allTextContents();
    const memoryTitles = () => memory.locator('[data-slot="item-title"]').allTextContents();
    const listed = expected => poll(titles, value => value.join() === expected.join(), `网站名单应为 ${expected.join(', ')}`);
    const remembered = expected => poll(memoryTitles, value => value.join() === expected.join(), `记住站点应为 ${expected.join(', ')}`);
    await listed(seeded);
    await remembered(['kept.example', 'other.test']);
    await sites.screenshot({ path: path.join(dir, 'list-all.png'), animations: 'disabled' });
    note('site list shows alpha.test, beta.example, gamma.example');

    await filter.fill('example');
    await listed(['beta.example', 'gamma.example']);
    if ((await titles()).includes('alpha.test')) throw new Error('过滤 example 时不应显示 alpha.test');
    await remembered(['kept.example', 'other.test']);
    const whileFiltered = await stored();
    if (!sameSites(seeded)(whileFiltered)) throw new Error(`过滤不应改存储：${sitesOf(whileFiltered).join()}`);
    if (whileFiltered.siteMode !== 'allow') throw new Error('过滤不应改 siteMode');
    await sites.screenshot({ path: path.join(dir, 'filtered.png'), animations: 'disabled' });
    note('filter example hides alpha.test');

    await settings.locator('#site-domain').fill('https://delta.test/watch');
    await sites.getByRole('button', { name: 'Add', exact: true }).click();
    const afterHiddenAdd = [...seeded, 'delta.test'];
    await poll(stored, sameSites(afterHiddenAdd), '添加 delta.test 应追加到原来的 sites');
    await listed(['beta.example', 'gamma.example']);
    if ((await titles()).includes('delta.test')) throw new Error('不匹配 example 的新站点不应出现');
    if (await filter.inputValue() !== 'example') throw new Error('添加不应清掉过滤词');

    await settings.locator('#site-domain').fill('delta.example');
    await sites.getByRole('button', { name: 'Add', exact: true }).click();
    const afterAdd = [...afterHiddenAdd, 'delta.example'];
    await poll(stored, sameSites(afterAdd), '添加 delta.example 应追加到原来的 sites');
    await listed(['beta.example', 'gamma.example', 'delta.example']);
    await remembered(['kept.example', 'other.test']);
    await sites.screenshot({ path: path.join(dir, 'added.png'), animations: 'disabled' });
    note(`added delta.test (hidden) and delta.example; stored=${afterAdd.join()}`);

    await sites.getByRole('button', { name: 'Remove gamma.example' }).click();
    const afterRemove = ['alpha.test', 'beta.example', 'delta.test', 'delta.example'];
    await listed(['beta.example', 'delta.example']);
    const removed = await poll(stored, sameSites(afterRemove), '移除 gamma.example 只应去掉这一条');
    if (prefsOf(removed).join() !== 'kept.example,other.test') throw new Error('移除网站规则不应改记住站点');
    await sites.screenshot({ path: path.join(dir, 'removed.png'), animations: 'disabled' });
    note(`removed gamma.example; stored=${sitesOf(removed).join()}`);

    await memoryFilter.fill('kept');
    await remembered(['kept.example']);
    await listed(['beta.example', 'delta.example']);
    if (await filter.inputValue() !== 'example') throw new Error('记住站点过滤不应改网站规则过滤词');
    await memory.screenshot({ path: path.join(dir, 'independent.png'), animations: 'disabled' });
    note('remembered filter kept leaves the site-rules filter alone');

    await settings.getByRole('radio', { name: /Exclude listed sites/ }).click();
    const excluded = await poll(stored, value => value.siteMode === 'exclude' && sameSites(afterRemove)(value), '切换到排除应只改 siteMode');
    if (await filter.inputValue() !== '') throw new Error('切换模式后网站规则过滤应清空');
    await listed(afterRemove);
    if (await memoryFilter.inputValue() !== 'kept') throw new Error('切换模式不应清空记住站点过滤');
    await remembered(['kept.example']);
    await sites.screenshot({ path: path.join(dir, 'mode-reset.png'), animations: 'disabled' });
    note(`mode exclude resets the site filter; stored=${sitesOf(excluded).join()}`);

    await filter.fill('zzzz');
    await listed([]);
    await sites.getByText('No sites match.', { exact: true }).waitFor({ state: 'visible' });
    if (await sites.locator('[role="list"]').count()) throw new Error('无匹配时不应留下空白列表');
    const unmatched = await stored();
    if (!sameSites(afterRemove)(unmatched) || unmatched.siteMode !== 'exclude') throw new Error(`无匹配文案不应改存储：${sitesOf(unmatched).join()}`);
    await remembered(['kept.example']);
    await sites.screenshot({ path: path.join(dir, 'no-match.png'), animations: 'disabled' });
    note('no match shows a sentence');

    await settings.getByRole('radio', { name: /All sites/ }).click();
    await poll(stored, value => value.siteMode === 'all' && sameSites(afterRemove)(value), '切回全部网站应只改 siteMode');
    if (await filter.inputValue() !== '') throw new Error('再次切换模式后网站规则过滤应清空');
    await listed(afterRemove);
    if (await memoryFilter.inputValue() !== 'kept') throw new Error('再次切换模式不应清空记住站点过滤');
    await remembered(['kept.example']);

    const state = { ok: true, filtered: ['beta.example', 'gamma.example'], afterAdd, afterRemove, modeReset: 'exclude', memoryVisible: ['kept.example'] };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await settings?.close().catch(() => {});
  }
}

async function driveSettingsFloatingHiddenFilter(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const hiddenOf = value => value.floatingHiddenSites ?? [];
  const sameHidden = expected => value => hiddenOf(value).join() === expected.join();
  const sitesOf = value => value.sites ?? [];
  const prefsOf = value => Object.keys(value.sitePrefs ?? {}).sort();
  let settings;
  try {
    await worker.evaluate(async () => {
      const key = 'ottertap-settings-v1';
      const current = (await chrome.storage.local.get(key))[key] ?? {};
      await chrome.storage.local.set({
        [key]: {
          ...current,
          floating: true,
          siteMode: 'allow',
          sites: ['rules.example', 'listed.test'],
          sitePrefs: {
            'kept.example': { volume: 0.4 },
            'noted.test': { volume: 0.2 },
          },
          floatingHiddenSites: ['alpha.test', 'beta.example', 'gamma.example'],
        },
      });
    });
    const seeded = ['alpha.test', 'beta.example', 'gamma.example'];
    await poll(stored, value => value.floating !== false && value.siteMode === 'allow' && sameHidden(seeded)(value) && sitesOf(value).join() === 'rules.example,listed.test' && prefsOf(value).join() === 'kept.example,noted.test', '应先写入隐藏名单、网站规则和记住站点');
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#floating`, { waitUntil: 'domcontentloaded' });
    const floating = settings.locator('#floating');
    const sites = settings.locator('#sites');
    const memory = settings.locator('#memory');
    const filter = floating.getByRole('searchbox', { name: 'Filter hidden sites' });
    const siteFilter = sites.getByRole('searchbox', { name: 'Filter site list' });
    const memoryFilter = memory.getByRole('searchbox', { name: 'Filter by hostname' });
    await filter.waitFor({ state: 'visible', timeout: 15_000 });
    await siteFilter.waitFor({ state: 'visible', timeout: 15_000 });
    await memoryFilter.waitFor({ state: 'visible', timeout: 15_000 });
    const titles = () => floating.locator('[data-slot="item-title"]').allTextContents();
    const siteTitles = () => sites.locator('[data-slot="item-title"]').allTextContents();
    const memoryTitles = () => memory.locator('[data-slot="item-title"]').allTextContents();
    const listed = expected => poll(titles, value => value.join() === expected.join(), `隐藏名单应为 ${expected.join(', ')}`);
    const ruled = expected => poll(siteTitles, value => value.join() === expected.join(), `网站名单应为 ${expected.join(', ')}`);
    const remembered = expected => poll(memoryTitles, value => value.join() === expected.join(), `记住站点应为 ${expected.join(', ')}`);
    await listed(seeded);
    await ruled(['rules.example', 'listed.test']);
    await remembered(['kept.example', 'noted.test']);
    await floating.screenshot({ path: path.join(dir, 'list-all.png'), animations: 'disabled' });
    note('hidden list shows alpha.test, beta.example, gamma.example');

    await filter.fill('example');
    await listed(['beta.example', 'gamma.example']);
    if ((await titles()).includes('alpha.test')) throw new Error('过滤 example 时不应显示 alpha.test');
    const whileFiltered = await stored();
    if (!sameHidden(seeded)(whileFiltered)) throw new Error(`过滤不应改存储：${hiddenOf(whileFiltered).join()}`);
    if (whileFiltered.floating === false || whileFiltered.siteMode !== 'allow') throw new Error('过滤不应改全局浮动或网站规则');
    await floating.screenshot({ path: path.join(dir, 'filtered.png'), animations: 'disabled' });
    note('filter example hides alpha.test');

    await siteFilter.fill('rules');
    await memoryFilter.fill('kept');
    await ruled(['rules.example']);
    await remembered(['kept.example']);
    await listed(['beta.example', 'gamma.example']);
    if (await filter.inputValue() !== 'example') throw new Error('另外两处过滤不应改隐藏名单过滤词');
    await settings.screenshot({ path: path.join(dir, 'independent.png'), fullPage: true, animations: 'disabled' });
    note('site and memory filters leave the hidden-sites filter alone');

    await floating.getByRole('button', { name: 'Show the floating button on beta.example again' }).click();
    const afterRestore = ['alpha.test', 'gamma.example'];
    await listed(['gamma.example']);
    if ((await titles()).includes('beta.example')) throw new Error('恢复后仍匹配的站点应从结果消失');
    const restored = await poll(stored, value => sameHidden(afterRestore)(value) && sitesOf(value).join() === 'rules.example,listed.test' && prefsOf(value).join() === 'kept.example,noted.test', '恢复 beta.example 只应去掉这一条');
    if (await filter.inputValue() !== 'example') throw new Error('恢复不应清掉过滤词');
    await floating.screenshot({ path: path.join(dir, 'restored.png'), animations: 'disabled' });
    note(`restored beta.example; stored=${hiddenOf(restored).join()}`);

    const [download] = await Promise.all([
      settings.waitForEvent('download'),
      settings.getByRole('button', { name: 'Export settings', exact: true }).click(),
    ]);
    const exportPath = path.join(dir, 'export.json');
    await download.saveAs(exportPath);
    const exported = JSON.parse(await readFile(exportPath, 'utf8'));
    if (JSON.stringify(exported.settings?.floatingHiddenSites) !== JSON.stringify(afterRestore)) throw new Error(`导出应带完整名单：${JSON.stringify(exported.settings?.floatingHiddenSites)}`);
    if (await filter.inputValue() !== 'example') throw new Error('导出不应清掉过滤词');
    await listed(['gamma.example']);
    note(`export floatingHiddenSites ${JSON.stringify(exported.settings.floatingHiddenSites)}`);

    const roundTrip = structuredClone(exported);
    roundTrip.settings.floatingHiddenSites = ['alpha.test', 'beta.example', 'gamma.example', 'delta.test'];
    const importPath = path.join(dir, 'import.json');
    await writeFile(importPath, `${JSON.stringify(roundTrip, null, 2)}\n`);
    await settings.locator('#backup input[type="file"]').setInputFiles(importPath);
    await settings.getByRole('button', { name: 'Replace settings', exact: true }).click();
    const importedHidden = ['alpha.test', 'beta.example', 'gamma.example', 'delta.test'];
    const imported = await poll(stored, value => sameHidden(importedHidden)(value) && sitesOf(value).join() === 'rules.example,listed.test' && prefsOf(value).join() === 'kept.example,noted.test', '导入应写回完整隐藏名单，且不改另外两张表');
    if (await filter.inputValue() !== 'example') throw new Error('导入不应清掉过滤词');
    await listed(['beta.example', 'gamma.example']);
    if ((await titles()).includes('alpha.test') || (await titles()).includes('delta.test')) throw new Error('导入后不匹配的站点不应出现在过滤结果里');
    await ruled(['rules.example']);
    await remembered(['kept.example']);
    await floating.screenshot({ path: path.join(dir, 'imported.png'), animations: 'disabled' });
    note(`import restored ${hiddenOf(imported).join()}; filter still example`);

    await filter.fill('zzzz');
    await listed([]);
    await floating.getByText('No hidden sites match.', { exact: true }).waitFor({ state: 'visible' });
    if (await floating.locator('[role="list"]').count()) throw new Error('无匹配时不应留下空白列表');
    const unmatched = await stored();
    if (!sameHidden(importedHidden)(unmatched)) throw new Error(`无匹配文案不应改存储：${hiddenOf(unmatched).join()}`);
    await floating.screenshot({ path: path.join(dir, 'no-match.png'), animations: 'disabled' });
    note('no match shows a sentence');

    await filter.fill('');
    await listed(importedHidden);
    const state = { ok: true, filtered: ['beta.example', 'gamma.example'], afterRestore, exported: exported.settings.floatingHiddenSites, imported: hiddenOf(imported) };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await settings?.close().catch(() => {});
  }
}

async function driveSettingsCurrentSite(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const snapshot = value => ({
    sites: value.sites ?? [],
    prefs: Object.keys(value.sitePrefs ?? {}).sort(),
    hidden: value.floatingHiddenSites ?? [],
  });
  const elsewhereRoute = 'https://elsewhere.test/**';
  let settings;
  let fixture;
  let elsewhere;
  try {
    await context.route(elsewhereRoute, route => route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><title>elsewhere</title><p>elsewhere</p>',
    }));
    await worker.evaluate(async () => {
      const key = 'ottertap-settings-v1';
      const current = (await chrome.storage.local.get(key))[key] ?? {};
      await chrome.storage.local.set({
        [key]: {
          ...current,
          siteMode: 'allow',
          sites: ['alpha.test', 'beta.example', 'media.ottertap.test'],
          sitePrefs: {
            'alpha.test': { volume: 0.4 },
            'beta.example': { rate: 1.5 },
            'media.ottertap.test': { volume: 0.8 },
          },
          floatingHiddenSites: ['alpha.test', 'gamma.example', 'media.ottertap.test'],
        },
      });
    });
    const seeded = await poll(stored, value => value.siteMode === 'allow' && (value.sites ?? []).join() === 'alpha.test,beta.example,media.ottertap.test' && Object.keys(value.sitePrefs ?? {}).sort().join() === 'alpha.test,beta.example,media.ottertap.test' && (value.floatingHiddenSites ?? []).join() === 'alpha.test,gamma.example,media.ottertap.test', '应先写入三处名单');
    const seededSnapshot = snapshot(seeded);
    elsewhere = await context.newPage();
    await elsewhere.goto('https://elsewhere.test/', { waitUntil: 'domcontentloaded' });
    await elsewhere.waitForTimeout(150);
    fixture = await context.newPage();
    await fixture.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await fixture.locator('#media').waitFor({ state: 'attached', timeout: 15_000 });
    await fixture.bringToFront();
    await fixture.waitForTimeout(150);
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' });
    const memory = settings.locator('#memory');
    const sites = settings.locator('#sites');
    const floating = settings.locator('#floating');
    const memoryFilter = memory.getByRole('searchbox', { name: 'Filter by hostname' });
    const siteFilter = sites.getByRole('searchbox', { name: 'Filter site list' });
    const hiddenFilter = floating.getByRole('searchbox', { name: 'Filter hidden sites' });
    const memoryButton = memory.getByRole('button', { name: 'Current site', exact: true });
    const siteButton = sites.getByRole('button', { name: 'Current site', exact: true });
    const hiddenButton = floating.getByRole('button', { name: 'Current site', exact: true });
    const memoryTitles = () => memory.locator('[data-slot="item-title"]').allTextContents();
    const siteTitles = () => sites.locator('[data-slot="item-title"]').allTextContents();
    const hiddenTitles = () => floating.locator('[data-slot="item-title"]').allTextContents();
    await memoryButton.waitFor({ state: 'visible', timeout: 15_000 });
    await siteButton.waitFor({ state: 'visible', timeout: 15_000 });
    await hiddenButton.waitFor({ state: 'visible', timeout: 15_000 });
    const tabs = await settings.evaluate(async () => {
      const self = await chrome.tabs.getCurrent();
      const all = await chrome.tabs.query({});
      return {
        selfId: self?.id ?? null,
        selfWindow: self?.windowId ?? null,
        tabs: all.map(tab => ({ id: tab.id, windowId: tab.windowId, active: tab.active, url: tab.url ?? '', lastAccessed: tab.lastAccessed ?? 0 })),
      };
    });
    note(`tabs ${JSON.stringify(tabs)}`);
    await poll(async () => (await memoryButton.isEnabled()) && (await siteButton.isEnabled()) && (await hiddenButton.isEnabled()), value => value === true, '有当前网站时三处当前站都可点');
    await siteFilter.fill('beta');
    await hiddenFilter.fill('gamma');
    await poll(siteTitles, value => value.join() === 'beta.example', '网站规则先筛到 beta');
    await poll(hiddenTitles, value => value.join() === 'gamma.example', '隐藏名单先筛到 gamma');
    await settings.evaluate(() => window.scrollTo(0, 0));
    await poll(() => settings.evaluate(() => window.scrollY), value => value === 0, '应回到页顶');
    await memoryButton.evaluate(node => node.click());
    await poll(() => memoryFilter.inputValue(), value => value === 'media.ottertap.test', '记住站点应筛成当前主机名');
    await poll(memoryTitles, value => value.join() === 'media.ottertap.test', '记住站点只剩当前站');
    if (await siteFilter.inputValue() !== 'beta') throw new Error('记住站点的当前站不应改网站规则过滤');
    if (await hiddenFilter.inputValue() !== 'gamma') throw new Error('记住站点的当前站不应改隐藏名单过滤');
    await poll(siteTitles, value => value.join() === 'beta.example', '网站规则结果应保持 beta');
    await poll(hiddenTitles, value => value.join() === 'gamma.example', '隐藏名单结果应保持 gamma');
    const viewport = settings.viewportSize();
    const memoryBox = await memory.locator('[data-current-site-list="memory"]').boundingBox();
    const scrolled = await settings.evaluate(() => window.scrollY);
    if (!viewport || !memoryBox || memoryBox.y < -2 || memoryBox.y > viewport.height - 8) throw new Error(`记住站点列表没有进视口 y=${memoryBox?.y}`);
    if (scrolled <= 0) throw new Error('点记住站点的当前站后页面仍停在页顶');
    const whileLocated = await stored();
    if (JSON.stringify(snapshot(whileLocated)) !== JSON.stringify(seededSnapshot)) throw new Error(`定位不应改存储：${JSON.stringify(snapshot(whileLocated))}`);
    await memory.screenshot({ path: path.join(dir, 'memory-located.png'), animations: 'disabled' });
    await sites.screenshot({ path: path.join(dir, 'sites-held.png'), animations: 'disabled' });
    note(`memory located; scrollY=${scrolled}; sites still beta; hidden still gamma`);

    await siteButton.evaluate(node => node.click());
    await poll(() => siteFilter.inputValue(), value => value === 'media.ottertap.test', '网站规则应筛成当前主机名');
    await poll(siteTitles, value => value.join() === 'media.ottertap.test', '网站规则只剩当前站');
    if (await memoryFilter.inputValue() !== 'media.ottertap.test') throw new Error('网站规则的当前站不应改记住站点过滤');
    if (await hiddenFilter.inputValue() !== 'gamma') throw new Error('网站规则的当前站不应改隐藏名单过滤');
    const sitesBox = await sites.locator('[data-current-site-list="sites"]').boundingBox();
    if (!sitesBox || sitesBox.y < -2 || sitesBox.y > viewport.height - 8) throw new Error(`网站规则列表没有进视口 y=${sitesBox?.y}`);

    await hiddenButton.evaluate(node => node.click());
    await poll(() => hiddenFilter.inputValue(), value => value === 'media.ottertap.test', '隐藏名单应筛成当前主机名');
    await poll(hiddenTitles, value => value.join() === 'media.ottertap.test', '隐藏名单只剩当前站');
    if (await memoryFilter.inputValue() !== 'media.ottertap.test' || await siteFilter.inputValue() !== 'media.ottertap.test') throw new Error('隐藏名单的当前站不应改另外两处');
    const hiddenBox = await floating.locator('[data-current-site-list="floating"]').boundingBox();
    if (!hiddenBox || hiddenBox.y < -2 || hiddenBox.y > viewport.height - 8) throw new Error(`隐藏名单没有进视口 y=${hiddenBox?.y}`);
    await floating.screenshot({ path: path.join(dir, 'hidden-located.png'), animations: 'disabled' });
    note('each section located on its own');

    await fixture.close();
    fixture = undefined;
    await elsewhere.close();
    elsewhere = undefined;
    const disabled = async () => !(await memoryButton.isEnabled()) && !(await siteButton.isEnabled()) && !(await hiddenButton.isEnabled());
    await poll(disabled, value => value === true, '没有网页标签时当前站应不可用');
    await memoryFilter.fill('alpha');
    await memoryButton.evaluate(node => node.click());
    if (await memoryFilter.inputValue() !== 'alpha') throw new Error('不可用的当前站不应改过滤');
    if (await siteFilter.inputValue() !== 'media.ottertap.test' || await hiddenFilter.inputValue() !== 'media.ottertap.test') throw new Error('不可用的点击不应改另外两处');
    const afterUnavailable = await stored();
    if (JSON.stringify(snapshot(afterUnavailable)) !== JSON.stringify(seededSnapshot)) throw new Error(`不可用时不应改存储：${JSON.stringify(snapshot(afterUnavailable))}`);
    await memory.screenshot({ path: path.join(dir, 'unavailable.png'), animations: 'disabled' });
    note('no hostname leaves the alpha filter');

    const state = {
      ok: true,
      host: 'media.ottertap.test',
      memory: ['media.ottertap.test'],
      held: { sites: 'beta', hidden: 'gamma' },
      unavailableKept: 'alpha',
    };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await context.unroute(elsewhereRoute).catch(() => {});
    await settings?.close().catch(() => {});
    await fixture?.close().catch(() => {});
    await elsewhere?.close().catch(() => {});
  }
}

async function driveSettingsClearRemembered(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const near = expected => value => Math.abs(value - expected) < 0.02;
  const hostsOf = value => Object.keys(value.sitePrefs ?? {}).sort();
  const kept = value => ({
    siteMode: value.siteMode,
    sites: value.sites ?? [],
    hidden: value.floatingHiddenSites ?? [],
    defaultRate: value.defaultRate ?? null,
    prefs: hostsOf(value),
  });
  const panelState = `(() => {
    const remember = document.querySelector('[role="switch"][aria-label="Remember this site"]');
    const slider = document.querySelector('input[aria-label="Volume"]');
    return {
      remembered: remember?.getAttribute('aria-checked') ?? '',
      volume: slider ? Number(slider.getAttribute('aria-valuenow')) : null,
    };
  })()`;
  let settings;
  let fixture;
  let popup;
  try {
    await worker.evaluate(async () => {
      const key = 'ottertap-settings-v1';
      const current = (await chrome.storage.local.get(key))[key] ?? {};
      await chrome.storage.local.set({
        [key]: {
          ...current,
          siteMode: 'exclude',
          sites: ['rules.example'],
          floatingHiddenSites: ['hidden.example'],
          defaultRate: 1.25,
          sitePrefs: {
            'alpha.test': { volume: 0.5 },
            'beta.example': { rate: 1.5 },
            'media.ottertap.test': { volume: 0.4, rate: 2 },
          },
        },
      });
    });
    const seeded = await poll(stored, value => hostsOf(value).join() === ['alpha.test', 'beta.example', 'media.ottertap.test'].join() && value.defaultRate === 1.25 && value.siteMode === 'exclude' && (value.sites ?? []).join() === 'rules.example' && (value.floatingHiddenSites ?? []).join() === 'hidden.example', '应先写入三条记住站点，并留下规则、隐藏名单和默认倍速');
    note(`seeded ${JSON.stringify(kept(seeded))}`);

    fixture = await context.newPage();
    await fixture.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await fixture.reload({ waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    const volumeOf = () => fixture.locator('#media').evaluate(element => element.volume);
    const rateOf = () => fixture.locator('#media').evaluate(element => element.playbackRate);
    const beforeVolume = await poll(volumeOf, near(0.4), '记住的音量 40% 应套用到夹具');
    const beforeRate = await poll(rateOf, near(2), '记住的 2× 应盖过默认 1.25×');
    await fixture.screenshot({ path: path.join(dir, 'fixture-before.png'), animations: 'disabled' });
    note(`before clear volume=${beforeVolume} rate=${beforeRate}`);

    popup = await openActionPopup(context, fixture);
    const beforePanel = await poll(() => popup.evaluate(panelState), value => value?.remembered === 'true' && Math.abs(value.volume - 40) < 1, '清空前面板应显示已记住，音量约 40%');
    await popup.screenshot(path.join(dir, 'popup-before.png'));
    note(`panel before ${JSON.stringify(beforePanel)}`);
    await popup.close();
    popup = undefined;

    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#memory`, { waitUntil: 'domcontentloaded' });
    const memory = settings.locator('#memory');
    const clearAll = memory.getByRole('button', { name: 'Clear all', exact: true });
    await clearAll.waitFor({ state: 'visible', timeout: 15_000 });
    const titles = () => memory.locator('[data-slot="item-title"]').allTextContents();
    await poll(titles, value => value.join() === ['alpha.test', 'beta.example', 'media.ottertap.test'].join(), '记住表应列出三条');
    if (await settings.locator('#sites').getByRole('button', { name: 'Clear all', exact: true }).count()) throw new Error('网站规则区不应有清空全部');
    if (await settings.locator('#floating').getByRole('button', { name: 'Clear all', exact: true }).count()) throw new Error('隐藏浮动名单不应有清空全部');
    const confirm = memory.getByRole('region', { name: 'Clear every remembered site?' });
    if (await confirm.count()) throw new Error('还没点清空全部时不应出现确认');
    await memory.screenshot({ path: path.join(dir, 'list-before.png'), animations: 'disabled' });
    note('memory lists three sites and Clear all');

    await clearAll.click();
    await confirm.waitFor({ state: 'visible' });
    await confirm.getByText('You cannot undo this unless you already have your own backup.', { exact: false }).waitFor({ state: 'visible' });
    await confirm.getByText('Site rules, sites without the floating button, and the rest of your settings stay unchanged.', { exact: false }).waitFor({ state: 'visible' });
    await memory.screenshot({ path: path.join(dir, 'confirm.png'), animations: 'disabled' });
    note('confirm copy says the wipe cannot be undone without a backup');

    await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
    await confirm.waitFor({ state: 'hidden' });
    await poll(titles, value => value.join() === ['alpha.test', 'beta.example', 'media.ottertap.test'].join(), '取消后列表应不变');
    const cancelled = await poll(stored, value => hostsOf(value).join() === ['alpha.test', 'beta.example', 'media.ottertap.test'].join() && value.sitePrefs?.['media.ottertap.test']?.volume === 0.4 && value.sitePrefs?.['media.ottertap.test']?.rate === 2 && value.siteMode === 'exclude' && (value.sites ?? []).join() === 'rules.example' && (value.floatingHiddenSites ?? []).join() === 'hidden.example' && value.defaultRate === 1.25, '取消不应改记住表、规则、隐藏名单或默认倍速');
    await memory.screenshot({ path: path.join(dir, 'cancelled.png'), animations: 'disabled' });
    note(`cancelled ${JSON.stringify(kept(cancelled))}`);

    await memory.getByRole('searchbox', { name: 'Filter by hostname' }).fill('example');
    await poll(titles, value => value.join() === 'beta.example', '过滤 example 时只显示 beta.example');
    await memory.screenshot({ path: path.join(dir, 'filtered.png'), animations: 'disabled' });
    note('filter hides alpha.test and media.ottertap.test before clear');

    await clearAll.click();
    await confirm.getByRole('button', { name: 'Clear all remembered sites', exact: true }).click();
    await memory.getByText('No sites remembered yet.', { exact: false }).waitFor({ state: 'visible' });
    if (await memory.locator('[role="list"]').count()) throw new Error('清空后不应留下记住表');
    await clearAll.waitFor({ state: 'hidden' });
    const cleared = await poll(stored, value => hostsOf(value).length === 0 && value.siteMode === 'exclude' && (value.sites ?? []).join() === 'rules.example' && (value.floatingHiddenSites ?? []).join() === 'hidden.example' && value.defaultRate === 1.25, '确认后 sitePrefs 应为空，规则、隐藏名单和默认倍速仍在');
    await memory.screenshot({ path: path.join(dir, 'cleared.png'), animations: 'disabled' });
    note(`cleared ${JSON.stringify(kept(cleared))}`);

    await settings.goto(`chrome-extension://${extensionId}/options.html#backup`, { waitUntil: 'domcontentloaded' });
    const [download] = await Promise.all([
      settings.waitForEvent('download'),
      settings.getByRole('button', { name: 'Export settings', exact: true }).click(),
    ]);
    const exportPath = path.join(dir, 'export.json');
    await download.saveAs(exportPath);
    const exported = JSON.parse(await readFile(exportPath, 'utf8'));
    const exportedPrefs = exported?.settings?.sitePrefs ?? null;
    if (!exportedPrefs || typeof exportedPrefs !== 'object' || Array.isArray(exportedPrefs) || Object.keys(exportedPrefs).length !== 0) {
      throw new Error(`导出的记住站点应为 0：${JSON.stringify(exportedPrefs)}`);
    }
    if ((exported.settings.sites ?? []).join() !== 'rules.example' || (exported.settings.floatingHiddenSites ?? []).join() !== 'hidden.example' || exported.settings.siteMode !== 'exclude' || exported.settings.defaultRate !== 1.25) {
      throw new Error(`导出不应改其他设置：${JSON.stringify({ sites: exported.settings.sites, hidden: exported.settings.floatingHiddenSites, siteMode: exported.settings.siteMode, defaultRate: exported.settings.defaultRate })}`);
    }
    note('export has 0 remembered sites');

    await fixture.reload({ waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    const afterRate = await poll(rateOf, near(1.25), '清空后应套用默认 1.25×，不再套用记住的 2×');
    await fixture.waitForTimeout(800);
    const afterVolume = await volumeOf();
    const settledRate = await rateOf();
    if (!near(1)(afterVolume)) throw new Error(`清空后新访问不应再套用 40%：${afterVolume}`);
    if (!near(1.25)(settledRate)) throw new Error(`清空后倍速不应离开默认 1.25×：${settledRate}`);
    await fixture.screenshot({ path: path.join(dir, 'fixture-after.png'), animations: 'disabled' });
    note(`after clear volume=${afterVolume} rate=${afterRate}`);

    popup = await openActionPopup(context, fixture);
    const afterPanel = await poll(() => popup.evaluate(panelState), value => value?.remembered === 'false' && Math.abs(value.volume - 100) < 1, '清空后面板不应再显示已记住，音量应回到约 100%');
    await popup.screenshot(path.join(dir, 'popup-after.png'));
    note(`panel after ${JSON.stringify(afterPanel)}`);

    const state = {
      ok: true,
      before: { volume: beforeVolume, rate: beforeRate, panel: beforePanel },
      cancelled: kept(cancelled),
      cleared: kept(cleared),
      exportRemembered: 0,
      after: { volume: afterVolume, rate: settledRate, panel: afterPanel },
    };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await popup?.close().catch(() => {});
    await settings?.close().catch(() => {});
    await fixture?.close().catch(() => {});
  }
}

const mirrorSwitchExpr = `(() => {
  const node = document.querySelector('[role="switch"][aria-label="Mirror horizontally"]');
  return {
    checked: node?.getAttribute('aria-checked') ?? '',
    disabled: !!(node && (node.disabled || node.hasAttribute('data-disabled') || node.getAttribute('aria-disabled') === 'true')),
    hint: document.querySelector('#mirror-hint')?.textContent ?? '',
    heading: document.querySelector('h1')?.textContent?.trim() ?? '',
    alert: document.querySelector('[role="alert"]')?.textContent?.trim() ?? '',
  };
})()`;

function mirrorClickExpr(label) {
  return `(() => {
    const node = document.querySelector('[role="switch"][aria-label=${JSON.stringify(label)}]');
    if (!node || node.disabled || node.hasAttribute('data-disabled') || node.getAttribute('aria-disabled') === 'true') return false;
    node.click();
    return true;
  })()`;
}

function pictureOf(page, selector) {
  return page.locator(selector).evaluate(element => {
    const box = element.getBoundingClientRect();
    const computed = getComputedStyle(element);
    return {
      scale: element.style.getPropertyValue('scale'),
      computedScale: computed.getPropertyValue('scale'),
      transform: computed.transform,
      volume: element.volume,
      muted: element.muted,
      rate: element.playbackRate,
      currentTime: element.currentTime,
      width: Math.round(box.width),
      height: Math.round(box.height),
      mirrored: element.hasAttribute('data-ottertap-mirror'),
    };
  });
}

function soundSame(before, after) {
  return Math.abs(after.volume - before.volume) < 0.001 && after.muted === before.muted && Math.abs(after.rate - before.rate) < 0.001 && Math.abs(after.currentTime - before.currentTime) < 0.25;
}

async function driveHorizontalMirror(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const prefsText = async () => JSON.stringify((await stored()).sitePrefs ?? {});
  const flipped = value => value.mirrored && (value.scale === '-1 1' || value.computedScale === '-1 1');
  const plain = value => !value.mirrored && value.scale !== '-1 1' && value.computedScale !== '-1 1';
  let popup = null;
  let feed = null;
  let audio = null;
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
      element.pause();
      element.style.borderLeft = '28px solid #e4572e';
    });
    const before = await pictureOf(page, '#media');
    if (!plain(before)) throw new Error(`视频默认应未镜像：${JSON.stringify(before)}`);
    if ((await prefsText()).includes('mirror')) throw new Error('空配置里已有 mirror');

    popup = await openActionPopup(context, page);
    const off = await popup.evaluate(mirrorSwitchExpr);
    if (off.checked !== 'false' || off.disabled || off.hint || off.alert) throw new Error(`默认开关不对：${JSON.stringify(off)}`);
    await popup.screenshot(path.join(dir, 'popup-off.png'));
    note('switch off by default');
    if (!await popup.evaluate(mirrorClickExpr('Mirror horizontally'))) throw new Error('点不到水平镜像开关');
    const onPicture = await poll(() => pictureOf(page, '#media'), flipped, '开启后当前视频应水平翻转');
    if (!soundSame(before, onPicture)) throw new Error(`镜像改了声音或进度：${JSON.stringify({ before, onPicture })}`);
    if (onPicture.width !== before.width || onPicture.height !== before.height) throw new Error(`镜像改了布局盒子：${JSON.stringify({ before, onPicture })}`);
    if (onPicture.transform !== before.transform) throw new Error(`镜像改了 transform：${before.transform} -> ${onPicture.transform}`);
    const onSwitch = await poll(() => popup.evaluate(mirrorSwitchExpr), value => value.checked === 'true' && !value.disabled && !value.hint && !value.alert, '开关应为开，且没有报错');
    await popup.screenshot(path.join(dir, 'popup-on.png'));
    await page.screenshot({ path: path.join(dir, 'fixture-on.png'), animations: 'disabled' });
    if ((await prefsText()).includes('mirror')) throw new Error('未记住站点时镜像写入了 sitePrefs');
    note(`on ${JSON.stringify({ switch: onSwitch.checked, scale: onPicture.scale, volume: onPicture.volume, rate: onPicture.rate })}`);

    if (!await popup.evaluate(mirrorClickExpr('Mirror horizontally'))) throw new Error('关不掉水平镜像');
    const restored = await poll(() => pictureOf(page, '#media'), plain, '关闭后画面应恢复');
    if (!soundSame(before, restored)) throw new Error(`关闭后声音变了：${JSON.stringify({ before, restored })}`);
    const restoredSwitch = await poll(() => popup.evaluate(mirrorSwitchExpr), value => value.checked === 'false', '关闭后开关应为关');
    await popup.screenshot(path.join(dir, 'popup-restored.png'));
    note(`restored checked=${restoredSwitch.checked}`);
    await popup.close();
    popup = null;

    popup = await openActionPopup(context, page);
    if (!await popup.evaluate(mirrorClickExpr('Mirror horizontally'))) throw new Error('重新打开后面板点不到开关');
    await poll(() => pictureOf(page, '#media'), flipped, '再次开启应再次翻转');
    await popup.close();
    popup = null;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    const reloaded = await poll(() => pictureOf(page, '#media'), plain, '重新加载后新媒体默认不镜像');
    note(`reload plain scale=${reloaded.scale}`);

    feed = await context.newPage();
    await feed.goto(`${origin}/feed`, { waitUntil: 'domcontentloaded' });
    await feed.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await feed.bringToFront();
    popup = await openActionPopup(context, feed);
    const feedStart = await popup.evaluate(mirrorSwitchExpr);
    const selectedSelector = feedStart.heading === 'Feed preview' ? '#preview' : feedStart.heading === 'Main player' ? '#media' : '';
    if (!selectedSelector || feedStart.checked !== 'false') throw new Error(`feed 初始选中不对：${JSON.stringify(feedStart)}`);
    const otherSelector = selectedSelector === '#preview' ? '#media' : '#preview';
    const otherName = otherSelector === '#media' ? 'Main player' : 'Feed preview';
    if (!await popup.evaluate(mirrorClickExpr('Mirror horizontally'))) throw new Error('feed 上点不到开关');
    const selectedOn = await poll(() => pictureOf(feed, selectedSelector), flipped, 'feed 上只应翻转当前选中的视频');
    const otherOff = await pictureOf(feed, otherSelector);
    if (!plain(otherOff)) throw new Error(`另一条视频被镜像了：${JSON.stringify(otherOff)}`);
    note(`feed selected=${feedStart.heading} other plain volume=${otherOff.volume}`);
    if (!await popup.evaluate(`(() => { const trigger = document.getElementById('popup-media'); if (!trigger) return false; trigger.click(); return true; })()`)) throw new Error('feed 上没有媒体列表');
    const chose = await poll(async () => popup.evaluate(`(() => {
      const item = [...document.querySelectorAll('[role="menuitemradio"]')].find(node => (node.textContent || '').includes(${JSON.stringify(otherName)}));
      if (!item) return false;
      item.click();
      return true;
    })()`), value => value === true, `应能选中 ${otherName}`);
    if (!chose) throw new Error(`没有点到 ${otherName}`);
    const otherSwitch = await poll(() => popup.evaluate(mirrorSwitchExpr), value => value.heading === otherName && value.checked === 'false' && !value.alert, '换媒体后开关应关着，标题换成另一条');
    const otherStill = await pictureOf(feed, otherSelector);
    const selectedStill = await pictureOf(feed, selectedSelector);
    if (!plain(otherStill) || !flipped(selectedOn) || !flipped(selectedStill)) throw new Error(`换媒体串了镜像：${JSON.stringify({ otherStill, selectedStill })}`);
    if (Math.abs(otherStill.volume - otherOff.volume) > 0.001 || Math.abs(otherStill.rate - otherOff.rate) > 0.001) throw new Error('换媒体改了另一条的声音');
    await popup.screenshot(path.join(dir, 'feed-other.png'));
    note(`switched to ${otherSwitch.heading} checked=${otherSwitch.checked}`);
    await popup.close();
    popup = null;
    await feed.reload({ waitUntil: 'domcontentloaded' });
    await feed.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    const feedFreshPreview = await poll(() => pictureOf(feed, '#preview'), plain, '刷新后预览默认不镜像');
    const feedFreshMain = await pictureOf(feed, '#media');
    if (!plain(feedFreshMain)) throw new Error(`刷新后主视频仍镜像：${JSON.stringify(feedFreshMain)}`);
    note(`feed reload preview=${feedFreshPreview.scale} main=${feedFreshMain.scale}`);

    audio = await context.newPage();
    await audio.goto(`${origin}/audio`, { waitUntil: 'domcontentloaded' });
    await audio.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await audio.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
      element.pause();
    });
    const audioBefore = await pictureOf(audio, '#media');
    await audio.bringToFront();
    popup = await openActionPopup(context, audio);
    const audioSwitch = await popup.evaluate(mirrorSwitchExpr);
    if (!audioSwitch.disabled || audioSwitch.checked !== 'false' || audioSwitch.hint !== 'Audio has no picture, so it cannot be mirrored.') {
      throw new Error(`音频开关不对：${JSON.stringify(audioSwitch)}`);
    }
    if (await popup.evaluate(mirrorClickExpr('Mirror horizontally'))) throw new Error('音频开关不应能点');
    const audioAfter = await pictureOf(audio, '#media');
    if (!plain(audioAfter) || !soundSame(audioBefore, audioAfter)) throw new Error(`音频被改了：${JSON.stringify({ audioBefore, audioAfter })}`);
    await popup.screenshot(path.join(dir, 'audio-disabled.png'));
    note('audio switch disabled');
    await popup.close();
    popup = null;

    await page.bringToFront();
    popup = await openActionPopup(context, page);
    const beforeRemember = await prefsText();
    if (!await popup.evaluate(mirrorClickExpr('Remember this site'))) throw new Error('点不到记住此站点');
    await poll(async () => (await stored()).sitePrefs?.['media.ottertap.test'], value => value && typeof value === 'object', '记住此站点应写下当前音量和倍速');
    if (!await popup.evaluate(mirrorClickExpr('Mirror horizontally'))) throw new Error('记住之后点不到水平镜像');
    const rememberedPicture = await poll(() => pictureOf(page, '#media'), flipped, '记住站点之后仍应能翻转画面');
    const rememberedPrefs = (await stored()).sitePrefs?.['media.ottertap.test'] ?? {};
    if (Object.hasOwn(rememberedPrefs, 'mirror') || JSON.stringify(rememberedPrefs).includes('mirror')) throw new Error(`镜像写进了 sitePrefs：${JSON.stringify(rememberedPrefs)}`);
    await popup.screenshot(path.join(dir, 'remembered.png'));
    note(`remembered keys=${Object.keys(rememberedPrefs).join(',')} scale=${rememberedPicture.scale}`);
    await popup.close();
    popup = null;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    const afterRemember = await poll(() => pictureOf(page, '#media'), plain, '记住站点并重新加载后画面仍默认不镜像');
    popup = await openActionPopup(context, page);
    const afterSwitch = await popup.evaluate(mirrorSwitchExpr);
    if (afterSwitch.checked !== 'false') throw new Error(`重新加载后开关不是关：${JSON.stringify(afterSwitch)}`);
    if (!await popup.evaluate(mirrorClickExpr('Remember this site'))) throw new Error('关不掉记住此站点');
    await poll(async () => (await stored()).sitePrefs?.['media.ottertap.test'], value => value == null, '关掉记住此站点后应忘掉这一条');
    if ((await prefsText()).includes('mirror')) throw new Error('清理后 sitePrefs 仍有 mirror');
    await popup.screenshot(path.join(dir, 'reloaded.png'));
    note(`after reload plain volume=${afterRemember.volume} prefsWere=${beforeRemember}`);

    const state = {
      ok: true,
      on: { scale: onPicture.scale, width: onPicture.width, height: onPicture.height, volume: onPicture.volume, rate: onPicture.rate },
      restored: { scale: restored.scale, mirrored: restored.mirrored },
      feed: { selected: feedStart.heading, other: otherName },
      audioDisabled: true,
      rememberedKeys: Object.keys(rememberedPrefs),
      reloadedMirrored: afterRemember.mirrored,
    };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await popup?.close().catch(() => {});
    await audio?.close().catch(() => {});
    await feed?.close().catch(() => {});
    await page.close().catch(() => {});
  }
}

const progressMarkView = `(() => {
  const button = label => document.querySelector('button[aria-label="' + label + '"]');
  const set = button('Set mark');
  const jump = button('Jump to mark');
  const clear = button('Clear mark');
  const mark = document.querySelector('[data-progress-mark]');
  const track = document.querySelector('[data-slot="slider-track"]');
  let ratio = null;
  if (mark && track) {
    const m = mark.getBoundingClientRect();
    const t = track.getBoundingClientRect();
    if (t.width > 0) ratio = (m.left + m.width / 2 - t.left) / t.width;
  }
  return {
    heading: document.querySelector('h1')?.textContent?.trim() ?? '',
    setDisabled: !set || !!set.disabled,
    jumpDisabled: !jump || !!jump.disabled,
    clearDisabled: !clear || !!clear.disabled,
    frameDisabled: !!button('Next frame')?.disabled,
    skipDisabled: !!button('Forward 10 seconds')?.disabled,
    status: (document.querySelector('#progress-mark-status')?.textContent ?? '').trim(),
    hasMark: !!mark,
    ratio,
    alert: document.querySelector('[role="alert"]')?.textContent?.trim() ?? '',
  };
})()`;

async function driveProgressMark(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const dumpStorage = () => worker.evaluate(async () => {
    const local = await chrome.storage.local.get(null);
    let session = null;
    try { session = await chrome.storage.session.get(null); } catch { session = null; }
    return JSON.stringify({ local, session });
  });
  const near = (expected, slack = 0.05) => value => Math.abs(value - expected) < slack;
  const chooseMedia = async (popup, name) => {
    if (!await popup.evaluate(`(() => { const trigger = document.getElementById('popup-media'); if (!trigger) return false; trigger.click(); return true; })()`)) throw new Error('没有媒体列表');
    const chose = await poll(async () => popup.evaluate(`(() => {
      const item = [...document.querySelectorAll('[role="menuitemradio"]')].find(node => (node.textContent || '').includes(${JSON.stringify(name)}));
      if (!item) return false;
      item.click();
      return true;
    })()`), value => value === true, `应能选中 ${name}`);
    if (!chose) throw new Error(`没有点到 ${name}`);
  };
  let popup = null;
  let fresh = null;
  let feed = null;
  let blocked = null;
  const page = await context.newPage();
  const time = () => page.locator('#media').evaluate(element => element.currentTime);
  try {
    await page.goto(`${origin}/long`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
      element.pause();
      element.currentTime = 12;
    });
    await poll(time, near(12), '长视频应停在 12 秒');
    const duration = await page.locator('#media').evaluate(element => element.duration);
    if (!(duration > 100)) throw new Error(`/long 的时长应约 120 秒：${duration}`);

    popup = await openActionPopup(context, page);
    const empty = await poll(() => popup.evaluate(progressMarkView), value => value.heading === 'Long video' && value.setDisabled === false && value.jumpDisabled && value.clearDisabled && value.status === '' && !value.hasMark && !value.alert, '未设标记时只能设，不能跳或清');
    let storage = await dumpStorage();
    await page.waitForTimeout(200);
    const settled = await dumpStorage();
    if (settled !== storage) storage = settled;
    if (storage.includes('"mark"')) throw new Error('设标记前扩展存储里已有 mark');
    note(`empty status=${JSON.stringify(empty.status)} storageBytes=${storage.length}`);

    await popup.click('Set mark');
    const marked = await poll(() => popup.evaluate(progressMarkView), value => value.status === 'Mark at 00:12' && value.hasMark && !value.jumpDisabled && !value.clearDisabled && !value.alert && value.ratio != null && value.ratio > 0.05 && value.ratio < 0.2, '设标记后应停在 12 秒，并画在进度条约 10% 处');
    await popup.screenshot(path.join(dir, 'popup-set.png'));
    note(`set ratio=${marked.ratio} status=${marked.status}`);

    await popup.click('Forward 10 seconds');
    const awayTime = await poll(time, near(22), '前进 10 秒后应到约 22 秒');
    const away = await poll(() => popup.evaluate(progressMarkView), value => value.status === 'Mark at 00:12' && value.hasMark && value.ratio != null && value.ratio > 0.05 && value.ratio < 0.2, '快进后标记仍停在 12 秒');
    await popup.screenshot(path.join(dir, 'popup-away.png'));
    const beforeFrame = await time();
    await popup.click('Next frame');
    const framed = await poll(time, value => value > beforeFrame + 0.005 && value < beforeFrame + 0.5, '下一帧应只挪一小步');
    const framedView = await popup.evaluate(progressMarkView);
    if (framedView.status !== 'Mark at 00:12' || !framedView.hasMark) throw new Error(`逐帧擦掉了标记：${JSON.stringify(framedView)}`);
    note(`away=${awayTime} ratio=${away.ratio} frame=${framed}`);

    await popup.click('Jump to mark');
    const jumped = await poll(time, near(12), '跳到标记应回到约 12 秒');
    const jumpedView = await poll(() => popup.evaluate(progressMarkView), value => value.status === 'Mark at 00:12' && value.hasMark && !value.alert, '跳转后标记还在');
    note(`jump=${jumped} status=${jumpedView.status}`);

    await popup.close();
    popup = null;
    popup = await openActionPopup(context, page);
    const reopened = await poll(() => popup.evaluate(progressMarkView), value => value.status === 'Mark at 00:12' && value.hasMark && !value.jumpDisabled && !value.alert, '关掉面板再打开，标记仍在这一页');
    await popup.screenshot(path.join(dir, 'popup-reopened.png'));
    note(`reopened ratio=${reopened.ratio}`);

    await popup.click('Clear mark');
    const cleared = await poll(() => popup.evaluate(progressMarkView), value => value.status === '' && !value.hasMark && value.jumpDisabled && value.clearDisabled && !value.setDisabled && !value.alert, '清除后不能再跳');
    const stayed = await time();
    if (!near(12)(stayed)) throw new Error(`清除标记改了进度：${stayed}`);
    await popup.click('Jump to mark');
    await page.waitForTimeout(400);
    const afterJump = await time();
    if (!near(12)(afterJump)) throw new Error(`清除后跳转改了进度：${afterJump}`);
    await popup.screenshot(path.join(dir, 'popup-cleared.png'));
    note(`cleared time=${afterJump} jumpDisabled=${cleared.jumpDisabled}`);
    await popup.close();
    popup = null;
    await page.close();

    fresh = await context.newPage();
    await fresh.goto(`${origin}/long`, { waitUntil: 'domcontentloaded' });
    await fresh.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await fresh.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
      element.pause();
      element.currentTime = 12;
    });
    await poll(() => fresh.locator('#media').evaluate(element => element.currentTime), near(12), '新标签应停在 12 秒');
    popup = await openActionPopup(context, fresh);
    const nextTab = await poll(() => popup.evaluate(progressMarkView), value => value.status === '' && !value.hasMark && value.jumpDisabled && !value.alert, '新标签不应带上一个标签的标记');
    note(`new tab status=${JSON.stringify(nextTab.status)}`);
    await popup.close();
    popup = null;

    feed = await context.newPage();
    await feed.goto(`${origin}/feed`, { waitUntil: 'domcontentloaded' });
    await feed.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await feed.evaluate(async () => {
      const preview = document.querySelector('#preview');
      const main = document.querySelector('#media');
      for (const element of [preview, main]) {
        if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
        element.pause();
      }
      preview.currentTime = 0.4;
      main.currentTime = 0.2;
    });
    popup = await openActionPopup(context, feed);
    const feedStart = await poll(() => popup.evaluate(progressMarkView), value => (value.heading === 'Feed preview' || value.heading === 'Main player') && !value.hasMark && value.jumpDisabled, 'feed 上两条都还没有标记');
    const selectedSelector = feedStart.heading === 'Feed preview' ? '#preview' : '#media';
    const otherSelector = selectedSelector === '#preview' ? '#media' : '#preview';
    const otherName = otherSelector === '#media' ? 'Main player' : 'Feed preview';
    const markedAt = selectedSelector === '#preview' ? 0.4 : 0.2;
    const readTimes = () => feed.evaluate(() => ({
      preview: document.querySelector('#preview').currentTime,
      main: document.querySelector('#media').currentTime,
    }));
    await popup.click('Set mark');
    await poll(() => popup.evaluate(progressMarkView), value => value.heading === feedStart.heading && value.hasMark && !value.jumpDisabled && value.status === 'Mark at 00:00', '当前这条应设上标记');
    const markedTimes = await readTimes();
    await chooseMedia(popup, otherName);
    const otherView = await poll(() => popup.evaluate(progressMarkView), value => value.heading === otherName && !value.hasMark && value.jumpDisabled && value.status === '' && !value.alert, '另一条媒体没有这条的标记');
    const otherTimes = await readTimes();
    if (Math.abs(otherTimes.preview - markedTimes.preview) > 0.05 || Math.abs(otherTimes.main - markedTimes.main) > 0.05) {
      throw new Error(`换媒体改了进度：${JSON.stringify({ markedTimes, otherTimes })}`);
    }
    await popup.screenshot(path.join(dir, 'feed-other.png'));
    await chooseMedia(popup, feedStart.heading);
    await poll(() => popup.evaluate(progressMarkView), value => value.heading === feedStart.heading && value.hasMark && !value.jumpDisabled, '回到原来那一条，标记还在');
    await feed.locator(selectedSelector).evaluate(element => { element.currentTime = 0.05; });
    await popup.click('Jump to mark');
    const returned = await poll(() => feed.locator(selectedSelector).evaluate(element => element.currentTime), near(markedAt, 0.08), '跳转应把原来那一条拉回标记');
    const otherAfter = await feed.locator(otherSelector).evaluate(element => element.currentTime);
    const otherExpected = otherSelector === '#preview' ? markedTimes.preview : markedTimes.main;
    if (Math.abs(otherAfter - otherExpected) > 0.05) throw new Error(`跳转串到了另一条：${otherAfter}`);
    note(`feed selected=${feedStart.heading} other=${otherView.heading} returned=${returned}`);
    await popup.close();
    popup = null;

    blocked = await context.newPage();
    await blocked.goto(`${origin}/unseekable`, { waitUntil: 'domcontentloaded' });
    await blocked.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    popup = await openActionPopup(context, blocked);
    const unavailable = "Live streams and media that can't be seeked can't keep a mark.";
    const blockedView = await poll(() => popup.evaluate(progressMarkView), value => value.setDisabled && value.jumpDisabled && value.clearDisabled && value.status === unavailable && !value.hasMark && value.frameDisabled && value.skipDisabled, '不可 seek 时标记入口应禁用并说明');
    const blockedTime = await blocked.locator('#media').evaluate(element => element.currentTime);
    await popup.click('Set mark');
    await blocked.waitForTimeout(400);
    const blockedAfter = await blocked.locator('#media').evaluate(element => element.currentTime);
    if (blockedAfter !== blockedTime) throw new Error(`不可 seek 时设标记改了进度：${blockedAfter}`);
    const stillBlocked = await popup.evaluate(progressMarkView);
    if (!stillBlocked.setDisabled || stillBlocked.hasMark || stillBlocked.alert) throw new Error(`不可 seek 时误设了标记：${JSON.stringify(stillBlocked)}`);
    await popup.screenshot(path.join(dir, 'unseekable-popup.png'));
    note(`unseekable status=${blockedView.status}`);
    await popup.close();
    popup = null;

    const after = await dumpStorage();
    // New tabs register content-script frames in session storage. That map is routing, not the mark.
    const withoutFrames = raw => {
      const parsed = JSON.parse(raw);
      const session = parsed.session && typeof parsed.session === 'object' ? { ...parsed.session } : parsed.session;
      if (session && typeof session === 'object') delete session['ottertap-frames-v1'];
      return JSON.stringify({ local: parsed.local, session });
    };
    if (withoutFrames(after) !== withoutFrames(storage)) throw new Error(`扩展存储被进度标记改写：before=${storage} after=${after}`);
    if (storage.includes('"mark"') || after.includes('"mark"')) throw new Error('扩展存储里出现了 mark');

    const state = { ok: true, markedRatio: marked.ratio, away: awayTime, framed, jumped, feed: feedStart.heading, storageSame: true };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await popup?.close().catch(() => {});
    await blocked?.close().catch(() => {});
    await feed?.close().catch(() => {});
    await fresh?.close().catch(() => {});
    await page.close().catch(() => {});
  }
}

const otherTabsView = `(() => {
  const button = document.querySelector('button[aria-label="Mute others"]');
  const empty = [...document.querySelectorAll('p')].some(node => (node.textContent || '').trim() === 'No other tabs are playing audio.');
  const rows = [...document.querySelectorAll('[role="listitem"]')].flatMap(node => {
    const opener = [...node.querySelectorAll('button')].find(item => (item.getAttribute('aria-label') || '').startsWith('Switch to '));
    if (!opener) return [];
    const mute = node.querySelector('button[aria-pressed]');
    return [{
      title: (node.querySelector('span')?.textContent || '').trim(),
      pressed: mute?.getAttribute('aria-pressed') || '',
      muteLabel: mute?.getAttribute('aria-label') || '',
    }];
  });
  return {
    heading: document.querySelector('h1')?.textContent?.trim() || '',
    empty,
    button: Boolean(button),
    disabled: Boolean(button?.disabled),
    alert: document.querySelector('[role="alert"]')?.textContent?.trim() || '',
    rows,
  };
})()`;

async function driveMuteOtherTabs(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const level = page => page.locator('#media').evaluate(element => ({ volume: element.volume, muted: element.muted, paused: element.paused, rate: element.playbackRate }));
  const tabs = () => worker.evaluate(async () => (await chrome.tabs.query({})).flatMap(tab => {
    if (typeof tab.url !== 'string' || !tab.url.startsWith('https://media.ottertap.test/tone-')) return [];
    return [{ id: tab.id, url: tab.url, title: tab.title ?? '', audible: tab.audible === true, muted: tab.mutedInfo?.muted === true }];
  }));
  const byPath = (listed, path) => listed.find(tab => tab.url.endsWith(path));
  const stored = () => worker.evaluate(async () => JSON.stringify(await chrome.storage.local.get(null)));
  const play = async (page, volume) => {
    await page.bringToFront();
    await page.locator('body').click({ position: { x: 8, y: 8 } });
    await page.locator('#media').evaluate(async (element, level) => {
      element.volume = level;
      element.muted = true;
      await element.play();
      element.muted = false;
      element.volume = level;
      if (element.paused) await element.play();
    }, volume);
    await poll(() => level(page), value => value.paused === false && value.muted === false && Math.abs(value.volume - volume) < 0.02, `应开始播放且音量约为 ${volume}`);
  };
  const showList = async popup => {
    await popup.evaluate(`(() => {
      const button = document.querySelector('button[aria-label="Mute others"]');
      const empty = [...document.querySelectorAll('p')].find(node => (node.textContent || '').includes('No other tabs are playing audio.'));
      (button || empty)?.scrollIntoView({ block: 'center' });
      return true;
    })()`);
  };
  let popup = null;
  let music = null;
  let meeting = null;
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/tone-current`, { waitUntil: 'domcontentloaded' });
    await play(page, 0.4);
    const currentBefore = await level(page);
    popup = await openActionPopup(context, page);
    const empty = await poll(() => popup.evaluate(otherTabsView), value => value.heading === 'Current show' && value.empty && !value.button && !value.alert && value.rows.length === 0, '没有其他发声标签时不应出现静音其他');
    await showList(popup);
    await popup.screenshot(path.join(dir, 'popup-empty.png'));
    note(`empty heading=${empty.heading}`);
    await popup.close();
    popup = null;

    music = await context.newPage();
    await music.goto(`${origin}/tone-music`, { waitUntil: 'domcontentloaded' });
    await play(music, 0.7);
    meeting = await context.newPage();
    await meeting.goto(`${origin}/tone-meeting`, { waitUntil: 'domcontentloaded' });
    await play(meeting, 0.55);
    const heard = await poll(tabs, listed => {
      const musicTab = byPath(listed, '/tone-music');
      const meetingTab = byPath(listed, '/tone-meeting');
      return Boolean(musicTab?.audible && !musicTab.muted && meetingTab?.audible && !meetingTab.muted);
    }, '另外两个标签应在出声且未静音', 12_000);
    note(`audible ${heard.map(tab => `${tab.title}:${tab.audible}`).join(',')}`);

    await page.bringToFront();
    popup = await openActionPopup(context, page);
    const ready = await poll(() => popup.evaluate(otherTabsView), value => {
      const titles = value.rows.map(row => row.title).sort();
      return value.heading === 'Current show' && value.button && !value.disabled && !value.alert && titles.join(',') === 'Meeting tab,Music tab' && value.rows.every(row => row.pressed === 'false' && row.muteLabel === 'Mute');
    }, '列表应有两个未静音标签，并且可以静音其他');
    await showList(popup);
    await popup.screenshot(path.join(dir, 'popup-ready.png'));
    note(`ready ${ready.rows.map(row => row.title).join(',')}`);
    let storage = await stored();
    await page.waitForTimeout(300);
    const settled = await stored();
    if (settled !== storage) storage = settled;
    const musicBefore = await level(music);
    const meetingBefore = await level(meeting);
    const currentAtClick = await level(page);

    await popup.click('Mute others');
    const mutedTabs = await poll(tabs, listed => {
      const musicTab = byPath(listed, '/tone-music');
      const meetingTab = byPath(listed, '/tone-meeting');
      const currentTab = byPath(listed, '/tone-current');
      return Boolean(musicTab?.muted && meetingTab?.muted && currentTab && !currentTab.muted);
    }, '其他标签应被浏览器静音，当前标签保持有声');
    const mutedView = await poll(() => popup.evaluate(otherTabsView), value => !value.alert && value.rows.length === 2 && value.rows.every(row => row.pressed === 'true' && row.muteLabel === 'Unmute'), '列表喇叭应与浏览器静音一致');
    const currentAfter = await level(page);
    const musicAfter = await level(music);
    const meetingAfter = await level(meeting);
    if (Math.abs(currentAfter.volume - currentAtClick.volume) > 0.02 || currentAfter.muted || currentAfter.paused || Math.abs(currentAfter.rate - currentAtClick.rate) > 0.001) {
      throw new Error(`当前页声音变了：${JSON.stringify({ currentAtClick, currentAfter })}`);
    }
    if (Math.abs(musicAfter.volume - musicBefore.volume) > 0.02 || musicAfter.muted !== musicBefore.muted || Math.abs(meetingAfter.volume - meetingBefore.volume) > 0.02 || meetingAfter.muted !== meetingBefore.muted) {
      throw new Error(`其他页的音量滑块变了：${JSON.stringify({ musicBefore, musicAfter, meetingBefore, meetingAfter })}`);
    }
    const storageAfter = await stored();
    if (storageAfter !== storage) throw new Error(`静音其他写了扩展存储：before=${storage} after=${storageAfter}`);
    await showList(popup);
    await popup.screenshot(path.join(dir, 'popup-muted.png'));
    note(`muted ${mutedTabs.filter(tab => tab.muted).map(tab => tab.title).join(',')} view=${mutedView.rows.map(row => row.muteLabel).join(',')}`);

    const restored = await popup.evaluate(`(() => {
      const row = [...document.querySelectorAll('[role="listitem"]')].find(node => (node.textContent || '').includes('Music tab'));
      const button = row?.querySelector('button[aria-label="Unmute"]');
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (!restored) throw new Error('音乐那一行没有取消静音按钮');
    await poll(tabs, listed => {
      const musicTab = byPath(listed, '/tone-music');
      const meetingTab = byPath(listed, '/tone-meeting');
      const currentTab = byPath(listed, '/tone-current');
      return Boolean(musicTab && !musicTab.muted && meetingTab?.muted && currentTab && !currentTab.muted);
    }, '逐条取消静音应只恢复音乐标签');
    const currentStill = await level(page);
    if (Math.abs(currentStill.volume - currentAfter.volume) > 0.02 || currentStill.muted) throw new Error('逐条取消静音改了当前页音量');
    note('row unmute kept the meeting muted');

    await music.close();
    music = null;
    await meeting.close();
    meeting = null;
    const cleared = await poll(() => popup.evaluate(otherTabsView), value => value.empty && !value.button && value.rows.length === 0 && !value.alert, '其他标签关掉后按钮应消失');
    await showList(popup);
    await popup.screenshot(path.join(dir, 'popup-empty-again.png'));
    note(`cleared empty=${cleared.empty}`);

    const state = {
      ok: true,
      emptyHidden: true,
      currentVolume: currentAfter.volume,
      currentMuted: false,
      othersMuted: true,
      musicVolume: musicAfter.volume,
      meetingVolume: meetingAfter.volume,
      rowUnmuted: true,
      storageSame: true,
    };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await popup?.close().catch(() => {});
    await meeting?.close().catch(() => {});
    await music?.close().catch(() => {});
    await page.close().catch(() => {});
  }
}

async function driveMirrorMarkCommands(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const prefsText = async () => JSON.stringify((await stored()).sitePrefs ?? {});
  const near = (expected, slack = 0.35) => value => Math.abs(value - expected) < slack;
  const flipped = value => value.mirrored && (value.scale === '-1 1' || value.computedScale === '-1 1');
  const plain = value => !value.mirrored && value.scale !== '-1 1' && value.computedScale !== '-1 1';
  const registered = await worker.evaluate(async () => {
    const manifest = chrome.runtime.getManifest();
    const listed = await chrome.commands.getAll();
    const commands = manifest.commands ?? {};
    const suggested = Object.entries(commands).filter(([, command]) => command.suggested_key).map(([name]) => name);
    return {
      permissions: manifest.permissions ?? [],
      names: Object.keys(commands),
      suggested,
      listed: listed.map(item => ({ name: item.name ?? '', shortcut: item.shortcut ?? '', description: item.description ?? '' })),
      commands: {
        mirror: commands.mirror ?? null,
        'mark-set': commands['mark-set'] ?? null,
        'mark-jump': commands['mark-jump'] ?? null,
      },
    };
  });
  if (JSON.stringify(registered.permissions) !== JSON.stringify(['storage'])) throw new Error(`权限应仍只有 storage：${JSON.stringify(registered.permissions)}`);
  if (registered.suggested.length !== 4 || !['play-pause', 'skip-back', 'skip-forward', 'mute'].every(name => registered.suggested.includes(name))) {
    throw new Error(`建议键应仍是原来四个：${JSON.stringify(registered.suggested)}`);
  }
  const expectedCommands = [
    ['mirror', 'Mirror or restore the video'],
    ['mark-set', 'Set a progress mark'],
    ['mark-jump', 'Jump to the progress mark'],
  ];
  for (const [name, description] of expectedCommands) {
    const manifestCommand = registered.commands[name];
    const listed = registered.listed.find(item => item.name === name);
    if (!manifestCommand || manifestCommand.suggested_key) throw new Error(`${name} 不应占用建议键：${JSON.stringify(manifestCommand)}`);
    if (!listed || listed.shortcut !== '' || listed.description !== description) throw new Error(`${name} 未按未绑定登记：${JSON.stringify(listed)}`);
  }
  if (registered.names.includes('mark-clear') || registered.listed.some(item => /clear mark/i.test(item.description))) throw new Error('清除标记不应有扩展命令');
  note(`commands unbound suggested=${registered.suggested.join(',')}`);

  const keyButton = (page, action) => page.getByRole('button', { name: new RegExp(`^Change the key for ${action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\. Now `) });
  const recording = page => page.getByRole('button', { name: 'Press a key', exact: true });
  let settings;
  let fixture;
  let audio;
  const focusFixture = async () => {
    await fixture.bringToFront();
    await fixture.mouse.click(12, 12);
  };
  try {
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
    const section = settings.locator('#shortcuts');
    await section.getByRole('heading', { name: 'Keyboard shortcuts' }).waitFor({ state: 'visible', timeout: 15_000 });
    await section.getByRole('button', { name: 'Edit shortcuts' }).waitFor({ state: 'visible' });
    for (const label of ['Mirror or restore the video', 'Set a progress mark', 'Jump to the progress mark']) {
      const node = section.getByText(label, { exact: true });
      if (await node.count() !== 1) throw new Error(`${label} 应只出现在扩展快捷键里`);
      const row = node.locator('xpath=ancestor::div[contains(@class,"py-3")][1]');
      const shortcut = (await row.locator('dt').innerText()).trim();
      if (shortcut !== 'Not set') throw new Error(`${label} 应显示 Not set：${shortcut}`);
    }
    for (const action of ['Mirror horizontally', 'Set mark', 'Jump to mark']) {
      const button = keyButton(settings, action);
      await button.waitFor({ state: 'visible' });
      const text = (await button.innerText()).trim();
      if (text !== 'Not set') throw new Error(`${action} 默认应是 Not set：${text}`);
    }
    if (await section.getByText('Clear mark', { exact: true }).count()) throw new Error('清除标记不应出现在快捷键设置里');
    const reset = () => settings.getByRole('button', { name: 'Restore default keys', exact: true });
    if (!await reset().isDisabled()) throw new Error('默认键位时「Restore default keys」应禁用');
    const singleKey = settings.getByRole('switch', { name: 'Single-key mode' });
    if (await singleKey.getAttribute('aria-checked') !== 'false') throw new Error('单键模式应保持关闭');
    await section.screenshot({ path: path.join(dir, 'settings-unbound.png'), animations: 'disabled' });
    note('settings lists mirror, set mark, and jump to mark as Not set');

    await keyButton(settings, 'Mirror horizontally').click();
    await recording(settings).waitFor({ state: 'visible' });
    await settings.keyboard.press('Comma');
    const conflict = (await settings.locator('#keybind-error').innerText()).trim();
    const conflictCopy = ', is already used for “Pause, then previous frame”. Press another key, or change that one first.';
    if (conflict !== conflictCopy) throw new Error(`撞键提示不对：${conflict}`);
    if ((await stored()).keybinds?.mirror) throw new Error('撞键时不应保存镜像键');
    if (!await recording(settings).isVisible()) throw new Error('撞键后应继续等待新键');
    await section.screenshot({ path: path.join(dir, 'settings-conflict.png'), animations: 'disabled' });
    note(`conflict tip: ${conflict}`);
    await settings.keyboard.press('KeyH');
    await poll(stored, value => value.keybinds?.mirror === 'h' && value.singleKey !== true, '应保存 Mirror horizontally = h，且单键模式仍关');
    await keyButton(settings, 'Set mark').click();
    await settings.keyboard.press('KeyB');
    await poll(stored, value => value.keybinds?.markSet === 'b', '应保存 Set mark = b');
    await keyButton(settings, 'Jump to mark').click();
    await settings.keyboard.press('KeyH');
    const taken = (await settings.locator('#keybind-error').innerText()).trim();
    const takenCopy = 'H is already used for “Mirror horizontally”. Press another key, or change that one first.';
    if (taken !== takenCopy) throw new Error(`空键不应占位，H 的占用提示不对：${taken}`);
    if ((await stored()).keybinds?.markJump) throw new Error('跳到标记不应保存成已被镜像占用的 H');
    await settings.keyboard.press('KeyN');
    const bound = await poll(stored, value => value.keybinds?.markJump === 'n' && value.keybinds?.mirror === 'h' && value.keybinds?.markSet === 'b' && value.singleKey !== true, '应保存 Jump to mark = n');
    if (await settings.locator('#keybind-error').count()) throw new Error('改键成功后不应留着冲突提示');
    if (await reset().isDisabled()) throw new Error('改过键之后应能恢复默认');
    await section.screenshot({ path: path.join(dir, 'settings-bound.png'), animations: 'disabled' });
    note(`bound ${JSON.stringify(bound.keybinds)}`);
    if ((await prefsText()) !== '{}') throw new Error(`改键写入了 sitePrefs：${await prefsText()}`);

    fixture = await context.newPage();
    await fixture.goto(`${origin}/long`, { waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await fixture.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
      element.pause();
      element.currentTime = 12;
    });
    const time = () => fixture.locator('#media').evaluate(element => element.currentTime);
    const paused = () => fixture.locator('#media').evaluate(element => element.paused);
    await poll(time, near(12), '长视频应停在 12 秒');
    await focusFixture();
    const pausedBefore = await paused();
    await fixture.keyboard.press('KeyK');
    await fixture.waitForTimeout(400);
    if (await paused() !== pausedBefore) throw new Error('单键模式关闭时 K 不应播放或暂停');
    if (!plain(await pictureOf(fixture, '#media'))) throw new Error('按镜像键之前画面应未翻转');
    await fixture.keyboard.press('KeyH');
    const mirrored = await poll(() => pictureOf(fixture, '#media'), flipped, 'H 应水平翻转当前视频');
    await fixture.screenshot({ path: path.join(dir, 'fixture-mirrored.png'), animations: 'disabled' });
    await fixture.keyboard.press('KeyH');
    await poll(() => pictureOf(fixture, '#media'), plain, '再按 H 应恢复画面');
    note(`mirror toggled scale=${mirrored.scale}`);
    await focusFixture();
    await fixture.keyboard.press('KeyB');
    await fixture.waitForTimeout(300);
    const markedAt = await time();
    if (!near(12)(markedAt)) throw new Error(`设标记时进度应仍在 12 秒附近：${markedAt}`);
    await fixture.locator('#media').evaluate(element => { element.currentTime = 40; });
    await poll(time, near(40), '应先离开标记');
    await focusFixture();
    await fixture.keyboard.press('KeyN');
    const jumped = await poll(time, near(markedAt), 'N 应跳回设下的时间');
    await fixture.screenshot({ path: path.join(dir, 'fixture-jumped.png'), animations: 'disabled' });
    note(`jumped to ${jumped} from mark ${markedAt}`);
    await fixture.locator('#media').evaluate(element => { element.currentTime = 40; });
    await poll(time, near(40), '应再次离开标记');
    await fixture.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('aria-label', 'Fixture note');
      input.style.position = 'fixed';
      input.style.left = '720px';
      input.style.top = '420px';
      document.body.append(input);
    });
    const field = fixture.getByRole('textbox', { name: 'Fixture note' });
    await field.focus();
    await fixture.keyboard.type('hello');
    if ((await field.inputValue()) !== 'hello') throw new Error('文本框应能输入');
    await fixture.keyboard.press('KeyH');
    await fixture.keyboard.press('KeyB');
    await fixture.keyboard.press('KeyN');
    await fixture.waitForTimeout(400);
    const whileTyping = await pictureOf(fixture, '#media');
    const typedAt = await time();
    if (!plain(whileTyping) || !near(40)(typedAt)) throw new Error(`输入框聚焦时不应翻转或跳转：${JSON.stringify({ ...whileTyping, currentTime: typedAt })}`);
    await fixture.screenshot({ path: path.join(dir, 'fixture-typing.png'), animations: 'disabled' });
    note('typing ignores mirror, set mark, and jump');
    await field.evaluate(element => element.blur());
    await focusFixture();
    await fixture.keyboard.press('KeyN');
    const stillMarked = await poll(time, near(markedAt), '输入时按过设标记，跳回应仍回到原来的时间');
    note(`mark survived typing, jump landed at ${stillMarked}`);
    if ((await prefsText()) !== '{}') throw new Error(`页内操作写入了 sitePrefs：${await prefsText()}`);

    audio = await context.newPage();
    await audio.goto(`${origin}/audio`, { waitUntil: 'domcontentloaded' });
    await audio.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await audio.bringToFront();
    await audio.mouse.click(12, 12);
    await audio.keyboard.press('KeyH');
    await audio.waitForTimeout(400);
    const audioPicture = await pictureOf(audio, '#media');
    if (audioPicture.mirrored) throw new Error(`音频不应被镜像：${JSON.stringify(audioPicture)}`);
    await audio.screenshot({ path: path.join(dir, 'audio-plain.png'), animations: 'disabled' });
    note('audio ignores the mirror key');
    if ((await prefsText()) !== '{}') throw new Error(`音频上的镜像键写入了 sitePrefs：${await prefsText()}`);

    await settings.bringToFront();
    await reset().click();
    const restored = await poll(stored, value => value.keybinds?.mirror === '' && value.keybinds?.markSet === '' && value.keybinds?.markJump === '' && value.keybinds?.toggle === 'k', '恢复默认后镜像和标记应回到未绑定');
    await keyButton(settings, 'Mirror horizontally').filter({ hasText: 'Not set' }).waitFor({ state: 'visible' });
    if (!await reset().isDisabled()) throw new Error('恢复默认后按钮应禁用');
    await section.screenshot({ path: path.join(dir, 'settings-restored.png'), animations: 'disabled' });
    await focusFixture();
    await fixture.keyboard.press('KeyH');
    await fixture.waitForTimeout(400);
    if (!plain(await pictureOf(fixture, '#media'))) throw new Error('恢复默认后 H 不应再翻转');
    note(`restored ${JSON.stringify({ mirror: restored.keybinds.mirror, markSet: restored.keybinds.markSet, markJump: restored.keybinds.markJump })}`);

    const state = {
      ok: true,
      suggested: registered.suggested,
      commands: expectedCommands.map(([name, description]) => ({ name, description, shortcut: '' })),
      conflict,
      taken,
      bound: { mirror: bound.keybinds.mirror, markSet: bound.keybinds.markSet, markJump: bound.keybinds.markJump },
      markedAt,
      jumped,
      typedAt,
      stillMarked,
      audioMirrored: audioPicture.mirrored,
      sitePrefs: {},
      restored: { mirror: restored.keybinds.mirror, markSet: restored.keybinds.markSet, markJump: restored.keybinds.markJump },
    };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await audio?.close().catch(() => {});
    await fixture?.close().catch(() => {});
    await settings?.close().catch(() => {});
  }
}

async function drivePrevNextMedia(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const prefsText = async () => JSON.stringify((await stored()).sitePrefs ?? {});
  const registered = await worker.evaluate(async () => {
    const manifest = chrome.runtime.getManifest();
    const listed = await chrome.commands.getAll();
    const commands = manifest.commands ?? {};
    const suggested = Object.entries(commands).filter(([, command]) => command.suggested_key).map(([name]) => name);
    return {
      permissions: manifest.permissions ?? [],
      suggested,
      listed: listed.map(item => ({ name: item.name ?? '', shortcut: item.shortcut ?? '', description: item.description ?? '' })),
      commands: {
        'media-prev': commands['media-prev'] ?? null,
        'media-next': commands['media-next'] ?? null,
      },
    };
  });
  if (JSON.stringify(registered.permissions) !== JSON.stringify(['storage'])) throw new Error(`权限应仍只有 storage：${JSON.stringify(registered.permissions)}`);
  if (registered.suggested.length !== 4 || !['play-pause', 'skip-back', 'skip-forward', 'mute'].every(name => registered.suggested.includes(name))) {
    throw new Error(`建议键应仍是原来四个：${JSON.stringify(registered.suggested)}`);
  }
  const expectedCommands = [
    ['media-prev', 'Select the previous media'],
    ['media-next', 'Select the next media'],
  ];
  for (const [name, description] of expectedCommands) {
    const manifestCommand = registered.commands[name];
    const listed = registered.listed.find(item => item.name === name);
    if (!manifestCommand || manifestCommand.suggested_key) throw new Error(`${name} 不应占用建议键：${JSON.stringify(manifestCommand)}`);
    if (!listed || listed.shortcut !== '' || listed.description !== description) throw new Error(`${name} 未按未绑定登记：${JSON.stringify(listed)}`);
  }
  note(`commands unbound suggested=${registered.suggested.join(',')}`);

  const keyButton = (page, action) => page.getByRole('button', { name: new RegExp(`^Change the key for ${action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\. Now `) });
  const recording = page => page.getByRole('button', { name: 'Press a key', exact: true });
  const rings = page => page.evaluate(() => ({
    preview: document.querySelector('#preview')?.classList.contains('ottertap-selection-ring') === true,
    media: document.querySelector('#media')?.classList.contains('ottertap-selection-ring') === true,
    ghost: document.querySelector('#ghost')?.classList.contains('ottertap-selection-ring') === true,
  }));
  const hints = page => page.evaluate(() => {
    const root = document.querySelector('ottertap-controller')?.shadowRoot;
    return [...(root?.querySelectorAll('[role="status"]') ?? [])].map(node => (node.textContent || '').trim());
  });
  const menuLabels = async popup => {
    const labels = await popup.evaluate(`(() => {
      const trigger = document.getElementById('popup-media');
      if (!trigger) return null;
      if (trigger.getAttribute('aria-expanded') !== 'true') trigger.click();
      return [...document.querySelectorAll('[role="menuitemradio"]')].map(node => (node.textContent || '').replace(/\\s+/g, ' ').trim());
    })()`);
    await popup.evaluate(`(() => {
      const trigger = document.getElementById('popup-media');
      if (trigger && trigger.getAttribute('aria-expanded') === 'true') trigger.click();
    })()`);
    return labels ?? [];
  };
  let settings;
  let fixture;
  let alone;
  let popup = null;
  const focusFixture = async () => {
    await fixture.bringToFront();
    await fixture.mouse.click(12, 12);
  };
  try {
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
    const section = settings.locator('#shortcuts');
    await section.getByRole('heading', { name: 'Keyboard shortcuts' }).waitFor({ state: 'visible', timeout: 15_000 });
    await section.getByRole('button', { name: 'Edit shortcuts' }).waitFor({ state: 'visible' });
    for (const label of ['Select the previous media', 'Select the next media']) {
      const node = section.getByText(label, { exact: true });
      if (await node.count() !== 1) throw new Error(`${label} 应只出现在扩展快捷键里`);
      const row = node.locator('xpath=ancestor::div[contains(@class,"py-3")][1]');
      const shortcut = (await row.locator('dt').innerText()).trim();
      if (shortcut !== 'Not set') throw new Error(`${label} 应显示 Not set：${shortcut}`);
    }
    for (const action of ['Previous media', 'Next media']) {
      const button = keyButton(settings, action);
      await button.waitFor({ state: 'visible' });
      const text = (await button.innerText()).trim();
      if (text !== 'Not set') throw new Error(`${action} 默认应是 Not set：${text}`);
    }
    const reset = () => settings.getByRole('button', { name: 'Restore default keys', exact: true });
    if (!await reset().isDisabled()) throw new Error('默认键位时「Restore default keys」应禁用');
    const singleKey = settings.getByRole('switch', { name: 'Single-key mode' });
    if (await singleKey.getAttribute('aria-checked') !== 'false') throw new Error('单键模式应保持关闭');
    await section.screenshot({ path: path.join(dir, 'settings-unbound.png'), animations: 'disabled' });
    note('settings lists previous and next media as Not set');

    await keyButton(settings, 'Next media').click();
    await recording(settings).waitFor({ state: 'visible' });
    await settings.keyboard.press('Comma');
    const conflict = (await settings.locator('#keybind-error').innerText()).trim();
    const conflictCopy = ', is already used for “Pause, then previous frame”. Press another key, or change that one first.';
    if (conflict !== conflictCopy) throw new Error(`撞键提示不对：${conflict}`);
    if ((await stored()).keybinds?.mediaNext) throw new Error('撞键时不应保存下一条');
    if (!await recording(settings).isVisible()) throw new Error('撞键后应继续等待新键');
    await section.screenshot({ path: path.join(dir, 'settings-conflict.png'), animations: 'disabled' });
    note(`conflict tip: ${conflict}`);
    await settings.keyboard.press('BracketRight');
    await poll(stored, value => value.keybinds?.mediaNext === ']' && value.singleKey !== true, '应保存 Next media = ]，且单键模式仍关');
    await keyButton(settings, 'Previous media').click();
    await settings.keyboard.press('BracketLeft');
    await poll(stored, value => value.keybinds?.mediaPrev === '[', '应保存 Previous media = [');
    await keyButton(settings, 'Next media').click();
    await settings.keyboard.press('BracketLeft');
    const taken = (await settings.locator('#keybind-error').innerText()).trim();
    const takenCopy = '[ is already used for “Previous media”. Press another key, or change that one first.';
    if (taken !== takenCopy) throw new Error(`空键不应占位，[ 的占用提示不对：${taken}`);
    if ((await stored()).keybinds?.mediaNext !== ']') throw new Error('下一条不应保存成已被上一条占用的 [');
    await settings.keyboard.press('BracketRight');
    const bound = await poll(stored, value => value.keybinds?.mediaPrev === '[' && value.keybinds?.mediaNext === ']' && value.singleKey !== true, '下一条应仍是 ]');
    if (await settings.locator('#keybind-error').count()) throw new Error('改键成功后不应留着冲突提示');
    if (await reset().isDisabled()) throw new Error('改过键之后应能恢复默认');
    await section.screenshot({ path: path.join(dir, 'settings-bound.png'), animations: 'disabled' });
    note(`bound ${JSON.stringify({ mediaPrev: bound.keybinds.mediaPrev, mediaNext: bound.keybinds.mediaNext })}`);
    if ((await prefsText()) !== '{}') throw new Error(`改键写入了 sitePrefs：${await prefsText()}`);

    fixture = await context.newPage();
    await fixture.goto(`${origin}/feed`, { waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await fixture.locator('#preview, #media').evaluateAll(async nodes => {
      for (const element of nodes) {
        if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
        element.pause();
      }
    });
    await fixture.bringToFront();
    popup = await openActionPopup(context, fixture);
    const initial = await poll(() => popup.view(), value => value.heading === 'Feed preview', '暂停的信息流应先选中页面顺序的第一条');
    await popup.close();
    popup = null;
    await fixture.evaluate(() => {
      const ghost = document.createElement('video');
      ghost.id = 'ghost';
      ghost.setAttribute('aria-label', 'Ghost video');
      ghost.preload = 'none';
      document.querySelector('#media').before(ghost);
      const detached = document.createElement('video');
      detached.id = 'detached';
      detached.setAttribute('aria-label', 'Detached video');
      window.__detached = detached;
    });
    popup = await openActionPopup(context, fixture);
    const withGhost = await poll(() => menuLabels(popup), value => value.some(label => label.includes('Ghost video')) && value.some(label => label.includes('Feed preview')) && value.some(label => label.includes('Main player')), '卸下之前，列表里应能看见刚插入的视频');
    if (withGhost.some(label => label.includes('Detached video'))) throw new Error(`从未插入的视频进了列表：${JSON.stringify(withGhost)}`);
    await fixture.evaluate(() => document.querySelector('#ghost')?.remove());
    const withoutGhost = await poll(() => menuLabels(popup), value => value.length === 2 && value.every(label => !label.includes('Ghost video') && !label.includes('Detached video')), '卸下之后，列表只剩原来的两条');
    note(`menu after removal ${JSON.stringify(withoutGhost)}`);
    await popup.close();
    popup = null;
    await focusFixture();
    await fixture.keyboard.press('BracketRight');
    const nextRing = await poll(() => rings(fixture), value => value.media === true && value.preview === false && value.ghost === false, '] 应只标出主视频');
    await fixture.screenshot({ path: path.join(dir, 'fixture-next.png'), animations: 'disabled' });
    popup = await openActionPopup(context, fixture);
    const nextHeading = await poll(() => popup.view(), value => value.heading === 'Main player', '下一条应是主视频，而不是已卸下的节点');
    await popup.close();
    popup = null;
    note(`next ${nextHeading.heading} ring=${JSON.stringify(nextRing)}`);
    await focusFixture();
    await fixture.keyboard.press('BracketRight');
    await poll(() => rings(fixture), value => value.preview === true && value.media === false, '再按 ] 应回到第一条');
    await fixture.screenshot({ path: path.join(dir, 'fixture-wrap.png'), animations: 'disabled' });
    popup = await openActionPopup(context, fixture);
    const wrapped = await poll(() => popup.view(), value => value.heading === 'Feed preview', '循环应回到 Feed preview');
    await popup.close();
    popup = null;
    await focusFixture();
    await fixture.keyboard.press('BracketLeft');
    await poll(() => rings(fixture), value => value.media === true && value.preview === false, '[ 应从第一条回到最后一条');
    await fixture.screenshot({ path: path.join(dir, 'fixture-prev.png'), animations: 'disabled' });
    popup = await openActionPopup(context, fixture);
    const previous = await poll(() => popup.view(), value => value.heading === 'Main player', '上一条应回到主视频');
    await popup.close();
    popup = null;
    note(`wrapped ${wrapped.heading} previous ${previous.heading}`);

    await fixture.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('aria-label', 'Fixture note');
      input.style.position = 'fixed';
      input.style.left = '720px';
      input.style.top = '420px';
      document.body.append(input);
    });
    const field = fixture.getByRole('textbox', { name: 'Fixture note' });
    await field.focus();
    await fixture.keyboard.type('hello');
    if ((await field.inputValue()) !== 'hello') throw new Error('文本框应能输入');
    await fixture.keyboard.press('BracketRight');
    await fixture.keyboard.press('BracketLeft');
    await fixture.waitForTimeout(400);
    popup = await openActionPopup(context, fixture);
    const whileTyping = await popup.view();
    if (whileTyping.heading !== 'Main player') throw new Error(`输入框聚焦时选中变了：${whileTyping.heading}`);
    await popup.close();
    popup = null;
    await fixture.screenshot({ path: path.join(dir, 'fixture-typing.png'), animations: 'disabled' });
    note('typing ignores previous and next');
    if ((await prefsText()) !== '{}') throw new Error(`页内操作写入了 sitePrefs：${await prefsText()}`);

    alone = await context.newPage();
    await alone.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await alone.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await alone.bringToFront();
    await alone.mouse.click(12, 12);
    await alone.keyboard.press('BracketRight');
    const onlyHint = await poll(() => hints(alone), value => value.includes('This page only has one media.'), '只有一条媒体时应出现短说明');
    await alone.screenshot({ path: path.join(dir, 'fixture-only.png'), animations: 'disabled' });
    popup = await openActionPopup(context, alone);
    const onlyHeading = await poll(() => popup.view(), value => value.heading === 'Fixture video', '只有一条时标题应仍是这条视频');
    await popup.close();
    popup = null;
    note(`only ${onlyHeading.heading} hints=${JSON.stringify(onlyHint)}`);

    await settings.bringToFront();
    await reset().click();
    const restored = await poll(stored, value => value.keybinds?.mediaPrev === '' && value.keybinds?.mediaNext === '' && value.keybinds?.toggle === 'k', '恢复默认后上一条和下一条应回到未绑定');
    await keyButton(settings, 'Next media').filter({ hasText: 'Not set' }).waitFor({ state: 'visible' });
    if (!await reset().isDisabled()) throw new Error('恢复默认后按钮应禁用');
    await section.screenshot({ path: path.join(dir, 'settings-restored.png'), animations: 'disabled' });
    await focusFixture();
    await fixture.keyboard.press('BracketRight');
    await fixture.waitForTimeout(400);
    popup = await openActionPopup(context, fixture);
    const stayed = await popup.view();
    if (stayed.heading !== 'Main player') throw new Error(`恢复默认后 ] 不应再切换：${stayed.heading}`);
    await popup.close();
    popup = null;
    if ((await prefsText()) !== '{}') throw new Error(`结束时写入了 sitePrefs：${await prefsText()}`);
    note(`restored prev=${restored.keybinds.mediaPrev} next=${restored.keybinds.mediaNext}`);

    const state = {
      ok: true,
      suggested: registered.suggested,
      commands: expectedCommands.map(([name, description]) => ({ name, description, shortcut: '' })),
      conflict,
      taken,
      bound: { mediaPrev: bound.keybinds.mediaPrev, mediaNext: bound.keybinds.mediaNext },
      initial: initial.heading,
      next: nextHeading.heading,
      wrapped: wrapped.heading,
      previous: previous.heading,
      whileTyping: whileTyping.heading,
      only: onlyHeading.heading,
      sitePrefs: {},
      restored: { mediaPrev: restored.keybinds.mediaPrev, mediaNext: restored.keybinds.mediaNext },
    };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await popup?.close().catch(() => {});
    await alone?.close().catch(() => {});
    await fixture?.close().catch(() => {});
    await settings?.close().catch(() => {});
  }
}

async function driveMirrorMarkFeedback(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const prefsText = async () => JSON.stringify((await stored()).sitePrefs ?? {});
  const near = (expected, slack = 0.35) => value => Math.abs(value - expected) < slack;
  const flipped = value => value.mirrored && (value.scale === '-1 1' || value.computedScale === '-1 1');
  const plain = value => !value.mirrored && value.scale !== '-1 1' && value.computedScale !== '-1 1';
  const keyButton = (page, action) => page.getByRole('button', { name: new RegExp(`^Change the key for ${action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\. Now `) });
  const successCopy = ['Mirror on', 'Mirror off', 'Marked', 'Back to mark'];
  const markUnavailable = "Live streams and media that can't be seeked can't keep a mark.";
  const mirrorUnavailable = "Audio has no picture, so it cannot be mirrored.";
  const markMissing = 'This media has no mark.';
  let settings;
  let fixture;
  let popup = null;
  const focusFixture = async () => {
    await fixture.bringToFront();
    await fixture.mouse.click(12, 12);
  };
  const hint = text => fixture.getByText(text, { exact: true });
  const showHint = async text => {
    const node = hint(text);
    await node.waitFor({ state: 'visible', timeout: 8_000 });
    const pass = await node.evaluate(element => element.className.includes('pointer-events-none') && element.getAttribute('role') === 'status');
    if (!pass) throw new Error(`${text} 不是不挡点击的状态字样`);
    const toast = await node.boundingBox();
    const media = await fixture.locator('#media').boundingBox();
    if (!toast || !media) throw new Error(`${text} 没有位置`);
    const controlsTop = media.y + Math.max(media.height - 48, media.height * 0.75);
    const coversControls = toast.y + toast.height > controlsTop && toast.x < media.x + media.width && toast.x + toast.width > media.x;
    if (coversControls) throw new Error(`${text} 盖住了播放控件：${JSON.stringify({ toast, media })}`);
    return toast;
  };
  const hideHint = async text => {
    await hint(text).waitFor({ state: 'hidden', timeout: 3_000 });
  };
  const restoreKeys = async () => {
    if (!settings || settings.isClosed()) return;
    await settings.bringToFront();
    const reset = settings.getByRole('button', { name: 'Restore default keys', exact: true });
    if (await reset.isDisabled()) return;
    await reset.click();
    await poll(stored, value => value.keybinds?.mirror === '' && value.keybinds?.markSet === '' && value.keybinds?.markJump === '' && value.keybinds?.toggle === 'k', '应恢复默认键');
  };
  const fillWindow = async on => {
    await fixture.evaluate(enabled => {
      const video = document.querySelector('#media');
      if (!(video instanceof HTMLVideoElement)) throw new Error('没有夹具视频');
      video.style.cssText = enabled
        ? 'position:fixed;inset:0;z-index:1;width:100vw;height:100vh;background:#111'
        : 'display:block;width:640px;height:360px;margin:48px';
    }, on);
  };
  try {
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
    await settings.locator('#shortcuts').getByRole('heading', { name: 'Keyboard shortcuts' }).waitFor({ state: 'visible', timeout: 15_000 });
    const singleKey = settings.getByRole('switch', { name: 'Single-key mode' });
    if (await singleKey.getAttribute('aria-checked') !== 'false') throw new Error('单键模式应保持关闭');
    await keyButton(settings, 'Mirror horizontally').click();
    await settings.getByRole('button', { name: 'Press a key', exact: true }).waitFor({ state: 'visible' });
    await settings.keyboard.press('KeyH');
    await keyButton(settings, 'Set mark').click();
    await settings.keyboard.press('KeyB');
    await keyButton(settings, 'Jump to mark').click();
    await settings.keyboard.press('KeyN');
    await poll(stored, value => value.keybinds?.mirror === 'h' && value.keybinds?.markSet === 'b' && value.keybinds?.markJump === 'n' && value.singleKey !== true, '应绑上 H / B / N，且单键模式仍关');
    note('bound H B N');

    fixture = await context.newPage();
    await fixture.goto(`${origin}/long`, { waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await fixture.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
      element.pause();
      element.currentTime = 12;
    });
    const time = () => fixture.locator('#media').evaluate(element => element.currentTime);
    await poll(time, near(12), '长视频应停在 12 秒');
    await focusFixture();
    if (!plain(await pictureOf(fixture, '#media'))) throw new Error('按镜像键之前画面应未翻转');
    await fixture.keyboard.press('KeyH');
    await showHint('Mirror on');
    await fixture.screenshot({ path: path.join(dir, 'toast-mirror-on.png'), animations: 'disabled' });
    const mirrored = await poll(() => pictureOf(fixture, '#media'), flipped, 'H 应翻转当前视频');
    note(`mirror on scale=${mirrored.scale}`);
    await fixture.keyboard.press('KeyH');
    await showHint('Mirror off');
    await poll(() => pictureOf(fixture, '#media'), plain, '再按 H 应恢复画面');
    await fixture.screenshot({ path: path.join(dir, 'toast-mirror-off.png'), animations: 'disabled' });
    await hideHint('Mirror off');
    note('mirror hint faded');

    await focusFixture();
    await fixture.keyboard.press('KeyB');
    await showHint('Marked');
    const markedAt = await time();
    if (!near(12)(markedAt)) throw new Error(`设标记时进度应仍在 12 秒附近：${markedAt}`);
    await fixture.screenshot({ path: path.join(dir, 'toast-marked.png'), animations: 'disabled' });
    await fixture.locator('#media').evaluate(element => { element.currentTime = 40; });
    await poll(time, near(40), '应先离开标记');
    await focusFixture();
    await fixture.keyboard.press('KeyN');
    await showHint('Back to mark');
    const jumped = await poll(time, near(markedAt), 'N 应跳回设下的时间');
    await fixture.screenshot({ path: path.join(dir, 'toast-jump.png'), animations: 'disabled' });
    await hideHint('Back to mark');
    note(`jump landed at ${jumped}`);

    await fixture.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('aria-label', 'Fixture note');
      input.style.position = 'fixed';
      input.style.left = '720px';
      input.style.top = '420px';
      document.body.append(input);
    });
    const field = fixture.getByRole('textbox', { name: 'Fixture note' });
    await field.focus();
    await fixture.keyboard.press('KeyH');
    await fixture.waitForTimeout(400);
    if (!plain(await pictureOf(fixture, '#media'))) throw new Error('输入框聚焦时不应翻转');
    if (await hint('Mirror on').isVisible()) throw new Error('输入框聚焦时不应出现镜像提示');
    await field.evaluate(element => element.blur());
    note('typing shows no mirror hint');

    await focusFixture();
    await fillWindow(true);
    await fixture.keyboard.press('KeyH');
    const fullToast = await showHint('Mirror on');
    if (fullToast.y > 80) throw new Error(`铺满窗口时提示不在顶部：${fullToast.y}`);
    await poll(() => pictureOf(fixture, '#media'), flipped, '铺满窗口时 H 仍应翻转');
    await fixture.screenshot({ path: path.join(dir, 'toast-fullscreen.png'), animations: 'disabled' });
    await fixture.keyboard.press('KeyH');
    await showHint('Mirror off');
    await poll(() => pictureOf(fixture, '#media'), plain, '铺满窗口时再按 H 应恢复');
    await fillWindow(false);
    await hideHint('Mirror off');
    const documentFullscreen = await fixture.evaluate(async () => {
      const root = document.documentElement;
      if (typeof root.requestFullscreen !== 'function') return false;
      try {
        await root.requestFullscreen();
        return document.fullscreenElement === root;
      } catch {
        return false;
      }
    });
    if (documentFullscreen) {
      await focusFixture();
      await fixture.keyboard.press('KeyH');
      await showHint('Mirror on');
      await fixture.keyboard.press('KeyH');
      await showHint('Mirror off');
      await fixture.evaluate(async () => { if (document.fullscreenElement) await document.exitFullscreen(); });
      await hideHint('Mirror off');
      note('document fullscreen showed the hint');
    } else note('document fullscreen unavailable; window-filling player showed the hint');

    popup = await openActionPopup(context, fixture);
    if (!await popup.evaluate(mirrorClickExpr('Mirror horizontally'))) throw new Error('面板点不到水平镜像');
    await showHint('Mirror on');
    await poll(() => pictureOf(fixture, '#media'), flipped, '面板开关应翻转画面');
    await fixture.screenshot({ path: path.join(dir, 'toast-panel-mirror.png'), animations: 'disabled' });
    await popup.click('Set mark');
    await showHint('Marked');
    await poll(() => popup.evaluate(`(() => {
      const jump = document.querySelector('button[aria-label="Jump to mark"]');
      return !!jump && !jump.disabled;
    })()`), value => value === true, '设标记后面板应能跳到标记');
    await fixture.locator('#media').evaluate(element => { element.currentTime = 40; });
    await poll(time, near(40), '面板跳转前应离开标记');
    await popup.click('Jump to mark');
    await showHint('Back to mark');
    await poll(time, near(markedAt), '面板应跳回设下的时间');
    await hideHint('Back to mark');
    await popup.click('Clear mark');
    await fixture.waitForTimeout(700);
    for (const text of successCopy) {
      if (await hint(text).isVisible()) throw new Error(`清除标记后不该出现「${text}」`);
    }
    const afterClear = await time();
    if (!near(markedAt)(afterClear)) throw new Error(`清除标记改了进度：${afterClear}`);
    note('panel hints shown; clear stays quiet');
    await popup.close();
    popup = null;
    if ((await prefsText()) !== '{}') throw new Error(`页内操作写入了 sitePrefs：${await prefsText()}`);

    const blocked = await context.newPage();
    try {
      await blocked.goto(`${origin}/unseekable`, { waitUntil: 'domcontentloaded' });
      await blocked.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
      await blocked.bringToFront();
      await blocked.mouse.click(12, 12);
      await blocked.keyboard.press('KeyB');
      await blocked.getByText(markUnavailable, { exact: true }).waitFor({ state: 'visible', timeout: 8_000 });
      const stuck = await blocked.locator('#media').evaluate(element => element.currentTime);
      if (stuck !== 0) throw new Error(`不可 seek 时进度被改成 ${stuck}`);
      await blocked.screenshot({ path: path.join(dir, 'toast-unseekable.png'), animations: 'disabled' });
      await blocked.getByText(markUnavailable, { exact: true }).waitFor({ state: 'hidden', timeout: 3_000 });
      note('unseekable uses the existing explanation');
    } finally { await blocked.close().catch(() => {}); }

    const audio = await context.newPage();
    try {
      await audio.goto(`${origin}/audio`, { waitUntil: 'domcontentloaded' });
      await audio.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
      await audio.bringToFront();
      await audio.mouse.click(12, 12);
      await audio.keyboard.press('KeyH');
      await audio.getByText(mirrorUnavailable, { exact: true }).waitFor({ state: 'visible', timeout: 8_000 });
      if ((await pictureOf(audio, '#media')).mirrored) throw new Error('音频不应被镜像');
      await audio.screenshot({ path: path.join(dir, 'toast-audio.png'), animations: 'disabled' });
      note('audio uses the existing explanation');
    } finally { await audio.close().catch(() => {}); }

    const fresh = await context.newPage();
    try {
      await fresh.goto(`${origin}/long`, { waitUntil: 'domcontentloaded' });
      await fresh.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
      await fresh.locator('#media').evaluate(async element => {
        if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
        element.pause();
        element.currentTime = 12;
      });
      await poll(() => fresh.locator('#media').evaluate(element => element.currentTime), near(12), '新页面应停在 12 秒');
      await fresh.bringToFront();
      await fresh.mouse.click(12, 12);
      await fresh.keyboard.press('KeyN');
      await fresh.getByText(markMissing, { exact: true }).waitFor({ state: 'visible', timeout: 8_000 });
      const stayed = await fresh.locator('#media').evaluate(element => element.currentTime);
      if (!near(12)(stayed)) throw new Error(`没有标记时进度被改成 ${stayed}`);
      await fresh.screenshot({ path: path.join(dir, 'toast-missing.png'), animations: 'disabled' });
      await fresh.getByText(markMissing, { exact: true }).waitFor({ state: 'hidden', timeout: 3_000 });
      note('missing mark uses the existing explanation');
    } finally { await fresh.close().catch(() => {}); }

    await restoreKeys();
    if ((await prefsText()) !== '{}') throw new Error(`结束时 sitePrefs 不是空的：${await prefsText()}`);
    const state = { ok: true, markedAt, jumped, documentFullscreen, sitePrefs: {} };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await popup?.close().catch(() => {});
    await restoreKeys().catch(() => {});
    await fixture?.close().catch(() => {});
    await settings?.close().catch(() => {});
  }
}

async function driveAutoFollowPlaying(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const names = { '#preview': 'Feed preview', '#media': 'Main player' };
  const opposite = selector => (selector === '#preview' ? '#media' : '#preview');
  const rateOf = (page, selector) => page.locator(selector).evaluate(element => element.playbackRate);
  const pausedOf = (page, selector) => page.locator(selector).evaluate(element => element.paused);
  const near = expected => value => Math.abs(value - expected) < 0.02;
  const ready = async (page, selector) => page.locator(selector).evaluate(async element => {
    if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
  });
  const start = async (page, selector) => {
    await page.locator(selector).evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
      element.pause();
      try { await element.play(); }
      catch { element.muted = true; await element.play(); element.muted = false; }
    });
    await poll(() => pausedOf(page, selector), value => value === false, `${selector} 应开始播放`);
  };
  const setRate = async (page, selector, rate) => {
    await page.locator(selector).evaluate((element, next) => { element.playbackRate = next; }, rate);
    await poll(() => rateOf(page, selector), near(rate), `${selector} 倍速应是 ${rate}`);
  };
  const nudge = async page => {
    await page.bringToFront();
    await page.mouse.click(8, 8);
    await page.keyboard.press('Alt+Period');
  };
  const choose = async (popup, name) => {
    if (!await popup.evaluate(`(() => { const trigger = document.getElementById('popup-media'); if (!trigger) return false; trigger.click(); return true; })()`)) throw new Error('没有媒体列表');
    const picked = await popup.evaluate(`(() => {
      const item = [...document.querySelectorAll('[role="menuitemradio"]')].find(node => (node.textContent || '').includes(${JSON.stringify(name)}));
      if (!item) return false;
      item.click();
      return true;
    })()`);
    if (!picked) throw new Error(`没有点到 ${name}`);
  };
  let settings;
  let feed;
  let single;
  let popup;
  try {
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    const toggle = settings.getByRole('switch', { name: 'Follow the media that starts playing' });
    await toggle.waitFor({ state: 'visible', timeout: 15_000 });
    if (await toggle.getAttribute('aria-checked') !== 'true') throw new Error('自动跟随默认应开启');
    await settings.getByText('stays selected for a few seconds').waitFor({ state: 'visible' });
    await settings.getByText('one media').waitFor({ state: 'visible' });
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-on.png'), animations: 'disabled' });
    note('setting on by default');

    feed = await context.newPage();
    await feed.goto(`${origin}/feed`, { waitUntil: 'domcontentloaded' });
    await feed.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await ready(feed, '#preview');
    await ready(feed, '#media');
    await feed.bringToFront();
    popup = await openActionPopup(context, feed);
    const initial = await poll(() => popup.view(), value => value.heading === 'Feed preview' || value.heading === 'Main player', '面板应先选中 feed 里的一条');
    const from = initial.heading === 'Feed preview' ? '#preview' : '#media';
    const followed = opposite(from);
    await start(feed, followed);
    const switched = await poll(() => popup.view(), value => value.heading === names[followed], '点播另一条后面板应改到它');
    await popup.screenshot(path.join(dir, 'popup-followed.png'));
    note(`followed ${switched.heading} from ${initial.heading}`);
    await popup.close();
    popup = null;
    const entry = feed.getByRole('button', { name: /volume pill/i });
    await poll(() => entry.getAttribute('title'), value => (value ?? '').includes(names[followed]), '浮动入口应改到新目标');
    await setRate(feed, '#preview', 1);
    await setRate(feed, '#media', 1);
    await nudge(feed);
    const followedRate = await poll(() => rateOf(feed, followed), near(1.25), '页内 Alt+. 应作用在新目标');
    const otherRate = await rateOf(feed, from);
    if (Math.abs(otherRate - 1) > 0.02) throw new Error(`页内键改到了另一条：${from}=${otherRate}`);
    note(`hotkey ${names[followed]}=${followedRate} ${names[from]}=${otherRate}`);
    const dialog = () => feed.getByRole('dialog', { name: 'Volume pill' });
    const playButton = () => dialog().getByRole('button', { name: 'Play', exact: true }).or(dialog().getByRole('button', { name: 'Pause', exact: true }));
    if (!(await playButton().isVisible())) {
      const box = await entry.boundingBox();
      if (!box) throw new Error('浮动入口没有位置');
      await feed.mouse.move(box.x + Math.min(8, box.width / 4), box.y + box.height / 2);
      await entry.click();
    }
    await dialog().getByRole('button', { name: 'Pause', exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
    await dialog().getByRole('button', { name: 'Pause', exact: true }).click();
    await poll(() => pausedOf(feed, followed), value => value === true, '药丸暂停应停住新目标');
    if (await pausedOf(feed, from) !== true) throw new Error('药丸暂停停到了另一条');
    await dialog().screenshot({ path: path.join(dir, 'pill-followed.png'), animations: 'disabled' });
    note('pill paused the followed media');

    await settings.bringToFront();
    await toggle.click();
    await poll(() => toggle.getAttribute('aria-checked'), value => value === 'false', '应能关掉自动跟随');
    await poll(stored, value => value.followPlaying === false && value.floating !== false && value.hoverWheel !== false, '存储里应关掉 followPlaying，且不改浮动和悬停滚轮');
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-off.png'), animations: 'disabled' });
    note('setting off');
    await setRate(feed, followed, 1);
    await setRate(feed, from, 1);
    await start(feed, from);
    await feed.waitForTimeout(1000);
    await feed.bringToFront();
    popup = await openActionPopup(context, feed);
    const heldOff = await popup.view();
    if (heldOff.heading !== names[followed]) throw new Error(`关闭后仍自动切了：${heldOff.heading}`);
    await popup.close();
    popup = null;
    await nudge(feed);
    const stayed = await poll(() => rateOf(feed, followed), near(1.25), '关闭后页内键应留在原来那一条');
    const ignored = await rateOf(feed, from);
    if (Math.abs(ignored - 1) > 0.02) throw new Error(`关闭后页内键跟到了新播放：${names[from]}=${ignored}`);
    note(`off held ${names[followed]}=${stayed}`);

    await settings.bringToFront();
    await toggle.click();
    await poll(() => toggle.getAttribute('aria-checked'), value => value === 'true', '应能重新打开自动跟随');
    await poll(stored, value => value.followPlaying === true, '存储里应重新打开 followPlaying');
    await feed.bringToFront();
    popup = await openActionPopup(context, feed);
    await choose(popup, names[from]);
    await poll(() => popup.view(), value => value.heading === names[from], '手动点选应改到那一条');
    const pickedAt = Date.now();
    await start(feed, followed);
    await feed.waitForTimeout(800);
    const during = await popup.view();
    if (during.heading !== names[from]) throw new Error(`刚点选就被抢走了：${during.heading}`);
    await popup.screenshot(path.join(dir, 'popup-held.png'));
    await popup.close();
    popup = null;
    await setRate(feed, from, 1);
    await setRate(feed, followed, 1);
    await nudge(feed);
    const manualRate = await poll(() => rateOf(feed, from), near(1.25), '让路时页内键应作用在刚点选的那一条');
    const blockedRate = await rateOf(feed, followed);
    if (Math.abs(blockedRate - 1) > 0.02) throw new Error(`让路时页内键跟到了正在播放的另一条：${blockedRate}`);
    note(`grace held ${names[from]}=${manualRate}`);
    const remain = 2700 - (Date.now() - pickedAt);
    if (remain > 0) await feed.waitForTimeout(remain);
    await start(feed, followed);
    await feed.bringToFront();
    popup = await openActionPopup(context, feed);
    const afterGrace = await poll(() => popup.view(), value => value.heading === names[followed], '让路窗口过后，再次播放应跟上');
    await popup.close();
    popup = null;
    note(`after grace ${afterGrace.heading}`);

    single = await context.newPage();
    await single.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await single.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await ready(single, '#media');
    await setRate(single, '#media', 1);
    await start(single, '#media');
    await single.waitForTimeout(800);
    await single.bringToFront();
    popup = await openActionPopup(context, single);
    const alone = await poll(() => popup.view(), value => value.heading === 'Fixture video', '单媒体页播放后面板仍是这一条');
    await popup.screenshot(path.join(dir, 'popup-single.png'));
    await popup.close();
    popup = null;
    await nudge(single);
    const singleRate = await poll(() => rateOf(single, '#media'), near(1.25), '单媒体页的页内键应作用在这一条');
    popup = await openActionPopup(context, single);
    await popup.click('Pause');
    await poll(() => pausedOf(single, '#media'), value => value === true, '单媒体页面板暂停应停住这一条');
    if ((await popup.view()).heading !== 'Fixture video') throw new Error('暂停后单媒体页换了标题');
    await popup.close();
    popup = null;
    const end = await stored();
    if (end.followPlaying !== true) throw new Error('结束时自动跟随应仍是开');
    note(`single ${alone.heading} rate=${singleRate}`);

    const state = {
      ok: true,
      from: names[from],
      followed: names[followed],
      heldWhileOff: names[followed],
      heldDuringGrace: names[from],
      followedAfterGrace: names[followed],
      single: 'Fixture video',
      followPlaying: true,
    };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await popup?.close().catch(() => {});
    await single?.close().catch(() => {});
    await feed?.close().catch(() => {});
    await settings?.close().catch(() => {});
  }
}

async function driveSelectionHighlight(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const names = { '#preview': 'Feed preview', '#media': 'Main player' };
  const opposite = selector => (selector === '#preview' ? '#media' : '#preview');
  const rings = page => page.evaluate(() => ({
    preview: document.querySelector('#preview')?.classList.contains('ottertap-selection-ring') === true,
    media: document.querySelector('#media')?.classList.contains('ottertap-selection-ring') === true,
    clip: document.querySelector('#clip')?.classList.contains('ottertap-selection-ring') === true,
  }));
  const ringDetail = (page, selector) => page.locator(selector).evaluate(element => {
    const animation = element.getAnimations().find(item => item.animationName === 'ottertap-selection-ring');
    const timing = animation?.effect?.getTiming?.();
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + Math.min(24, rect.height / 2));
    return {
      on: element.classList.contains('ottertap-selection-ring'),
      duration: typeof timing?.duration === 'number' ? timing.duration : 0,
      outline: style.outlineStyle,
      width: style.outlineWidth,
      events: style.pointerEvents,
      hit: hit === element || (!!hit && element.contains(hit)),
    };
  });
  const hints = page => page.evaluate(() => {
    const root = document.querySelector('ottertap-controller')?.shadowRoot;
    return [...(root?.querySelectorAll('[role="status"]') ?? [])].map(node => ({
      text: (node.textContent || '').trim(),
      events: getComputedStyle(node).pointerEvents,
    }));
  });
  const ready = async (page, selector) => page.locator(selector).evaluate(async element => {
    if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
  });
  const start = async (page, selector) => {
    await page.locator(selector).evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
      element.pause();
      try { await element.play(); }
      catch { element.muted = true; await element.play(); }
    });
    await poll(() => page.locator(selector).evaluate(element => element.paused), value => value === false, `${selector} 应开始播放`);
  };
  const choose = async (popup, name) => {
    if (!await popup.evaluate(`(() => { const trigger = document.getElementById('popup-media'); if (!trigger) return false; trigger.click(); return true; })()`)) throw new Error('没有媒体列表');
    const picked = await popup.evaluate(`(() => {
      const item = [...document.querySelectorAll('[role="menuitemradio"]')].find(node => (node.textContent || '').includes(${JSON.stringify(name)}));
      if (!item) return false;
      item.click();
      return true;
    })()`);
    if (!picked) throw new Error(`没有点到 ${name}`);
  };
  let settings;
  let feed;
  let mixed;
  let popup;
  try {
    feed = await context.newPage();
    await feed.goto(`${origin}/feed`, { waitUntil: 'domcontentloaded' });
    await feed.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await ready(feed, '#preview');
    await ready(feed, '#media');
    await feed.bringToFront();
    popup = await openActionPopup(context, feed);
    const initial = await poll(() => popup.view(), value => value.heading === 'Feed preview' || value.heading === 'Main player', '面板应先选中 feed 里的一条');
    const from = initial.heading === 'Feed preview' ? '#preview' : '#media';
    const followed = opposite(from);
    await popup.close();
    popup = null;
    await start(feed, followed);
    const shown = await poll(async () => {
      const marks = await rings(feed);
      const detail = await ringDetail(feed, followed);
      return { marks, detail };
    }, value => value.marks[followed.slice(1)] === true && value.marks[from.slice(1)] === false && value.detail.duration >= 900 && value.detail.duration <= 1100 && value.detail.outline === 'solid' && value.detail.width === '2px' && value.detail.events !== 'none' && value.detail.hit, '跟随之后只有新视频有一圈约一秒的轮廓，且不挡住画面');
    await feed.screenshot({ path: path.join(dir, 'ring-followed.png') });
    note(`followed ring on ${names[followed]} duration=${shown.detail.duration}`);
    await feed.bringToFront();
    await feed.mouse.click(8, 8);
    await feed.keyboard.press('Alt+Period');
    const withSpeed = await poll(async () => ({ marks: await rings(feed), hints: await hints(feed) }), value => value.marks[followed.slice(1)] === true && value.marks[from.slice(1)] === false && value.hints.some(item => item.text === 'Speed 1.25×'), '轮廓还在时倍速提示应同时出现');
    await feed.screenshot({ path: path.join(dir, 'ring-with-speed.png') });
    note(`speed hint with ring: ${withSpeed.hints.map(item => item.text).filter(Boolean).join(' | ')}`);
    await poll(() => rings(feed), value => value.preview === false && value.media === false, '轮廓应在大约一秒后消失', 2_500);
    const after = await ringDetail(feed, followed);
    if (!after.hit) throw new Error('轮廓消失后画面中心不再命中视频');
    note('ring faded');

    popup = await openActionPopup(context, feed);
    await choose(popup, names[from]);
    await poll(() => popup.view(), value => value.heading === names[from], '面板点选应改到原来那一条');
    const panelRing = await poll(() => rings(feed), value => value[from.slice(1)] === true && value[followed.slice(1)] === false, '面板点选后只高亮点中的那一条');
    await feed.screenshot({ path: path.join(dir, 'ring-panel.png') });
    note(`panel ring ${JSON.stringify(panelRing)}`);
    await popup.close();
    popup = null;

    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
    const toggle = settings.getByRole('switch', { name: 'Single-key mode' });
    await toggle.waitFor({ state: 'visible', timeout: 15_000 });
    if (await toggle.getAttribute('aria-checked') !== 'false') throw new Error('单键模式默认应关闭');
    await toggle.click();
    await poll(() => toggle.getAttribute('aria-checked'), value => value === 'true', '应能打开单键模式');
    await poll(stored, value => value.singleKey === true && value.followPlaying !== false, '存储里应打开单键模式，且不关掉自动跟随');
    await feed.bringToFront();
    const box = await feed.locator(followed).boundingBox();
    if (!box) throw new Error('键切的视频没有位置');
    await feed.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await feed.keyboard.press('ArrowUp');
    const keyed = await poll(() => rings(feed), value => value[followed.slice(1)] === true && value[from.slice(1)] === false, '指着另一条按向上键后只高亮这一条');
    await feed.screenshot({ path: path.join(dir, 'ring-key.png') });
    note(`key ring ${JSON.stringify(keyed)}`);
    await settings.bringToFront();
    await toggle.click();
    await poll(() => toggle.getAttribute('aria-checked'), value => value === 'false', '应关掉单键模式');
    await poll(stored, value => value.singleKey === false, '存储里单键模式应关闭');

    mixed = await context.newPage();
    await mixed.goto(`${origin}/mixed`, { waitUntil: 'domcontentloaded' });
    await mixed.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await ready(mixed, '#media');
    await ready(mixed, '#clip');
    await mixed.bringToFront();
    popup = await openActionPopup(context, mixed);
    await poll(() => popup.view(), value => value.heading === 'Fixture video', '混合页应先选中视频');
    await start(mixed, '#clip');
    const audioHint = await poll(async () => ({ marks: await rings(mixed), hints: await hints(mixed), heading: (await popup.view()).heading }), value => value.heading === 'Fixture audio' && value.marks.media === false && value.marks.clip === false && value.hints.some(item => item.text === 'Audio selected' && item.events === 'none'), '选中音频时应出现短提示，并且不画轮廓');
    await mixed.screenshot({ path: path.join(dir, 'toast-audio.png') });
    note(`audio hint ${audioHint.hints.map(item => item.text).filter(Boolean).join(' | ')}`);
    await choose(popup, 'Fixture video');
    await poll(() => popup.view(), value => value.heading === 'Fixture video', '点回视频后面板应回到视频');
    await poll(() => rings(mixed), value => value.media === true && value.clip === false, '点回视频后只高亮视频');
    await popup.close();
    popup = null;
    const end = await stored();
    if (end.singleKey !== false) throw new Error('结束时单键模式应关闭');
    if (end.followPlaying === false) throw new Error('结束时自动跟随应仍开启');
    if (end.sitePrefs && Object.keys(end.sitePrefs).length) throw new Error(`选中反馈写入了站点记忆：${JSON.stringify(end.sitePrefs)}`);
    const state = {
      ok: true,
      followed: names[followed],
      panel: names[from],
      keyed: names[followed],
      audioHint: 'Audio selected',
      speedHint: 'Speed 1.25×',
      singleKey: false,
      followPlaying: end.followPlaying !== false,
    };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await popup?.close().catch(() => {});
    await mixed?.close().catch(() => {});
    await feed?.close().catch(() => {});
    await settings?.close().catch(() => {});
  }
}

async function drivePanelMediaList(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const listView = `(() => {
    const rows = [...document.querySelectorAll('[role="menuitemradio"]')].filter(node => !node.hasAttribute('data-filtered')).map(node => ({
      text: (node.textContent || '').replace(/\\s+/g, ' ').trim(),
      checked: node.getAttribute('aria-checked') === 'true',
    }));
    return {
      rows,
      list: !!document.getElementById('popup-media'),
      filter: !!document.getElementById('popup-media-filter'),
      empty: (document.body.innerText || '').includes('No media match.'),
      heading: document.querySelector('h1')?.textContent?.trim() ?? '',
    };
  })()`;
  const openList = `(() => {
    if (document.querySelector('[role="menuitemradio"]')) return true;
    const trigger = document.getElementById('popup-media');
    if (!trigger) return false;
    trigger.click();
    return true;
  })()`;
  const setFilter = value => `(() => {
    const input = document.getElementById('popup-media-filter');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return input.value;
  })()`;
  const choose = async (popup, name) => {
    if (!await popup.evaluate(openList)) throw new Error('没有媒体列表');
    const picked = await popup.evaluate(`(() => {
      const item = [...document.querySelectorAll('[role="menuitemradio"]')].find(node => !node.hasAttribute('data-filtered') && (node.textContent || '').includes(${JSON.stringify(name)}));
      if (!item) return false;
      item.click();
      return true;
    })()`);
    if (!picked) throw new Error(`没有点到 ${name}`);
  };
  const play = async (page, selector) => {
    await page.locator(selector).evaluate(async element => {
      try { await element.play(); }
      catch { element.muted = true; await element.play(); }
    });
    await poll(() => page.locator(selector).evaluate(element => element.paused), value => value === false, `${selector} 应开始播放`);
  };
  let popup = null;
  let single = null;
  let feed = null;
  let playlist = null;
  try {
    single = await context.newPage();
    await single.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await single.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await single.bringToFront();
    popup = await openActionPopup(context, single);
    const quiet = await poll(() => popup.evaluate(listView), value => value.heading === 'Fixture video' && value.list === false && value.filter === false, '单媒体页不应出现媒体列表或过滤');
    await popup.screenshot(path.join(dir, 'popup-single.png'));
    note(`single heading=${quiet.heading}`);
    await popup.close();
    popup = null;

    feed = await context.newPage();
    await feed.goto(`${origin}/feed`, { waitUntil: 'domcontentloaded' });
    await feed.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await feed.evaluate(async () => {
      for (const element of [document.querySelector('#preview'), document.querySelector('#media')]) {
        if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
        element.pause();
      }
    });
    await feed.bringToFront();
    popup = await openActionPopup(context, feed);
    const initial = await poll(() => popup.view(), value => value.heading === 'Feed preview' || value.heading === 'Main player', 'feed 应先选中一条');
    const playingSelector = initial.heading === 'Feed preview' ? '#media' : '#preview';
    const playingName = playingSelector === '#media' ? 'Main player' : 'Feed preview';
    const heldName = initial.heading;
    const heldSelector = heldName === 'Feed preview' ? '#preview' : '#media';
    await play(feed, playingSelector);
    await poll(() => popup.view(), value => value.heading === playingName, '播放另一条后面板应跟过去');
    if (!await popup.evaluate(openList)) throw new Error('feed 上没有媒体列表');
    const feedRows = await poll(() => popup.evaluate(listView), value => {
      const playing = value.rows.find(row => row.text.includes(playingName));
      const held = value.rows.find(row => row.text.includes(heldName));
      return value.filter === false && value.rows.length === 2 && playing?.text.includes('Playing') && playing.checked && held?.text.includes('Paused') && !held.checked;
    }, '列表应标出正在播放的一条和当前选中');
    await popup.screenshot(path.join(dir, 'popup-rows.png'));
    note(`rows ${feedRows.rows.map(row => row.text).join(' | ')}`);
    await choose(popup, heldName);
    await poll(() => popup.view(), value => value.heading === heldName, '点选应改到那一条');
    await popup.click('Play');
    await poll(() => feed.locator(heldSelector).evaluate(element => element.paused), value => value === false, '点选后播放应作用在这一条');
    if (await feed.locator(playingSelector).evaluate(element => element.paused) !== false) throw new Error('点选后把另一条停了');
    await popup.click('Pause');
    await poll(() => feed.locator(heldSelector).evaluate(element => element.paused), value => value === true, '点选后暂停应作用在这一条');
    if (await feed.locator(playingSelector).evaluate(element => element.paused) !== false) throw new Error('暂停串到了正在播放的另一条');
    note(`control landed on ${heldName}`);
    await popup.close();
    popup = null;

    playlist = await context.newPage();
    await playlist.goto(`${origin}/playlist`, { waitUntil: 'domcontentloaded' });
    await playlist.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await playlist.bringToFront();
    popup = await openActionPopup(context, playlist);
    await poll(() => popup.view(), value => value.heading === 'Alpha reel', '五条里应先选中 Alpha reel');
    if (!await popup.evaluate(openList)) throw new Error('playlist 上没有媒体列表');
    const labels = await poll(() => popup.evaluate(listView), value => value.filter === true && value.rows.length === 5 && ['Alpha reel', 'Beta reel', 'Gamma reel', 'delta-reel', 'Video 5'].every(name => value.rows.some(row => row.text.includes(name))) && value.rows.every(row => !row.text.includes('Playlist page')), '五条都应有短标签，且不用页面标题');
    note(`labels ${labels.rows.map(row => row.text).join(' | ')}`);
    if (await popup.evaluate(setFilter('beta')) !== 'beta') throw new Error('过滤框没有写上 beta');
    const filtered = await poll(() => popup.evaluate(listView), value => value.rows.length === 1 && value.rows[0].text.includes('Beta reel') && value.heading === 'Alpha reel', '过滤只留下 Beta reel，选中仍是 Alpha');
    await popup.screenshot(path.join(dir, 'popup-filtered.png'));
    const count = await playlist.evaluate(() => document.querySelectorAll('video').length);
    if (count !== 5) throw new Error(`过滤改了页面上的媒体数量：${count}`);
    note(`filtered heading=${filtered.heading} videos=${count}`);
    if (await popup.evaluate(setFilter('zzzz')) !== 'zzzz') throw new Error('过滤框没有写上 zzzz');
    await poll(() => popup.evaluate(listView), value => value.rows.length === 0 && value.empty && value.heading === 'Alpha reel', '没有匹配时列表空着，选中不变');
    await popup.screenshot(path.join(dir, 'popup-nomatch.png'));
    if (await popup.evaluate(setFilter('')) !== '') throw new Error('过滤框没有清空');
    await poll(() => popup.evaluate(listView), value => value.rows.length === 5 && !value.empty, '清空过滤后五条都回来');
    await choose(popup, 'Beta reel');
    await poll(() => popup.view(), value => value.heading === 'Beta reel', '过滤清空后点选应改到 Beta reel');
    await popup.click('Play');
    await poll(() => playlist.locator('#beta').evaluate(element => element.paused), value => value === false, '点选 Beta 后播放应作用在它身上');
    const others = await playlist.evaluate(() => ['#alpha', '#gamma', '#delta', '#echo'].map(selector => document.querySelector(selector).paused));
    if (others.some(paused => paused !== true)) throw new Error(`播放 Beta 带动了其他条：${JSON.stringify(others)}`);
    note('playlist control landed on Beta reel');
    await popup.close();
    popup = null;

    const prefs = await stored();
    if (prefs.sitePrefs && Object.keys(prefs.sitePrefs).length) throw new Error(`媒体列表写入了站点记忆：${JSON.stringify(prefs.sitePrefs)}`);
    const state = { ok: true, single: 'Fixture video', feedPlaying: playingName, feedSelected: heldName, filtered: 'Beta reel', fallback: 'Video 5', file: 'delta-reel', sitePrefs: prefs.sitePrefs ?? {} };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await popup?.close().catch(() => {});
    await playlist?.close().catch(() => {});
    await feed?.close().catch(() => {});
    await single?.close().catch(() => {});
  }
}

async function driveFloatPrevNext(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const dialog = page => page.getByRole('dialog', { name: 'Volume pill' });
  const trigger = page => page.getByRole('button', { name: /volume pill/i });
  const named = (page, label) => dialog(page).getByRole('button', { name: label, exact: true });
  const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  const place = async page => {
    const box = await trigger(page).boundingBox();
    if (!box) throw new Error('浮动入口没有位置');
    return { x: Math.round(box.x), y: Math.round(box.y) };
  };
  const expand = async page => {
    const box = await trigger(page).boundingBox();
    if (!box) throw new Error('浮动入口没有位置');
    await page.mouse.move(box.x + Math.min(8, box.width / 4), box.y + box.height / 2);
    await trigger(page).click();
    await dialog(page).waitFor({ state: 'visible', timeout: 5_000 });
  };
  const rings = page => page.evaluate(() => ({
    preview: document.querySelector('#preview')?.classList.contains('ottertap-selection-ring') === true,
    media: document.querySelector('#media')?.classList.contains('ottertap-selection-ring') === true,
  }));
  const rates = page => page.evaluate(() => ({
    preview: document.querySelector('#preview')?.playbackRate ?? 0,
    media: document.querySelector('#media')?.playbackRate ?? 0,
    paused: {
      preview: document.querySelector('#preview')?.paused !== false,
      media: document.querySelector('#media')?.paused !== false,
    },
  }));
  const apart = async page => {
    const previous = await named(page, 'Previous media').boundingBox();
    const next = await named(page, 'Next media').boundingBox();
    const open = await named(page, 'Open panel').boundingBox();
    if (!previous || !next || !open) throw new Error('上一条、下一条或打开面板没有位置');
    if (overlaps(previous, open) || overlaps(next, open)) throw new Error('上一条或下一条挡住了打开面板');
    if (previous.y + previous.height > open.y || next.y + next.height > open.y) throw new Error('上一条或下一条不在打开面板上方');
    return { previous, next, open };
  };
  let page;
  let popup;
  try {
    const before = await stored();
    page = await context.newPage();
    await page.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await trigger(page).waitFor({ state: 'visible', timeout: 15_000 });
    await expand(page);
    if (await named(page, 'Previous media').count()) throw new Error('只有一条时不应有上一条');
    if (await named(page, 'Next media').count()) throw new Error('只有一条时不应有下一条');
    await named(page, 'Open panel').waitFor({ state: 'visible', timeout: 5_000 });
    await dialog(page).screenshot({ path: path.join(dir, 'pill-one.png'), animations: 'disabled' });
    note('single media hides prev/next');

    await page.goto(`${origin}/feed`, { waitUntil: 'domcontentloaded' });
    await trigger(page).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#preview').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
    });
    await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
    });
    await poll(async () => (await trigger(page).getAttribute('title')) ?? '', value => value.startsWith('Feed preview'), '暂停的信息流应先选中页面顺序的第一条');
    await expand(page);
    await named(page, 'Previous media').waitFor({ state: 'visible', timeout: 5_000 });
    await named(page, 'Next media').waitFor({ state: 'visible', timeout: 5_000 });
    const gap = await apart(page);
    const anchored = await place(page);
    await dialog(page).screenshot({ path: path.join(dir, 'pill-two.png'), animations: 'disabled' });
    note(`two media, open panel y=${Math.round(gap.open.y)} prev y=${Math.round(gap.previous.y)}`);

    await named(page, 'Next media').click();
    await poll(() => rings(page), value => value.media === true && value.preview === false, '下一条后只有主视频有轮廓');
    await poll(async () => (await trigger(page).getAttribute('title')) ?? '', value => value.startsWith('Main player'), '药丸应改去控制主视频');
    if (await dialog(page).isVisible() !== true) throw new Error('切换后药丸不应收起');
    await page.screenshot({ path: path.join(dir, 'ring-next.png') });
    popup = await openActionPopup(context, page);
    const nextHeading = await poll(() => popup.view(), value => value.heading === 'Main player', '弹出面板应对准主视频');
    await popup.screenshot(path.join(dir, 'popup-next.png'));
    await popup.close();
    popup = null;
    note(`next heading=${nextHeading.heading}`);

    await named(page, 'Play').click();
    await poll(() => rates(page), value => value.paused.media === false && value.paused.preview === true, '药丸播放应只作用在主视频');
    await page.bringToFront();
    await page.keyboard.press('Alt+Period');
    await poll(() => rates(page), value => value.media === 1.25 && value.preview === 1, 'Alt+. 应只加快主视频');
    await named(page, 'Pause').waitFor({ state: 'visible', timeout: 5_000 });
    await named(page, 'Pause').click();
    await poll(() => rates(page), value => value.paused.media === true && value.paused.preview === true, '暂停应停住主视频');

    await named(page, 'Previous media').click();
    await poll(() => rings(page), value => value.preview === true && value.media === false, '上一条后只有预览有轮廓');
    await poll(async () => (await trigger(page).getAttribute('title')) ?? '', value => value.startsWith('Feed preview'), '药丸应回到预览');
    await page.screenshot({ path: path.join(dir, 'ring-prev.png') });
    popup = await openActionPopup(context, page);
    const prevHeading = await poll(() => popup.view(), value => value.heading === 'Feed preview', '弹出面板应回到预览');
    await popup.screenshot(path.join(dir, 'popup-prev.png'));
    await popup.close();
    popup = null;
    await page.bringToFront();
    await page.keyboard.press('Alt+Period');
    await poll(() => rates(page), value => value.preview === 1.25 && value.media === 1.25, 'Alt+. 应只加快回到的预览，主视频保持 1.25×');
    const stayed = await place(page);
    if (stayed.x !== anchored.x || stayed.y !== anchored.y) throw new Error(`浮动入口挪动了：${JSON.stringify(anchored)} -> ${JSON.stringify(stayed)}`);
    await apart(page);
    const after = await stored();
    if (JSON.stringify(after.floatingPosition ?? null) !== JSON.stringify(before.floatingPosition ?? null)) throw new Error(`位置记忆变了：${JSON.stringify(before.floatingPosition)} -> ${JSON.stringify(after.floatingPosition)}`);
    if (after.sitePrefs && Object.keys(after.sitePrefs).length) throw new Error(`切换写入了站点记忆：${JSON.stringify(after.sitePrefs)}`);
    const state = { ok: true, from: 'Feed preview', next: nextHeading.heading, previous: prevHeading.heading, place: stayed, floatingPosition: after.floatingPosition ?? null };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    note(`place ${JSON.stringify(stayed)}`);
    return state;
  } finally {
    await popup?.close().catch(() => {});
    await page?.close().catch(() => {});
  }
}

async function driveFloatPip(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const dialog = page => page.getByRole('dialog', { name: 'Volume pill' });
  const trigger = page => page.getByRole('button', { name: /volume pill/i });
  const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  const place = async page => {
    const box = await trigger(page).boundingBox();
    if (!box) throw new Error('浮动入口没有位置');
    return { x: Math.round(box.x), y: Math.round(box.y) };
  };
  const expand = async page => {
    const box = await trigger(page).boundingBox();
    if (!box) throw new Error('浮动入口没有位置');
    await page.mouse.move(box.x + Math.min(8, box.width / 4), box.y + box.height / 2);
    await trigger(page).click();
    await dialog(page).waitFor({ state: 'visible', timeout: 5_000 });
  };
  const pipControl = page => dialog(page).getByRole('button', { name: /picture-in-picture$/i });
  const readPill = async page => {
    const button = pipControl(page);
    await button.waitFor({ state: 'visible', timeout: 5_000 });
    const hint = dialog(page).locator('#floating-pip-hint');
    const hintText = await hint.count() ? (await hint.innerText()).trim() : '';
    const state = await button.evaluate(element => ({
      label: element.getAttribute('aria-label') ?? '',
      disabled: element.disabled === true || element.getAttribute('aria-disabled') === 'true',
      pressed: element.getAttribute('aria-pressed') ?? '',
    }));
    const playback = dialog(page).getByRole('group', { name: 'Playback', exact: true });
    if (await playback.getByRole('button', { name: state.label, exact: true }).count() !== 1) throw new Error('画中画不在播放那一组');
    if (await playback.getByRole('button', { name: 'Open panel', exact: true }).count() !== 0) throw new Error('画中画不应放在打开面板那一栏');
    return { ...state, hint: hintText };
  };
  const alerts = async page => (await page.getByRole('alert').allInnerTexts()).map(text => text.trim()).filter(Boolean);
  const mediaPip = page => page.locator('#media').evaluate(element => ({
    pip: element.isConnected && element.ownerDocument.pictureInPictureElement === element,
    any: element.ownerDocument.pictureInPictureElement != null,
    readyState: element.readyState,
    videoWidth: element.videoWidth,
    kind: element.localName,
  }));
  const panelState = async page => {
    const popup = await openActionPopup(context, page);
    try {
      const button = await poll(() => popup.evaluate(pipButtonState), value => Boolean(value?.label), '弹出面板应有画中画按钮');
      return { popup, button };
    } catch (error) {
      await popup.close().catch(() => {});
      throw error;
    }
  };
  const sameReason = async (page, shot) => {
    const pill = await readPill(page);
    const opened = await panelState(page);
    try {
      if (pill.label !== opened.button.label || pill.disabled !== opened.button.disabled || pill.hint !== opened.button.hint) {
        throw new Error(`药丸和面板的画中画原因不一致：${JSON.stringify({ pill, panel: opened.button })}`);
      }
      await dialog(page).screenshot({ path: path.join(dir, shot), animations: 'disabled' });
      return { pill, panel: opened.button };
    } finally { await opened.popup.close().catch(() => {}); }
  };
  let page;
  let popup;
  try {
    const before = await stored();
    page = await context.newPage();
    await page.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await trigger(page).waitFor({ state: 'visible', timeout: 15_000 });
    const picture = await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) {
        await Promise.race([
          new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true })),
          new Promise(resolve => setTimeout(resolve, 2_000)),
        ]);
      }
      const describe = pictured => ({
        readyState: element.readyState,
        videoWidth: element.videoWidth,
        enabled: document.pictureInPictureEnabled === true,
        request: typeof element.requestPictureInPicture === 'function',
        disabledBySite: element.disablePictureInPicture === true,
        pictured,
      });
      if (element.videoWidth > 0 || document.pictureInPictureEnabled !== true || typeof element.requestPictureInPicture !== 'function') return describe(element.videoWidth > 0 ? 'native' : 'none');
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 36;
      const context = canvas.getContext('2d');
      if (!context || typeof canvas.captureStream !== 'function') return describe('none');
      context.fillStyle = '#c45c26';
      context.fillRect(0, 0, 64, 36);
      element.srcObject = canvas.captureStream(5);
      element.muted = true;
      try { await element.play(); } catch { /* a muted play can still be rejected; the button click is the gesture */ }
      const deadline = performance.now() + 2_000;
      while (element.videoWidth === 0 && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
      return describe(element.videoWidth > 0 ? 'canvas' : 'none');
    });
    note(`video ${JSON.stringify(picture)}`);
    await expand(page);
    const anchored = await place(page);
    const expectEnabled = picture.enabled && picture.request && !picture.disabledBySite && picture.videoWidth > 0;
    const ready = await poll(() => readPill(page), value => {
      if (value.label !== 'Picture-in-picture' && value.label !== 'Exit picture-in-picture') return false;
      if (!expectEnabled) return true;
      return value.disabled === false && value.hint === '' && value.label === 'Picture-in-picture';
    }, '药丸应有画中画按钮');
    const openBox = await dialog(page).getByRole('button', { name: 'Open panel', exact: true }).boundingBox();
    const pipBox = await pipControl(page).boundingBox();
    if (!openBox || !pipBox) throw new Error('画中画或打开面板没有位置');
    if (overlaps(openBox, pipBox)) throw new Error('画中画挡住了打开面板');
    await dialog(page).screenshot({ path: path.join(dir, 'pill-video.png'), animations: 'disabled' });
    note(`pill video disabled=${ready.disabled} hint=${JSON.stringify(ready.hint)}`);

    let toggled = null;
    if (!ready.disabled) {
      await pipControl(page).click();
      const entered = await poll(async () => ({
        media: await mediaPip(page),
        pill: await readPill(page),
        alerts: await alerts(page),
      }), value => value.media.pip === true || value.pill.label === 'Exit picture-in-picture' || value.alerts.some(text => Object.values(pipHintText).includes(text)), '点击画中画后应进入，或显示和面板相同的失败说明');
      if (entered.media.pip === true || entered.pill.label === 'Exit picture-in-picture') {
        if (entered.pill.label !== 'Exit picture-in-picture' || entered.pill.pressed !== 'true' || entered.media.pip !== true) {
          throw new Error(`进入画中画后药丸应改成退出：${JSON.stringify(entered)}`);
        }
        await dialog(page).screenshot({ path: path.join(dir, 'pill-entered.png'), animations: 'disabled' });
        await pipControl(page).click();
        const left = await poll(async () => ({
          media: await mediaPip(page),
          pill: await readPill(page),
        }), value => value.media.pip === false && value.pill.label === 'Picture-in-picture', '再点一次应退出画中画');
        if (left.pill.pressed === 'true') throw new Error('退出后不应保持按下');
        await dialog(page).screenshot({ path: path.join(dir, 'pill-exited.png'), animations: 'disabled' });
        toggled = { entered: true, exited: true };
        note('entered and exited picture-in-picture');
      } else {
        const pillAlert = entered.alerts.find(text => Object.values(pipHintText).includes(text)) ?? '';
        await dialog(page).screenshot({ path: path.join(dir, 'pill-failed.png'), animations: 'disabled' });
        popup = await openActionPopup(context, page);
        if (!await popup.evaluate(clickLabel('Picture-in-picture'))) throw new Error('弹出面板点不到 Picture-in-picture');
        const panelAfter = await poll(() => popup.evaluate(pipButtonState), value => Object.values(pipHintText).includes(value?.alert ?? ''), '弹出面板应显示画中画失败说明');
        if (panelAfter.alert !== pillAlert) throw new Error(`药丸和面板的失败说明不一致：${JSON.stringify({ pillAlert, panel: panelAfter.alert })}`);
        await popup.screenshot(path.join(dir, 'popup-failed.png'));
        await popup.close();
        popup = null;
        if (await mediaPip(page).then(value => value.any)) throw new Error('失败时页面不应留在画中画');
        toggled = { entered: false, reason: pillAlert };
        note(`picture-in-picture refused: ${pillAlert}`);
      }
    } else {
      const matched = await sameReason(page, 'pill-video.png');
      toggled = { entered: false, unavailable: matched.pill.hint };
      note(`video unavailable: ${matched.pill.hint}`);
    }
    const stayed = await place(page);
    if (stayed.x !== anchored.x || stayed.y !== anchored.y) throw new Error(`浮动入口挪动了：${JSON.stringify(anchored)} -> ${JSON.stringify(stayed)}`);

    await page.goto(`${origin}/audio`, { waitUntil: 'domcontentloaded' });
    await trigger(page).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
    });
    await expand(page);
    const audio = await sameReason(page, 'pill-audio.png');
    if (audio.pill.hint !== pipHintText.audio || audio.pill.disabled !== true) throw new Error(`音频应禁用画中画：${JSON.stringify(audio)}`);
    if ((await mediaPip(page)).any) throw new Error('音频不应进入画中画');
    note('audio matches the panel');

    await page.goto(`${origin}/pip-off`, { waitUntil: 'domcontentloaded' });
    await trigger(page).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await Promise.race([
        new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true })),
        new Promise(resolve => setTimeout(resolve, 2_000)),
      ]);
    });
    await expand(page);
    const blocked = await sameReason(page, 'pill-off.png');
    const offHint = picture.enabled && picture.request ? pipHintText.disabled : pipHintText.unsupported;
    if (blocked.pill.hint !== offHint || blocked.pill.disabled !== true) throw new Error(`站点关闭画中画时说明不对：${JSON.stringify(blocked)}`);
    note(`pip-off matches the panel: ${blocked.pill.hint}`);

    await page.goto(`${origin}/unseekable`, { waitUntil: 'domcontentloaded' });
    await trigger(page).waitFor({ state: 'visible', timeout: 15_000 });
    await expand(page);
    const waiting = await sameReason(page, 'pill-waiting.png');
    const waitingHint = picture.enabled && picture.request ? pipHintText.notReady : pipHintText.unsupported;
    if (waiting.pill.hint !== waitingHint || waiting.pill.disabled !== true) throw new Error(`尚未就绪时说明不对：${JSON.stringify(waiting)}`);
    note(`waiting matches the panel: ${waiting.pill.hint}`);

    await page.goto(`${origin}/feed`, { waitUntil: 'domcontentloaded' });
    await trigger(page).waitFor({ state: 'visible', timeout: 15_000 });
    await poll(async () => (await trigger(page).getAttribute('title')) ?? '', value => value.startsWith('Feed preview'), '信息流应先选中第一条');
    await expand(page);
    const feedAnchored = await place(page);
    await dialog(page).getByRole('button', { name: 'Previous media', exact: true }).waitFor({ state: 'visible' });
    await dialog(page).getByRole('button', { name: 'Next media', exact: true }).waitFor({ state: 'visible' });
    const playback = dialog(page).getByRole('group', { name: 'Playback', exact: true });
    const boxes = {};
    for (const label of ['Previous media', 'Next media', 'Picture-in-picture', 'Open panel']) {
      const target = label === 'Open panel' ? dialog(page) : playback;
      boxes[label] = await target.getByRole('button', { name: label, exact: true }).boundingBox();
      if (!boxes[label]) throw new Error(`${label} 没有位置`);
    }
    if (overlaps(boxes['Picture-in-picture'], boxes['Open panel']) || overlaps(boxes['Previous media'], boxes['Open panel']) || overlaps(boxes['Next media'], boxes['Open panel'])) {
      throw new Error('画中画或上一条、下一条挡住了打开面板');
    }
    if (overlaps(boxes['Picture-in-picture'], boxes['Previous media']) || overlaps(boxes['Picture-in-picture'], boxes['Next media'])) {
      throw new Error('画中画挡住了上一条或下一条');
    }
    await dialog(page).screenshot({ path: path.join(dir, 'pill-feed.png'), animations: 'disabled' });
    const feedStayed = await place(page);
    if (feedStayed.x !== feedAnchored.x || feedStayed.y !== feedAnchored.y) throw new Error(`信息流上浮动入口挪动了：${JSON.stringify(feedAnchored)} -> ${JSON.stringify(feedStayed)}`);
    const after = await stored();
    if (JSON.stringify(after.floatingPosition ?? null) !== JSON.stringify(before.floatingPosition ?? null)) throw new Error(`位置记忆变了：${JSON.stringify(before.floatingPosition)} -> ${JSON.stringify(after.floatingPosition)}`);
    if (after.sitePrefs && Object.keys(after.sitePrefs).length) throw new Error(`画中画写入了站点记忆：${JSON.stringify(after.sitePrefs)}`);
    const state = { ok: true, picture, toggled, audio: audio.pill, pipOff: blocked.pill, waiting: waiting.pill, place: stayed, floatingPosition: after.floatingPosition ?? null };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    note(`place ${JSON.stringify(stayed)}`);
    return state;
  } finally {
    await popup?.close().catch(() => {});
    await page?.close().catch(() => {});
  }
}

async function drivePagePip(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const prefsText = async () => JSON.stringify((await stored()).sitePrefs ?? {});
  const pipCommand = () => worker.evaluate(async () => {
    const listed = await chrome.commands.getAll();
    const item = listed.find(command => command.name === 'pip');
    return { shortcut: item?.shortcut ?? null, description: item?.description ?? '' };
  });
  const notes = page => page.evaluate(() => {
    const root = document.querySelector('ottertap-controller')?.shadowRoot;
    return [...(root?.querySelectorAll('[role="status"]') ?? [])].map(node => (node.textContent || '').trim()).filter(Boolean);
  });
  const pipNote = texts => texts.find(text => Object.values(pipHintText).includes(text)) ?? '';
  const inPip = page => page.locator('#media').evaluate(element => element.isConnected && (element.ownerDocument.pictureInPictureElement === element));
  const keyButton = (page, action) => page.getByRole('button', { name: new RegExp(`^Change the key for ${action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\. Now `) });
  const recording = page => page.getByRole('button', { name: 'Press a key', exact: true });
  const registered = await worker.evaluate(async () => {
    const manifest = chrome.runtime.getManifest();
    const listed = await chrome.commands.getAll();
    const commands = manifest.commands ?? {};
    const suggested = Object.entries(commands).filter(([, command]) => command.suggested_key).map(([name]) => name);
    return {
      permissions: manifest.permissions ?? [],
      pip: commands.pip ?? null,
      suggested,
      listed: listed.find(item => item.name === 'pip') ?? null,
    };
  });
  if (JSON.stringify(registered.permissions) !== JSON.stringify(['storage'])) throw new Error(`权限应仍只有 storage：${JSON.stringify(registered.permissions)}`);
  if (!registered.pip || registered.pip.suggested_key) throw new Error(`pip 不应占用建议键：${JSON.stringify(registered.pip)}`);
  if (registered.suggested.length !== 4 || !['play-pause', 'skip-back', 'skip-forward', 'mute'].every(name => registered.suggested.includes(name))) {
    throw new Error(`建议键应仍是原来四个：${JSON.stringify(registered.suggested)}`);
  }
  if (!registered.listed || registered.listed.shortcut !== '' || registered.listed.description !== 'Enter or exit picture-in-picture') {
    throw new Error(`扩展命令 pip 未按未绑定登记：${JSON.stringify(registered.listed)}`);
  }
  note(`commands pip shortcut=${JSON.stringify(registered.listed.shortcut)}`);

  let settings;
  let fixture;
  const focusFixture = async () => {
    await fixture.bringToFront();
    await fixture.mouse.click(12, 12);
  };
  try {
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
    const section = settings.locator('#shortcuts');
    await section.getByRole('heading', { name: 'Keyboard shortcuts' }).waitFor({ state: 'visible', timeout: 15_000 });
    const extensionList = section.getByRole('heading', { name: 'Extension shortcuts', exact: true }).locator('xpath=following-sibling::dl[1]');
    const extensionLabel = extensionList.getByText('Enter or exit picture-in-picture', { exact: true });
    await extensionLabel.waitFor({ state: 'visible' });
    const extensionRow = extensionLabel.locator('xpath=ancestor::div[contains(@class,"py-3")][1]');
    if ((await extensionRow.locator('dt').innerText()).trim() !== 'Not set') throw new Error('扩展命令画中画应显示 Not set');
    const action = 'Enter or exit picture-in-picture';
    const button = keyButton(settings, action);
    await button.waitFor({ state: 'visible' });
    if ((await button.innerText()).trim() !== 'Not set') throw new Error(`页内画中画默认应是 Not set：${await button.innerText()}`);
    const reset = () => settings.getByRole('button', { name: 'Restore default keys', exact: true });
    if (!await reset().isDisabled()) throw new Error('默认键位时「Restore default keys」应禁用');
    const singleKey = settings.getByRole('switch', { name: 'Single-key mode' });
    if (await singleKey.getAttribute('aria-checked') !== 'false') throw new Error('单键模式应保持关闭');
    await section.screenshot({ path: path.join(dir, 'settings-unbound.png'), animations: 'disabled' });
    note('settings lists picture-in-picture as Not set');

    await button.click();
    await recording(settings).waitFor({ state: 'visible' });
    await settings.keyboard.press('Comma');
    const conflict = (await settings.locator('#keybind-error').innerText()).trim();
    const conflictCopy = ', is already used for “Pause, then previous frame”. Press another key, or change that one first.';
    if (conflict !== conflictCopy) throw new Error(`撞键提示不对：${conflict}`);
    if ((await stored()).keybinds?.pip) throw new Error('撞键时不应保存画中画键');
    if (!await recording(settings).isVisible()) throw new Error('撞键后应继续等待新键');
    await section.screenshot({ path: path.join(dir, 'settings-conflict.png'), animations: 'disabled' });
    note(`conflict tip: ${conflict}`);
    await settings.keyboard.press('KeyP');
    await poll(stored, value => value.keybinds?.pip === 'p' && value.singleKey !== true, '应保存 Enter or exit picture-in-picture = p，且单键模式仍关');
    await keyButton(settings, 'Mirror horizontally').click();
    await settings.keyboard.press('KeyP');
    const taken = (await settings.locator('#keybind-error').innerText()).trim();
    const takenCopy = 'P is already used for “Enter or exit picture-in-picture”. Press another key, or change that one first.';
    if (taken !== takenCopy) throw new Error(`空键不应占位，P 的占用提示不对：${taken}`);
    if ((await stored()).keybinds?.mirror) throw new Error('水平镜像不应保存成已被画中画占用的 P');
    await section.screenshot({ path: path.join(dir, 'settings-bound.png'), animations: 'disabled' });
    await settings.keyboard.press('Escape');
    await recording(settings).waitFor({ state: 'hidden' });
    const commandAfter = await pipCommand();
    if (commandAfter.shortcut !== '' || commandAfter.description !== 'Enter or exit picture-in-picture') {
      throw new Error(`页内改键不应改掉扩展命令：${JSON.stringify(commandAfter)}`);
    }
    if ((await prefsText()) !== '{}') throw new Error(`改键写入了 sitePrefs：${await prefsText()}`);
    note('page key is p; extension command stays unbound');

    fixture = await context.newPage();
    await fixture.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    const picture = await fixture.locator('#media').evaluate(async element => {
      if (element.readyState < 1) {
        await Promise.race([
          new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true })),
          new Promise(resolve => setTimeout(resolve, 2_000)),
        ]);
      }
      const describe = pictured => ({
        readyState: element.readyState,
        videoWidth: element.videoWidth,
        enabled: document.pictureInPictureEnabled === true,
        request: typeof element.requestPictureInPicture === 'function',
        disabledBySite: element.disablePictureInPicture === true,
        pictured,
      });
      if (element.videoWidth > 0 || document.pictureInPictureEnabled !== true || typeof element.requestPictureInPicture !== 'function') return describe(element.videoWidth > 0 ? 'native' : 'none');
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 36;
      const context = canvas.getContext('2d');
      if (!context || typeof canvas.captureStream !== 'function') return describe('none');
      context.fillStyle = '#c45c26';
      context.fillRect(0, 0, 64, 36);
      element.srcObject = canvas.captureStream(5);
      element.muted = true;
      try { await element.play(); } catch { /* the key press is the gesture */ }
      const deadline = performance.now() + 2_000;
      while (element.videoWidth === 0 && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
      return describe(element.videoWidth > 0 ? 'canvas' : 'none');
    });
    note(`video ${JSON.stringify(picture)}`);
    const paused = () => fixture.locator('#media').evaluate(element => element.paused);
    await focusFixture();
    const pausedBefore = await paused();
    await fixture.keyboard.press('KeyK');
    await fixture.waitForTimeout(400);
    if (await paused() !== pausedBefore) throw new Error('单键模式关闭时 K 不应播放或暂停');
    await focusFixture();
    await fixture.keyboard.press('KeyP');
    const outcome = await poll(async () => ({
      pip: await inPip(fixture),
      note: pipNote(await notes(fixture)),
    }), value => value.pip === true || Object.values(pipHintText).includes(value.note), 'P 应进入画中画，或显示面板已有的失败说明');
    let toggled = null;
    if (outcome.pip === true) {
      await fixture.screenshot({ path: path.join(dir, 'fixture-entered.png'), animations: 'disabled' });
      await focusFixture();
      await fixture.keyboard.press('KeyP');
      await poll(() => inPip(fixture), value => value === false, '再按 P 应退出画中画');
      await fixture.screenshot({ path: path.join(dir, 'fixture-exited.png'), animations: 'disabled' });
      toggled = { entered: true, exited: true };
      note('entered and exited picture-in-picture');
    } else {
      await fixture.screenshot({ path: path.join(dir, 'fixture-failed.png'), animations: 'disabled' });
      const popup = await openActionPopup(context, fixture);
      let panelAlert = '';
      try {
        const buttonState = await poll(() => popup.evaluate(pipButtonState), value => Boolean(value?.label), '弹出面板应有画中画按钮');
        if (buttonState.disabled) {
          panelAlert = buttonState.hint;
          if (panelAlert && !Object.values(pipHintText).includes(panelAlert)) throw new Error(`面板说明不在已有句子里：${panelAlert}`);
        } else {
          if (!await popup.evaluate(clickLabel('Picture-in-picture'))) throw new Error('弹出面板点不到 Picture-in-picture');
          const after = await poll(() => popup.evaluate(pipButtonState), value => value?.label === 'Exit picture-in-picture' || Object.values(pipHintText).includes(value?.alert ?? ''), '弹出面板点击后应进入画中画，或显示已有的失败说明');
          panelAlert = after.alert || (after.label === 'Exit picture-in-picture' ? 'entered' : after.hint);
          if (after.label === 'Exit picture-in-picture') {
            if (!await popup.evaluate(clickLabel('Exit picture-in-picture'))) throw new Error('弹出面板点不到 Exit picture-in-picture');
            await poll(() => fixture.locator('#media').evaluate(element => element.ownerDocument.pictureInPictureElement !== element), value => value === true, '面板进入画中画后应能退出');
          }
        }
        await popup.screenshot(path.join(dir, 'popup-failed.png'));
      } finally { await popup.close().catch(() => {}); }
      if (!Object.values(pipHintText).includes(outcome.note)) throw new Error(`页内失败说明不在面板那几句里：${outcome.note}`);
      if (await inPip(fixture)) throw new Error('核对之后页面不应留在画中画');
      toggled = { entered: false, reason: outcome.note, panel: panelAlert };
      note(`picture-in-picture refused: ${outcome.note}; panel=${panelAlert}`);
    }

    await fixture.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('aria-label', 'Fixture note');
      input.style.position = 'fixed';
      input.style.left = '16px';
      input.style.top = '16px';
      document.body.append(input);
    });
    await fixture.waitForTimeout(1300);
    const field = fixture.getByRole('textbox', { name: 'Fixture note' });
    await field.focus();
    await fixture.keyboard.type('hi');
    await fixture.keyboard.press('KeyP');
    await fixture.waitForTimeout(500);
    if ((await field.inputValue()) !== 'hip') throw new Error(`输入框应收到 P：${await field.inputValue()}`);
    if (await inPip(fixture)) throw new Error('输入框聚焦时不应进入画中画');
    if (pipNote(await notes(fixture))) throw new Error(`输入框聚焦时不应出现画中画说明：${pipNote(await notes(fixture))}`);
    await fixture.screenshot({ path: path.join(dir, 'fixture-typing.png'), animations: 'disabled' });
    note('typing ignores the picture-in-picture key');

    const blocked = async (pathname, shot, expected) => {
      await fixture.goto(`${origin}${pathname}`, { waitUntil: 'domcontentloaded' });
      await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
      await fixture.locator('#media').evaluate(async element => {
        if (element.readyState >= 1) return;
        await Promise.race([
          new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true })),
          new Promise(resolve => setTimeout(resolve, 1_500)),
        ]);
      });
      const popup = await openActionPopup(context, fixture);
      let hint = '';
      try {
        const buttonState = await poll(() => popup.evaluate(pipButtonState), value => Boolean(value?.label), `${pathname} 的弹出面板应有画中画按钮`);
        hint = buttonState.hint;
        if (hint !== expected || buttonState.disabled !== true) throw new Error(`${pathname} 面板说明不对：${JSON.stringify(buttonState)}`);
      } finally { await popup.close().catch(() => {}); }
      await focusFixture();
      await fixture.keyboard.press('KeyP');
      const shown = await poll(async () => pipNote(await notes(fixture)), value => value === expected, `${pathname} 按 P 后应显示和面板相同的说明`);
      if (await inPip(fixture)) throw new Error(`${pathname} 不应进入画中画`);
      await fixture.screenshot({ path: path.join(dir, shot), animations: 'disabled' });
      note(`${pathname} hint=${shown}`);
      return shown;
    };
    const audioHint = await blocked('/audio', 'fixture-audio.png', pipHintText.audio);
    const offHint = picture.enabled && picture.request ? pipHintText.disabled : pipHintText.unsupported;
    const siteHint = await blocked('/pip-off', 'fixture-off.png', offHint);
    const waitingHint = picture.enabled && picture.request ? pipHintText.notReady : pipHintText.unsupported;
    const waiting = await blocked('/unseekable', 'fixture-waiting.png', waitingHint);
    await fixture.waitForTimeout(1300);

    await settings.bringToFront();
    await reset().click();
    await poll(stored, value => value.keybinds?.pip === '' && value.keybinds?.toggle === 'k' && value.keybinds?.mirror === '', '恢复默认后画中画应回到未绑定');
    await keyButton(settings, action).filter({ hasText: 'Not set' }).waitFor({ state: 'visible' });
    if (!await reset().isDisabled()) throw new Error('恢复默认后按钮应禁用');
    await section.screenshot({ path: path.join(dir, 'settings-restored.png'), animations: 'disabled' });
    await focusFixture();
    await fixture.keyboard.press('KeyP');
    await fixture.waitForTimeout(500);
    if (pipNote(await notes(fixture))) throw new Error(`恢复默认后 P 不应再提示：${pipNote(await notes(fixture))}`);
    if (await inPip(fixture)) throw new Error('恢复默认后 P 不应进入画中画');
    if ((await prefsText()) !== '{}') throw new Error(`页内画中画写入了 sitePrefs：${await prefsText()}`);
    const state = {
      ok: true,
      suggested: registered.suggested,
      conflict,
      taken,
      command: commandAfter,
      picture,
      toggled,
      audioHint,
      siteHint,
      waiting,
      sitePrefs: {},
    };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await fixture?.close().catch(() => {});
    await settings?.close().catch(() => {});
  }
}

async function drivePipFeedback(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const prefsText = async () => JSON.stringify((await stored()).sitePrefs ?? {});
  const onCopy = 'Picture-in-picture on';
  const offCopy = 'Picture-in-picture off';
  const dialog = page => page.getByRole('dialog', { name: 'Volume pill' });
  const trigger = page => page.getByRole('button', { name: /volume pill/i });
  const keyButton = (page, action) => page.getByRole('button', { name: new RegExp(`^Change the key for ${action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\. Now `) });
  let settings;
  let fixture;
  let popup = null;
  const focusFixture = async () => {
    await fixture.bringToFront();
    await fixture.mouse.click(12, 12);
  };
  const hint = text => fixture.getByText(text, { exact: true });
  const inPip = () => fixture.locator('#media').evaluate(element => element.isConnected && element.ownerDocument.pictureInPictureElement === element);
  const showHint = async text => {
    const node = hint(text);
    await node.waitFor({ state: 'visible', timeout: 8_000 });
    const pass = await node.evaluate(element => element.className.includes('pointer-events-none') && element.getAttribute('role') === 'status');
    if (!pass) throw new Error(`${text} 不是不挡点击的状态字样`);
    const toast = await node.boundingBox();
    const media = await fixture.locator('#media').boundingBox();
    if (!toast || !media) throw new Error(`${text} 没有位置`);
    const controlsTop = media.y + Math.max(media.height - 48, media.height * 0.75);
    const coversControls = toast.y + toast.height > controlsTop && toast.x < media.x + media.width && toast.x + toast.width > media.x;
    if (coversControls) throw new Error(`${text} 盖住了播放控件：${JSON.stringify({ toast, media })}`);
    return toast;
  };
  const hideHint = async text => {
    await hint(text).waitFor({ state: 'hidden', timeout: 3_000 });
  };
  const alerts = async () => (await fixture.getByRole('alert').allInnerTexts()).map(text => text.trim()).filter(Boolean);
  const expectCopy = async (copy, pip, shot) => {
    const seen = await poll(async () => ({
      copy: await hint(copy).isVisible().catch(() => false),
      pip: await inPip(),
      alert: (await alerts()).find(text => Object.values(pipHintText).includes(text)) || '',
    }), value => value.copy || Boolean(value.alert), `应出现「${copy}」，或已有的失败说明`);
    if (!seen.copy || seen.pip !== pip) throw new Error(`「${copy}」没有和画中画状态一起出现：${JSON.stringify(seen)}`);
    const toast = await showHint(copy);
    await fixture.screenshot({ path: path.join(dir, shot), animations: 'disabled' });
    return toast;
  };
  const restoreKeys = async () => {
    if (!settings || settings.isClosed()) return;
    await settings.bringToFront();
    const reset = settings.getByRole('button', { name: 'Restore default keys', exact: true });
    if (await reset.isDisabled()) return;
    await reset.click();
    await poll(stored, value => value.keybinds?.pip === '' && value.keybinds?.toggle === 'k', '应恢复默认键');
  };
  const place = async () => {
    const box = await trigger(fixture).boundingBox();
    if (!box) throw new Error('浮动入口没有位置');
    return { x: Math.round(box.x), y: Math.round(box.y) };
  };
  const expand = async () => {
    const box = await trigger(fixture).boundingBox();
    if (!box) throw new Error('浮动入口没有位置');
    await fixture.mouse.move(box.x + Math.min(8, box.width / 4), box.y + box.height / 2);
    await trigger(fixture).click();
    await dialog(fixture).waitFor({ state: 'visible', timeout: 5_000 });
  };
  const paint = async page => page.locator('#media').evaluate(async element => {
    if (element.readyState < 1) {
      await Promise.race([
        new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true })),
        new Promise(resolve => setTimeout(resolve, 2_000)),
      ]);
    }
    const describe = pictured => ({
      readyState: element.readyState,
      videoWidth: element.videoWidth,
      enabled: document.pictureInPictureEnabled === true,
      request: typeof element.requestPictureInPicture === 'function',
      disabledBySite: element.disablePictureInPicture === true,
      pictured,
    });
    if (element.videoWidth > 0 || document.pictureInPictureEnabled !== true || typeof element.requestPictureInPicture !== 'function') return describe(element.videoWidth > 0 ? 'native' : 'none');
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 36;
    const context = canvas.getContext('2d');
    if (!context || typeof canvas.captureStream !== 'function') return describe('none');
    context.fillStyle = '#c45c26';
    context.fillRect(0, 0, 64, 36);
    element.srcObject = canvas.captureStream(5);
    element.muted = true;
    try { await element.play(); } catch { /* the click is the gesture */ }
    const deadline = performance.now() + 2_000;
    while (element.videoWidth === 0 && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
    return describe(element.videoWidth > 0 ? 'canvas' : 'none');
  });
  try {
    const registered = await worker.evaluate(async () => {
      const manifest = chrome.runtime.getManifest();
      return { permissions: manifest.permissions ?? [], hostPermissions: manifest.host_permissions ?? [] };
    });
    if (JSON.stringify(registered.permissions) !== JSON.stringify(['storage'])) throw new Error(`权限应仍只有 storage：${JSON.stringify(registered.permissions)}`);
    if (JSON.stringify([...registered.hostPermissions].sort()) !== JSON.stringify(['http://*/*', 'https://*/*'])) throw new Error(`主机权限不应扩大：${JSON.stringify(registered.hostPermissions)}`);
    if ((await prefsText()) !== '{}') throw new Error(`开始时 sitePrefs 不是空的：${await prefsText()}`);

    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
    await settings.locator('#shortcuts').getByRole('heading', { name: 'Keyboard shortcuts' }).waitFor({ state: 'visible', timeout: 15_000 });
    const singleKey = settings.getByRole('switch', { name: 'Single-key mode' });
    if (await singleKey.getAttribute('aria-checked') !== 'false') throw new Error('单键模式应保持关闭');
    await keyButton(settings, 'Enter or exit picture-in-picture').click();
    await settings.getByRole('button', { name: 'Press a key', exact: true }).waitFor({ state: 'visible' });
    await settings.keyboard.press('KeyP');
    await poll(stored, value => value.keybinds?.pip === 'p' && value.singleKey !== true, '应绑上 P，且单键模式仍关');
    note('bound P');

    fixture = await context.newPage();
    await fixture.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await trigger(fixture).waitFor({ state: 'visible', timeout: 15_000 });
    const picture = await paint(fixture);
    note(`video ${JSON.stringify(picture)}`);
    if (!picture.enabled || !picture.request || picture.videoWidth < 1) throw new Error(`夹具视频进不了画中画：${JSON.stringify(picture)}`);
    const originPlace = await place();
    const positionBefore = JSON.stringify((await stored()).floatingPosition ?? null);
    await fixture.screenshot({ path: path.join(dir, 'fixture-before.png'), animations: 'disabled' });
    if (await hint(onCopy).isVisible() || await hint(offCopy).isVisible()) throw new Error('还没切换时不该有画中画字样');

    await expand();
    const enter = dialog(fixture).getByRole('button', { name: 'Picture-in-picture', exact: true });
    if (await enter.isDisabled()) throw new Error(`药丸画中画不可用：${await dialog(fixture).locator('#floating-pip-hint').innerText().catch(() => '')}`);
    await enter.click();
    await expectCopy(onCopy, true, 'toast-float-on.png');
    await dialog(fixture).getByRole('button', { name: 'Exit picture-in-picture', exact: true }).click();
    await expectCopy(offCopy, false, 'toast-float-off.png');
    await hideHint(offCopy);
    note('floating toasts faded');

    popup = await openActionPopup(context, fixture);
    if (!await popup.evaluate(clickLabel('Picture-in-picture'))) throw new Error('面板点不到 Picture-in-picture');
    await expectCopy(onCopy, true, 'toast-panel-on.png');
    if (!await popup.evaluate(clickLabel('Exit picture-in-picture'))) throw new Error('面板点不到 Exit picture-in-picture');
    await expectCopy(offCopy, false, 'toast-panel-off.png');
    await hideHint(offCopy);
    await popup.close();
    popup = null;
    note('panel toasts faded');

    await focusFixture();
    await fixture.keyboard.press('KeyP');
    await expectCopy(onCopy, true, 'toast-key-on.png');
    await focusFixture();
    await fixture.keyboard.press('KeyP');
    await expectCopy(offCopy, false, 'toast-key-off.png');
    await hideHint(offCopy);
    note('page key toasts faded');

    await focusFixture();
    await fixture.evaluate(enabled => {
      const video = document.querySelector('#media');
      if (!(video instanceof HTMLVideoElement)) throw new Error('没有夹具视频');
      video.style.cssText = enabled
        ? 'position:fixed;inset:0;z-index:1;width:100vw;height:100vh;background:#111'
        : '';
    }, true);
    await fixture.keyboard.press('KeyP');
    const fullToast = await expectCopy(onCopy, true, 'toast-fullscreen.png');
    if (fullToast.y > 80) throw new Error(`铺满窗口时提示不在顶部：${fullToast.y}`);
    await focusFixture();
    await fixture.keyboard.press('KeyP');
    await expectCopy(offCopy, false, 'toast-fullscreen-off.png');
    await fixture.evaluate(() => {
      const video = document.querySelector('#media');
      if (video instanceof HTMLVideoElement) video.style.cssText = 'display:block;width:640px;height:360px;margin:48px';
    });
    await hideHint(offCopy);
    note('filled window still shows the hint');

    await fixture.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('aria-label', 'Fixture note');
      input.style.position = 'fixed';
      input.style.left = '720px';
      input.style.top = '420px';
      document.body.append(input);
    });
    const field = fixture.getByRole('textbox', { name: 'Fixture note' });
    await field.focus();
    await fixture.keyboard.press('KeyP');
    await fixture.waitForTimeout(500);
    if (await inPip()) throw new Error('输入框聚焦时不应进入画中画');
    if (await hint(onCopy).isVisible() || await hint(offCopy).isVisible()) throw new Error('输入框聚焦时不应出现画中画字样');
    await fixture.screenshot({ path: path.join(dir, 'fixture-typing.png'), animations: 'disabled' });
    note('typing shows no picture-in-picture hint');

    const blocked = async (pathname, shot, expected) => {
      const page = await context.newPage();
      try {
        await page.goto(`${origin}${pathname}`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
        await page.bringToFront();
        await page.mouse.click(12, 12);
        await page.keyboard.press('KeyP');
        const node = page.getByText(expected, { exact: true });
        await node.waitFor({ state: 'visible', timeout: 8_000 });
        const pass = await node.evaluate(element => element.className.includes('pointer-events-none') && element.getAttribute('role') === 'status');
        if (!pass) throw new Error(`${expected} 不是不挡点击的状态字样`);
        if (await page.getByText(onCopy, { exact: true }).isVisible()) throw new Error(`${pathname} 失败时不该出现进入字样`);
        const pip = await page.locator('#media').evaluate(element => element.ownerDocument.pictureInPictureElement === element);
        if (pip) throw new Error(`${pathname} 不应进入画中画`);
        await page.screenshot({ path: path.join(dir, shot), animations: 'disabled' });
        await node.waitFor({ state: 'hidden', timeout: 3_000 });
        note(`${pathname} hint faded`);
      } finally { await page.close().catch(() => {}); }
    };
    await blocked('/audio', 'toast-audio.png', pipHintText.audio);
    const offHint = picture.enabled && picture.request ? pipHintText.disabled : pipHintText.unsupported;
    await blocked('/pip-off', 'toast-off.png', offHint);

    const endPlace = await place();
    if (endPlace.x !== originPlace.x || endPlace.y !== originPlace.y) throw new Error(`浮动入口挪动了：${JSON.stringify({ originPlace, endPlace })}`);
    if (JSON.stringify((await stored()).floatingPosition ?? null) !== positionBefore) throw new Error('floatingPosition 变了');
    if ((await prefsText()) !== '{}') throw new Error(`画中画写入了 sitePrefs：${await prefsText()}`);
    await restoreKeys();
    const state = { ok: true, picture, paths: { float: true, panel: true, key: true, extensionCommand: 'tests/pip-feedback.test.ts' }, sitePrefs: {} };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await popup?.close().catch(() => {});
    await restoreKeys().catch(() => {});
    await fixture?.close().catch(() => {});
    await settings?.close().catch(() => {});
  }
}

async function drivePipActive(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const permissions = await worker.evaluate(() => chrome.runtime.getManifest().permissions ?? []);
  if (JSON.stringify(permissions) !== JSON.stringify(['storage'])) throw new Error(`权限变了：${JSON.stringify(permissions)}`);
  const active = 'In picture-in-picture';
  const mark = 'PiP';
  const dialog = page => page.getByRole('dialog', { name: 'Volume pill' });
  const trigger = page => page.getByRole('button', { name: /volume pill/i });
  const pipControl = page => dialog(page).getByRole('button', { name: /picture-in-picture$/i });
  const readPill = async page => {
    const button = pipControl(page);
    await button.waitFor({ state: 'visible', timeout: 5_000 });
    return button.evaluate(element => {
      const root = element.getRootNode();
      const status = root.querySelector('#floating-pip-status');
      return {
        label: element.getAttribute('aria-label') ?? '',
        pressed: element.getAttribute('aria-pressed') ?? '',
        describedBy: element.getAttribute('aria-describedby') ?? '',
        disabled: element.disabled === true,
        status: status?.textContent?.trim() ?? '',
      };
    });
  };
  const panelState = `(() => {
    const button = [...document.querySelectorAll('button')].find(item => {
      const label = item.getAttribute('aria-label');
      return label === 'Picture-in-picture' || label === 'Exit picture-in-picture';
    });
    const playback = [...document.querySelectorAll('p')].map(item => item.textContent?.trim() ?? '').find(text => text === 'Video · Playing' || text === 'Video · Paused' || text === 'Audio · Playing' || text === 'Audio · Paused') ?? '';
    return {
      label: button?.getAttribute('aria-label') ?? '',
      pressed: button?.getAttribute('aria-pressed') ?? '',
      describedBy: button?.getAttribute('aria-describedby') ?? '',
      disabled: button?.disabled === true,
      status: document.getElementById('pip-status')?.textContent?.trim() ?? '',
      playback,
      heading: document.querySelector('h1')?.textContent?.trim() ?? '',
      body: document.body.innerText || '',
      rows: [...document.querySelectorAll('[role="menuitemradio"]')].filter(node => !node.hasAttribute('data-filtered')).map(node => (node.textContent || '').replace(/\\s+/g, ' ').trim()),
      list: !!document.getElementById('popup-media'),
    };
  })()`;
  const openList = `(() => {
    if (document.querySelector('[role="menuitemradio"]')) return true;
    const trigger = document.getElementById('popup-media');
    if (!trigger) return false;
    trigger.click();
    return true;
  })()`;
  const choose = async (popup, name) => {
    if (!await popup.evaluate(openList)) throw new Error('没有媒体列表');
    const picked = await popup.evaluate(`(() => {
      const item = [...document.querySelectorAll('[role="menuitemradio"]')].find(node => (node.textContent || '').includes(${JSON.stringify(name)}));
      if (!item) return false;
      item.click();
      return true;
    })()`);
    if (!picked) throw new Error(`没有点到 ${name}`);
  };
  const paint = (page, selector) => page.locator(selector).evaluate(async element => {
    if (!(element instanceof HTMLVideoElement)) return { ok: false, reason: 'not-video' };
    if (element.readyState < 1) {
      await Promise.race([
        new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true })),
        new Promise(resolve => setTimeout(resolve, 2_000)),
      ]);
    }
    if (element.videoWidth > 0) return { ok: true, reason: 'native', videoWidth: element.videoWidth };
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 36;
    const context = canvas.getContext('2d');
    if (!context || typeof canvas.captureStream !== 'function') return { ok: false, reason: 'no-canvas', videoWidth: element.videoWidth };
    context.fillStyle = '#c45c26';
    context.fillRect(0, 0, 64, 36);
    element.srcObject = canvas.captureStream(5);
    element.muted = true;
    try { await element.play(); } catch { /* the button click is still the gesture */ }
    const deadline = performance.now() + 2_000;
    while (element.videoWidth === 0 && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
    return { ok: element.videoWidth > 0, reason: element.videoWidth > 0 ? 'canvas' : 'none', videoWidth: element.videoWidth, enabled: document.pictureInPictureEnabled === true };
  });
  const expand = async page => {
    const box = await trigger(page).boundingBox();
    if (!box) throw new Error('浮动入口没有位置');
    await page.mouse.move(box.x + Math.min(8, box.width / 4), box.y + box.height / 2);
    await trigger(page).click();
    await dialog(page).waitFor({ state: 'visible', timeout: 5_000 });
  };
  const mediaPip = (page, selector) => page.locator(selector).evaluate(element => element.isConnected && element.ownerDocument.pictureInPictureElement === element);
  let popup = null;
  let page = null;
  try {
    const before = await stored();
    page = await context.newPage();
    await page.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await trigger(page).waitFor({ state: 'visible', timeout: 15_000 });
    const picture = await paint(page, '#media');
    note(`video ${JSON.stringify(picture)}`);
    if (!picture.ok) throw new Error(`夹具没有画面，无法进入画中画：${JSON.stringify(picture)}`);
    await expand(page);
    const beforePill = await poll(() => readPill(page), value => value.label === 'Picture-in-picture' && value.status === '' && value.pressed !== 'true', '进入前药丸应是进入态');
    await dialog(page).screenshot({ path: path.join(dir, 'pill-before.png'), animations: 'disabled' });
    popup = await openActionPopup(context, page);
    const beforePanel = await poll(() => popup.evaluate(panelState), value => value.label === 'Picture-in-picture' && value.status === '' && value.list === false, '单视频面板进入前没有短状态，也没有列表');
    await popup.screenshot(path.join(dir, 'popup-before.png'));
    await popup.close();
    popup = null;
    note(`before pill=${beforePill.label} panel=${beforePanel.playback}`);

    await pipControl(page).click();
    const enteredPill = await poll(async () => ({
      pill: await readPill(page),
      pip: await mediaPip(page, '#media'),
      alerts: (await page.getByRole('alert').allInnerTexts()).map(text => text.trim()).filter(Boolean),
    }), value => value.pip === true && value.pill.label === 'Exit picture-in-picture', '药丸应进入画中画并改成退出');
    if (enteredPill.pill.pressed !== 'true' || enteredPill.pill.status !== active || enteredPill.pill.describedBy !== 'floating-pip-status') {
      throw new Error(`药丸退出态不完整：${JSON.stringify(enteredPill)}`);
    }
    await dialog(page).screenshot({ path: path.join(dir, 'pill-entered.png'), animations: 'disabled' });
    popup = await openActionPopup(context, page);
    const enteredPanel = await poll(() => popup.evaluate(panelState), value => value.label === 'Exit picture-in-picture' && value.status === active && (value.playback === 'Video · Playing' || value.playback === 'Video · Paused'), '面板应显示退出和短状态，且不改写播放行');
    if (enteredPanel.pressed !== 'true' || enteredPanel.describedBy !== 'pip-status') throw new Error(`面板退出态不完整：${JSON.stringify(enteredPanel)}`);
    await popup.screenshot(path.join(dir, 'popup-entered.png'));
    await popup.click('Exit picture-in-picture');
    const leftPanel = await poll(() => popup.evaluate(panelState), value => value.label === 'Picture-in-picture' && value.status === '' && value.pressed !== 'true', '面板退出后应恢复进入');
    await popup.screenshot(path.join(dir, 'popup-exited.png'));
    await popup.close();
    popup = null;
    const leftPill = await poll(async () => ({ pill: await readPill(page), pip: await mediaPip(page, '#media') }), value => value.pip === false && value.pill.label === 'Picture-in-picture' && value.pill.status === '' && value.pill.pressed !== 'true', '药丸退出后应恢复进入');
    await dialog(page).screenshot({ path: path.join(dir, 'pill-exited.png'), animations: 'disabled' });
    note(`exited playback=${leftPanel.playback} pill=${leftPill.pill.label}`);
    await page.close();
    page = null;

    page = await context.newPage();
    await page.goto(`${origin}/feed`, { waitUntil: 'domcontentloaded' });
    await trigger(page).waitFor({ state: 'visible', timeout: 15_000 });
    const title = await trigger(page).getAttribute('title') ?? '';
    const selectedName = title.startsWith('Feed preview') ? 'Feed preview' : title.startsWith('Main player') ? 'Main player' : '';
    if (!selectedName) throw new Error(`信息流选中不明：${title}`);
    const selectedSelector = selectedName === 'Feed preview' ? '#preview' : '#media';
    const otherName = selectedName === 'Feed preview' ? 'Main player' : 'Feed preview';
    const painted = await paint(page, selectedSelector);
    note(`feed ${selectedName} ${JSON.stringify(painted)}`);
    if (!painted.ok) throw new Error(`信息流没有画面：${JSON.stringify(painted)}`);
    await poll(async () => (await trigger(page).getAttribute('title')) ?? '', value => value.startsWith(selectedName), '补画面后选中应仍是原来那一条');
    await expand(page);
    await pipControl(page).click();
    await poll(() => mediaPip(page, selectedSelector), value => value === true, '信息流上选中的视频应进入画中画');
    popup = await openActionPopup(context, page);
    if (!await popup.evaluate(openList)) throw new Error('信息流上没有媒体列表');
    const marked = await poll(() => popup.evaluate(panelState), value => {
      const mine = value.rows.find(text => text.includes(selectedName));
      const other = value.rows.find(text => text.includes(otherName));
      return value.rows.length === 2 && value.status === active && value.label === 'Exit picture-in-picture' && Boolean(mine?.includes(mark)) && Boolean(other) && !other.includes(mark);
    }, '列表只给正在画中画的一条标 PiP');
    note(`marked ${marked.rows.join(' | ')}`);
    await choose(popup, otherName);
    const switched = await poll(() => popup.evaluate(panelState), value => value.heading === otherName && value.label === 'Picture-in-picture' && value.status === '' && value.pressed !== 'true', '换选中后面板应回到进入态');
    if (!await popup.evaluate(openList)) throw new Error('换选中后打不开列表');
    const still = await poll(() => popup.evaluate(panelState), value => {
      const mine = value.rows.find(text => text.includes(selectedName));
      const other = value.rows.find(text => text.includes(otherName));
      return value.heading === otherName && Boolean(mine?.includes(mark)) && Boolean(other) && !other.includes(mark) && value.status === '';
    }, '换选中后短标记仍留在原来那一条');
    await popup.screenshot(path.join(dir, 'popup-switched.png'));
    if (await mediaPip(page, selectedSelector) !== true) throw new Error('换选中把画中画退掉了');
    await choose(popup, selectedName);
    await poll(() => popup.evaluate(panelState), value => value.heading === selectedName && value.label === 'Exit picture-in-picture' && value.status === active, '选回画中画那一条应恢复退出态');
    await popup.click('Exit picture-in-picture');
    await poll(async () => ({ panel: await popup.evaluate(panelState), pip: await mediaPip(page, selectedSelector) }), value => value.pip === false && value.panel.status === '' && value.panel.label === 'Picture-in-picture', '选回后退出应清掉短状态');
    if (!await popup.evaluate(openList)) throw new Error('退出后打不开列表');
    const cleared = await poll(() => popup.evaluate(panelState), value => value.rows.length === 2 && value.rows.every(text => !text.includes(mark)), '退出后列表不应再标 PiP');
    note(`cleared ${cleared.rows.join(' | ')} switched=${switched.heading} kept=${still.heading}`);
    await popup.close();
    popup = null;
    await page.close();
    page = null;

    page = await context.newPage();
    await page.goto(`${origin}/audio`, { waitUntil: 'domcontentloaded' });
    await trigger(page).waitFor({ state: 'visible', timeout: 15_000 });
    await expand(page);
    const audioPill = await poll(() => readPill(page), value => value.label === 'Picture-in-picture' && value.disabled === true && value.status === '' && value.pressed !== 'true', '音频药丸不应是画中画中');
    const pillText = await pipControl(page).evaluate(element => element.getRootNode().textContent ?? '');
    if (pillText.includes(active)) throw new Error(`音频药丸出现了短状态：${pillText}`);
    await dialog(page).screenshot({ path: path.join(dir, 'pill-audio.png'), animations: 'disabled' });
    popup = await openActionPopup(context, page);
    const audioPanel = await poll(() => popup.evaluate(panelState), value => value.label === 'Picture-in-picture' && value.disabled === true && value.status === '' && value.playback.startsWith('Audio') && !value.body.includes(active), '音频面板不应出现画中画中');
    await popup.screenshot(path.join(dir, 'popup-audio.png'));
    note(`audio pill disabled=${audioPill.disabled} panel=${audioPanel.playback}`);
    await popup.close();
    popup = null;

    const after = await stored();
    if (after.sitePrefs && Object.keys(after.sitePrefs).length) throw new Error(`画中画状态写入了 sitePrefs：${JSON.stringify(after.sitePrefs)}`);
    if (JSON.stringify(after.floatingPosition ?? null) !== JSON.stringify(before.floatingPosition ?? null)) throw new Error('floatingPosition 变了');
    const state = { ok: true, picture, entered: true, switched: otherName, audio: audioPanel.playback, sitePrefs: {} };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await popup?.close().catch(() => {});
    await page?.close().catch(() => {});
  }
}

async function drive(feature) {
  if (!supportedFeatures.includes(feature)) throw new Error(`用法：drive ${supportedFeatures.join('|')}`);
  const session = await readJson(sessionPath);
  if (!alive(session.pid)) throw new Error('会话没有在跑。先 launch');
  const result = await callSession(session, 'POST', '/drive', { feature });
  console.log(`ottertap-verify drove feature=${result.feature} evidence=${result.evidenceDir}`);
  console.log(JSON.stringify(result.state, null, 2));
}

async function drivePipAwayTab(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const permissions = await worker.evaluate(() => chrome.runtime.getManifest().permissions ?? []);
  if (JSON.stringify(permissions) !== JSON.stringify(['storage'])) throw new Error(`权限应仍只有 storage：${JSON.stringify(permissions)}`);
  const noteText = 'After you switch tabs, use an extension shortcut for picture-in-picture media.';
  const dialog = page => page.getByRole('dialog', { name: 'Volume pill' });
  const trigger = page => page.getByRole('button', { name: /volume pill/i });
  const videoState = () => video.locator('#media').evaluate(element => ({
    pip: element.isConnected && element.ownerDocument.pictureInPictureElement === element,
    paused: element.paused,
    muted: element.muted,
    rate: element.playbackRate,
  }));
  const paint = page => page.locator('#media').evaluate(async element => {
    if (!(element instanceof HTMLVideoElement)) return { ok: false, reason: 'not-video' };
    if (element.readyState < 1) {
      await Promise.race([
        new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true })),
        new Promise(resolve => setTimeout(resolve, 2_000)),
      ]);
    }
    if (element.videoWidth > 0) return { ok: true, reason: 'native', videoWidth: element.videoWidth };
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 36;
    const context = canvas.getContext('2d');
    if (!context || typeof canvas.captureStream !== 'function') return { ok: false, reason: 'no-canvas' };
    context.fillStyle = '#c45c26';
    context.fillRect(0, 0, 64, 36);
    element.srcObject = canvas.captureStream(5);
    element.muted = true;
    try { await element.play(); } catch { /* the pill click is the gesture */ }
    const deadline = performance.now() + 2_000;
    while (element.videoWidth === 0 && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
    return { ok: element.videoWidth > 0, reason: element.videoWidth > 0 ? 'canvas' : 'none', videoWidth: element.videoWidth };
  });
  let settings;
  let video;
  let away;
  try {
    if (JSON.stringify((await stored()).sitePrefs ?? {}) !== '{}') throw new Error('开始时 sitePrefs 不是空的');
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
    const description = settings.locator('#shortcuts p').first();
    await description.waitFor({ state: 'visible', timeout: 15_000 });
    const copy = (await description.innerText()).replace(/\s+/g, ' ').trim();
    if (!copy.includes(noteText)) throw new Error(`快捷键说明没有切走标签后的那一句：${copy}`);
    if (!copy.includes('Extension shortcuts work only while the browser window is focused.')) throw new Error('原来的扩展快捷键说明被换掉了');
    await description.scrollIntoViewIfNeeded();
    await settings.locator('#shortcuts').screenshot({ path: path.join(dir, 'settings-note.png'), animations: 'disabled' });
    note('settings mentions the extension shortcut after leaving the tab');

    video = await context.newPage();
    await video.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await trigger(video).waitFor({ state: 'visible', timeout: 15_000 });
    const picture = await paint(video);
    note(`video ${JSON.stringify(picture)}`);
    if (!picture.ok) throw new Error(`夹具没有画面，无法进入画中画：${JSON.stringify(picture)}`);
    const box = await trigger(video).boundingBox();
    if (!box) throw new Error('浮动入口没有位置');
    await video.mouse.move(box.x + Math.min(8, box.width / 4), box.y + box.height / 2);
    await trigger(video).click();
    await dialog(video).waitFor({ state: 'visible', timeout: 5_000 });
    const enter = dialog(video).getByRole('button', { name: 'Picture-in-picture', exact: true });
    if (await enter.isDisabled()) throw new Error(`药丸画中画不可用：${await dialog(video).locator('#floating-pip-hint').innerText().catch(() => '')}`);
    await enter.click();
    const entered = await poll(videoState, value => value.pip === true && value.paused === false && value.muted === true, '进入画中画后视频应在播且保持静音');
    note(`entered ${JSON.stringify(entered)}`);

    away = await context.newPage();
    await away.goto(`${origin}/audio`, { waitUntil: 'domcontentloaded' });
    await trigger(away).waitFor({ state: 'visible', timeout: 15_000 });
    await away.bringToFront();
    await away.mouse.click(12, 12);
    await away.keyboard.press('Alt+KeyM');
    const audioMuted = await poll(() => away.locator('#media').evaluate(element => element.muted), value => value === true, '页内静音键应作用在眼前的音频');
    const still = await videoState();
    if (!still.pip || still.paused !== false || still.muted !== true || still.rate !== 1) {
      throw new Error(`别的标签上的页内键改到了画中画视频：${JSON.stringify(still)}`);
    }
    await away.screenshot({ path: path.join(dir, 'away-tab.png'), animations: 'disabled' });
    note(`away tab muted audio=${audioMuted}; video ${JSON.stringify(still)}`);

    await video.bringToFront();
    await video.mouse.click(12, 12);
    await video.keyboard.press('Alt+KeyM');
    const unmuted = await poll(videoState, value => value.muted === false && value.pip === true && value.paused === false, '回到视频页后页内静音键应取消这条视频的静音');
    note(`media page key ${JSON.stringify(unmuted)}`);

    await video.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('aria-label', 'Fixture note');
      input.style.position = 'fixed';
      input.style.left = '24px';
      input.style.top = '24px';
      document.body.append(input);
    });
    const field = video.getByRole('textbox', { name: 'Fixture note' });
    await field.focus();
    await video.keyboard.press('Alt+KeyM');
    await video.waitForTimeout(400);
    const typing = await videoState();
    if (typing.muted !== false || typing.pip !== true || typing.paused !== false) {
      throw new Error(`输入框聚焦时页内键仍作用在视频上：${JSON.stringify(typing)}`);
    }
    const typed = await field.inputValue();
    await video.screenshot({ path: path.join(dir, 'typing.png'), animations: 'disabled' });
    note(`typing leaves the video ${JSON.stringify(typing)} field=${JSON.stringify(typed)}`);
    if (JSON.stringify((await stored()).sitePrefs ?? {}) !== '{}') throw new Error(`静音写入了 sitePrefs：${JSON.stringify((await stored()).sitePrefs)}`);
    const state = { ok: true, entered, away: still, onMediaPage: unmuted, typing, sitePrefs: {}, permissions };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await away?.close().catch(() => {});
    await video?.close().catch(() => {});
    await settings?.close().catch(() => {});
  }
}

// Playwright turns on focus emulation for every page it drives, which keeps `document.visibilityState` at `visible`
// even behind another tab. Hiding a tab for real needs a browser reached without those overrides.
async function launchPlainBrowser(note, name = 'pip-auto-hide') {
  const port = await freePort();
  const profile = `${profileDir}-${name}`;
  await rm(profile, { recursive: true, force: true });
  const proc = spawn(chromium.executablePath(), [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-component-extensions-with-background-pages',
    '--window-size=1280,720',
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    '--lang=en-US',
    '--accept-lang=en-US',
    'about:blank',
  ], { stdio: 'ignore' });
  const stop = async () => {
    if (proc.exitCode == null && proc.signalCode == null) {
      proc.kill('SIGTERM');
      await Promise.race([new Promise(resolve => proc.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 4_000))]);
      if (proc.exitCode == null && proc.signalCode == null) proc.kill('SIGKILL');
    }
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  };
  try {
    const deadline = Date.now() + 20_000;
    while (true) {
      try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch { /* not up yet */ }
      if (Date.now() > deadline) throw new Error('没有普通连接的 Chromium 起来');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { noDefaults: true });
    note(`plain browser pid=${proc.pid} port=${port} profile=${profile}`);
    return { browser, context: browser.contexts()[0], stop: async () => { await browser.close().catch(() => {}); await stop(); } };
  } catch (error) {
    await stop();
    throw error;
  }
}

async function drivePipAutoHide(_sessionContext, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const plain = await launchPlainBrowser(note);
  const { context } = plain;
  let other;
  try {
    await context.route(`${origin}/**`, async route => {
      const body = routedHtml(new URL(route.request().url()).pathname);
      if (!body) { await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }); return; }
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers: { 'cache-control': 'no-store' }, body });
    });
    const ours = item => item.url().endsWith('/background.js');
    const worker = context.serviceWorkers().find(ours) ?? await context.waitForEvent('serviceworker', { predicate: ours, timeout: 20_000 });
    const extensionId = new URL(worker.url()).host;
    const uiLanguage = await worker.evaluate(() => chrome.i18n.getUILanguage());
    if (!uiLanguage.toLowerCase().startsWith('en')) throw new Error(`UI 语言是 ${uiLanguage}`);
    const permissions = await worker.evaluate(() => chrome.runtime.getManifest().permissions ?? []);
    if (JSON.stringify(permissions) !== JSON.stringify(['storage'])) throw new Error(`权限变了：${JSON.stringify(permissions)}`);
    const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
    const label = 'Picture-in-picture when you switch tabs';

    const fixture = context.pages()[0] ?? await context.newPage();
    await fixture.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    const cdp = await context.newCDPSession(fixture);
    const { targetInfo } = await cdp.send('Target.getTargetInfo');
    const { targetId: otherId } = await cdp.send('Target.createTarget', { url: `${origin}/silent`, newWindow: false });
    other = otherId;
    await cdp.send('Target.activateTarget', { targetId: targetInfo.targetId });
    // Playwright's own evaluate counts as a user gesture. These reads go through CDP without one,
    // so the click on the page stays the only activation the browser sees.
    const plainEval = async expression => {
      const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (exceptionDetails) throw new Error(exceptionDetails.text);
      return result.value;
    };
    const watch = () => plainEval(`(() => {
      window.__otterVis = [];
      if (!window.__otterVisHooked) {
        window.__otterVisHooked = true;
        document.addEventListener('visibilitychange', () => window.__otterVis.push(document.visibilityState));
      }
    })()`);
    const read = () => plainEval(`(() => ({
      visibility: document.visibilityState,
      gesture: navigator.userActivation.isActive,
      seen: [...(window.__otterVis ?? [])],
      pip: document.pictureInPictureElement?.id ?? '',
      kind: document.querySelector('#media')?.localName ?? '',
      paused: document.querySelector('#media')?.paused ?? null,
      hint: [...document.querySelectorAll('*')].map(node => node.shadowRoot?.textContent ?? '').join(' ').match(/Picture-in-picture (on|off)|blocked picture-in-picture|Couldn't switch picture-in-picture/g) ?? [],
    }))()`);
    const paint = () => fixture.locator('#media').evaluate(async element => {
      if (!(element instanceof HTMLVideoElement)) { await element.play().catch(() => {}); return { ok: !element.paused, kind: element.localName }; }
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 36;
      const drawing = canvas.getContext('2d');
      drawing.fillStyle = '#c45c26';
      drawing.fillRect(0, 0, 64, 36);
      element.srcObject = canvas.captureStream(5);
      element.muted = true;
      await element.play().catch(() => {});
      const deadline = performance.now() + 2_000;
      while (element.videoWidth === 0 && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
      return { ok: !element.paused && element.videoWidth > 0, kind: 'video' };
    });
    // A click on an empty spot of the page is the recent gesture a browser asks for before allowing picture-in-picture.
    const touchPage = () => fixture.mouse.click(8, 8);
    const leaveTab = async () => {
      await watch();
      await cdp.send('Target.activateTarget', { targetId: other });
      await poll(read, value => value.visibility === 'hidden', '切到另一个标签后，夹具页应变成 hidden');
      await new Promise(resolve => setTimeout(resolve, 1_200));
      return read();
    };
    const comeBack = async () => {
      await cdp.send('Target.activateTarget', { targetId: targetInfo.targetId });
      await fixture.bringToFront();
      await poll(read, value => value.visibility === 'visible', '回到夹具页后应为 visible');
    };
    const pill = () => fixture.getByRole('dialog', { name: 'Volume pill' });
    const openPill = async () => {
      if (await pill().isVisible().catch(() => false)) return;
      await fixture.getByRole('button', { name: /volume pill/i }).click();
      await pill().waitFor({ state: 'visible', timeout: 5_000 });
    };
    const pillButton = async name => {
      await openPill();
      const button = pill().getByRole('button', { name, exact: true });
      await button.waitFor({ state: 'visible', timeout: 5_000 });
      return button;
    };

    const settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    const toggle = settings.locator('#playback').getByRole('switch', { name: label });
    await toggle.waitFor({ state: 'visible', timeout: 15_000 });
    if (await toggle.getAttribute('aria-checked') !== 'false') throw new Error('开关默认应为关');
    if ((await stored()).autoPipOnHide === true) throw new Error('存储里默认不应打开');
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-off.png'), animations: 'disabled' });
    note(`settings ${label} defaults off`);

    await comeBack();
    const painted = await paint();
    if (!painted.ok) throw new Error(`夹具视频没有画面或没在播：${JSON.stringify(painted)}`);
    await new Promise(resolve => setTimeout(resolve, 800));
    await touchPage();
    const off = await leaveTab();
    if (!off.seen.includes('hidden') || off.pip) throw new Error(`开关关闭时切走标签不应进入画中画：${JSON.stringify(off)}`);
    await comeBack();
    await fixture.screenshot({ path: path.join(dir, 'fixture-off.png'), animations: 'disabled' });
    note(`off: tab hidden, no picture-in-picture ${JSON.stringify(off)}`);

    await settings.bringToFront();
    await toggle.click();
    await poll(() => toggle.getAttribute('aria-checked'), value => value === 'true', '点击后开关应为开');
    await poll(stored, value => value.autoPipOnHide === true, '存储里应写入 autoPipOnHide: true');
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-on.png'), animations: 'disabled' });
    note('settings switched on, storage autoPipOnHide=true');

    await comeBack();
    if ((await read()).paused !== false) throw new Error('打开开关后夹具视频应仍在播放');
    await touchPage();
    const entered = await leaveTab();
    if (entered.pip !== 'media') throw new Error(`打开后，播放中视频切走标签应进入画中画：${JSON.stringify(entered)}`);
    await comeBack();
    const exitButton = await pillButton('Exit picture-in-picture');
    await pill().screenshot({ path: path.join(dir, 'pill-entered.png'), animations: 'disabled' });
    note(`on: playing video entered picture-in-picture on hide ${JSON.stringify(entered)}`);

    await exitButton.click();
    await poll(read, value => value.pip === '', '从药丸退出后应离开画中画');
    const exitedAt = Date.now();
    await touchPage();
    const cooling = await leaveTab();
    if (cooling.pip) throw new Error(`刚手动退出后的冷却期内不应再进：${JSON.stringify(cooling)}`);
    await comeBack();
    note(`cooldown: left the tab ${Date.now() - exitedAt}ms after exit, stayed out ${JSON.stringify(cooling)}`);

    await new Promise(resolve => setTimeout(resolve, Math.max(0, exitedAt + 10_500 - Date.now())));
    await touchPage();
    const again = await leaveTab();
    if (again.pip !== 'media') throw new Error(`冷却期过后应能再次自动进入：${JSON.stringify(again)}`);
    await comeBack();
    note(`after cooldown: entered again ${JSON.stringify(again)}`);
    await (await pillButton('Exit picture-in-picture')).click();
    await poll(read, value => value.pip === '', '再次退出画中画');
    const secondExit = Date.now();

    await (await pillButton('Pause')).click();
    await poll(read, value => value.paused === true, '药丸暂停后视频应暂停');
    await new Promise(resolve => setTimeout(resolve, Math.max(0, secondExit + 10_500 - Date.now())));
    await touchPage();
    const paused = await leaveTab();
    if (paused.pip) throw new Error(`暂停中不应进入：${JSON.stringify(paused)}`);
    await comeBack();
    await fixture.screenshot({ path: path.join(dir, 'fixture-paused.png'), animations: 'disabled' });
    note(`paused: stayed out ${JSON.stringify(paused)}`);

    await (await pillButton('Play')).click();
    await poll(read, value => value.paused === false, '药丸播放后视频应在播');
    // Let the click's activation run out, so the browser refuses a request made on hide.
    await poll(read, value => value.gesture === false, '点击带来的激活应过期', 10_000);
    await watch();
    await cdp.send('Target.activateTarget', { targetId: other });
    const refused = await poll(read, value => value.visibility === 'hidden' && !value.pip && value.hint.some(item => item.includes('blocked picture-in-picture')) && !value.hint.some(item => item === 'Picture-in-picture on'), '没有近期手势时应出现原来的手势短句，且不显示成功字样', 4_000);
    await comeBack();
    if (await fixture.locator('[role="alert"]').count()) throw new Error('拒绝后页面不应出现警告');
    await fixture.screenshot({ path: path.join(dir, 'fixture-refused.png'), animations: 'disabled' });
    note(`refused without a recent gesture: existing note ${JSON.stringify(refused)}`);
    await touchPage();
    const refusedAgain = await leaveTab();
    if (refusedAgain.pip) throw new Error(`拒绝后的冷却期内再切走不应又进：${JSON.stringify(refusedAgain)}`);
    await comeBack();
    await (await pillButton('Pause')).click();

    await fixture.goto(`${origin}/audio`, { waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    // The shared audio clip is one second long; looping keeps it playing while the tab is hidden.
    await plainEval(`document.querySelector('#media').loop = true`);
    await (await pillButton('Play')).click();
    await poll(read, value => value.kind === 'audio' && value.paused === false, '音频应在播');
    await new Promise(resolve => setTimeout(resolve, 800));
    await touchPage();
    const audio = await leaveTab();
    if (audio.paused !== false) throw new Error(`切走时音频应仍在播：${JSON.stringify(audio)}`);
    if (audio.pip) throw new Error(`音频不应进入画中画：${JSON.stringify(audio)}`);
    await comeBack();
    await fixture.screenshot({ path: path.join(dir, 'fixture-audio.png'), animations: 'disabled' });
    note(`audio: stayed out ${JSON.stringify(audio)}`);

    await worker.evaluate(async () => {
      const key = 'ottertap-settings-v1';
      const current = (await chrome.storage.local.get(key))[key] ?? {};
      await chrome.storage.local.set({ [key]: { ...current, siteMode: 'exclude', sites: ['media.ottertap.test'] } });
    });
    await poll(stored, value => value.siteMode === 'exclude' && (value.sites ?? []).join() === 'media.ottertap.test', '应停用夹具站点');
    await fixture.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await fixture.waitForFunction(() => document.querySelector('#media')?.readyState >= 1, null, { timeout: 8_000 });
    if (!(await paint()).ok) throw new Error('停用站点上的夹具视频没在播');
    await new Promise(resolve => setTimeout(resolve, 800));
    await touchPage();
    const excluded = await leaveTab();
    if (excluded.pip) throw new Error(`停用的网站不应进入：${JSON.stringify(excluded)}`);
    await comeBack();
    await fixture.screenshot({ path: path.join(dir, 'fixture-excluded.png'), animations: 'disabled' });
    note(`site turned off: stayed out ${JSON.stringify(excluded)}`);
    await worker.evaluate(async () => {
      const key = 'ottertap-settings-v1';
      const current = (await chrome.storage.local.get(key))[key] ?? {};
      await chrome.storage.local.set({ [key]: { ...current, siteMode: 'all', sites: [] } });
    });

    await settings.bringToFront();
    await toggle.click();
    await poll(stored, value => value.autoPipOnHide === false && value.siteMode === 'all', '结束时应关掉开关并恢复全部网站');
    const final = await stored();
    if (JSON.stringify(final.sitePrefs ?? {}) !== '{}') throw new Error(`不应写入 sitePrefs：${JSON.stringify(final.sitePrefs)}`);
    note('restored: switch off, all sites, sitePrefs empty');
    const state = { ok: true, off, entered, cooling, again, paused, refused, audio, excluded, sitePrefs: {}, permissions };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await plain.stop();
  }
}

// Scroll-out runs in the plain browser too: the session context's evaluate carries a user gesture,
// which would hide the browser's refusal of a wheel-only scroll.
async function drivePipAutoScroll(_sessionContext, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const plain = await launchPlainBrowser(note, 'pip-auto-scroll');
  const { context } = plain;
  try {
    await context.route(`${origin}/**`, async route => {
      const body = routedHtml(new URL(route.request().url()).pathname);
      if (!body) { await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }); return; }
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers: { 'cache-control': 'no-store' }, body });
    });
    const ours = item => item.url().endsWith('/background.js');
    const worker = context.serviceWorkers().find(ours) ?? await context.waitForEvent('serviceworker', { predicate: ours, timeout: 20_000 });
    const extensionId = new URL(worker.url()).host;
    const uiLanguage = await worker.evaluate(() => chrome.i18n.getUILanguage());
    if (!uiLanguage.toLowerCase().startsWith('en')) throw new Error(`UI 语言是 ${uiLanguage}`);
    const permissions = await worker.evaluate(() => chrome.runtime.getManifest().permissions ?? []);
    if (JSON.stringify(permissions) !== JSON.stringify(['storage'])) throw new Error(`权限变了：${JSON.stringify(permissions)}`);
    const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
    const label = 'Picture-in-picture when the video scrolls out of view';
    const hideLabel = 'Picture-in-picture when you switch tabs';

    const fixture = context.pages()[0] ?? await context.newPage();
    await fixture.goto(`${origin}/feed`, { waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    const cdp = await context.newCDPSession(fixture);
    const evaluate = async (expression, userGesture = false) => {
      const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    };
    await evaluate(`(() => {
      window.__otterEntered = 0;
      document.addEventListener('enterpictureinpicture', () => { window.__otterEntered += 1; }, true);
      document.querySelector('body > div').id = 'spacer';
    })()`);
    const read = () => evaluate(`(() => {
      const main = document.querySelector('#media');
      const preview = document.querySelector('#preview');
      const rect = main.getBoundingClientRect();
      const seen = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0)) * Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
      return {
        scrollY: Math.round(scrollY),
        top: Math.round(rect.top + scrollY),
        share: Math.round(seen / (rect.width * rect.height) * 100) / 100,
        pip: document.pictureInPictureElement?.id ?? '',
        entered: window.__otterEntered,
        gesture: navigator.userActivation.isActive,
        fullscreen: document.fullscreenElement?.id ?? '',
        main: { paused: main.paused, rate: main.playbackRate },
        preview: { paused: preview.paused, rate: preview.playbackRate },
        hint: [...document.querySelectorAll('*')].map(node => node.shadowRoot?.textContent ?? '').join(' ').match(/Picture-in-picture (on|off)|blocked picture-in-picture|Couldn't switch picture-in-picture/g) ?? [],
      };
    })()`);
    const paint = id => evaluate(`(async () => {
      const element = document.getElementById(${JSON.stringify(id)});
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 36;
      const drawing = canvas.getContext('2d');
      drawing.fillStyle = '#c45c26';
      drawing.fillRect(0, 0, 64, 36);
      element.srcObject = canvas.captureStream(5);
      element.muted = true;
      await element.play().catch(() => {});
      const deadline = performance.now() + 2000;
      while (element.videoWidth === 0 && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
      return !element.paused && element.videoWidth > 0;
    })()`);
    const settle = (ms = 600) => new Promise(resolve => setTimeout(resolve, ms));
    // A plain script scroll, like a mouse wheel: it carries no user activation of its own.
    const scrollTo = async y => {
      await evaluate(`window.scrollTo(0, ${y})`);
      await settle();
      return read();
    };
    const away = 1200;
    // A click on the blank left margin is the recent gesture the browser asks for before picture-in-picture.
    const touchPage = () => fixture.mouse.click(8, 8);
    const exitPip = async () => {
      await evaluate('document.exitPictureInPicture()');
      await poll(read, value => value.pip === '', '应离开画中画');
      return Date.now();
    };
    const waitUntil = at => settle(Math.max(0, at - Date.now()));
    const shot = name => fixture.screenshot({ path: path.join(dir, name), animations: 'disabled' });

    const settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    const toggle = settings.locator('#playback').getByRole('switch', { name: label });
    const hideToggle = settings.locator('#playback').getByRole('switch', { name: hideLabel });
    await toggle.waitFor({ state: 'visible', timeout: 15_000 });
    if (await toggle.getAttribute('aria-checked') !== 'false') throw new Error('开关默认应为关');
    if ((await stored()).autoPipOnScroll === true) throw new Error('存储里默认不应打开');
    await toggle.scrollIntoViewIfNeeded();
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-off.png'), animations: 'disabled' });
    note(`settings ${label} defaults off`);

    await fixture.bringToFront();
    if (!await paint('media')) throw new Error('主播放器没有画面或没在播');
    await settle(800);
    const top = await scrollTo(0);
    if (top.share < 0.99) throw new Error(`页顶时主播放器应完整可见：${JSON.stringify(top)}`);
    await touchPage();
    const off = await scrollTo(away);
    await settle(400);
    if (off.share !== 0 || off.pip || off.entered) throw new Error(`开关关闭时滚走主视频不应进入画中画：${JSON.stringify(off)}`);
    await shot('fixture-off.png');
    note(`off: scrolled away, no picture-in-picture ${JSON.stringify(off)}`);
    await scrollTo(0);

    await settings.bringToFront();
    await toggle.click();
    await poll(() => toggle.getAttribute('aria-checked'), value => value === 'true', '点击后开关应为开');
    await poll(stored, value => value.autoPipOnScroll === true, '存储里应写入 autoPipOnScroll: true');
    if ((await stored()).autoPipOnHide === true || await hideToggle.getAttribute('aria-checked') !== 'false') throw new Error('打开滚出开关不应带上切走开关');
    await settings.locator('#playback').screenshot({ path: path.join(dir, 'settings-on.png'), animations: 'disabled' });
    note('settings switched on, storage autoPipOnScroll=true, autoPipOnHide untouched');

    await fixture.bringToFront();
    const armed = await scrollTo(0);
    await touchPage();
    const partial = await scrollTo(armed.top + 252);
    await settle(400);
    if (partial.share < 0.2 || partial.share > 0.4 || partial.pip) throw new Error(`往下滚一点（仍露出约三成）不应进入：${JSON.stringify(partial)}`);
    await shot('fixture-partial.png');
    note(`partial scroll keeps the page: ${JSON.stringify(partial)}`);

    await touchPage();
    await scrollTo(away);
    const entered = await poll(read, value => value.pip === 'media', '滚走播放中的主视频应进入画中画');
    await shot('fixture-entered.png');
    for (const y of [away - 60, away + 40, away - 20]) await scrollTo(y);
    await touchPage();
    await settle(400);
    const jitter = await read();
    if (jitter.entered !== 1 || jitter.pip !== 'media') throw new Error(`滚出后的小幅抖动不应重复进入：${JSON.stringify(jitter)}`);
    note(`on: entered once on scroll-out, jitter kept it at one ${JSON.stringify({ entered, jitter })}`);

    const exitedAt = await exitPip();
    await touchPage();
    await settle(800);
    const closed = await read();
    if (closed.pip) throw new Error(`滚出时关掉画中画后，点击不应马上又进：${JSON.stringify(closed)}`);
    note(`closed while away: stays closed ${JSON.stringify(closed)}`);
    await waitUntil(exitedAt + 10_500);
    await scrollTo(0);
    await touchPage();
    await scrollTo(away);
    const again = await poll(read, value => value.pip === 'media', '滚回来再滚走应能再次进入');
    note(`scrolled back then away: entered again ${JSON.stringify(again)}`);
    const secondExit = await exitPip();

    // Let the click's activation run out, so the scroll alone is refused like a wheel scroll.
    await waitUntil(secondExit + 10_500);
    await scrollTo(0);
    await poll(read, value => value.gesture === false, '点击带来的激活应过期', 10_000);
    await scrollTo(away);
    const quiet = await poll(read, value => !value.pip && value.hint.some(item => item.includes('blocked picture-in-picture')) && !value.hint.includes('Picture-in-picture on'), '拒绝后应出现原来的手势短句，且不显示成功字样', 4_000);
    const refusedAt = Date.now();
    if (await fixture.locator('[role="alert"]').count()) throw new Error('拒绝后页面不应出现警告');
    await shot('fixture-refused.png');
    note(`refused without a recent gesture: existing note ${JSON.stringify(quiet)}`);
    await touchPage();
    await settle(800);
    const held = await read();
    if (held.pip) throw new Error(`失败冷却期内点击不应马上进入：${JSON.stringify(held)}`);
    await waitUntil(refusedAt + 10_500);
    await touchPage();
    const retried = await poll(read, value => value.pip === 'media', '冷却过后点击应再试并进入');
    await shot('fixture-retry.png');
    note(`next click retried: entered ${JSON.stringify(retried)}`);
    const thirdExit = await exitPip();

    await evaluate(`document.querySelector('#media').pause()`);
    await waitUntil(thirdExit + 10_500);
    await scrollTo(0);
    await touchPage();
    await scrollTo(away);
    await settle(400);
    const paused = await read();
    if (paused.pip || paused.main.paused !== true) throw new Error(`暂停中滚走不应进入：${JSON.stringify(paused)}`);
    await shot('fixture-paused.png');
    note(`paused: stayed out ${JSON.stringify(paused)}`);
    await evaluate(`document.querySelector('#media').play()`, true);
    const played = await poll(read, value => value.pip === 'media' && value.main.paused === false, '滚走后开始播放应进入');
    note(`started playing while away: entered ${JSON.stringify(played)}`);
    const fourthExit = await exitPip();

    const selectedName = async () => (await fixture.getByRole('button', { name: /volume pill/i }).getAttribute('title'))?.split(' · ')[0] ?? '';
    if (await selectedName() !== 'Main player') throw new Error(`此前选中的应是主视频：${await selectedName()}`);
    await scrollTo(0);
    if (!await paint('preview')) throw new Error('小卡片没在播');
    const picked = await poll(selectedName, name => name === 'Feed preview', '小卡片开始播放后浮动入口应改到它');
    await waitUntil(fourthExit + 10_500);
    await scrollTo(0);
    await touchPage();
    await scrollTo(away);
    await settle(400);
    const card = await read();
    if (card.pip || card.entered !== 4 || card.main.paused !== false) throw new Error(`选中小卡片时滚走不应进入，未选中的主视频也不应进入：${JSON.stringify(card)}`);
    await shot('fixture-card.png');
    note(`feed card selected: no entry for the card or the unselected main player ${JSON.stringify({ picked, card })}`);
    await evaluate(`document.querySelector('#preview').pause()`);
    await scrollTo(0);
    await evaluate(`(async () => { const main = document.querySelector('#media'); main.pause(); await main.play(); })()`);
    await poll(selectedName, name => name === 'Main player', '主视频重新播放后应回到选中');

    await evaluate(`document.querySelector('#spacer').classList.add('bpx-state-web-fullscreen')`);
    await scrollTo(0);
    await touchPage();
    await scrollTo(away);
    await settle(400);
    const web = await read();
    if (web.pip) throw new Error(`网页全屏标记在时不应进入：${JSON.stringify(web)}`);
    note(`web fullscreen marker: stayed out ${JSON.stringify(web)}`);
    await evaluate(`document.querySelector('#spacer').classList.remove('bpx-state-web-fullscreen')`);
    await touchPage();
    const afterWeb = await poll(read, value => value.pip === 'media', '退出网页全屏后，下一次点击应按规则进入');
    note(`after web fullscreen: entered ${JSON.stringify(afterWeb)}`);
    const fifthExit = await exitPip();

    // Scrolled away while paused, so nothing enters before fullscreen; playback then starts with a gesture inside fullscreen.
    await waitUntil(fifthExit + 10_500);
    await scrollTo(0);
    await evaluate(`document.querySelector('#media').pause()`);
    await scrollTo(away);
    await evaluate(`document.querySelector('#spacer').requestFullscreen()`, true);
    await poll(read, value => value.fullscreen === 'spacer', '应进入 Fullscreen API 全屏');
    await settle(400);
    await evaluate(`document.querySelector('#media').play()`, true);
    await touchPage();
    await settle(800);
    const fullscreen = await read();
    if (fullscreen.pip || fullscreen.main.paused !== false) throw new Error(`全屏中开始播放不应进入：${JSON.stringify(fullscreen)}`);
    await shot('fixture-fullscreen.png');
    note(`fullscreen: playing, stayed out ${JSON.stringify(fullscreen)}`);
    await evaluate('document.exitFullscreen()', true);
    await poll(read, value => value.fullscreen === '', '应退出全屏');
    await settle(400);
    const afterFullscreen = await read();
    if (afterFullscreen.share === 0) {
      await poll(read, value => value.pip === 'media', '退出全屏后主视频仍在视口外，应按规则进入');
    } else {
      // The browser may restore a scroll where the video shows; then the rule applies on the next scroll-out.
      await touchPage();
      await scrollTo(away);
      await poll(read, value => value.pip === 'media', '退出全屏后滚走应按规则进入');
    }
    const resumed = await read();
    await shot('fixture-after-fullscreen.png');
    note(`after fullscreen: entered ${JSON.stringify({ afterFullscreen, resumed })}`);
    await exitPip();
    await scrollTo(0);

    await settings.bringToFront();
    await toggle.click();
    await poll(stored, value => value.autoPipOnScroll === false, '结束时应关掉开关');
    const final = await stored();
    if (final.autoPipOnHide === true) throw new Error('切走开关不应被打开');
    if (JSON.stringify(final.sitePrefs ?? {}) !== '{}') throw new Error(`不应写入 sitePrefs：${JSON.stringify(final.sitePrefs)}`);
    note('restored: switch off, autoPipOnHide off, sitePrefs empty');
    const state = { ok: true, off, partial, entered, jitter, closed, again, refused: quiet, retried, paused, played, picked, card, web, afterWeb, fullscreen, afterFullscreen, resumed, sitePrefs: {}, permissions };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await plain.stop();
  }
}

// Coming back to a tab needs real visibility changes, so this runs in the plain browser like the two entry journeys.
async function drivePipAutoExit(_sessionContext, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const plain = await launchPlainBrowser(note, 'pip-auto-exit');
  const { context } = plain;
  try {
    await context.route(`${origin}/**`, async route => {
      const body = routedHtml(new URL(route.request().url()).pathname);
      if (!body) { await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }); return; }
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers: { 'cache-control': 'no-store' }, body });
    });
    const ours = item => item.url().endsWith('/background.js');
    const worker = context.serviceWorkers().find(ours) ?? await context.waitForEvent('serviceworker', { predicate: ours, timeout: 20_000 });
    const extensionId = new URL(worker.url()).host;
    const uiLanguage = await worker.evaluate(() => chrome.i18n.getUILanguage());
    if (!uiLanguage.toLowerCase().startsWith('en')) throw new Error(`UI 语言是 ${uiLanguage}`);
    const permissions = await worker.evaluate(() => chrome.runtime.getManifest().permissions ?? []);
    if (JSON.stringify(permissions) !== JSON.stringify(['storage'])) throw new Error(`权限变了：${JSON.stringify(permissions)}`);
    const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
    const exitLabel = 'Leave picture-in-picture when you return to the tab or the video';
    const hideLabel = 'Picture-in-picture when you switch tabs';
    const scrollLabel = 'Picture-in-picture when the video scrolls out of view';

    const fixture = context.pages()[0] ?? await context.newPage();
    const cdp = await context.newCDPSession(fixture);
    const { targetInfo } = await cdp.send('Target.getTargetInfo');
    const { targetId: other } = await cdp.send('Target.createTarget', { url: `${origin}/silent`, newWindow: false });
    // Playwright's own evaluate counts as a user gesture; reads go through CDP without one.
    const evaluate = async (expression, userGesture = false) => {
      const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    };
    const open = async pathname => {
      await cdp.send('Target.activateTarget', { targetId: targetInfo.targetId });
      await fixture.bringToFront();
      await fixture.goto(`${origin}${pathname}`, { waitUntil: 'domcontentloaded' });
      await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
      await evaluate(`(() => {
        window.__otterVis = [];
        window.__otterEntered = 0;
        window.__otterLeft = 0;
        document.addEventListener('visibilitychange', () => window.__otterVis.push(document.visibilityState));
        document.addEventListener('enterpictureinpicture', () => { window.__otterEntered += 1; }, true);
        document.addEventListener('leavepictureinpicture', () => { window.__otterLeft += 1; }, true);
      })()`);
    };
    const read = () => evaluate(`(() => {
      const main = document.querySelector('#media');
      const rect = main.getBoundingClientRect();
      const seen = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0)) * Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
      return {
        visibility: document.visibilityState,
        seen: [...window.__otterVis],
        scrollY: Math.round(scrollY),
        top: Math.round(rect.top + scrollY),
        share: Math.round(seen / (rect.width * rect.height) * 100) / 100,
        pip: document.pictureInPictureElement?.id ?? '',
        entered: window.__otterEntered,
        left: window.__otterLeft,
        paused: main.paused,
        hint: [...document.querySelectorAll('*')].map(node => node.shadowRoot?.textContent ?? '').join(' ').match(/Picture-in-picture (on|off)|blocked picture-in-picture|Couldn't switch picture-in-picture/g) ?? [],
      };
    })()`);
    const paint = () => evaluate(`(async () => {
      const element = document.querySelector('#media');
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 36;
      const drawing = canvas.getContext('2d');
      drawing.fillStyle = '#c45c26';
      drawing.fillRect(0, 0, 64, 36);
      element.srcObject = canvas.captureStream(5);
      element.muted = true;
      await element.play().catch(() => {});
      const deadline = performance.now() + 2000;
      while (element.videoWidth === 0 && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
      return !element.paused && element.videoWidth > 0;
    })()`);
    const settle = (ms = 600) => new Promise(resolve => setTimeout(resolve, ms));
    const waitUntil = at => settle(Math.max(0, at - Date.now()));
    const touchPage = () => fixture.mouse.click(8, 8);
    const scrollTo = async y => {
      await evaluate(`window.scrollTo(0, ${y})`);
      await settle();
      return read();
    };
    const leaveTab = async () => {
      await cdp.send('Target.activateTarget', { targetId: other });
      await poll(read, value => value.visibility === 'hidden', '切到另一个标签后，夹具页应变成 hidden');
      await settle(1_200);
      return read();
    };
    const comeBack = async () => {
      await cdp.send('Target.activateTarget', { targetId: targetInfo.targetId });
      await fixture.bringToFront();
      await poll(read, value => value.visibility === 'visible', '回到夹具页后应为 visible');
    };
    const exitPip = async () => {
      await evaluate('document.exitPictureInPicture()');
      await poll(read, value => value.pip === '', '应离开画中画');
      return Date.now();
    };
    const shot = name => fixture.screenshot({ path: path.join(dir, name), animations: 'disabled' });
    const pill = () => fixture.getByRole('dialog', { name: 'Volume pill' });
    const pillButton = async name => {
      if (!await pill().isVisible().catch(() => false)) {
        await fixture.getByRole('button', { name: /volume pill/i }).click();
        await pill().waitFor({ state: 'visible', timeout: 5_000 });
      }
      const button = pill().getByRole('button', { name, exact: true });
      await button.waitFor({ state: 'visible', timeout: 5_000 });
      return button;
    };

    const settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    const playback = settings.locator('#playback');
    const exitToggle = playback.getByRole('switch', { name: exitLabel });
    const hideToggle = playback.getByRole('switch', { name: hideLabel });
    const scrollToggle = playback.getByRole('switch', { name: scrollLabel });
    await exitToggle.waitFor({ state: 'visible', timeout: 15_000 });
    // Leaving the fixture for the settings tab hides it; pausing first keeps the hide switch from entering on the way.
    const flip = async (toggle, want) => {
      await evaluate(`document.querySelector('#media')?.pause()`).catch(() => {});
      await settings.bringToFront();
      if (await toggle.getAttribute('aria-checked') !== String(want)) await toggle.click();
      await poll(() => toggle.getAttribute('aria-checked'), value => value === String(want), `开关应为 ${want}`);
    };
    const resume = async () => {
      await comeBack();
      await evaluate(`document.querySelector('#media').play()`);
      await poll(read, value => value.paused === false, '夹具视频应恢复播放');
    };

    for (const toggle of [exitToggle, hideToggle, scrollToggle]) {
      if (await toggle.getAttribute('aria-checked') !== 'false') throw new Error('三个开关默认都应为关');
    }
    const initial = await stored();
    if (initial.autoPipExitOnReturn === true) throw new Error('存储里默认不应打开自动退出');
    await exitToggle.scrollIntoViewIfNeeded();
    await playback.screenshot({ path: path.join(dir, 'settings-off.png'), animations: 'disabled' });
    note(`settings ${exitLabel} defaults off`);

    // 1. Exit switch off: an automatic entry stays open after coming back.
    await flip(hideToggle, true);
    await poll(stored, value => value.autoPipOnHide === true && value.autoPipExitOnReturn !== true, '只打开切走开关');
    await open('/video');
    if (!await paint()) throw new Error('夹具视频没有画面或没在播');
    await settle(800);
    await touchPage();
    const offEntered = await leaveTab();
    if (offEntered.pip !== 'media') throw new Error(`切走应自动进入：${JSON.stringify(offEntered)}`);
    await comeBack();
    await settle(1_500);
    const offBack = await read();
    if (offBack.pip !== 'media') throw new Error(`自动退出开关关闭时，回来不应退出：${JSON.stringify(offBack)}`);
    await shot('fixture-off.png');
    note(`exit switch off: came back, picture-in-picture stays ${JSON.stringify(offBack)}`);
    let lastExit = await exitPip();

    // 2. Turning the exit switch on leaves the two entry switches as they were.
    await flip(exitToggle, true);
    await poll(stored, value => value.autoPipExitOnReturn === true, '存储里应写入 autoPipExitOnReturn: true');
    const afterOn = await stored();
    if (afterOn.autoPipOnHide !== true || afterOn.autoPipOnScroll === true || await scrollToggle.getAttribute('aria-checked') !== 'false') {
      throw new Error(`打开自动退出不应改动两个进入开关：${JSON.stringify({ hide: afterOn.autoPipOnHide, scroll: afterOn.autoPipOnScroll })}`);
    }
    await exitToggle.scrollIntoViewIfNeeded();
    await playback.screenshot({ path: path.join(dir, 'settings-on.png'), animations: 'disabled' });
    note('settings switched on, storage autoPipExitOnReturn=true, autoPipOnHide stays true, autoPipOnScroll stays off');

    // 3. Hide entry, then come back: it closes on its own.
    await resume();
    await waitUntil(lastExit + 10_500);
    await touchPage();
    const hideEntered = await leaveTab();
    if (hideEntered.pip !== 'media') throw new Error(`切走应自动进入：${JSON.stringify(hideEntered)}`);
    await comeBack();
    const backAt = Date.now();
    const hideReturned = await poll(read, value => value.pip === '', '回到标签后，自动进入的画中画应自动退出', 5_000);
    const closedAfterMs = Date.now() - backAt;
    if (hideReturned.paused !== false) throw new Error(`自动退出后视频应继续播放：${JSON.stringify(hideReturned)}`);
    await shot('fixture-returned.png');
    note(`hide entry: came back, closed after ${closedAfterMs}ms ${JSON.stringify(hideReturned)}`);
    lastExit = Date.now();

    // 4. No flicker: leaving again right after the automatic exit does not reopen.
    await touchPage();
    const cooling = await leaveTab();
    if (cooling.pip) throw new Error(`自动退出后马上再切走不应又进：${JSON.stringify(cooling)}`);
    await comeBack();
    note(`left again ${Date.now() - lastExit}ms after the automatic exit: stayed out ${JSON.stringify(cooling)}`);

    // 5. Manual picture-in-picture is never closed by coming back.
    await (await pillButton('Picture-in-picture')).click();
    await poll(read, value => value.pip === 'media', '从药丸手动进入画中画');
    await touchPage();
    await leaveTab();
    await comeBack();
    await settle(1_500);
    const manual = await read();
    if (manual.pip !== 'media') throw new Error(`手动进入的画中画回来后不应被退出：${JSON.stringify(manual)}`);
    await (await pillButton('Exit picture-in-picture')).waitFor({ state: 'visible' });
    await pill().screenshot({ path: path.join(dir, 'pill-manual.png'), animations: 'disabled' });
    note(`manual entry: came back, still open ${JSON.stringify(manual)}`);
    await (await pillButton('Exit picture-in-picture')).click();
    await poll(read, value => value.pip === '', '从药丸退出画中画');
    lastExit = Date.now();

    // 6. A quick pass through the tab does not close an automatic one.
    await waitUntil(lastExit + 10_500);
    await touchPage();
    const passEntered = await leaveTab();
    if (passEntered.pip !== 'media') throw new Error(`切走应自动进入：${JSON.stringify(passEntered)}`);
    await evaluate('window.__otterVis = []');
    await cdp.send('Target.activateTarget', { targetId: targetInfo.targetId });
    await settle(150);
    await cdp.send('Target.activateTarget', { targetId: other });
    await poll(read, value => value.visibility === 'hidden', '路过后应回到 hidden');
    await settle(1_200);
    const passed = await read();
    if (!passed.seen.includes('visible')) throw new Error(`路过标签时应先变成 visible：${JSON.stringify(passed)}`);
    if (passed.pip !== 'media' || passed.left !== passEntered.left) throw new Error(`快速路过标签不应退出：${JSON.stringify(passed)}`);
    note(`quick pass through the tab kept it open ${JSON.stringify(passed)}`);
    await comeBack();
    await poll(read, value => value.pip === '', '停在标签上后应自动退出', 5_000);
    lastExit = Date.now();
    note('stayed on the tab after the pass: closed');

    // 7. Scroll entry on the feed: a partial scroll back keeps it, scrolling back to the player closes it.
    await flip(hideToggle, false);
    await flip(scrollToggle, true);
    await poll(stored, value => value.autoPipOnScroll === true && value.autoPipOnHide === false && value.autoPipExitOnReturn === true, '改成只开滚出与自动退出');
    await open('/feed');
    if (!await paint()) throw new Error('主播放器没有画面或没在播');
    await settle(800);
    await waitUntil(lastExit + 10_500);
    const away = 1200;
    const top = await scrollTo(0);
    await touchPage();
    await scrollTo(away);
    const scrollEntered = await poll(read, value => value.pip === 'media', '滚走播放中的主视频应进入画中画');
    const partial = await scrollTo(top.top + 252);
    await touchPage();
    await settle(1_200);
    const partialKept = await read();
    if (partialKept.share > 0.45 || partialKept.pip !== 'media') throw new Error(`只露出一点时不应退出：${JSON.stringify(partialKept)}`);
    await shot('fixture-partial.png');
    note(`scroll entry ${JSON.stringify(scrollEntered)}; partial scroll back keeps it ${JSON.stringify({ partial, partialKept })}`);
    await scrollTo(0);
    const scrollReturned = await poll(read, value => value.pip === '', '滚回主视频后应自动退出', 5_000);
    await shot('fixture-scrolled-back.png');
    note(`scrolled back to the player: closed ${JSON.stringify(scrollReturned)}`);
    lastExit = Date.now();
    await touchPage();
    const scrollCooling = await scrollTo(away);
    await settle(400);
    const scrollCooled = await read();
    if (scrollCooled.pip) throw new Error(`自动退出后马上再滚走不应又进：${JSON.stringify(scrollCooled)}`);
    note(`scrolled away right after the automatic exit: stayed out ${JSON.stringify({ scrollCooling, scrollCooled })}`);

    // 8. Back on a visible tab but still scrolled away: stays until the video is back in view.
    await waitUntil(lastExit + 10_500);
    await scrollTo(0);
    await touchPage();
    await scrollTo(away);
    await poll(read, value => value.pip === 'media', '冷却后滚走应再进');
    await leaveTab();
    await comeBack();
    await settle(1_500);
    const awayBack = await read();
    if (awayBack.pip !== 'media' || awayBack.share > 0.1) throw new Error(`回到标签但视频仍在视口外时不应退出：${JSON.stringify(awayBack)}`);
    await shot('fixture-away-tab.png');
    note(`came back to the tab with the video still scrolled away: stays ${JSON.stringify(awayBack)}`);
    await scrollTo(0);
    await poll(read, value => value.pip === '', '滚回视频后应自动退出', 5_000);
    lastExit = Date.now();

    // 9. Exit switch off again: scrolling back keeps the automatic one open.
    await flip(exitToggle, false);
    await poll(stored, value => value.autoPipExitOnReturn === false, '存储里应写回 autoPipExitOnReturn: false');
    await resume();
    await waitUntil(lastExit + 10_500);
    await scrollTo(0);
    await touchPage();
    await scrollTo(away);
    await poll(read, value => value.pip === 'media', '关掉自动退出后滚走仍会进入');
    await scrollTo(0);
    await settle(1_500);
    const switchedOff = await read();
    if (switchedOff.pip !== 'media') throw new Error(`关掉自动退出后滚回来不应退出：${JSON.stringify(switchedOff)}`);
    if (switchedOff.hint.length || await fixture.locator('[role="alert"]').count()) throw new Error(`自动进出不应出现字样或警告：${JSON.stringify(switchedOff.hint)}`);
    await shot('fixture-switch-off.png');
    note(`exit switch off: scrolled back, stays open ${JSON.stringify(switchedOff)}`);
    await exitPip();

    await flip(scrollToggle, false);
    await poll(stored, value => value.autoPipOnScroll === false && value.autoPipOnHide === false && value.autoPipExitOnReturn === false, '结束时三个开关都应关掉');
    const final = await stored();
    if (JSON.stringify(final.sitePrefs ?? {}) !== '{}') throw new Error(`不应写入 sitePrefs：${JSON.stringify(final.sitePrefs)}`);
    note('restored: all three switches off, sitePrefs empty');
    const state = { ok: true, offBack, hideEntered, hideReturned, closedAfterMs, cooling, manual, passed, scrollEntered, partialKept, scrollReturned, scrollCooled, awayBack, switchedOff, sitePrefs: {}, permissions };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await plain.stop();
  }
}

// The excluded-sites list is checked in the plain browser too, so a refused or skipped automatic entry is not masked by a gesture.
async function drivePipAutoExcludedSites(_sessionContext, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const plain = await launchPlainBrowser(note, 'pip-auto-excluded-sites');
  const { context } = plain;
  const otherOrigin = 'https://elsewhere.test';
  try {
    const serve = async route => {
      const body = routedHtml(new URL(route.request().url()).pathname);
      if (!body) { await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }); return; }
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers: { 'cache-control': 'no-store' }, body });
    };
    await context.route(`${origin}/**`, serve);
    await context.route(`${otherOrigin}/**`, serve);
    const ours = item => item.url().endsWith('/background.js');
    const worker = context.serviceWorkers().find(ours) ?? await context.waitForEvent('serviceworker', { predicate: ours, timeout: 20_000 });
    const extensionId = new URL(worker.url()).host;
    const uiLanguage = await worker.evaluate(() => chrome.i18n.getUILanguage());
    if (!uiLanguage.toLowerCase().startsWith('en')) throw new Error(`UI 语言是 ${uiLanguage}`);
    const permissions = await worker.evaluate(() => chrome.runtime.getManifest().permissions ?? []);
    if (JSON.stringify(permissions) !== JSON.stringify(['storage'])) throw new Error(`权限变了：${JSON.stringify(permissions)}`);
    const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
    const hostName = new URL(origin).hostname;
    const listOf = value => JSON.stringify(value?.autoPipExcludedSites ?? []);
    const othersUntouched = value => (value.floatingHiddenSites ?? []).length === 0 && (value.siteMode ?? 'all') === 'all' && (value.sites ?? []).length === 0 && value.floating !== false;
    const heading = 'Sites without automatic picture-in-picture';
    const hereLabel = 'No auto picture-in-picture on this site';
    const removeLabel = `Allow automatic picture-in-picture on ${hostName} again`;

    const fixture = context.pages()[0] ?? await context.newPage();
    const cdp = await context.newCDPSession(fixture);
    const { targetInfo } = await cdp.send('Target.getTargetInfo');
    const { targetId: other } = await cdp.send('Target.createTarget', { url: `${origin}/silent`, newWindow: false });
    // Playwright's own evaluate counts as a user gesture; reads go through CDP without one.
    const evaluate = async expression => {
      const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    };
    const settle = (ms = 600) => new Promise(resolve => setTimeout(resolve, ms));
    const waitUntil = at => settle(Math.max(0, at - Date.now()));
    const comeBack = async () => {
      await cdp.send('Target.activateTarget', { targetId: targetInfo.targetId });
      await fixture.bringToFront();
      await poll(read, value => value.visibility === 'visible', '回到夹具页后应为 visible');
    };
    const open = async url => {
      await comeBack().catch(() => {});
      await fixture.goto(url, { waitUntil: 'domcontentloaded' });
      await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
      await evaluate(`(() => {
        window.__otterEntered = 0;
        window.__otterLeft = 0;
        document.addEventListener('enterpictureinpicture', () => { window.__otterEntered += 1; }, true);
        document.addEventListener('leavepictureinpicture', () => { window.__otterLeft += 1; }, true);
      })()`);
      const painted = await evaluate(`(async () => {
        const element = document.querySelector('#media');
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 36;
        const drawing = canvas.getContext('2d');
        drawing.fillStyle = '#c45c26';
        drawing.fillRect(0, 0, 64, 36);
        element.srcObject = canvas.captureStream(5);
        element.muted = true;
        await element.play().catch(() => {});
        const deadline = performance.now() + 2000;
        while (element.videoWidth === 0 && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
        return !element.paused && element.videoWidth > 0;
      })()`);
      if (!painted) throw new Error(`${url} 的夹具视频没有画面或没在播`);
      await settle(800);
    };
    const read = () => evaluate(`(() => ({
      visibility: document.visibilityState,
      host: location.hostname,
      scrollY: Math.round(scrollY),
      pip: document.pictureInPictureElement?.id ?? '',
      entered: window.__otterEntered ?? 0,
      left: window.__otterLeft ?? 0,
      paused: document.querySelector('#media')?.paused ?? null,
    }))()`);
    const touchPage = () => fixture.mouse.click(8, 8);
    const scrollTo = async y => {
      await evaluate(`window.scrollTo(0, ${y})`);
      await settle();
      return read();
    };
    const leaveTab = async () => {
      await cdp.send('Target.activateTarget', { targetId: other });
      await poll(read, value => value.visibility === 'hidden', '切到另一个标签后，夹具页应变成 hidden');
      await settle(1_200);
      return read();
    };
    const exitPip = async () => {
      await evaluate('document.exitPictureInPicture()');
      await poll(read, value => value.pip === '', '应离开画中画');
      return Date.now();
    };
    const pause = () => evaluate(`document.querySelector('#media')?.pause()`).catch(() => {});
    const shot = name => fixture.screenshot({ path: path.join(dir, name), animations: 'disabled' });
    const pill = () => fixture.getByRole('dialog', { name: 'Volume pill' });
    const pillButton = async name => {
      if (!await pill().isVisible().catch(() => false)) {
        await fixture.getByRole('button', { name: /volume pill/i }).click();
        await pill().waitFor({ state: 'visible', timeout: 5_000 });
      }
      const button = pill().getByRole('button', { name, exact: true });
      await button.waitFor({ state: 'visible', timeout: 5_000 });
      return button;
    };
    const pressed = popup => popup.evaluate(`(() => document.querySelector(${JSON.stringify(`button[aria-label="${hereLabel}"]`)})?.getAttribute('aria-pressed') ?? 'absent')()`);
    const popupToggle = async (name, want) => {
      const popup = await openActionPopup(context, fixture);
      try {
        const before = await pressed(popup);
        if (before !== String(!want)) throw new Error(`弹出面板「${hereLabel}」应为 ${!want}，实际 ${before}`);
        await popup.click(hereLabel);
        await poll(() => pressed(popup), value => value === String(want), `弹出面板「${hereLabel}」应变为 ${want}`);
        await popup.evaluate('new Promise(resolve => setTimeout(resolve, 300))');
        await popup.screenshot(path.join(dir, name));
      } finally { await popup.close(); }
    };

    const settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    const playback = settings.locator('#playback');
    const hideToggle = playback.getByRole('switch', { name: 'Picture-in-picture when you switch tabs' });
    const scrollToggle = playback.getByRole('switch', { name: 'Picture-in-picture when the video scrolls out of view' });
    const exitToggle = playback.getByRole('switch', { name: 'Leave picture-in-picture when you return to the tab or the video' });
    const flip = async (toggle, want) => {
      await pause();
      await settings.bringToFront();
      if (await toggle.getAttribute('aria-checked') !== String(want)) await toggle.click();
      await poll(() => toggle.getAttribute('aria-checked'), value => value === String(want), `开关应为 ${want}`);
    };
    const section = playback.getByRole('heading', { name: heading, exact: true });
    await section.waitFor({ state: 'visible', timeout: 15_000 });
    await playback.getByText('No sites yet. While an automatic switch is on', { exact: false }).waitFor({ state: 'visible' });
    await playback.getByText('separate from Site rules and from Sites without the floating button', { exact: false }).waitFor({ state: 'visible' });
    if (listOf(await stored()) !== '[]') throw new Error('名单默认应为空');
    await section.scrollIntoViewIfNeeded();
    await playback.screenshot({ path: path.join(dir, 'settings-empty.png'), animations: 'disabled' });
    note('settings list empty by default, sits under the three automatic switches');

    // 1. With every automatic switch off, the panel stays as before.
    await open(`${origin}/video`);
    const quiet = await openActionPopup(context, fixture);
    let quietState;
    try {
      quietState = await pressed(quiet);
      if (quietState !== 'absent') throw new Error(`自动开关都关时弹出面板不应出现「${hereLabel}」：${quietState}`);
      await quiet.screenshot(path.join(dir, 'popup-switches-off.png'));
    } finally { await quiet.close(); }
    note('popup: no exclusion button while every automatic switch is off');

    // 2. Baseline with all three switches on: switching away enters, coming back leaves.
    await flip(hideToggle, true);
    await flip(scrollToggle, true);
    await flip(exitToggle, true);
    await poll(stored, value => value.autoPipOnHide === true && value.autoPipOnScroll === true && value.autoPipExitOnReturn === true, '三个自动开关应都打开');
    await open(`${origin}/video`);
    await touchPage();
    const baseline = await leaveTab();
    if (baseline.pip !== 'media') throw new Error(`排除前切走应自动进入：${JSON.stringify(baseline)}`);
    await comeBack();
    await poll(read, value => value.pip === '', '排除前回来应自动退出', 5_000);
    let lastExit = Date.now();
    note(`baseline: hide entered and coming back left ${JSON.stringify(baseline)}`);

    // 3. One click in the panel adds only this host.
    await popupToggle('popup-excluded.png', true);
    const added = await poll(stored, value => listOf(value) === JSON.stringify([hostName]) && othersUntouched(value), `存储里应只多出 autoPipExcludedSites ["${hostName}"]，不动隐藏浮动名单和网站规则`);
    note(`popup added ${listOf(added)}; floatingHiddenSites=${JSON.stringify(added.floatingHiddenSites ?? [])} siteMode=${added.siteMode ?? 'all'} sites=${JSON.stringify(added.sites ?? [])}`);

    // 4. Listed site: no entry on hide.
    await evaluate(`document.querySelector('#media').play()`);
    await waitUntil(lastExit + 10_500);
    await touchPage();
    const beforeHide = await read();
    const hidden = await leaveTab();
    if (hidden.pip || hidden.entered !== beforeHide.entered) throw new Error(`名单里的站点切走不应自动进入：${JSON.stringify(hidden)}`);
    if (hidden.paused !== false) throw new Error(`切走时视频应仍在播：${JSON.stringify(hidden)}`);
    await comeBack();
    await shot('fixture-hide-skipped.png');
    note(`listed: left the tab, stayed out ${JSON.stringify(hidden)}`);

    // 5. Listed site: no entry on scroll-out either.
    await open(`${origin}/feed`);
    await scrollTo(0);
    await touchPage();
    await scrollTo(1200);
    await settle(1_200);
    const scrolled = await read();
    if (scrolled.pip || scrolled.entered) throw new Error(`名单里的站点滚出不应自动进入：${JSON.stringify(scrolled)}`);
    await shot('fixture-scroll-skipped.png');
    note(`listed: scrolled the player away, stayed out ${JSON.stringify(scrolled)}`);
    await scrollTo(0);

    // 6. Manual picture-in-picture still works on a listed site.
    await (await pillButton('Picture-in-picture')).click();
    const manual = await poll(read, value => value.pip === 'media', '名单里的站点仍能从药丸手动进入画中画');
    await (await pillButton('Exit picture-in-picture')).waitFor({ state: 'visible' });
    await pill().screenshot({ path: path.join(dir, 'pill-manual.png'), animations: 'disabled' });
    await (await pillButton('Exit picture-in-picture')).click();
    await poll(read, value => value.pip === '', '名单里的站点仍能从药丸手动退出画中画');
    note(`listed: manual enter and exit from the pill work ${JSON.stringify(manual)}`);

    // 7. Undo, let scroll-out enter, then list the site while it is open: scrolling back no longer closes it.
    await popupToggle('popup-included.png', false);
    await poll(stored, value => listOf(value) === '[]', '弹出面板撤销后名单应为空');
    await open(`${origin}/feed`);
    await waitUntil(lastExit + 10_500);
    await scrollTo(0);
    await touchPage();
    await scrollTo(1200);
    const scrollEntered = await poll(read, value => value.pip === 'media', '移出名单后滚出应能自动进入');
    await popupToggle('popup-excluded-while-open.png', true);
    await poll(stored, value => listOf(value) === JSON.stringify([hostName]), '画中画开着时也能加入名单');
    await scrollTo(0);
    await settle(1_500);
    const kept = await read();
    if (kept.pip !== 'media') throw new Error(`加入名单后滚回来不应自动退出：${JSON.stringify(kept)}`);
    await shot('fixture-exit-skipped.png');
    note(`entered on scroll ${JSON.stringify(scrollEntered)}, listed while open, scrolled back: stays ${JSON.stringify(kept)}`);
    lastExit = await exitPip();

    // 8. Another site is not affected.
    await open(`${otherOrigin}/video`);
    await waitUntil(lastExit + 10_500);
    await touchPage();
    const elsewhere = await leaveTab();
    if (elsewhere.host !== 'elsewhere.test' || elsewhere.pip !== 'media') throw new Error(`别的站点切走仍应自动进入：${JSON.stringify(elsewhere)}`);
    await comeBack();
    const elsewhereBack = await poll(read, value => value.pip === '', '别的站点回来仍应自动退出', 5_000);
    lastExit = Date.now();
    await shot('fixture-elsewhere.png');
    note(`elsewhere.test still enters and leaves on its own ${JSON.stringify({ elsewhere, elsewhereBack })}`);
    await pause();

    // 9. Settings: filter, export, remove, import.
    await settings.bringToFront();
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    const list = playback.locator(`[aria-label="${heading}"]`);
    await list.getByText(hostName, { exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
    const filter = settings.locator('#auto-pip-excluded-filter');
    await filter.fill('nothing-here');
    await settings.locator('#auto-pip-excluded-no-match').waitFor({ state: 'visible', timeout: 3_000 });
    await filter.fill('media.ottertap');
    await list.getByText(hostName, { exact: true }).waitFor({ state: 'visible', timeout: 3_000 });
    if (await settings.locator('[data-current-site-list="floating"]').count()) throw new Error('隐藏浮动名单应仍为空');
    await section.scrollIntoViewIfNeeded();
    await playback.screenshot({ path: path.join(dir, 'settings-listed.png'), animations: 'disabled' });
    note(`settings: list shows ${hostName}, filter by hostname and no-match work`);

    await settings.goto(`chrome-extension://${extensionId}/options.html#backup`, { waitUntil: 'domcontentloaded' });
    // A browser joined over CDP gives Playwright no download events, so the file is saved into a folder and read from there.
    const downloads = path.join(dir, 'downloads');
    await mkdir(downloads, { recursive: true });
    const browserCdp = await plain.browser.newBrowserCDPSession();
    await browserCdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    await settings.getByRole('button', { name: 'Export settings', exact: true }).click();
    const saved = await poll(async () => (await readdir(downloads)).filter(name => name.endsWith('.json')), names => names.length === 1, '导出文件应落到下载目录', 10_000);
    await browserCdp.detach().catch(() => {});
    const exportPath = path.join(dir, 'export.json');
    await rename(path.join(downloads, saved[0]), exportPath);
    await rm(downloads, { recursive: true, force: true });
    const exported = JSON.parse(await readFile(exportPath, 'utf8'));
    if (JSON.stringify(exported.settings?.autoPipExcludedSites) !== JSON.stringify([hostName])) throw new Error(`导出文件应带名单：${JSON.stringify(exported.settings?.autoPipExcludedSites)}`);
    if (JSON.stringify(exported.settings?.floatingHiddenSites) !== '[]') throw new Error(`导出文件里隐藏浮动名单应为空：${JSON.stringify(exported.settings?.floatingHiddenSites)}`);
    note(`export autoPipExcludedSites ${JSON.stringify(exported.settings.autoPipExcludedSites)}`);

    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    await settings.getByRole('button', { name: removeLabel, exact: true }).click();
    await playback.getByText('No sites yet. While an automatic switch is on', { exact: false }).waitFor({ state: 'visible', timeout: 5_000 });
    await poll(stored, value => listOf(value) === '[]', '设置页删除后名单应为空');
    note('settings remove emptied the list');

    await settings.goto(`chrome-extension://${extensionId}/options.html#backup`, { waitUntil: 'domcontentloaded' });
    await settings.locator('#backup input[type="file"]').setInputFiles(exportPath);
    await settings.getByRole('button', { name: 'Replace settings', exact: true }).click();
    const imported = await poll(stored, value => listOf(value) === JSON.stringify([hostName]) && othersUntouched(value), '导入后名单应回来');
    note(`import restored ${listOf(imported)}`);

    // 10. Undo from the panel brings automatic entry back on this site.
    await open(`${origin}/video`);
    await popupToggle('popup-restored.png', false);
    await poll(stored, value => listOf(value) === '[]', '弹出面板撤销后名单应为空');
    await evaluate(`document.querySelector('#media').play()`);
    await waitUntil(lastExit + 10_500);
    await touchPage();
    const restored = await leaveTab();
    if (restored.pip !== 'media') throw new Error(`移出名单后切走应恢复自动进入：${JSON.stringify(restored)}`);
    await comeBack();
    await poll(read, value => value.pip === '', '移出名单后回来应恢复自动退出', 5_000);
    note(`undo: automatic entry and exit are back ${JSON.stringify(restored)}`);

    await flip(hideToggle, false);
    await flip(scrollToggle, false);
    await flip(exitToggle, false);
    const final = await poll(stored, value => value.autoPipOnHide === false && value.autoPipOnScroll === false && value.autoPipExitOnReturn === false && listOf(value) === '[]', '结束时三个开关都应关掉、名单为空');
    if (JSON.stringify(final.sitePrefs ?? {}) !== '{}') throw new Error(`不应写入 sitePrefs：${JSON.stringify(final.sitePrefs)}`);
    const unknown = await unknownStorageKeys(worker);
    if (unknown.length) throw new Error(`出现未登记的存储键：${JSON.stringify(unknown)}`);
    note('restored: three switches off, list empty, sitePrefs empty, no new storage keys');
    const state = { ok: true, host: hostName, quietState, baseline, added: added.autoPipExcludedSites, hidden, scrolled, manual, scrollEntered, kept, elsewhere, exported: exported.settings.autoPipExcludedSites, imported: imported.autoPipExcludedSites, restored, final: final.autoPipExcludedSites ?? [], floatingHiddenSites: final.floatingHiddenSites ?? [], siteMode: final.siteMode ?? 'all', sites: final.sites ?? [], sitePrefs: {}, unknownStorageKeys: unknown, permissions };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await plain.stop();
  }
}

function silentWavBytes(seconds, rate = 8000) {
  const samples = rate * seconds;
  const bytes = Buffer.alloc(44 + samples, 128);
  bytes.write('RIFF', 0, 'ascii');
  bytes.writeUInt32LE(36 + samples, 4);
  bytes.write('WAVE', 8, 'ascii');
  bytes.write('fmt ', 12, 'ascii');
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate, 28);
  bytes.writeUInt16LE(1, 32);
  bytes.writeUInt16LE(8, 34);
  bytes.write('data', 36, 'ascii');
  bytes.writeUInt32LE(samples, 40);
  return bytes;
}

async function driveResumeSave(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const prefix = 'ottertap-resume-v1:';
  const lectureOrigin = 'https://lecture.ottertap.test';
  const lecturePage = `${lectureOrigin}/watch?v=1`;
  const lectureMedia = `src:${lectureOrigin}/media/lecture.wav`;
  const lectureWav = silentWavBytes(300);
  const lectureHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Lecture page</title></head><body style="min-height:100vh;margin:0;background:#f4f1ea"><video id="media" aria-label="Lecture" src="/media/lecture.wav" preload="auto" playsinline controls style="display:block;width:640px;height:360px;margin:48px"></video></body></html>`;
  const serveLecture = async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/watch') {
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers: { 'cache-control': 'no-store' }, body: lectureHtml });
      return;
    }
    if (pathname !== '/media/lecture.wav') { await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }); return; }
    const total = lectureWav.length;
    const range = /^bytes=(\d+)-(\d*)$/.exec((await request.allHeaders()).range ?? '');
    if (!range) {
      await route.fulfill({ status: 200, headers: { 'content-type': 'audio/wav', 'accept-ranges': 'bytes', 'content-length': String(total) }, body: lectureWav });
      return;
    }
    const start = Math.min(Number(range[1]), total - 1);
    const end = range[2] ? Math.min(Number(range[2]), total - 1) : total - 1;
    await route.fulfill({ status: 206, headers: { 'content-type': 'audio/wav', 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${total}`, 'content-length': String(end - start + 1) }, body: lectureWav.subarray(start, end + 1) });
  };
  const ledger = () => worker.evaluate(async prefix => Object.entries(await chrome.storage.local.get(null)).filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key, ...value })), prefix);
  const clearLedger = () => worker.evaluate(async prefix => {
    const keys = Object.keys(await chrome.storage.local.get(null)).filter(key => key.startsWith(prefix));
    if (keys.length) await chrome.storage.local.remove(keys);
  }, prefix);
  const settingsText = () => worker.evaluate(async () => JSON.stringify((await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? null));
  const ready = async (page, selector = '#media') => {
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator(selector).evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
    });
  };
  const play = async page => {
    await page.bringToFront();
    await page.locator('body').click({ position: { x: 8, y: 8 } });
    await page.locator('#media').evaluate(element => element.play());
  };
  const time = page => page.locator('#media').evaluate(element => element.currentTime);
  const permissions = await worker.evaluate(() => chrome.runtime.getManifest().permissions ?? []);
  if (JSON.stringify(permissions) !== JSON.stringify(['storage'])) throw new Error(`权限应仍只有 storage：${JSON.stringify(permissions)}`);
  let lecture;
  let popup;
  let reopened;
  let clip;
  let long;
  let blocked;
  let fresh;
  await context.route(`${lectureOrigin}/**`, serveLecture);
  try {
    await clearLedger();
    const settingsBefore = await settingsText();

    lecture = await context.newPage();
    await lecture.goto(`${lecturePage}#t=5`, { waitUntil: 'domcontentloaded' });
    await ready(lecture);
    const loaded = await lecture.locator('#media').evaluate(element => ({ duration: element.duration, seekableEnd: element.seekable.length ? element.seekable.end(element.seekable.length - 1) : 0, src: element.currentSrc }));
    if (!(Math.abs(loaded.duration - 300) < 1) || !(loaded.seekableEnd > 200)) throw new Error(`讲座夹具应约 300 秒且可 seek：${JSON.stringify(loaded)}`);
    await lecture.locator('#media').evaluate(element => { element.currentTime = 40; });
    await poll(() => time(lecture), value => Math.abs(value - 40) < 0.5, '讲座应停在 40 秒');
    note(`lecture loaded ${JSON.stringify(loaded)}`);

    popup = await openActionPopup(context, lecture);
    await poll(() => popup.view(), value => value.heading === 'Lecture' && value.button === 'Play', '弹出面板应控制 Lecture');
    await popup.click('Play');
    await poll(() => popup.view(), value => value.button === 'Pause' && value.status === 'Video · Playing', '点播放后应在播');
    await lecture.waitForTimeout(3_000);
    const early = await ledger();
    if (early.length) throw new Error(`刚开始播放就写了账本：${JSON.stringify(early)}`);
    note('3s into playback the ledger is still empty');
    const periodic = await poll(ledger, list => list.some(entry => entry.page === lecturePage && entry.media === lectureMedia), '播放约 10 秒后应写入讲座进度', 15_000);
    const first = periodic.find(entry => entry.page === lecturePage);
    if (!(first.time >= 49 && first.time <= 60) || Math.abs(first.duration - 300) > 1) throw new Error(`周期写入的进度不对：${JSON.stringify(first)}`);
    await lecture.screenshot({ path: path.join(dir, 'lecture-playing.png'), animations: 'disabled' });
    note(`periodic save ${JSON.stringify(first)}`);

    await popup.click('Pause');
    await poll(() => popup.view(), value => value.button === 'Play' && value.status === 'Video · Paused', '点暂停后应停下');
    const pausedAt = await time(lecture);
    const paused = await poll(ledger, list => list.some(entry => entry.page === lecturePage && Math.abs(entry.time - pausedAt) < 0.6), '暂停应立刻写入暂停处的进度');
    const pausedEntry = paused.find(entry => entry.page === lecturePage);
    await popup.screenshot(path.join(dir, 'popup-paused.png'));
    note(`pause save ${JSON.stringify(pausedEntry)} pausedAt=${pausedAt}`);
    await popup.close();
    popup = null;
    await lecture.close();
    lecture = null;

    reopened = await context.newPage();
    await reopened.goto(lecturePage, { waitUntil: 'domcontentloaded' });
    await ready(reopened);
    await reopened.waitForTimeout(1_000);
    const afterReopen = await ledger();
    const kept = afterReopen.find(entry => entry.page === lecturePage && entry.media === lectureMedia);
    if (!kept || kept.time !== pausedEntry.time || kept.savedAt !== pausedEntry.savedAt) throw new Error(`关标签再开后账本里应留着原来的进度：${JSON.stringify(afterReopen)}`);
    await writeFile(path.join(dir, 'ledger.json'), `${JSON.stringify(afterReopen, null, 2)}\n`);
    await reopened.screenshot({ path: path.join(dir, 'reopened.png'), animations: 'disabled' });
    note(`reopened tab still has ${kept.key} time=${kept.time}`);

    clip = await context.newPage();
    await clip.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await ready(clip);
    long = await context.newPage();
    await long.goto(`${origin}/long`, { waitUntil: 'domcontentloaded' });
    await ready(long);
    await long.locator('#media').evaluate(element => { element.currentTime = 12; });
    await play(clip);
    await play(long);
    await long.waitForTimeout(11_500);
    const clipDuration = await clip.locator('#media').evaluate(element => element.duration);
    const longDuration = await long.locator('#media').evaluate(element => element.duration);
    await clip.locator('#media').evaluate(element => element.pause());
    await long.locator('#media').evaluate(element => element.pause());
    const longPaused = await time(long);
    const mixed = await poll(ledger, list => list.some(entry => entry.page === `${origin}/long` && Math.abs(entry.time - longPaused) < 0.6), '/long（data 地址、120 秒）应按时长记下', 5_000);
    const longEntry = mixed.find(entry => entry.page === `${origin}/long`);
    if (longEntry.media !== 'dur:120') throw new Error(`data 地址应按整秒时长作媒体标识：${JSON.stringify(longEntry)}`);
    if (mixed.some(entry => entry.page === `${origin}/video`)) throw new Error(`短片写进了账本：${JSON.stringify(mixed)}`);
    await long.screenshot({ path: path.join(dir, 'long-saved.png'), animations: 'disabled' });
    note(`clip duration=${clipDuration} not saved; /long duration=${longDuration} saved ${JSON.stringify(longEntry)}`);

    blocked = await context.newPage();
    await blocked.goto(`${origin}/unseekable`, { waitUntil: 'domcontentloaded' });
    await blocked.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await blocked.locator('body').click({ position: { x: 8, y: 8 } });
    // Without a source the play() promise never settles, so it is not awaited.
    await blocked.locator('#media').evaluate(element => { element.play().catch(() => {}); });
    await blocked.waitForTimeout(400);
    await blocked.locator('#media').evaluate(element => element.pause());
    await blocked.waitForTimeout(800);
    if ((await ledger()).some(entry => entry.page === `${origin}/unseekable`)) throw new Error('不可 seek 的媒体写进了账本');
    note('unseekable not saved');

    await reopened.locator('#media').evaluate(element => { element.currentTime = 285; });
    await play(reopened);
    await reopened.waitForTimeout(600);
    await reopened.locator('#media').evaluate(element => element.pause());
    const finished = await poll(ledger, list => !list.some(entry => entry.page === lecturePage), '看到片尾后应删掉讲座这一条', 5_000);
    note(`near end removed lecture; left ${finished.map(entry => entry.key).join(', ')}`);

    await clearLedger();
    fresh = await context.newPage();
    await fresh.goto(`${origin}/long`, { waitUntil: 'domcontentloaded' });
    await ready(fresh);
    await fresh.waitForTimeout(1_000);
    const cleared = await ledger();
    if (cleared.length) throw new Error(`清掉存储后又冒出旧进度：${JSON.stringify(cleared)}`);
    note('after clearing storage the reopened page has no progress');

    const settingsAfter = await settingsText();
    if (settingsAfter !== settingsBefore) throw new Error(`接着看改写了设置：before=${settingsBefore} after=${settingsAfter}`);
    if (settingsAfter.includes(prefix)) throw new Error('账本键混进了设置');
    const state = { ok: true, permissions, periodic: first, paused: pausedEntry, reopened: kept, long: longEntry, clipDuration, finishedRemoved: true, clearedEmpty: true, settingsSame: true };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await context.unroute(`${lectureOrigin}/**`, serveLecture).catch(() => {});
    await popup?.close().catch(() => {});
    for (const page of [lecture, reopened, clip, long, blocked, fresh]) await page?.close().catch(() => {});
  }
}

const sleepTimerView = `(() => {
  const trigger = document.querySelector('button[aria-label="Sleep timer"]');
  const labels = [...document.querySelectorAll('button')].map(node => node.getAttribute('aria-label') || '');
  return {
    heading: document.querySelector('h1')?.textContent?.trim() ?? '',
    play: labels.find(label => label === 'Play' || label === 'Pause') ?? '',
    present: Boolean(trigger),
    inHeader: Boolean(trigger?.closest('header')),
    panelHeight: Math.round(document.querySelector('[aria-label="Media controls"]')?.getBoundingClientRect().height ?? 0),
    disabled: !trigger || trigger.getAttribute('aria-disabled') === 'true',
    text: trigger?.textContent?.trim() ?? '',
    running: Boolean(trigger?.hasAttribute('data-running')),
    describedBy: trigger?.getAttribute('aria-describedby') ?? '',
    explain: document.querySelector('[data-slot="popover-content"] [data-slot="popover-description"]')?.textContent?.trim() ?? '',
    status: document.querySelector('#sleep-timer-status')?.textContent?.trim() ?? '',
    presets: labels.filter(label => /^Pause in \\d+ minutes$/.test(label)),
    custom: Boolean(document.querySelector('#sleep-timer-custom')),
    scope: document.querySelector('[data-slot="popover-content"]')?.textContent ?? '',
    alert: document.querySelector('[role="alert"]')?.textContent?.trim() ?? '',
  };
})()`;

async function driveSleepTimer(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const permissions = await worker.evaluate(() => chrome.runtime.getManifest().permissions ?? []);
  if (JSON.stringify(permissions) !== JSON.stringify(['storage'])) throw new Error(`权限应仍只有 storage：${JSON.stringify(permissions)}`);
  const settingsText = () => worker.evaluate(async () => JSON.stringify((await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? null));
  const clock = text => text.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  const view = popup => popup.evaluate(sleepTimerView);
  // The popover fades in; a screenshot taken right away shows it half transparent.
  const settled = popup => poll(() => popup.evaluate(`(() => { const node = document.querySelector('[data-slot="popover-content"]'); return !!node && node.getAnimations().every(item => item.playState !== 'running'); })()`), value => value === true, '定时弹层应已展开完');
  const openTimer = async popup => {
    if (!await popup.evaluate(`(() => { const trigger = document.querySelector('button[aria-label="Sleep timer"]'); if (!trigger || trigger.disabled) return false; trigger.click(); return true; })()`)) throw new Error('睡眠定时入口点不开');
    const shown = await poll(() => view(popup), value => value.presets.length === 4 && value.custom, '弹层里应有四个档位和自定义分钟');
    await settled(popup);
    return shown;
  };
  const startCustom = async (popup, minutes) => {
    const started = await popup.evaluate(`(() => {
      const input = document.querySelector('#sleep-timer-custom');
      const submit = input?.form?.querySelector('button[type="submit"]');
      if (!input || !submit) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(String(minutes))});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    if (!started) throw new Error('没有自定义分钟输入框');
    await poll(() => popup.evaluate(`(() => !document.querySelector('#sleep-timer-custom')?.form?.querySelector('button[type="submit"]')?.disabled)()`), value => value === true, `${minutes} 分钟应可开始`);
    await popup.evaluate(`(() => { document.querySelector('#sleep-timer-custom').form.querySelector('button[type="submit"]').click(); })()`);
  };
  const choose = async (popup, name) => {
    if (!await popup.evaluate(`(() => { const trigger = document.getElementById('popup-media'); if (!trigger) return false; trigger.click(); return true; })()`)) throw new Error('没有媒体列表');
    const picked = await poll(() => popup.evaluate(`(() => {
      const item = [...document.querySelectorAll('[role="menuitemradio"]')].find(node => (node.textContent || '').includes(${JSON.stringify(name)}));
      if (!item) return false;
      item.click();
      return true;
    })()`), value => value === true, `应能选中 ${name}`);
    if (!picked) throw new Error(`没有点到 ${name}`);
    await poll(() => view(popup), value => value.heading === name, `面板标题应换成 ${name}`);
  };
  const start = async (page, selector) => {
    await page.locator(selector).evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
      try { await element.play(); }
      catch { element.muted = true; await element.play(); element.muted = false; }
    });
    await poll(() => page.locator(selector).evaluate(element => element.paused), value => value === false, `${selector} 应开始播放`);
  };
  const playing = (page, selector) => page.locator(selector).evaluate(element => ({ paused: element.paused, currentTime: element.currentTime, connected: element.isConnected }));
  let popup = null;
  let silent = null;
  let long = null;
  let feed = null;
  try {
    const settingsBefore = await settingsText();

    silent = await context.newPage();
    await silent.goto(`${origin}/silent`, { waitUntil: 'domcontentloaded' });
    popup = await openActionPopup(context, silent, { empty: true });
    await poll(() => view(popup), value => value.present && value.inHeader && value.disabled && value.status === 'No media to pause on this page.' && value.describedBy === 'sleep-timer-status' && value.text === '' && !value.play, '没有媒体时入口应标为不可用并带短说明');
    await popup.evaluate(`(() => document.querySelector('button[aria-label="Sleep timer"]')?.click())()`);
    const empty = await poll(() => view(popup), value => value.explain === 'No media to pause on this page.', '没有媒体时点入口应说明原因');
    if (empty.presets.length || empty.custom) throw new Error('没有媒体时不该给档位');
    await settled(popup);
    await popup.screenshot(path.join(dir, 'popup-no-media.png'));
    note(`no media: explain=${JSON.stringify(empty.explain)}`);
    await popup.close();
    popup = null;

    long = await context.newPage();
    await long.goto(`${origin}/long`, { waitUntil: 'domcontentloaded' });
    await long.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await long.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
      element.pause();
      element.currentTime = 5;
    });
    popup = await openActionPopup(context, long);
    const idle = await poll(() => view(popup), value => value.heading === 'Long video' && value.present && value.inHeader && !value.disabled && value.text === '' && !value.running && !value.status, '有媒体时入口可用，默认不开');
    if (idle.panelHeight > 600) throw new Error(`单媒体面板高度 ${idle.panelHeight}px 超过弹出窗口上限 600px`);
    await popup.screenshot(path.join(dir, 'popup-off.png'));
    await popup.click('Play');
    await poll(() => playing(long, '#media'), value => !value.paused, '/long 应开始播放');
    const menu = await openTimer(popup);
    if (JSON.stringify(menu.presets) !== JSON.stringify(['Pause in 15 minutes', 'Pause in 30 minutes', 'Pause in 45 minutes', 'Pause in 60 minutes'])) throw new Error(`档位不对：${JSON.stringify(menu.presets)}`);
    if (!menu.scope.includes('Pauses only the media OtterTap controls in this tab.')) throw new Error(`弹层没写清只停当前这条：${menu.scope}`);
    await popup.screenshot(path.join(dir, 'popup-presets.png'));
    note(`idle inHeader=${idle.inHeader} panelHeight=${idle.panelHeight} presets=${menu.presets.join(' / ')}`);

    await popup.click('Pause in 15 minutes');
    const fifteen = await poll(() => view(popup), value => value.running && value.presets.length === 0 && clock(value.text) > 14 * 60 && clock(value.text) <= 15 * 60 && value.status === `Sleep left ${value.text}` && !value.alert, '选 15 分钟后弹层收起并显示倒计时');
    await popup.screenshot(path.join(dir, 'popup-15.png'));
    note(`15 min countdown=${fifteen.text}`);

    await openTimer(popup);
    await startCustom(popup, 1);
    const custom = await poll(() => view(popup), value => value.running && value.presets.length === 0 && clock(value.text) > 45 && clock(value.text) <= 60 && !value.alert, '自定义 1 分钟替换原来的 15 分钟');
    const armedAt = Date.now();
    await popup.screenshot(path.join(dir, 'popup-custom.png'));
    note(`custom 1 min countdown=${custom.text}`);
    await popup.close();
    popup = null;

    feed = await context.newPage();
    await feed.goto(`${origin}/feed`, { waitUntil: 'domcontentloaded' });
    await feed.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await start(feed, '#preview');
    await start(feed, '#media');
    popup = await openActionPopup(context, feed);
    await choose(popup, 'Feed preview');
    await openTimer(popup);
    await startCustom(popup, 1);
    await poll(() => view(popup), value => value.running && clock(value.text) > 45 && clock(value.text) <= 60, 'feed 上的定时开始');
    const feedArmedAt = Date.now();
    await choose(popup, 'Main player');
    await feed.waitForTimeout(600);
    const switched = { preview: await playing(feed, '#preview'), main: await playing(feed, '#media') };
    if (switched.preview.paused || switched.main.paused) throw new Error(`换目标时不应立刻暂停：${JSON.stringify(switched)}`);
    const feedView = await view(popup);
    if (!feedView.running) throw new Error(`换目标后倒计时不该消失：${JSON.stringify(feedView)}`);
    await popup.screenshot(path.join(dir, 'feed-switched.png'));
    note(`feed armed, switched to Main player; countdown=${feedView.text}`);
    await popup.close();
    popup = null;

    popup = await openActionPopup(context, long);
    const reopened = await poll(() => view(popup), value => value.heading === 'Long video' && value.running && clock(value.text) < clock(custom.text) && clock(value.text) > 0, '关掉面板再打开，倒计时仍在并继续走');
    const midway = await playing(long, '#media');
    if (midway.paused) throw new Error('定时还没到 /long 就停了');
    await popup.screenshot(path.join(dir, 'popup-reopened.png'));
    note(`reopened countdown=${reopened.text} time=${midway.currentTime.toFixed(1)}`);
    await popup.close();
    popup = null;

    const stopped = await poll(() => playing(long, '#media'), value => value.paused, '1 分钟到期后 /long 应暂停', Math.max(10_000, armedAt + 75_000 - Date.now()));
    const elapsed = (Date.now() - armedAt) / 1000;
    if (elapsed < 55) throw new Error(`到期太早：${elapsed.toFixed(1)} 秒`);
    if (!(stopped.currentTime > midway.currentTime) || !stopped.connected) throw new Error(`暂停后进度应保留在原处：${JSON.stringify({ midway, stopped })}`);
    await long.waitForTimeout(1_500);
    const held = await playing(long, '#media');
    if (!held.paused || Math.abs(held.currentTime - stopped.currentTime) > 0.05) throw new Error(`暂停后进度变了：${JSON.stringify({ stopped, held })}`);
    if (long.isClosed()) throw new Error('到期关掉了标签');
    note(`long paused after ${elapsed.toFixed(1)}s at ${stopped.currentTime.toFixed(1)}s`);

    const feedStopped = await poll(async () => ({ preview: await playing(feed, '#preview'), main: await playing(feed, '#media') }), value => value.main.paused, 'feed 到期应暂停当前选中的 Main player', Math.max(10_000, feedArmedAt + 75_000 - Date.now()));
    if (feedStopped.preview.paused) throw new Error(`feed 到期误停了原来那条 Feed preview：${JSON.stringify(feedStopped)}`);
    note(`feed: main paused=${feedStopped.main.paused} preview paused=${feedStopped.preview.paused}`);

    popup = await openActionPopup(context, long);
    const expired = await poll(() => view(popup), value => value.heading === 'Long video' && value.play === 'Play' && value.text === '' && !value.running && !value.status && !value.alert, '到期后面板回到未定时，媒体是暂停');
    await popup.screenshot(path.join(dir, 'popup-expired.png'));
    await long.screenshot({ path: path.join(dir, 'fixture-paused.png') });
    await popup.close();
    popup = null;

    const settingsAfter = await settingsText();
    if (settingsAfter !== settingsBefore) throw new Error(`睡眠定时改写了设置：before=${settingsBefore} after=${settingsAfter}`);
    const unknownKeys = await unknownStorageKeys(worker);
    if (unknownKeys.length) throw new Error(`扩展存储里出现了名单外的键（睡眠倒计时不应写入存储）：${unknownKeys.join(', ')}`);
    const state = { ok: true, permissions, noMedia: empty.explain, panelHeight: idle.panelHeight, presets: menu.presets, fifteen: fifteen.text, custom: custom.text, reopened: reopened.text, pausedAfterSeconds: Number(elapsed.toFixed(1)), pausedAt: Number(stopped.currentTime.toFixed(2)), feedMainPaused: feedStopped.main.paused, feedPreviewPlaying: !feedStopped.preview.paused, expiredRunning: expired.running, settingsSame: true };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await popup?.close().catch(() => {});
    for (const page of [silent, long, feed]) await page?.close().catch(() => {});
  }
}

const sleepCancelView = `(() => {
  const trigger = document.querySelector('button[aria-label="Sleep timer"]');
  const labels = [...document.querySelectorAll('button')].map(node => node.getAttribute('aria-label') || '');
  return {
    heading: document.querySelector('h1')?.textContent?.trim() ?? '',
    play: labels.find(label => label === 'Play' || label === 'Pause') ?? '',
    text: trigger?.textContent?.trim() ?? '',
    running: Boolean(trigger?.hasAttribute('data-running')),
    status: document.querySelector('#sleep-timer-status')?.textContent?.trim() ?? '',
    feedback: document.querySelector('#sleep-timer-feedback')?.textContent?.trim() ?? '',
    presets: labels.filter(label => /^Pause in \\d+ minutes$/.test(label)),
    custom: Boolean(document.querySelector('#sleep-timer-custom')),
    cancel: labels.includes('Cancel sleep'),
    extend: labels.includes('Add 15 minutes'),
    alert: document.querySelector('[role="alert"]')?.textContent?.trim() ?? '',
  };
})()`;

async function driveSleepTimerCancel(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const permissions = await worker.evaluate(() => chrome.runtime.getManifest().permissions ?? []);
  if (JSON.stringify(permissions) !== JSON.stringify(['storage'])) throw new Error(`权限应仍只有 storage：${JSON.stringify(permissions)}`);
  const settingsText = () => worker.evaluate(async () => JSON.stringify((await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? null));
  const clock = text => text.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  const view = popup => popup.evaluate(sleepCancelView);
  const settled = popup => poll(() => popup.evaluate(`(() => { const node = document.querySelector('[data-slot="popover-content"]'); return !!node && node.getAnimations().every(item => item.playState !== 'running'); })()`), value => value === true, '定时弹层应已展开完');
  const openTimer = async popup => {
    if (!await popup.evaluate(`(() => { const trigger = document.querySelector('button[aria-label="Sleep timer"]'); if (!trigger || trigger.disabled) return false; trigger.click(); return true; })()`)) throw new Error('睡眠定时入口点不开');
    const shown = await poll(() => view(popup), value => value.presets.length === 4 && value.custom, '弹层里应有四个档位和自定义分钟');
    await settled(popup);
    return shown;
  };
  const startCustom = async (popup, minutes) => {
    const started = await popup.evaluate(`(() => {
      const input = document.querySelector('#sleep-timer-custom');
      const submit = input?.form?.querySelector('button[type="submit"]');
      if (!input || !submit) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(String(minutes))});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    if (!started) throw new Error('没有自定义分钟输入框');
    await poll(() => popup.evaluate(`(() => !document.querySelector('#sleep-timer-custom')?.form?.querySelector('button[type="submit"]')?.disabled)()`), value => value === true, `${minutes} 分钟应可开始`);
    await popup.evaluate(`(() => { document.querySelector('#sleep-timer-custom').form.querySelector('button[type="submit"]').click(); })()`);
  };
  const choose = async (popup, name) => {
    if (!await popup.evaluate(`(() => { const trigger = document.getElementById('popup-media'); if (!trigger) return false; trigger.click(); return true; })()`)) throw new Error('没有媒体列表');
    const picked = await poll(() => popup.evaluate(`(() => {
      const item = [...document.querySelectorAll('[role="menuitemradio"]')].find(node => (node.textContent || '').includes(${JSON.stringify(name)}));
      if (!item) return false;
      item.click();
      return true;
    })()`), value => value === true, `应能选中 ${name}`);
    if (!picked) throw new Error(`没有点到 ${name}`);
    await poll(() => view(popup), value => value.heading === name, `面板标题应换成 ${name}`);
  };
  const start = async (page, selector) => {
    await page.locator(selector).evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
      try { await element.play(); }
      catch { element.muted = true; await element.play(); element.muted = false; }
    });
    await poll(() => page.locator(selector).evaluate(element => element.paused), value => value === false, `${selector} 应开始播放`);
  };
  const playing = (page, selector) => page.locator(selector).evaluate(element => ({ paused: element.paused, currentTime: element.currentTime, connected: element.isConnected }));
  let popup = null;
  let long = null;
  let feed = null;
  try {
    const settingsBefore = await settingsText();
    long = await context.newPage();
    await long.goto(`${origin}/long`, { waitUntil: 'domcontentloaded' });
    await long.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    popup = await openActionPopup(context, long);
    await popup.click('Play');
    await poll(() => playing(long, '#media'), value => !value.paused, '/long 应开始播放');
    await openTimer(popup);
    const idle = await view(popup);
    if (idle.cancel || idle.extend) throw new Error('没开定时时不该出现取消或续时');
    await startCustom(popup, 1);
    const armed = await poll(() => view(popup), value => value.running && value.presets.length === 0 && clock(value.text) > 45 && clock(value.text) <= 60, '自定义 1 分钟后应显示倒计时');
    note(`armed countdown=${armed.text}`);
    await openTimer(popup);
    const actions = await poll(() => view(popup), value => value.running && value.cancel && value.extend && value.presets.length === 4, '进行中应能取消和再续 15 分钟');
    await popup.screenshot(path.join(dir, 'popup-running.png'));
    const before = clock((await view(popup)).text);
    await popup.click('Add 15 minutes');
    const extended = await poll(() => view(popup), value => {
      const left = clock(value.text);
      return value.running && value.feedback === 'Added 15 minutes.' && value.status.includes('Added 15 minutes.') && value.status.includes(`Sleep left ${value.text}`) && left >= before + 15 * 60 - 10 && left <= before + 15 * 60 + 2;
    }, '续时应正好加 15 分钟，并写明已加上');
    if (extended.alert) throw new Error(`续时出现了失败说明：${extended.alert}`);
    const midway = await playing(long, '#media');
    if (midway.paused) throw new Error('续时不应暂停');
    await settled(popup);
    await popup.screenshot(path.join(dir, 'popup-extended.png'));
    note(`extended ${actions.text} -> ${extended.text} feedback=${extended.feedback}`);
    await popup.click('Cancel sleep');
    const cancelled = await poll(() => view(popup), value => !value.running && value.text === '' && value.feedback === 'Sleep cancelled. Playback is unchanged.' && value.status === 'Sleep cancelled. Playback is unchanged.' && value.presets.length === 4 && !value.cancel && !value.extend, '取消后倒计时消失，档位还在');
    if (cancelled.alert) throw new Error(`取消出现了失败说明：${cancelled.alert}`);
    const afterCancel = await playing(long, '#media');
    if (afterCancel.paused || !(afterCancel.currentTime >= midway.currentTime)) throw new Error(`取消不应暂停：${JSON.stringify({ midway, afterCancel })}`);
    await settled(popup);
    await popup.screenshot(path.join(dir, 'popup-cancelled.png'));
    note(`cancelled feedback=${cancelled.feedback}`);
    await popup.close();
    popup = null;
    popup = await openActionPopup(context, long);
    const reopened = await poll(() => view(popup), value => value.heading === 'Long video' && !value.running && value.text === '' && !value.feedback && value.play === 'Pause', '关掉再打开，已取消的定时不应还在');
    await popup.screenshot(path.join(dir, 'popup-reopened.png'));
    note(`reopened running=${reopened.running}`);

    await openTimer(popup);
    await startCustom(popup, 1);
    const rearmed = await poll(() => view(popup), value => value.running && clock(value.text) > 45 && clock(value.text) <= 60 && !value.feedback.includes('cancelled'), '误触取消后可以再设 1 分钟');
    const armedAt = Date.now();
    await popup.screenshot(path.join(dir, 'popup-rearmed.png'));
    note(`rearmed countdown=${rearmed.text}`);
    await openTimer(popup);
    await popup.click('Cancel sleep');
    await poll(() => view(popup), value => !value.running && value.feedback === 'Sleep cancelled. Playback is unchanged.', '再设之后仍能取消');
    await popup.close();
    popup = null;

    feed = await context.newPage();
    await feed.goto(`${origin}/feed`, { waitUntil: 'domcontentloaded' });
    await feed.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await start(feed, '#preview');
    await start(feed, '#media');
    popup = await openActionPopup(context, feed);
    await choose(popup, 'Feed preview');
    await openTimer(popup);
    await startCustom(popup, 1);
    await poll(() => view(popup), value => value.running && clock(value.text) > 45 && clock(value.text) <= 60, 'feed 上的定时开始');
    await choose(popup, 'Main player');
    await feed.waitForTimeout(600);
    const switched = { preview: await playing(feed, '#preview'), main: await playing(feed, '#media'), panel: await view(popup) };
    if (switched.preview.paused || switched.main.paused) throw new Error(`换目标时不应立刻暂停：${JSON.stringify(switched)}`);
    if (!switched.panel.running) throw new Error(`换目标后倒计时不该消失：${JSON.stringify(switched.panel)}`);
    await popup.screenshot(path.join(dir, 'feed-switched.png'));
    note(`feed switched to Main player; countdown=${switched.panel.text}`);
    await openTimer(popup);
    await popup.click('Cancel sleep');
    await poll(() => view(popup), value => !value.running && value.feedback === 'Sleep cancelled. Playback is unchanged.', '换目标后取消应清掉倒计时');
    await feed.waitForTimeout(400);
    const feedAfter = { preview: await playing(feed, '#preview'), main: await playing(feed, '#media') };
    if (feedAfter.preview.paused || feedAfter.main.paused) throw new Error(`取消不应停掉任何一条：${JSON.stringify(feedAfter)}`);
    await popup.screenshot(path.join(dir, 'feed-cancelled.png'));
    await popup.close();
    popup = null;

    await long.bringToFront();
    await long.locator('#media').evaluate(element => { element.currentTime = 5; });
    const marked = await poll(() => playing(long, '#media'), value => !value.paused && value.currentTime < 30, '取消之后 /long 应仍在播放');
    const held = await poll(() => playing(long, '#media'), value => !value.paused && value.connected && value.currentTime > marked.currentTime + 20 && Date.now() >= armedAt + 65_000, '取消后原来的 1 分钟到点也不应暂停', Math.max(10_000, armedAt + 90_000 - Date.now()));
    const elapsed = (Date.now() - armedAt) / 1000;
    if (elapsed < 65) throw new Error(`还没等到原来的截止时间：${elapsed.toFixed(1)} 秒`);
    if (long.isClosed()) throw new Error('到点关掉了标签');
    await long.screenshot({ path: path.join(dir, 'fixture-still-playing.png') });
    note(`still playing after ${elapsed.toFixed(1)}s at ${held.currentTime.toFixed(1)}s`);

    const settingsAfter = await settingsText();
    if (settingsAfter !== settingsBefore) throw new Error(`取消或续时改写了设置：before=${settingsBefore} after=${settingsAfter}`);
    const unknownKeys = await unknownStorageKeys(worker);
    if (unknownKeys.length) throw new Error(`扩展存储里出现了名单外的键（睡眠倒计时不应写入存储）：${unknownKeys.join(', ')}`);
    const state = {
      ok: true,
      permissions,
      before: actions.text,
      extended: extended.text,
      addedSeconds: clock(extended.text) - before,
      cancelled: cancelled.feedback,
      reopenedRunning: reopened.running,
      rearmed: rearmed.text,
      feedPreviewPlaying: !feedAfter.preview.paused,
      feedMainPlaying: !feedAfter.main.paused,
      stillPlaying: !held.paused,
      waitedSeconds: Number(elapsed.toFixed(1)),
      settingsSame: true,
    };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await popup?.close().catch(() => {});
    for (const page of [long, feed]) await page?.close().catch(() => {});
  }
}

async function driveSleepTimerHints(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const permissions = await worker.evaluate(() => chrome.runtime.getManifest().permissions ?? []);
  if (JSON.stringify(permissions) !== JSON.stringify(['storage'])) throw new Error(`权限应仍只有 storage：${JSON.stringify(permissions)}`);
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? null);
  const clock = text => text.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  const view = popup => popup.evaluate(`(() => {
    const trigger = document.querySelector('button[aria-label="Sleep timer"]');
    const labels = [...document.querySelectorAll('button')].map(node => node.getAttribute('aria-label') || '');
    return {
      text: trigger?.textContent?.trim() ?? '',
      running: Boolean(trigger?.hasAttribute('data-running')),
      presets: labels.filter(label => /^Pause in \\d+ minutes$/.test(label)),
      custom: Boolean(document.querySelector('#sleep-timer-custom')),
      play: labels.find(label => label === 'Play' || label === 'Pause') ?? '',
    };
  })()`);
  const openTimer = async popup => {
    if (!await popup.evaluate(`(() => { const trigger = document.querySelector('button[aria-label="Sleep timer"]'); if (!trigger || trigger.disabled) return false; trigger.click(); return true; })()`)) throw new Error('睡眠定时入口点不开');
    await poll(() => view(popup), value => value.presets.length === 4 && value.custom, '弹层里应有四个档位和自定义分钟');
  };
  const startCustom = async (popup, minutes) => {
    const started = await popup.evaluate(`(() => {
      const input = document.querySelector('#sleep-timer-custom');
      const submit = input?.form?.querySelector('button[type="submit"]');
      if (!input || !submit) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(String(minutes))});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    if (!started) throw new Error('没有自定义分钟输入框');
    await poll(() => popup.evaluate(`(() => !document.querySelector('#sleep-timer-custom')?.form?.querySelector('button[type="submit"]')?.disabled)()`), value => value === true, `${minutes} 分钟应可开始`);
    await popup.evaluate(`(() => { document.querySelector('#sleep-timer-custom').form.querySelector('button[type="submit"]').click(); })()`);
  };
  const playing = () => long.locator('#media').evaluate(element => ({ paused: element.paused, currentTime: element.currentTime, connected: element.isConnected }));
  const hint = text => long.getByText(text, { exact: true });
  const showHint = async (text, shot, timeout = 8_000) => {
    const node = hint(text);
    await node.waitFor({ state: 'visible', timeout });
    const pass = await node.evaluate(element => element.className.includes('pointer-events-none') && element.getAttribute('role') === 'status');
    if (!pass) throw new Error(`${text} 不是不挡点击的状态字样`);
    const toast = await node.boundingBox();
    const media = await long.locator('#media').boundingBox();
    if (!toast || !media) throw new Error(`${text} 没有位置`);
    const controlsTop = media.y + Math.max(media.height - 48, media.height * 0.75);
    const coversControls = toast.y + toast.height > controlsTop && toast.x < media.x + media.width && toast.x + toast.width > media.x;
    if (coversControls) throw new Error(`${text} 盖住了播放控件：${JSON.stringify({ toast, media })}`);
    await long.screenshot({ path: path.join(dir, shot), animations: 'disabled' });
    await node.waitFor({ state: 'hidden', timeout: 3_000 });
    return toast;
  };
  const settingName = 'Warn about a minute before';
  const startCopy = 'Sleep 2 min';
  const cancelCopy = 'Sleep cancelled';
  const soonCopy = 'About 1 minute left';
  const dueCopy = 'Sleep timer ended, paused';
  let settings = null;
  let long = null;
  let popup = null;
  let turnedOff = false;
  try {
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    const toggle = settings.getByRole('switch', { name: settingName });
    await toggle.waitFor({ state: 'visible', timeout: 15_000 });
    if (await toggle.getAttribute('aria-checked') !== 'true') throw new Error('临近提示默认应开启');
    await settings.getByText('About a minute before the sleep timer pauses, a short note appears on the page. On by default.', { exact: true }).waitFor({ state: 'visible' });
    await toggle.scrollIntoViewIfNeeded();
    await settings.screenshot({ path: path.join(dir, 'settings-on.png'), animations: 'disabled' });
    const initial = await stored();
    if (initial?.sleepSoonHint === false) throw new Error('存储里的临近提示不是默认开');
    note('setting defaults on');

    long = await context.newPage();
    await long.goto(`${origin}/long`, { waitUntil: 'domcontentloaded' });
    await long.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await long.locator('#media').evaluate(element => { element.loop = true; });
    popup = await openActionPopup(context, long);
    await popup.click('Play');
    await poll(playing, value => !value.paused, '/long 应开始播放');
    await openTimer(popup);
    await startCustom(popup, 2);
    await showHint(startCopy, 'toast-start.png');
    const armed = await poll(() => view(popup), value => value.running && clock(value.text) > 90 && clock(value.text) <= 120, '自定义 2 分钟后应显示倒计时');
    const afterStart = await playing();
    if (afterStart.paused) throw new Error('开始提示时不应暂停');
    note(`start hint countdown=${armed.text}`);

    await openTimer(popup);
    await popup.click('Cancel sleep');
    await showHint(cancelCopy, 'toast-cancel.png');
    await poll(() => view(popup), value => !value.running && value.text === '', '取消后倒计时应消失');
    const afterCancel = await playing();
    if (afterCancel.paused || !(afterCancel.currentTime >= afterStart.currentTime)) throw new Error(`取消不应暂停：${JSON.stringify({ afterStart, afterCancel })}`);
    note('cancel hint, still playing');

    await startCustom(popup, 2);
    const armedAt = Date.now();
    await showHint(startCopy, 'toast-start-again.png');
    const again = await poll(() => view(popup), value => value.running && clock(value.text) > 90 && clock(value.text) <= 120, '再设 2 分钟');
    await hint(soonCopy).waitFor({ state: 'visible', timeout: 90_000 });
    const soonAfterSeconds = (Date.now() - armedAt) / 1000;
    if (soonAfterSeconds < 45) throw new Error(`临近提示太早：${soonAfterSeconds.toFixed(1)} 秒`);
    if (soonAfterSeconds > 80) throw new Error(`临近提示太晚：${soonAfterSeconds.toFixed(1)} 秒`);
    const duringSoon = await playing();
    if (duringSoon.paused) throw new Error('临近提示时不应暂停');
    const node = hint(soonCopy);
    const pass = await node.evaluate(element => element.className.includes('pointer-events-none') && element.getAttribute('role') === 'status');
    if (!pass) throw new Error('临近提示不是不挡点击的状态字样');
    await long.screenshot({ path: path.join(dir, 'toast-soon.png'), animations: 'disabled' });
    await node.waitFor({ state: 'hidden', timeout: 3_000 });
    const left = await view(popup);
    if (!left.running || clock(left.text) > 90) throw new Error(`临近提示时倒计时应还在、并接近 1 分钟：${JSON.stringify(left)}`);
    note(`soon after ${soonAfterSeconds.toFixed(1)}s countdown=${left.text} previous=${again.text}`);

    const soonAt = Date.now();
    await hint(dueCopy).waitFor({ state: 'visible', timeout: 90_000 });
    const dueAfterSoonSeconds = (Date.now() - soonAt) / 1000;
    if (dueAfterSoonSeconds < 45) throw new Error(`到期太早：${dueAfterSoonSeconds.toFixed(1)} 秒`);
    await long.screenshot({ path: path.join(dir, 'toast-due.png'), animations: 'disabled' });
    const stopped = await poll(playing, value => value.paused && value.connected, '到期应暂停当前媒体');
    await hint(dueCopy).waitFor({ state: 'hidden', timeout: 3_000 });
    await long.waitForTimeout(1_200);
    const held = await playing();
    if (!held.paused || Math.abs(held.currentTime - stopped.currentTime) > 0.05) throw new Error(`暂停后进度变了：${JSON.stringify({ stopped, held })}`);
    if (long.isClosed()) throw new Error('到期关掉了标签');
    await long.screenshot({ path: path.join(dir, 'fixture-paused.png'), animations: 'disabled' });
    const expired = await poll(() => view(popup), value => !value.running && value.text === '' && value.play === 'Play', '到期后面板回到未定时');
    note(`due ${dueAfterSoonSeconds.toFixed(1)}s after soon, paused at ${stopped.currentTime.toFixed(1)} play=${expired.play}`);

    await popup.close();
    popup = null;
    await settings.bringToFront();
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    const off = settings.getByRole('switch', { name: settingName });
    await off.waitFor({ state: 'visible', timeout: 15_000 });
    await off.click();
    turnedOff = true;
    await poll(stored, value => value?.sleepSoonHint === false, '应关掉临近提示');
    await off.scrollIntoViewIfNeeded();
    await settings.screenshot({ path: path.join(dir, 'settings-off.png'), animations: 'disabled' });
    note('setting turned off');

    await long.bringToFront();
    popup = await openActionPopup(context, long);
    await popup.click('Play');
    await poll(playing, value => !value.paused, '关掉临近提示后应能继续播放');
    await openTimer(popup);
    await startCustom(popup, 2);
    const offArmedAt = Date.now();
    await showHint(startCopy, 'toast-start-while-off.png');
    await poll(() => view(popup), value => value.running && clock(value.text) > 90, '关闭临近提示后仍能开始定时');
    let sawSoon = false;
    while (Date.now() - offArmedAt < 75_000) {
      if (await hint(soonCopy).isVisible().catch(() => false)) { sawSoon = true; break; }
      await long.waitForTimeout(400);
    }
    const watched = (Date.now() - offArmedAt) / 1000;
    if (sawSoon) throw new Error(`关掉临近提示后仍出现了「${soonCopy}」`);
    if (watched < 70) throw new Error(`还没等到临近窗口：${watched.toFixed(1)} 秒`);
    const still = await playing();
    if (still.paused) throw new Error('2 分钟还没到，关掉临近提示不应暂停');
    await openTimer(popup);
    await popup.click('Cancel sleep');
    await showHint(cancelCopy, 'toast-cancel-while-off.png');
    const afterOffCancel = await playing();
    if (afterOffCancel.paused) throw new Error('关闭临近提示后取消不应暂停');
    note(`soon suppressed for ${watched.toFixed(1)}s`);

    await settings.bringToFront();
    const back = settings.getByRole('switch', { name: settingName });
    if (await back.getAttribute('aria-checked') !== 'false') throw new Error('开关应仍是关');
    await back.click();
    turnedOff = false;
    await poll(stored, value => value?.sleepSoonHint !== false, '应把临近提示开回去');
    const saved = await stored();
    const exported = JSON.stringify(saved);
    if (!exported.includes('"sleepSoonHint":true') && !exported.includes('"sleepSoonHint": true')) throw new Error(`导出用的存储里没有临近提示开关：${exported}`);
    const state = {
      ok: true,
      permissions,
      settingDefaultOn: true,
      start: startCopy,
      cancel: cancelCopy,
      soon: soonCopy,
      due: dueCopy,
      soonAfterSeconds: Number(soonAfterSeconds.toFixed(1)),
      dueAfterSoonSeconds: Number(dueAfterSoonSeconds.toFixed(1)),
      pausedAt: Number(stopped.currentTime.toFixed(2)),
      soonSuppressed: true,
      settingRestored: saved?.sleepSoonHint === true,
    };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    if (turnedOff && settings && !settings.isClosed()) {
      const back = settings.getByRole('switch', { name: settingName });
      if (await back.isVisible().catch(() => false) && await back.getAttribute('aria-checked') === 'false') await back.click().catch(() => {});
    }
    await popup?.close().catch(() => {});
    for (const page of [settings, long]) await page?.close().catch(() => {});
  }
}

async function driveSleepHotkeys(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const startLabel = 'Start the sleep timer at the default length';
  const cancelLabel = 'Cancel the sleep timer';
  const sleepCommands = () => worker.evaluate(async () => (await chrome.commands.getAll())
    .filter(item => item.name === 'sleep-start' || item.name === 'sleep-cancel')
    .map(item => ({ name: item.name, shortcut: item.shortcut ?? null, description: item.description ?? '' }))
    .sort((a, b) => b.name.localeCompare(a.name)));
  const registered = await worker.evaluate(() => {
    const manifest = chrome.runtime.getManifest();
    const commands = manifest.commands ?? {};
    return {
      permissions: manifest.permissions ?? [],
      suggested: Object.entries(commands).filter(([, command]) => command.suggested_key).map(([name]) => name),
      start: commands['sleep-start'] ?? null,
      cancel: commands['sleep-cancel'] ?? null,
    };
  });
  if (JSON.stringify(registered.permissions) !== JSON.stringify(['storage'])) throw new Error(`权限应仍只有 storage：${JSON.stringify(registered.permissions)}`);
  if (!registered.start || !registered.cancel || registered.start.suggested_key || registered.cancel.suggested_key) throw new Error(`睡眠命令应登记且不占建议键：${JSON.stringify(registered)}`);
  if (registered.suggested.length !== 4 || !['play-pause', 'skip-back', 'skip-forward', 'mute'].every(name => registered.suggested.includes(name))) {
    throw new Error(`建议键应仍是原来四个：${JSON.stringify(registered.suggested)}`);
  }
  const listed = await sleepCommands();
  const expectedCommands = [{ name: 'sleep-start', shortcut: '', description: startLabel }, { name: 'sleep-cancel', shortcut: '', description: cancelLabel }];
  if (JSON.stringify(listed) !== JSON.stringify(expectedCommands)) throw new Error(`扩展命令未按未绑定登记：${JSON.stringify(listed)}`);
  note(`commands ${JSON.stringify(listed)}`);

  const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keyButton = (page, action) => page.getByRole('button', { name: new RegExp(`^Change the key for ${escape(action)}\\. Now `) });
  const recording = page => page.getByRole('button', { name: 'Press a key', exact: true });
  const clock = text => text.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  const sleepView = popup => popup.evaluate(`(() => {
    const trigger = document.querySelector('button[aria-label="Sleep timer"]');
    return { text: trigger?.textContent?.trim() ?? '', running: Boolean(trigger?.hasAttribute('data-running')) };
  })()`);
  let settings = null;
  let long = null;
  let bound = false;
  const playing = () => long.locator('#media').evaluate(element => ({ paused: element.paused, currentTime: element.currentTime }));
  const focusFixture = async () => {
    await long.bringToFront();
    await long.mouse.click(12, 12);
  };
  const toast = async (text, shot) => {
    const node = long.getByText(text, { exact: true });
    await node.waitFor({ state: 'visible', timeout: 8_000 });
    const pass = await node.evaluate(element => element.className.includes('pointer-events-none') && element.getAttribute('role') === 'status');
    if (!pass) throw new Error(`${text} 不是不挡点击的状态字样`);
    await long.screenshot({ path: path.join(dir, shot), animations: 'disabled' });
    await node.waitFor({ state: 'hidden', timeout: 3_000 });
  };
  const sleepToasts = () => long.evaluate(() => {
    const root = document.querySelector('ottertap-controller')?.shadowRoot;
    return [...(root?.querySelectorAll('[role="status"]') ?? [])].map(node => (node.textContent || '').trim()).filter(text => /^Sleep |^No sleep timer/.test(text));
  });
  const quiet = async label => {
    const deadline = Date.now() + 900;
    while (Date.now() < deadline) {
      const seen = await sleepToasts();
      if (seen.length) throw new Error(`${label}：不应出现睡眠字样 ${JSON.stringify(seen)}`);
      await long.waitForTimeout(100);
    }
  };
  const timerInPopup = async (check, label, shot) => {
    const popup = await openActionPopup(context, long);
    try {
      const value = await poll(() => sleepView(popup), check, label);
      if (shot) await popup.screenshot(path.join(dir, shot));
      return value;
    } finally { await popup.close().catch(() => {}); }
  };
  const lengthGroup = () => settings.getByRole('group', { name: 'Shortcut sleep length' });
  const pressedLength = async () => (await lengthGroup().locator('button[aria-pressed="true"]').allInnerTexts()).map(text => text.trim());
  try {
    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#shortcuts`, { waitUntil: 'domcontentloaded' });
    const section = settings.locator('#shortcuts');
    await section.getByRole('heading', { name: 'Keyboard shortcuts' }).waitFor({ state: 'visible', timeout: 15_000 });
    const extensionList = section.getByRole('heading', { name: 'Extension shortcuts', exact: true }).locator('xpath=following-sibling::dl[1]');
    for (const label of [startLabel, cancelLabel]) {
      const row = extensionList.getByText(label, { exact: true }).locator('xpath=ancestor::div[contains(@class,"py-3")][1]');
      await row.waitFor({ state: 'visible' });
      if ((await row.locator('dt').innerText()).trim() !== 'Not set') throw new Error(`扩展命令「${label}」应显示 Not set`);
      const button = keyButton(settings, label);
      await button.waitFor({ state: 'visible' });
      if ((await button.innerText()).trim() !== 'Not set') throw new Error(`页内「${label}」默认应是 Not set：${await button.innerText()}`);
    }
    const reset = () => settings.getByRole('button', { name: 'Restore default keys', exact: true });
    if (!await reset().isDisabled()) throw new Error('默认键位时「Restore default keys」应禁用');
    if (await settings.getByRole('switch', { name: 'Single-key mode' }).getAttribute('aria-checked') !== 'false') throw new Error('单键模式应保持关闭');
    await section.screenshot({ path: path.join(dir, 'settings-unbound.png'), animations: 'disabled' });
    note('both sleep actions are Not set, page and extension');

    await keyButton(settings, startLabel).click();
    await recording(settings).waitFor({ state: 'visible' });
    await settings.keyboard.press('Comma');
    const conflict = (await settings.locator('#keybind-error').innerText()).trim();
    const conflictCopy = ', is already used for “Pause, then previous frame”. Press another key, or change that one first.';
    if (conflict !== conflictCopy) throw new Error(`撞键提示不对：${conflict}`);
    if ((await stored()).keybinds?.sleepStart) throw new Error('撞键时不应保存睡眠键');
    if (!await recording(settings).isVisible()) throw new Error('撞键后应继续等待新键');
    await settings.keyboard.press('KeyZ');
    await poll(stored, value => value.keybinds?.sleepStart === 'z' && value.keybinds?.sleepCancel === '' && value.singleKey !== true, '应保存开始睡眠 = z，取消仍未绑，单键模式仍关');
    if (await settings.locator('#keybind-error').isVisible()) throw new Error('Z 没人占用，不应报占用');
    await keyButton(settings, cancelLabel).click();
    await settings.keyboard.press('KeyZ');
    const taken = (await settings.locator('#keybind-error').innerText()).trim();
    const takenCopy = `Z is already used for “${startLabel}”. Press another key, or change that one first.`;
    if (taken !== takenCopy) throw new Error(`Z 的占用提示不对：${taken}`);
    if ((await stored()).keybinds?.sleepCancel) throw new Error('取消睡眠不应保存成已被占用的 Z');
    await section.screenshot({ path: path.join(dir, 'settings-conflict.png'), animations: 'disabled' });
    note(`conflict tips: ${conflict} | ${taken}`);
    await settings.keyboard.press('KeyX');
    await poll(stored, value => value.keybinds?.sleepCancel === 'x', '应保存取消睡眠 = x');
    bound = true;
    await recording(settings).waitFor({ state: 'hidden' });
    await section.screenshot({ path: path.join(dir, 'settings-bound.png'), animations: 'disabled' });
    if (JSON.stringify(await sleepCommands()) !== JSON.stringify(expectedCommands)) throw new Error(`页内改键不应改掉扩展命令：${JSON.stringify(await sleepCommands())}`);

    await lengthGroup().scrollIntoViewIfNeeded();
    const lengths = (await lengthGroup().getByRole('button').allInnerTexts()).map(text => text.trim());
    if (JSON.stringify(lengths) !== JSON.stringify(['15 min', '30 min', '45 min', '60 min'])) throw new Error(`默认睡眠档的选项不对：${JSON.stringify(lengths)}`);
    if (JSON.stringify(await pressedLength()) !== JSON.stringify(['30 min'])) throw new Error(`默认睡眠档出厂应是 30 分钟：${JSON.stringify(await pressedLength())}`);
    if ((await stored()).sleepDefaultMinutes !== 30) throw new Error(`存储里的默认睡眠档应是 30：${(await stored()).sleepDefaultMinutes}`);
    await settings.screenshot({ path: path.join(dir, 'settings-length-30.png'), animations: 'disabled' });
    note('default sleep length is 30 min');

    long = await context.newPage();
    await long.goto(`${origin}/long`, { waitUntil: 'domcontentloaded' });
    await long.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await long.locator('#media').evaluate(element => { element.loop = true; });
    const opener = await openActionPopup(context, long);
    try {
      await opener.click('Play');
      await poll(playing, value => !value.paused, '/long 应开始播放');
    } finally { await opener.close().catch(() => {}); }

    await focusFixture();
    await long.keyboard.press('KeyZ');
    await toast('Sleep 30 min', 'toast-start-30.png');
    const thirty = await timerInPopup(value => value.running && clock(value.text) > 1740 && clock(value.text) <= 1800, '按 Z 后应按 30 分钟倒计时', 'popup-30.png');
    if ((await playing()).paused) throw new Error('开始睡眠不应暂停');
    note(`Z started ${thirty.text}`);

    await settings.bringToFront();
    await lengthGroup().getByRole('button', { name: '15 min', exact: true }).click();
    await poll(stored, value => value.sleepDefaultMinutes === 15, '应保存默认睡眠档 15 分钟');
    await settings.screenshot({ path: path.join(dir, 'settings-length-15.png'), animations: 'disabled' });
    await focusFixture();
    await long.keyboard.press('KeyZ');
    await toast('Sleep 15 min', 'toast-start-15.png');
    const fifteen = await timerInPopup(value => value.running && clock(value.text) > 840 && clock(value.text) <= 900, '改成 15 分钟后再按 Z，应从现在起按 15 分钟重开', 'popup-15.png');
    note(`changed length without reload, Z restarted ${fifteen.text}`);

    await focusFixture();
    await long.keyboard.press('KeyX');
    await toast('Sleep cancelled', 'toast-cancel.png');
    await timerInPopup(value => !value.running && value.text === '', '按 X 后倒计时应消失', 'popup-cancelled.png');
    const afterCancel = await playing();
    if (afterCancel.paused) throw new Error('取消睡眠不应暂停');
    await focusFixture();
    await long.keyboard.press('KeyX');
    await toast('No sleep timer is running.', 'toast-idle.png');
    note('X cancelled, second X says nothing is running');

    await long.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('aria-label', 'Fixture note');
      input.style.position = 'fixed';
      input.style.left = '16px';
      input.style.top = '420px';
      document.body.append(input);
    });
    const field = long.getByRole('textbox', { name: 'Fixture note' });
    await field.focus();
    await long.keyboard.type('hi');
    await long.keyboard.press('KeyZ');
    await quiet('输入框聚焦时按 Z');
    await long.keyboard.press('KeyX');
    await quiet('输入框聚焦时按 X');
    if ((await field.inputValue()) !== 'hizx') throw new Error(`输入框应收到 Z 和 X：${await field.inputValue()}`);
    await long.screenshot({ path: path.join(dir, 'fixture-typing.png'), animations: 'disabled' });
    await timerInPopup(value => !value.running, '输入框聚焦时不应开始睡眠');
    note('typing keeps Z and X');

    await settings.bringToFront();
    await reset().click();
    await poll(stored, value => value.keybinds?.sleepStart === '' && value.keybinds?.sleepCancel === '' && value.keybinds?.toggle === 'k', '恢复默认后两个睡眠动作应回到未绑定');
    bound = false;
    for (const label of [startLabel, cancelLabel]) await keyButton(settings, label).filter({ hasText: 'Not set' }).waitFor({ state: 'visible' });
    if (!await reset().isDisabled()) throw new Error('恢复默认后按钮应禁用');
    await lengthGroup().getByRole('button', { name: '30 min', exact: true }).click();
    await poll(stored, value => value.sleepDefaultMinutes === 30, '默认睡眠档应改回 30 分钟');
    await section.screenshot({ path: path.join(dir, 'settings-restored.png'), animations: 'disabled' });
    await focusFixture();
    await long.keyboard.press('KeyZ');
    await quiet('恢复默认后按 Z');
    await timerInPopup(value => !value.running, '恢复默认后 Z 不应开始睡眠');
    const prefs = JSON.stringify((await stored()).sitePrefs ?? {});
    if (prefs !== '{}') throw new Error(`睡眠快捷键写入了 sitePrefs：${prefs}`);
    const state = {
      ok: true,
      permissions: registered.permissions,
      suggested: registered.suggested,
      commands: await sleepCommands(),
      conflict,
      taken,
      defaultLength: 30,
      started30: thirty.text,
      restarted15: fifteen.text,
      cancelled: true,
      idleHint: 'No sleep timer is running.',
      typingValue: 'hizx',
      restored: true,
      sitePrefs: {},
    };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    if (bound && settings && !settings.isClosed()) await settings.getByRole('button', { name: 'Restore default keys', exact: true }).click().catch(() => {});
    for (const page of [long, settings]) await page?.close().catch(() => {});
  }
}

const remainingView = `(() => {
  const slider = document.querySelector('[aria-label="Playback progress"]');
  const row = slider?.closest('.tabular-nums');
  const spans = row ? [...row.querySelectorAll(':scope > span')] : [];
  const remaining = document.querySelector('#episode-remaining');
  const trigger = document.querySelector('button[aria-label="Sleep timer"]');
  const panel = document.querySelector('[aria-label="Media controls"]');
  return {
    heading: document.querySelector('h1')?.textContent?.trim() ?? '',
    remaining: remaining?.textContent?.trim() ?? '',
    shown: Boolean(remaining),
    slider: Boolean(slider),
    durationLabel: spans.length ? spans[spans.length - 1].textContent?.trim() ?? '' : '',
    sleep: document.querySelector('#sleep-timer-status')?.textContent?.trim() ?? '',
    sleepText: trigger?.textContent?.trim() ?? '',
    sleepRunning: Boolean(trigger?.hasAttribute('data-running')),
    height: Math.round(panel?.getBoundingClientRect().height ?? 0),
    alert: document.querySelector('[role="alert"]')?.textContent?.trim() ?? '',
  };
})()`;

function parseRemaining(text) {
  const match = /^About (\d{1,2}:\d{2}(?::\d{2})?) left in this episode \(([0-9.]+)×\)$/.exec(text);
  if (!match) return null;
  const clock = match[1].split(':').reduce((total, part) => total * 60 + Number(part), 0);
  return { clock, rate: Number(match[2]) };
}

async function driveRemainingAtRate(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const permissions = await worker.evaluate(() => chrome.runtime.getManifest().permissions ?? []);
  if (JSON.stringify(permissions) !== JSON.stringify(['storage'])) throw new Error(`权限应仍只有 storage：${JSON.stringify(permissions)}`);
  const settingsText = () => worker.evaluate(async () => JSON.stringify((await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? null));
  const readMedia = page => page.locator('#media').evaluate(element => ({
    paused: element.paused,
    currentTime: element.currentTime,
    duration: element.duration,
    rate: element.playbackRate,
  }));
  const view = popup => popup.evaluate(remainingView);
  const shown = (popup, rate) => poll(async () => {
    const panel = await view(popup);
    const media = await readMedia(page);
    const parsed = parseRemaining(panel.remaining);
    return { panel, media, parsed };
  }, value => {
    if (!value.panel.slider || !value.parsed || value.panel.alert) return false;
    if (Math.abs(value.parsed.rate - rate) > 0.001 || Math.abs(value.media.rate - rate) > 0.001) return false;
    if (!Number.isFinite(value.media.duration) || value.media.duration <= 0) return false;
    const expect = Math.floor(Math.max(0, value.media.duration - value.media.currentTime) / rate);
    return Math.abs(value.parsed.clock - expect) <= 1;
  }, `本集剩余应按 ${rate}× 折算`);
  let popup = null;
  let blocked = null;
  const page = await context.newPage();
  try {
    const settingsBefore = await settingsText();
    await page.goto(`${origin}/long`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
      element.pause();
      element.currentTime = 0;
    });
    await poll(() => readMedia(page), value => value.paused === true && value.currentTime < 0.25 && value.duration > 100 && Math.abs(value.rate - 1) < 0.001, '长视频应暂停在开头、倍速 1×');
    popup = await openActionPopup(context, page);
    const atOne = await shown(popup, 1);
    if (atOne.panel.height > 600) throw new Error(`单媒体面板高度 ${atOne.panel.height}px 超过弹出窗口上限 600px`);
    const mediaLeft = atOne.media.duration - atOne.media.currentTime;
    if (Math.abs(atOne.parsed.clock - mediaLeft) > 1) throw new Error(`1× 应接近媒体时钟剩余 ${mediaLeft}，显示 ${atOne.parsed.clock}`);
    await popup.screenshot(path.join(dir, 'popup-1x.png'));
    note(`1x remaining=${atOne.panel.remaining} height=${atOne.panel.height} mediaLeft=${mediaLeft.toFixed(2)}`);

    await popup.click('2× speed');
    const atTwo = await shown(popup, 2);
    const half = (atTwo.media.duration - atTwo.media.currentTime) / 2;
    if (Math.abs(atTwo.parsed.clock - half) > 1) throw new Error(`2× 应约为媒体时钟剩余的一半 ${half}，显示 ${atTwo.parsed.clock}`);
    if (atTwo.parsed.clock >= atOne.parsed.clock) throw new Error(`2× 的剩余没有变短：${atOne.parsed.clock} -> ${atTwo.parsed.clock}`);
    await popup.screenshot(path.join(dir, 'popup-2x.png'));
    note(`2x remaining=${atTwo.panel.remaining} half=${half.toFixed(2)}`);

    await popup.click('1.5× speed');
    const atOnePointFive = await shown(popup, 1.5);
    if (atOnePointFive.parsed.clock === atTwo.parsed.clock) throw new Error('改到 1.5× 后剩余没有更新');
    await popup.screenshot(path.join(dir, 'popup-1.5x.png'));
    note(`1.5x remaining=${atOnePointFive.panel.remaining}`);

    await popup.click('Sleep timer');
    await poll(() => popup.evaluate(`(() => [...document.querySelectorAll('button')].some(item => item.getAttribute('aria-label') === 'Pause in 15 minutes'))()`), value => value === true, '睡眠档位应出现');
    await popup.click('Pause in 15 minutes');
    const withSleep = await poll(() => view(popup), value => {
      const parsed = parseRemaining(value.remaining);
      return value.sleepRunning && parsed && Math.abs(parsed.rate - 1.5) < 0.001 && value.sleep === `Sleep left ${value.sleepText}` && !value.remaining.includes('Sleep') && !value.sleep.includes('episode') && !value.alert;
    }, '睡眠还剩和本集剩余应同时在，且文案不同');
    await popup.screenshot(path.join(dir, 'popup-with-sleep.png'));
    note(`sleep=${withSleep.sleep} episode=${withSleep.remaining}`);
    await popup.click('Sleep timer');
    await poll(() => popup.evaluate(`(() => [...document.querySelectorAll('button')].some(item => item.getAttribute('aria-label') === 'Cancel sleep'))()`), value => value === true, '取消睡眠应出现');
    await popup.click('Cancel sleep');
    await poll(() => view(popup), value => !value.sleepRunning && parseRemaining(value.remaining) && !value.sleep.includes('episode'), '取消睡眠后本集剩余还在');
    await popup.click('Sleep timer');
    await poll(() => popup.evaluate(`(() => !document.querySelector('[data-slot="popover-content"]'))()`), value => value === true, '睡眠弹层应收起，免得挡住直播这一屏');

    const liveKind = await page.locator('#media').evaluate(async element => {
      if (typeof MediaSource === 'undefined') return 'no-mediasource';
      const source = new MediaSource();
      element.src = URL.createObjectURL(source);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('sourceopen timeout')), 4000);
        source.addEventListener('sourceopen', () => { clearTimeout(timer); resolve(); }, { once: true });
      });
      try { source.duration = Infinity; }
      catch (error) {
        const mime = ['audio/webm; codecs=opus', 'audio/webm', 'audio/mp4'].find(type => MediaSource.isTypeSupported(type));
        if (!mime) return `duration-failed ${error instanceof Error ? error.message : error}`;
        source.addSourceBuffer(mime);
        source.duration = Infinity;
      }
      return element.duration === Infinity ? 'live' : `duration=${element.duration}`;
    });
    if (liveKind !== 'live') throw new Error(`没法把夹具变成直播：${liveKind}`);
    const live = await poll(() => view(popup), value => !value.shown && value.durationLabel === 'Live' && value.slider && !value.alert, '直播不显示本集剩余，进度右侧是 Live');
    await popup.screenshot(path.join(dir, 'popup-live.png'));
    note(`live durationLabel=${live.durationLabel} shown=${live.shown}`);
    await popup.close();
    popup = null;

    blocked = await context.newPage();
    await blocked.goto(`${origin}/unseekable`, { waitUntil: 'domcontentloaded' });
    await blocked.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    popup = await openActionPopup(context, blocked);
    const unknown = await poll(() => view(popup), value => value.heading === 'Unseekable video' && !value.shown && value.durationLabel === '--:--' && value.slider && !value.alert, '未知时长且不可 seek 时不显示本集剩余');
    await popup.screenshot(path.join(dir, 'unseekable-popup.png'));
    note(`unseekable durationLabel=${unknown.durationLabel} shown=${unknown.shown}`);
    await popup.close();
    popup = null;

    const settingsAfter = await settingsText();
    if (settingsAfter !== settingsBefore) throw new Error(`本集剩余改写了设置：before=${settingsBefore} after=${settingsAfter}`);
    const state = {
      ok: true,
      permissions,
      atOne: atOne.panel.remaining,
      atTwo: atTwo.panel.remaining,
      atOnePointFive: atOnePointFive.panel.remaining,
      halfSeconds: atTwo.parsed.clock,
      mediaLeftAtTwo: Number(half.toFixed(2)),
      sleep: withSleep.sleep,
      episodeWithSleep: withSleep.remaining,
      height: atOne.panel.height,
      liveHidden: true,
      unseekableHidden: true,
      settingsSame: true,
    };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await popup?.close().catch(() => {});
    await blocked?.close().catch(() => {});
    await page.close().catch(() => {});
  }
}

async function drivePipAutoFeedback(_sessionContext, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const plain = await launchPlainBrowser(note, 'pip-auto-feedback');
  const { context } = plain;
  let other;
  try {
    await context.route(`${origin}/**`, async route => {
      const body = routedHtml(new URL(route.request().url()).pathname);
      if (!body) { await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }); return; }
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers: { 'cache-control': 'no-store' }, body });
    });
    const ours = item => item.url().endsWith('/background.js');
    const worker = context.serviceWorkers().find(ours) ?? await context.waitForEvent('serviceworker', { predicate: ours, timeout: 20_000 });
    const extensionId = new URL(worker.url()).host;
    const uiLanguage = await worker.evaluate(() => chrome.i18n.getUILanguage());
    if (!uiLanguage.toLowerCase().startsWith('en')) throw new Error(`UI 语言是 ${uiLanguage}`);
    const permissions = await worker.evaluate(() => chrome.runtime.getManifest().permissions ?? []);
    if (JSON.stringify(permissions) !== JSON.stringify(['storage'])) throw new Error(`权限变了：${JSON.stringify(permissions)}`);
    const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
    const onCopy = 'Picture-in-picture on';
    const offCopy = 'Picture-in-picture off';
    const gestureCopy = 'The browser blocked picture-in-picture for this click. Try again.';
    const audioCopy = "Audio can't use picture-in-picture.";
    const blockedCopy = 'This site has turned off picture-in-picture.';
    const hideLabel = 'Picture-in-picture when you switch tabs';
    const scrollLabel = 'Picture-in-picture when the video scrolls out of view';
    const exitLabel = 'Leave picture-in-picture when you return to the tab or the video';

    const settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#playback`, { waitUntil: 'domcontentloaded' });
    const playback = settings.locator('#playback');
    const hideToggle = playback.getByRole('switch', { name: hideLabel });
    const scrollToggle = playback.getByRole('switch', { name: scrollLabel });
    const exitToggle = playback.getByRole('switch', { name: exitLabel });
    await hideToggle.waitFor({ state: 'visible', timeout: 15_000 });
    const intro = await playback.innerText();
    if (!intro.includes('These three switches are all off by default.')) throw new Error('播放区缺少自动画中画说明');
    if (!intro.includes('only the selected video') || !intro.includes('only while it is playing') || !intro.includes('yourself still works')) throw new Error(`说明没有写清默认、选中视频和手动并存：${intro.slice(0, 400)}`);
    for (const toggle of [hideToggle, scrollToggle, exitToggle]) {
      if (await toggle.getAttribute('aria-checked') !== 'false') throw new Error('三个开关默认都应为关');
    }
    await hideToggle.scrollIntoViewIfNeeded();
    await playback.screenshot({ path: path.join(dir, 'settings-intro.png'), animations: 'disabled' });
    note('settings intro visible, three switches off');

    const fixture = context.pages()[0] ?? await context.newPage();
    await fixture.goto(`${origin}/video`, { waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    const cdp = await context.newCDPSession(fixture);
    const { targetInfo } = await cdp.send('Target.getTargetInfo');
    const { targetId: otherId } = await cdp.send('Target.createTarget', { url: `${origin}/silent`, newWindow: false });
    other = otherId;
    await cdp.send('Target.activateTarget', { targetId: targetInfo.targetId });
    const evaluate = async (expression, userGesture = false) => {
      const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    };
    const armHints = () => evaluate(`(() => {
      window.__otterHintLog = window.__otterHintLog ?? [];
      const scan = () => {
        for (const host of document.querySelectorAll('*')) {
          const root = host.shadowRoot;
          if (!root) continue;
          for (const status of root.querySelectorAll('[role="status"]')) {
            if (status.dataset.otterHint) continue;
            status.dataset.otterHint = '1';
            let last = '';
            new MutationObserver(() => {
              const text = (status.textContent || '').trim();
              if (!text) { last = ''; return; }
              if (text === last) return;
              last = text;
              window.__otterHintLog.push(text);
            }).observe(status, { childList: true, characterData: true, subtree: true });
          }
        }
      };
      scan();
      if (!window.__otterHintScan) {
        window.__otterHintScan = true;
        new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
      }
    })()`);
    const hintLog = () => evaluate('window.__otterHintLog ?? []');
    const read = () => evaluate(`(() => ({
      visibility: document.visibilityState,
      gesture: navigator.userActivation.isActive,
      pip: document.pictureInPictureElement?.id ?? '',
      paused: document.querySelector('#media')?.paused ?? null,
      kind: document.querySelector('#media')?.localName ?? '',
      hints: window.__otterHintLog ?? [],
    }))()`);
    const paint = () => fixture.locator('#media').evaluate(async element => {
      if (!(element instanceof HTMLVideoElement)) return element.paused === false;
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 36;
      const drawing = canvas.getContext('2d');
      drawing.fillStyle = '#c45c26';
      drawing.fillRect(0, 0, 64, 36);
      element.srcObject = canvas.captureStream(5);
      element.muted = true;
      await element.play().catch(() => {});
      const deadline = performance.now() + 2_000;
      while (element.videoWidth === 0 && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
      return !element.paused && element.videoWidth > 0;
    });
    const settle = ms => new Promise(resolve => setTimeout(resolve, ms));
    const touchPage = () => fixture.mouse.click(8, 8);
    const comeBack = async () => {
      await cdp.send('Target.activateTarget', { targetId: targetInfo.targetId });
      await fixture.bringToFront();
      await poll(read, value => value.visibility === 'visible', '回到夹具页后应为 visible');
    };
    const leaveTab = async () => {
      await cdp.send('Target.activateTarget', { targetId: other });
      return poll(read, value => value.visibility === 'hidden', '切到另一个标签后，夹具页应变成 hidden');
    };
    const times = (list, text) => list.filter(item => item === text).length;
    const flip = async (toggle, want) => {
      await evaluate(`document.querySelector('#media')?.pause()`).catch(() => {});
      await settings.bringToFront();
      if (await toggle.getAttribute('aria-checked') !== String(want)) await toggle.click();
      await poll(() => toggle.getAttribute('aria-checked'), value => value === String(want), `开关应为 ${want}`);
    };

    await armHints();
    if (!(await paint())) throw new Error('夹具视频没有画面或没在播');
    await settle(800);
    await flip(hideToggle, true);
    await flip(exitToggle, true);
    await poll(stored, value => value.autoPipOnHide === true && value.autoPipExitOnReturn === true && value.autoPipOnScroll !== true, '应只打开切走和自动退出');
    await comeBack();
    await evaluate(`document.querySelector('#media').play()`);
    await poll(read, value => value.paused === false, '夹具视频应恢复播放');
    await armHints();
    await touchPage();
    await leaveTab();
    const entered = await poll(read, value => value.pip === 'media' && times(value.hints, onCopy) === 1, '切走自动进入应出现和手动相同的画中画开');
    note(`hide entered with one on-note ${JSON.stringify(entered.hints)}`);
    await comeBack();
    const offNote = fixture.getByText(offCopy, { exact: true });
    await offNote.waitFor({ state: 'visible', timeout: 5_000 });
    const offPass = await offNote.evaluate(element => element.getAttribute('role') === 'status' && element.className.includes('pointer-events-none'));
    if (!offPass) throw new Error('画中画关不是原来那块不挡点击的字样');
    await poll(read, value => value.pip === '' && times(value.hints, offCopy) === 1, '回到标签后应自动退出并出现画中画关');
    await fixture.screenshot({ path: path.join(dir, 'toast-off.png'), animations: 'disabled' });
    note('returned: picture-in-picture off');
    await touchPage();
    const cooling = await leaveTab();
    await settle(600);
    const cooled = await read();
    if (cooling.pip || cooled.pip || times(cooled.hints, onCopy) !== 1) throw new Error(`退出后马上再切走不应又进或再提示：${JSON.stringify(cooled)}`);
    await comeBack();
    note('left again inside the cooldown: stayed out, still one on-note');

    await fixture.goto(`${origin}/audio`, { waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await armHints();
    await evaluate(`document.querySelector('#media').loop = true`);
    await fixture.getByRole('button', { name: /volume pill/i }).click();
    await fixture.getByRole('button', { name: 'Play', exact: true }).click();
    await poll(read, value => value.kind === 'audio' && value.paused === false, '音频应在播');
    await settle(400);
    await touchPage();
    await leaveTab();
    const audio = await poll(read, value => times(value.hints, audioCopy) === 1 && times(value.hints, onCopy) === 0 && !value.pip, '音频切走应出现原来的短说明，且不显示画中画开');
    await comeBack();
    await fixture.screenshot({ path: path.join(dir, 'toast-audio.png'), animations: 'disabled' });
    await touchPage();
    await leaveTab();
    await settle(500);
    const audioAgain = await read();
    if (audioAgain.pip || times(audioAgain.hints, audioCopy) !== 1) throw new Error(`音频失败后冷却期内不应再提示：${JSON.stringify(audioAgain.hints)}`);
    await comeBack();
    note(`audio refusal once ${JSON.stringify(audio.hints)}`);

    await fixture.goto(`${origin}/pip-off`, { waitUntil: 'domcontentloaded' });
    await fixture.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await armHints();
    if (!(await paint())) throw new Error('禁用画中画的视频没有在播');
    await settle(400);
    await touchPage();
    await leaveTab();
    const blocked = await poll(read, value => times(value.hints, blockedCopy) === 1 && times(value.hints, onCopy) === 0 && !value.pip, '站方禁用应出现原来的短说明');
    await comeBack();
    await leaveTab();
    await settle(500);
    const blockedAgain = await read();
    if (times(blockedAgain.hints, blockedCopy) !== 1) throw new Error(`站方禁用后冷却期内不应再提示：${JSON.stringify(blockedAgain.hints)}`);
    await comeBack();
    note(`site blocked once ${JSON.stringify(blocked.hints)}`);

    await flip(hideToggle, false);
    await flip(scrollToggle, true);
    await poll(stored, value => value.autoPipOnScroll === true && value.autoPipOnHide === false && value.autoPipExitOnReturn === true, '改成只开滚出和自动退出');
    const feed = await context.newPage();
    await feed.goto(`${origin}/feed`, { waitUntil: 'domcontentloaded' });
    await feed.bringToFront();
    await feed.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    const feedCdp = await context.newCDPSession(feed);
    const feedEval = async (expression, userGesture = false) => {
      const { result, exceptionDetails } = await feedCdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    };
    await feedEval(`(() => {
      window.__otterHintLog = [];
      window.__otterEntered = 0;
      document.addEventListener('enterpictureinpicture', () => { window.__otterEntered += 1; }, true);
      const scan = () => {
        for (const host of document.querySelectorAll('*')) {
          const root = host.shadowRoot;
          if (!root) continue;
          for (const status of root.querySelectorAll('[role="status"]')) {
            if (status.dataset.otterHint) continue;
            status.dataset.otterHint = '1';
            let last = '';
            new MutationObserver(() => {
              const text = (status.textContent || '').trim();
              if (!text) { last = ''; return; }
              if (text === last) return;
              last = text;
              window.__otterHintLog.push(text);
            }).observe(status, { childList: true, characterData: true, subtree: true });
          }
        }
      };
      scan();
      new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
    })()`);
    const feedRead = () => feedEval(`(() => {
      const main = document.querySelector('#media');
      const rect = main.getBoundingClientRect();
      const seen = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0)) * Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
      return {
        share: Math.round(seen / (rect.width * rect.height) * 100) / 100,
        top: Math.round(rect.top + scrollY),
        pip: document.pictureInPictureElement?.id ?? '',
        entered: window.__otterEntered,
        gesture: navigator.userActivation.isActive,
        hints: window.__otterHintLog ?? [],
      };
    })()`);
    const feedPaint = () => feedEval(`(async () => {
      const element = document.querySelector('#media');
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 36;
      const drawing = canvas.getContext('2d');
      drawing.fillStyle = '#c45c26';
      drawing.fillRect(0, 0, 64, 36);
      element.srcObject = canvas.captureStream(5);
      element.muted = true;
      await element.play().catch(() => {});
      const deadline = performance.now() + 2000;
      while (element.videoWidth === 0 && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
      return !element.paused && element.videoWidth > 0;
    })()`, true);
    const scrollTo = async y => {
      await feedEval(`window.scrollTo(0, ${y})`);
      await settle(500);
      return feedRead();
    };
    if (!(await feedPaint())) throw new Error('主播放器没有画面或没在播');
    await settle(800);
    const armed = await scrollTo(0);
    if (armed.share < 0.99) throw new Error(`页顶时主播放器应完整可见：${JSON.stringify(armed)}`);
    await feed.mouse.click(8, 8);
    await scrollTo(1200);
    const scrolled = await poll(feedRead, value => value.pip === 'media' && times(value.hints, onCopy) === 1, '滚走应进入并只出现一次画中画开');
    for (const y of [1140, 1260, 1180]) await scrollTo(y);
    await feed.mouse.click(8, 8);
    await settle(400);
    const jitter = await feedRead();
    if (jitter.entered !== 1 || jitter.pip !== 'media' || times(jitter.hints, onCopy) !== 1) throw new Error(`滚出边界抖动不应连着进出或提示：${JSON.stringify(jitter)}`);
    note(`scroll entered once ${JSON.stringify({ scrolled: scrolled.hints, jitter: jitter.hints })}`);
    const partial = await scrollTo(armed.top + 252);
    await settle(800);
    const partialKept = await feedRead();
    if (partialKept.pip !== 'media' || times(partialKept.hints, offCopy) !== 0) throw new Error(`只露出一点不应退出或出现画中画关：${JSON.stringify({ partial, partialKept })}`);
    await scrollTo(0);
    const returned = await poll(feedRead, value => value.pip === '' && times(value.hints, offCopy) === 1, '滚回播放器应退出并只出现一次画中画关');
    await feed.screenshot({ path: path.join(dir, 'toast-scroll-off.png'), animations: 'disabled' });
    note(`scrolled back once ${JSON.stringify(returned.hints)}`);
    const exitAt = Date.now();
    await settle(Math.max(0, exitAt + 10_500 - Date.now()));
    await poll(feedRead, value => value.gesture === false, '点击带来的激活应过期', 12_000);
    const refusedAt = Date.now();
    await scrollTo(1200);
    const refused = await poll(feedRead, value => !value.pip && value.hints.includes(gestureCopy) && times(value.hints, onCopy) === 1, '没有手势时应出现原来的短句，且不再显示新的画中画开');
    await feed.mouse.click(8, 8);
    await settle(800);
    const held = await feedRead();
    if (held.pip || times(held.hints, gestureCopy) !== 1) throw new Error(`失败冷却期内点击不应进入或再提示：${JSON.stringify(held)}`);
    await settle(Math.max(0, refusedAt + 10_500 - Date.now()));
    await feed.mouse.click(8, 8);
    const recovered = await poll(feedRead, value => value.pip === 'media' && times(value.hints, onCopy) === 2, '冷却过后点击应再进入');
    note(`gesture refusal once, then recovered ${JSON.stringify({ refused: refused.hints, recovered: recovered.hints })}`);

    await flip(scrollToggle, false);
    await flip(exitToggle, false);
    await poll(stored, value => value.autoPipOnHide === false && value.autoPipOnScroll === false && value.autoPipExitOnReturn === false, '结束时三个开关都应关掉');
    const final = await stored();
    if (JSON.stringify(final.sitePrefs ?? {}) !== '{}') throw new Error(`不应写入 sitePrefs：${JSON.stringify(final.sitePrefs)}`);
    const unknown = await unknownStorageKeys(worker);
    if (unknown.length) throw new Error(`出现了名单外的存储键：${unknown.join(', ')}`);
    note('restored: switches off, no new storage keys');
    const state = { ok: true, entered: entered.hints, audio: audio.hints, blocked: blocked.hints, jitter: jitter.hints, returned: returned.hints, refused: refused.hints, sitePrefs: {}, unknown, permissions };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await plain.stop();
  }
}

async function driveFloatingSleepNote(context, dir, note) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = await serviceWorker(context);
  const extensionId = new URL(worker.url()).host;
  const permissions = await worker.evaluate(() => chrome.runtime.getManifest().permissions ?? []);
  if (JSON.stringify(permissions) !== JSON.stringify(['storage'])) throw new Error(`权限应仍只有 storage：${JSON.stringify(permissions)}`);
  const stored = () => worker.evaluate(async () => (await chrome.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'] ?? {});
  const page = await context.newPage();
  let settings;
  let popup = null;
  const floater = () => page.getByRole('complementary', { name: 'Floating controller' });
  const entry = () => page.locator('[data-slot="entry-note"]');
  const readNote = async () => {
    if (await entry().count() === 0) return null;
    return entry().evaluate(node => ({
      text: (node.textContent || '').trim(),
      label: node.getAttribute('aria-label') || '',
      kind: node.getAttribute('data-kind') || '',
      boost: node.getAttribute('data-boost') || '',
    }));
  };
  const clockOf = text => {
    const match = /^Sleep (\d{1,2}:\d{2}(?::\d{2})?)$/.exec(text);
    if (!match) return null;
    return match[1].split(':').reduce((total, part) => total * 60 + Number(part), 0);
  };
  const inside = async label => {
    const box = await entry().boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) throw new Error(`${label}：旁注没有位置`);
    if (box.x < -1 || box.y < -1 || box.x + box.width > viewport.width + 1 || box.y + box.height > viewport.height + 1) {
      throw new Error(`${label}：旁注超出视口 ${JSON.stringify({ box, viewport })}`);
    }
    return box;
  };
  const badge = async () => {
    const url = page.url();
    return worker.evaluate(async pageUrl => {
      const tabId = (await chrome.tabs.query({ url: pageUrl })).find(tab => tab.url === pageUrl)?.id;
      if (tabId == null) return null;
      const [text, title] = await Promise.all([chrome.action.getBadgeText({ tabId }), chrome.action.getTitle({ tabId })]);
      return { text, title };
    }, url);
  };
  const reopen = async () => {
    if (popup) await popup.close().catch(() => {});
    popup = await openActionPopup(context, page);
  };
  const arm = async () => {
    await reopen();
    await popup.click('Sleep timer');
    await poll(() => popup.evaluate(`(() => [...document.querySelectorAll('button')].some(item => item.getAttribute('aria-label') === 'Pause in 15 minutes'))()`), value => value === true, '睡眠档位应出现');
    await popup.click('Pause in 15 minutes');
    await poll(() => popup.evaluate(`(() => {
      const trigger = document.querySelector('button[aria-label="Sleep timer"]');
      return Boolean(trigger?.hasAttribute('data-running')) && /\\d/.test(trigger?.textContent || '');
    })()`), value => value === true, '15 分钟睡眠应开始');
  };
  const cancel = async () => {
    await reopen();
    await popup.click('Sleep timer');
    await poll(() => popup.evaluate(`(() => [...document.querySelectorAll('button')].some(item => item.getAttribute('aria-label') === 'Cancel sleep'))()`), value => value === true, '取消睡眠应出现');
    await popup.click('Cancel sleep');
    await poll(() => popup.evaluate(`(() => {
      const trigger = document.querySelector('button[aria-label="Sleep timer"]');
      return Boolean(trigger) && !trigger.hasAttribute('data-running');
    })()`), value => value === true, '睡眠应已取消');
  };
  try {
    await page.goto(`${origin}/keys`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /volume pill/i }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('#media').evaluate(async element => {
      if (element.readyState < 1) await new Promise(resolve => element.addEventListener('loadedmetadata', resolve, { once: true }));
      element.pause();
    });
    const idle = await poll(readNote, value => value?.label === 'On-page volume 100%' && value.text === '100%' && value.kind === 'volume', '默认旁注应是页内音量 100%');
    if ((await floater().getAttribute('data-revealed')) !== 'false') throw new Error('默认应半隐藏');
    if ((await floater().getAttribute('data-side')) !== 'right') throw new Error('默认应贴在右侧');
    note(`idle ${idle.label}`);

    await arm();
    await page.bringToFront();
    const whileOff = await poll(readNote, value => value?.label === 'On-page volume 100%' && value.kind === 'volume' && value.text === '100%', '开关关闭时，定时进行中旁注仍是音量');
    const toolbar = await badge();
    if (toolbar?.text) throw new Error(`100% 时工具栏角标应为空：${JSON.stringify(toolbar)}`);
    if ((toolbar?.title || '').includes('Sleep')) throw new Error(`工具栏标题不应写成睡眠倒计时：${toolbar?.title}`);
    await page.screenshot({ path: path.join(dir, 'note-off.png'), animations: 'disabled' });
    note(`while off ${whileOff.text}; badge=${JSON.stringify(toolbar)}`);

    settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/options.html#floating`, { waitUntil: 'domcontentloaded' });
    const toggle = settings.getByRole('switch', { name: 'Countdown while sleeping', exact: true });
    await toggle.waitFor({ state: 'visible', timeout: 15_000 });
    if ((await toggle.getAttribute('aria-checked')) !== 'false') throw new Error('倒计时开关默认应关闭');
    const description = settings.locator('#settings-floating-sleep-note-description');
    await description.waitFor({ state: 'visible' });
    const descriptionText = await description.innerText();
    if (!descriptionText.includes('Off by default')) throw new Error(`说明应写明默认关闭：${descriptionText}`);
    if (!descriptionText.includes('toolbar badge above 100%')) throw new Error(`说明应和工具栏角标分开：${descriptionText}`);
    await settings.locator('#floating').screenshot({ path: path.join(dir, 'settings-off.png'), animations: 'disabled' });
    await toggle.click();
    const enabled = await poll(stored, value => value.floatingSleepNote === true && value.floatingNote === 'volume' && value.floatingPosition?.side === 'right' && value.floatingPosition?.y === 0.8 && Object.keys(value.sitePrefs ?? {}).length === 0, '应只打开睡眠旁注，贴边和旁注偏好不变');
    await settings.locator('#floating').screenshot({ path: path.join(dir, 'settings-on.png'), animations: 'disabled' });
    note(`enabled floatingSleepNote=${enabled.floatingSleepNote} position=${JSON.stringify(enabled.floatingPosition)}`);

    await page.bringToFront();
    const countdown = await poll(readNote, value => {
      const seconds = clockOf(value?.text ?? '');
      return value?.kind === 'sleep' && value.boost === 'false' && value.label === `Sleep left ${value.text.replace(/^Sleep /, '')}` && seconds != null && seconds > 14 * 60 && seconds <= 15 * 60;
    }, '打开后旁注应是 15 分钟内的睡眠倒计时');
    const box = await inside('倒计时');
    if ((await floater().getAttribute('data-revealed')) !== 'false') throw new Error('显示倒计时时仍应半隐藏');
    if ((await floater().getAttribute('data-side')) !== 'right') throw new Error('显示倒计时时仍应贴在右侧');
    const firstClock = clockOf(countdown.text);
    const later = await poll(readNote, value => {
      const seconds = clockOf(value?.text ?? '');
      return seconds != null && firstClock != null && seconds < firstClock && seconds > 14 * 60;
    }, '倒计时应继续往下走', 4_000);
    await page.screenshot({ path: path.join(dir, 'note-countdown.png'), animations: 'disabled' });
    note(`countdown ${countdown.text} -> ${later.text} box=${JSON.stringify(box)}`);

    await cancel();
    await page.bringToFront();
    const restored = await poll(readNote, value => value?.label === 'On-page volume 100%' && value.kind === 'volume' && value.text === '100%', '取消后应回到页内音量');
    await page.screenshot({ path: path.join(dir, 'note-restored.png'), animations: 'disabled' });
    note(`restored ${restored.label}`);

    await settings.bringToFront();
    await settings.goto(`chrome-extension://${extensionId}/options.html#backup`, { waitUntil: 'domcontentloaded' });
    const [download] = await Promise.all([settings.waitForEvent('download'), settings.getByRole('button', { name: 'Export settings', exact: true }).click()]);
    const exportPath = path.join(dir, 'export.json');
    await download.saveAs(exportPath);
    const exported = JSON.parse(await readFile(exportPath, 'utf8'));
    if (exported.settings?.floatingSleepNote !== true) throw new Error(`导出应带上打开的睡眠旁注：${JSON.stringify(exported.settings?.floatingSleepNote)}`);
    if (exported.settings?.floatingNote !== 'volume') throw new Error('导出不应改旁注偏好');
    note('export floatingSleepNote=true');

    await settings.goto(`chrome-extension://${extensionId}/options.html#floating`, { waitUntil: 'domcontentloaded' });
    await settings.getByRole('switch', { name: 'Countdown while sleeping', exact: true }).click();
    await poll(stored, value => value.floatingSleepNote === false, '导入前应先关掉开关');
    await settings.goto(`chrome-extension://${extensionId}/options.html#backup`, { waitUntil: 'domcontentloaded' });
    await settings.locator('#backup input[type="file"]').setInputFiles(exportPath);
    await settings.getByRole('button', { name: 'Replace settings', exact: true }).click();
    await poll(stored, value => value.floatingSleepNote === true && value.floatingNote === 'volume', '导入后应恢复打开的睡眠旁注');

    await page.bringToFront();
    await arm();
    const imported = await poll(readNote, value => {
      const seconds = clockOf(value?.text ?? '');
      return value?.kind === 'sleep' && seconds != null && seconds > 14 * 60 && seconds <= 15 * 60;
    }, '导入后再开定时，旁注应再次显示倒计时');
    await inside('导入后');
    await page.screenshot({ path: path.join(dir, 'note-imported.png'), animations: 'disabled' });
    note(`imported countdown ${imported.text}`);

    await cancel();
    await settings.bringToFront();
    await settings.goto(`chrome-extension://${extensionId}/options.html#floating`, { waitUntil: 'domcontentloaded' });
    const finish = settings.getByRole('switch', { name: 'Countdown while sleeping', exact: true });
    if ((await finish.getAttribute('aria-checked')) !== 'true') throw new Error('导入后开关应为打开');
    await finish.click();
    const done = await poll(stored, value => value.floatingSleepNote === false && value.floatingNote === 'volume' && value.floatingPosition?.side === 'right' && value.floatingPosition?.y === 0.8 && Object.keys(value.sitePrefs ?? {}).length === 0, '结束时应关掉开关，且不留下站点记忆');
    await page.bringToFront();
    await poll(readNote, value => value?.kind === 'volume' && value.text === '100%', '关掉开关且没有定时时旁注回到音量');
    const unknown = await unknownStorageKeys(worker);
    if (unknown.length) throw new Error(`出现了名单外的存储键：${unknown.join(', ')}`);
    const state = { ok: true, whileOff: whileOff.text, countdown: countdown.text, later: later.text, restored: restored.text, imported: imported.text, badge: toolbar, floatingPosition: done.floatingPosition, unknownStorageKeys: unknown, permissions };
    await writeFile(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
    return state;
  } finally {
    await popup?.close().catch(() => {});
    await settings?.close().catch(() => {});
    await page.close().catch(() => {});
  }
}

async function cleanup() {
  let session = null;
  try { session = await readJson(sessionPath); }
  catch { /* already gone */ }
  if (session?.pid && alive(session.pid)) {
    try { await callSession(session, 'POST', '/shutdown'); }
    catch { /* process may exit before the body returns */ }
    const deadline = Date.now() + 8_000;
    while (alive(session.pid) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    if (alive(session.pid)) process.kill(session.pid, 'SIGTERM');
    const killed = Date.now() + 4_000;
    while (alive(session.pid) && Date.now() < killed) await new Promise(resolve => setTimeout(resolve, 100));
    if (alive(session.pid)) process.kill(session.pid, 'SIGKILL');
  }
  const recorded = new Set(session?.browserPids ?? []);
  for (const pid of pidsUsingProfile(profileDir)) recorded.add(pid);
  for (const pid of recorded) {
    if (!alive(pid) || pid === process.pid) continue;
    if (!cmdline(pid).includes(profileDir)) continue;
    try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ }
  }
  await new Promise(resolve => setTimeout(resolve, 300));
  for (const pid of recorded) {
    if (!alive(pid) || !cmdline(pid).includes(profileDir)) continue;
    try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
  }
  if (path.resolve(stateDir).startsWith(path.resolve(evidenceRoot))) throw new Error('cleanup 拒绝删除证据目录');
  await rm(stateDir, { recursive: true, force: true });
  console.log(`ottertap-verify cleaned id=${id}`);
}

const [command, feature] = process.argv.slice(2);
try {
  if (command === 'serve') await serve();
  else if (command === 'launch') await launch();
  else if (command === 'doctor') await doctor();
  else if (command === 'drive') await drive(feature);
  else if (command === 'cleanup') await cleanup();
  else {
    console.error(`用法：node .cursor/skills/verify-ottertap/scripts/session.mjs <launch|doctor|drive|cleanup> [${supportedFeatures.join('|')}]`);
    process.exit(2);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
