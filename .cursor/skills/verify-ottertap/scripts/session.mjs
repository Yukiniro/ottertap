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
//   node .cursor/skills/verify-ottertap/scripts/session.mjs cleanup

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
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
const supportedFeatures = ['popup-playback', 'wheel-volume', 'skip-step', 'skip-with-rate', 'volume-step', 'fine-wheel', 'coarse-step', 'rate-step', 'extension-pip', 'default-rate', 'hold-boost', 'hold-skip-combo', 'frame-step', 'hotkey-remap', 'floating-speed', 'floating-playback', 'floating-entry-note', 'floating-open-panel', 'floating-while-playing', 'floating-hidden-sites', 'wheel-direction', 'fullscreen-wheel', 'sidebar-ignore', 'settings-memory-filter'];

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
  if (pathname === '/pip-off') return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>OtterTap fixture</title></head><body style="min-height:100vh;margin:0;background:#f4f1ea"><video id="media" aria-label="Fixture video" src="${wav}" preload="auto" playsinline disablepictureinpicture style="display:block;width:640px;height:360px;margin:48px"></video></body></html>`;
  if (pathname === '/unseekable') return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Unseekable</title></head><body style="min-height:100vh;margin:0;background:#f4f1ea"><video id="media" aria-label="Unseekable video" preload="none" style="display:block;width:640px;height:360px;margin:48px"></video></body></html>`;
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
  const view = await poll(() => evaluate(popupView), value => value?.region && value.button, '弹出面板应出现 Media controls 和播放按钮');
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
      await fixture.keyboard.press('Escape').catch(() => {});
      await cdp.send('Target.detachFromTarget', { sessionId }).catch(() => {});
      await cdp.detach().catch(() => {});
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
    const label = section.getByText('Enter or exit picture-in-picture', { exact: true });
    await label.waitFor({ state: 'visible' });
    if (await label.count() !== 1) throw new Error('画中画命令说明应只出现在扩展快捷键列表里');
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
    await settings.getByText('Sites without the floating button', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
    await settings.getByText('No sites yet.', { exact: false }).waitFor({ state: 'visible' });
    await settings.getByText('separate from Site rules', { exact: false }).waitFor({ state: 'visible' });
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
    await settings.getByText('No sites yet.', { exact: false }).waitFor({ state: 'visible', timeout: 5_000 });
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
    ignoreDefaultArgs: ['--disable-extensions'],
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
            const drivers = { 'popup-playback': drivePopupPlayback, 'wheel-volume': driveWheelVolume, 'skip-step': driveSkipStep, 'skip-with-rate': driveSkipWithRate, 'volume-step': driveVolumeStep, 'fine-wheel': driveFineWheel, 'coarse-step': driveCoarseStep, 'rate-step': driveRateStep, 'extension-pip': driveExtensionPip, 'default-rate': driveDefaultRate, 'hold-boost': driveHoldBoost, 'hold-skip-combo': driveHoldSkipCombo, 'frame-step': driveFrameStep, 'hotkey-remap': driveHotkeyRemap, 'floating-speed': driveFloatingSpeed, 'floating-playback': driveFloatingPlayback, 'floating-entry-note': driveFloatingEntryNote, 'floating-open-panel': driveFloatingOpenPanel, 'floating-while-playing': driveFloatingWhilePlaying, 'floating-hidden-sites': driveFloatingHiddenSites, 'wheel-direction': driveWheelDirection, 'fullscreen-wheel': driveFullscreenWheel, 'sidebar-ignore': driveSidebarIgnore, 'settings-memory-filter': driveSettingsMemoryFilter };
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

async function drive(feature) {
  if (!supportedFeatures.includes(feature)) throw new Error(`用法：drive ${supportedFeatures.join('|')}`);
  const session = await readJson(sessionPath);
  if (!alive(session.pid)) throw new Error('会话没有在跑。先 launch');
  const result = await callSession(session, 'POST', '/drive', { feature });
  console.log(`ottertap-verify drove feature=${result.feature} evidence=${result.evidenceDir}`);
  console.log(JSON.stringify(result.state, null, 2));
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
