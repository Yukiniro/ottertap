#!/usr/bin/env node
// OtterTap verification session. From the repo root:
//   node .cursor/skills/verify-ottertap/scripts/session.mjs launch
//   node .cursor/skills/verify-ottertap/scripts/session.mjs doctor
//   node .cursor/skills/verify-ottertap/scripts/session.mjs drive popup-playback
//   node .cursor/skills/verify-ottertap/scripts/session.mjs cleanup

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
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
const supportedFeatures = ['popup-playback'];

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

function silentWav() {
  const samples = 8000;
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

function fixtureHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>OtterTap fixture</title></head><body style="min-height:100vh;margin:0;background:#f4f1ea"><video id="media" aria-label="Fixture video" src="${wav}" preload="auto" playsinline loop controls style="display:block;width:640px;height:360px;margin:48px"></video></body></html>`;
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

async function openActionPopup(context, fixture) {
  await fixture.bringToFront();
  const worker = await serviceWorker(context);
  const cdp = await context.newCDPSession(fixture);
  await worker.evaluate(async () => { await chrome.action.openPopup(); });
  let targetId = '';
  let targets = [];
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const listed = await cdp.send('Target.getTargets');
    targets = listed.targetInfos ?? [];
    targetId = targets.find(item => item.type === 'page' && item.url.endsWith('/popup.html'))?.targetId ?? '';
    if (targetId) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!targetId) {
    await cdp.detach().catch(() => {});
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
      if (pathname !== fixturePath) {
        await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers: { 'cache-control': 'no-store' }, body: fixtureHtml() });
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
            const state = await drivePopupPlayback(context, dir, note);
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
    console.error('用法：node .cursor/skills/verify-ottertap/scripts/session.mjs <launch|doctor|drive|cleanup> [popup-playback]');
    process.exit(2);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
