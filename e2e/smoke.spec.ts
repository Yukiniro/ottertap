import { chromium, expect, test, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const host = 'media.ottertap.test';
const origin = `https://${host}`;
const extensionPath = fileURLToPath(new URL('../.output/chrome-mv3/', import.meta.url));
const settingsKey = 'ottertap-settings-v1';

type SitePref = { volume?: number; rate?: number; channel?: 'mono' | 'left' | 'right' };
type Settings = {
  theme: 'system';
  floating: boolean;
  floatingPosition: { side: 'right'; y: number };
  siteMode: 'all';
  sites: string[];
  sitePrefs: Record<string, SitePref>;
  hoverWheel?: boolean;
  singleKey?: boolean;
  lockRate?: boolean;
};
type WheelSnapshot = { deltaX: number; deltaY: number; deltaMode: number; altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean };
type ExtensionGlobal = {
  chrome: {
    action: {
      getBadgeBackgroundColor: (details: { tabId: number }) => Promise<number[]>;
      getBadgeText: (details: { tabId: number }) => Promise<string>;
      getTitle: (details: { tabId: number }) => Promise<string>;
    };
    storage: {
      local: {
        get: (key: string) => Promise<Record<string, Settings | undefined>>;
        set: (items: Record<string, Settings>) => Promise<void>;
      };
    };
    tabs: {
      get: (id: number) => Promise<{ id?: number; title?: string; mutedInfo?: { muted?: boolean } }>;
      query: (query: { url?: string }) => Promise<Array<{ id?: number; url?: string; title?: string }>>;
      update: (id: number, properties: { muted?: boolean }) => Promise<unknown>;
    };
  };
};

function defaultSettings(): Settings {
  return {
    theme: 'system',
    floating: true,
    floatingPosition: { side: 'right', y: 0.5 },
    siteMode: 'all',
    sites: [],
    sitePrefs: {},
  };
}

function silentWav() {
  const samples = 800;
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
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
  return bytes;
}

function base64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

const wav = `data:audio/wav;base64,${base64(silentWav())}`;

// Left is a 440 Hz sine at 0.5, right a 1000 Hz sine at 0.2. Half a second holds whole cycles of both, so it loops cleanly.
function stereoWav() {
  const rate = 8000;
  const frames = rate / 2;
  const bytes = new Uint8Array(44 + frames * 4);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) bytes[offset + index] = value.charCodeAt(index);
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + frames * 4, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, frames * 4, true);
  for (let frame = 0; frame < frames; frame += 1) {
    const time = frame / rate;
    view.setInt16(44 + frame * 4, Math.round(0.5 * Math.sin(2 * Math.PI * 440 * time) * 32767), true);
    view.setInt16(46 + frame * 4, Math.round(0.2 * Math.sin(2 * Math.PI * 1000 * time) * 32767), true);
  }
  return bytes;
}

const toneWav = stereoWav();
const tone = `data:audio/wav;base64,${base64(toneWav)}`;
const cdn = 'https://cdn.ottertap.test';
// RMS of each output channel for the tone above, per channel mode, at 100% volume.
const toneLevels = {
  stereo: [0.5 / Math.SQRT2, 0.2 / Math.SQRT2],
  mono: [Math.hypot(0.25, 0.1) / Math.SQRT2, Math.hypot(0.25, 0.1) / Math.SQRT2],
  left: [0.5 / Math.SQRT2, 0.5 / Math.SQRT2],
  right: [0.2 / Math.SQRT2, 0.2 / Math.SQRT2],
} as const;

function documentHtml(body: string, title = 'OtterTap fixture') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body style="min-height:100vh">${body}</body></html>`;
}

const pages: Record<string, string> = {
  '/': documentHtml(`<audio id="media" src="${wav}" preload="auto"></audio>`),
  '/empty': documentHtml('<p>empty</p>'),
  '/frame': documentHtml('<iframe title="embedded media" src="/embed" style="width:320px;height:180px;border:0"></iframe>'),
  '/embed': documentHtml(`<video id="media" src="${wav}" preload="auto" playsinline></video>`),
  '/video': documentHtml(`<video id="media" src="${wav}" preload="auto" playsinline></video>`),
  '/keys': documentHtml(`<video id="media" src="${wav}" preload="auto" playsinline style="display:block;width:640px;height:360px;margin-top:320px"></video><input id="field" aria-label="Field" style="margin-top:1200px">`),
  '/feed': documentHtml(`<video id="preview" aria-label="Feed preview" src="${wav}" preload="auto" playsinline loop style="display:block;width:240px;height:135px"></video><video id="media" aria-label="Main player" src="${wav}" preload="auto" playsinline loop style="display:block;width:640px;height:360px;margin-top:24px"></video><div style="height:1600px"></div>`),
  '/cards': documentHtml(`<video id="card" aria-label="Feed card" src="${wav}" preload="auto" playsinline loop style="display:block;width:240px;height:135px"></video><div style="height:1600px"></div>`),
  '/chat': documentHtml(`<div id="stage" style="position:relative;width:960px;height:540px;margin:24px"><video id="media" aria-label="Main player" src="${wav}" preload="auto" playsinline loop style="display:block;width:960px;height:540px;background:#111"></video><div id="chat" data-test-selector="chat-scrollable-area__message-container" class="chat-scrollable-area__message-container" style="position:absolute;top:0;right:0;width:280px;height:540px;overflow:auto;z-index:2;background:#fff;color:#111"><div style="height:2400px;padding:12px">live chat</div></div><aside id="outline" class="VPDocAside" style="position:absolute;top:16px;left:16px;width:180px;height:160px;overflow:auto;z-index:2;background:#fff;color:#111"><div style="height:800px;padding:8px">outline</div></aside><div id="overlay" style="position:absolute;left:16px;bottom:16px;width:140px;height:64px;z-index:2;background:#ddd">notes</div></div>`),
  '/pip-off': documentHtml(`<video id="media" src="${wav}" preload="auto" playsinline disablepictureinpicture></video>`),
  '/other': documentHtml(`<audio id="media" src="${wav}" preload="auto"></audio>`, 'Other tab'),
  '/stereo': documentHtml(`<audio id="media" src="${tone}" preload="auto" loop></audio>`),
  '/cross': documentHtml(`<audio id="media" src="${cdn}/tone.wav" preload="auto" loop></audio>`),
};

let browser: BrowserContext | undefined;

async function serviceWorker(context: BrowserContext) {
  return context.serviceWorkers()[0] ?? context.waitForEvent('serviceworker');
}

async function saveSettings(worker: Worker, settings: Settings) {
  await worker.evaluate(async ({ key, settings }) => {
    await (globalThis as unknown as ExtensionGlobal).chrome.storage.local.set({ [key]: settings });
  }, { key: settingsKey, settings });
}

async function toolbarBadge(page: Page) {
  if (!browser) throw new Error('浏览器还没有启动');
  const worker = await serviceWorker(browser);
  return worker.evaluate(async url => {
    const chrome = (globalThis as unknown as ExtensionGlobal).chrome;
    const tabId = (await chrome.tabs.query({ url })).find(tab => tab.url === url)?.id;
    if (tabId == null) return null;
    const [text, title, color] = await Promise.all([
      chrome.action.getBadgeText({ tabId }),
      chrome.action.getTitle({ tabId }),
      chrome.action.getBadgeBackgroundColor({ tabId }),
    ]);
    return { text, title, color: [...color] };
  }, page.url());
}

async function rememberedVolume(worker: Worker) {
  return worker.evaluate(async ({ key, host }) => {
    const stored = await (globalThis as unknown as ExtensionGlobal).chrome.storage.local.get(key);
    return stored[key]?.sitePrefs?.[host]?.volume ?? null;
  }, { key: settingsKey, host });
}

async function withPage(run: (page: Page) => Promise<void>) {
  if (!browser) throw new Error('浏览器还没有启动');
  const page = await browser.newPage();
  try { await run(page); }
  finally { await page.close(); }
}

async function openFixture(page: Page, path: string) {
  const response = await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), `${path} 应该由拦截返回`).toBe(true);
  await expect(page.getByRole('button', { name: /volume pill/i }), '页面上有媒体时应该出现浮动入口').toBeVisible();
}

async function mediaVolume(page: Page, framed = false) {
  const media = framed ? page.frameLocator('iframe').locator('#media') : page.locator('#media');
  return media.evaluate((element: HTMLMediaElement) => element.volume);
}

async function shownPercent(page: Page) {
  const raw = await page.getByRole('slider', { name: 'Volume' }).getAttribute('aria-valuenow');
  if (raw == null) throw new Error('音量滑块没有当前值');
  return Number(raw);
}

async function focusPage(page: Page, y = 240) {
  await page.mouse.click(48, y);
}

async function openPill(page: Page) {
  const slider = page.getByRole('slider', { name: 'Volume' });
  if (!(await slider.isVisible())) {
    const toggle = page.getByRole('button', { name: /volume pill/i });
    const box = await toggle.boundingBox();
    if (!box) throw new Error('浮动入口没有位置');
    await page.mouse.move(box.x + Math.min(8, box.width / 4), box.y + box.height / 2);
    await toggle.click();
  }
  await expect(slider).toBeVisible();
}

async function altWheel(page: Page, deltaY: number) {
  await page.keyboard.down('Alt');
  try { await page.mouse.wheel(0, deltaY); }
  finally { await page.keyboard.up('Alt'); }
}

async function volumeUp(page: Page) { await altWheel(page, -100); }
async function volumeDown(page: Page) { await altWheel(page, 100); }

/** Reads whether the extension's capture listener prevented each Alt release, the event Windows Chrome turns into menu focus. */
async function watchAltReleases(page: Page) {
  await page.evaluate(() => {
    const seen: boolean[] = [];
    (window as unknown as { __altReleases: boolean[] }).__altReleases = seen;
    // Capture, registered after the extension's: the floater isolates key events that reach its shadow root.
    window.addEventListener('keyup', event => { if (event.key === 'Alt') seen.push(event.defaultPrevented); }, true);
  });
  return async () => {
    const seen = await page.evaluate(() => (window as unknown as { __altReleases: boolean[] }).__altReleases.splice(0));
    expect(seen, '应收到一次 Alt 松开').toHaveLength(1);
    return seen[0];
  };
}

async function stepVolume(page: Page, step: (page: Page) => Promise<void>, expected: number, read: () => Promise<number> = () => mediaVolume(page)) {
  await step(page);
  await expect.poll(read).toBeCloseTo(expected, 2);
}

async function ready(page: Page) {
  await expect.poll(() => page.locator('#media').evaluate((element: HTMLMediaElement) => element.readyState)).toBeGreaterThanOrEqual(1);
}

function volumeAfterWheel(startPercent: number, wheel: WheelSnapshot) {
  const axis = wheel.deltaY || wheel.deltaX;
  const notches = wheel.deltaMode === 0 ? axis / 100 : axis;
  return Math.min(200, Math.max(0, startPercent - notches * 10));
}

test.beforeAll(async () => {
  browser = await chromium.launchPersistentContext('', {
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
  await serviceWorker(browser);
  await browser.addInitScript(() => {
    window.addEventListener('wheel', event => {
      (window as unknown as { __ottertapWheel?: WheelSnapshot }).__ottertapWheel = {
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
      };
    }, { capture: true });
  });
  await browser.route(`${origin}/**`, async route => {
    const body = pages[new URL(route.request().url()).pathname];
    if (!body) {
      await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers: { 'cache-control': 'no-store' }, body });
  });
  // No Access-Control-Allow-Origin: routing this through Web Audio would play silence.
  await browser.route(`${cdn}/**`, route => route.fulfill({ status: 200, contentType: 'audio/wav', body: Buffer.from(toneWav) }));
});

test.afterAll(async () => {
  await browser?.close();
});

test.beforeEach(async () => {
  if (!browser) throw new Error('浏览器还没有启动');
  await saveSettings(await serviceWorker(browser), defaultSettings());
});

test('拖动音量到 98% 附近会吸附到 100%', async () => {
  await withPage(async page => {
    await openFixture(page, '/');
    await ready(page);
    await focusPage(page);
    for (const expected of [0.9, 0.8, 0.7, 0.6, 0.5]) await stepVolume(page, volumeDown, expected);
    await openPill(page);
    const slider = page.locator('[data-slot="slider-thumb"]');
    await expect(slider.locator('input')).toHaveAttribute('max', '200');
    await expect.poll(() => shownPercent(page)).toBe(50);
    const thumb = await slider.boundingBox();
    if (!thumb) throw new Error('音量滑块没有位置');
    const target = await page.locator('[data-base-ui-slider-control]').evaluate((element, percent) => {
      const rect = element.getBoundingClientRect();
      const styles = getComputedStyle(element);
      const size = (value: string) => {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
      };
      const thumb = element.querySelector('[data-slot="slider-thumb"]');
      const input = thumb?.querySelector('input');
      if (!thumb || !input) throw new Error('找不到音量滑块');
      const max = Number(input.getAttribute('max'));
      const min = Number(input.getAttribute('min') ?? 0);
      const inset = thumb.getBoundingClientRect().height / 2;
      const controlSize = rect.height - size(styles.borderTopWidth) - size(styles.paddingTop) - size(styles.borderBottomWidth) - size(styles.paddingBottom) - inset * 2;
      const rescaled = (percent - min) / (max - min);
      return { x: rect.left + rect.width / 2, y: rect.bottom - size(styles.borderBottomWidth) - size(styles.paddingBottom) - inset - rescaled * controlSize };
    }, 98);
    await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
    await page.mouse.down();
    try { await page.mouse.move(target.x, target.y); }
    finally { await page.mouse.up(); }
    await expect.poll(() => shownPercent(page), { message: '拖到 98% 附近应吸附为 100%' }).toBe(100);
    await expect.poll(() => mediaVolume(page)).toBeCloseTo(1, 2);
  });
});

test('Alt+滚轮向上从 95% 先停在 100%，再按一次到 110%，且媒体音量不超过 1', async () => {
  await withPage(async page => {
    await openFixture(page, '/');
    await ready(page);
    await page.locator('#media').evaluate((element: HTMLMediaElement) => { element.volume = 0.95; });
    await focusPage(page);
    await volumeUp(page);
    await expect.poll(() => mediaVolume(page)).toBeCloseTo(1, 2);
    await openPill(page);
    await expect.poll(() => shownPercent(page)).toBe(100);
    await focusPage(page);
    await volumeUp(page);
    await openPill(page);
    await expect.poll(() => shownPercent(page)).toBe(110);
    const volume = await mediaVolume(page);
    expect(volume).toBeLessThanOrEqual(1);
    expect(volume).toBeCloseTo(1, 2);
    const amplified = await page.evaluate(() => {
      const media = document.querySelector('#media');
      if (!(media instanceof HTMLMediaElement)) return 'missing';
      const context = new AudioContext();
      try {
        context.createMediaElementSource(media);
        return 'not-connected';
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return /already connected/i.test(message) ? 'connected' : message;
      } finally { void context.close(); }
    });
    expect(amplified).toBe('connected');
  });
});

test('音量超过 100% 时工具栏角标显示，回到 100% 或来源 frame 消失后清除', async () => {
  await withPage(async page => {
    await openFixture(page, '/');
    await ready(page);
    await page.locator('#media').evaluate((element: HTMLMediaElement) => { element.volume = 0.95; });
    await focusPage(page);
    await volumeUp(page);
    await expect.poll(() => mediaVolume(page)).toBeCloseTo(1, 2);
    await volumeUp(page);
    await expect.poll(async () => (await toolbarBadge(page))?.text).toBe('110');
    const boosted = await toolbarBadge(page);
    expect(boosted?.title).toBe('Volume is boosted to 110%');
    expect(boosted?.color).toEqual([0xe4, 0x57, 0x2e, 255]);
    await volumeDown(page);
    await expect.poll(async () => (await toolbarBadge(page))?.text).toBe('');
  });
  await withPage(async page => {
    await openFixture(page, '/frame');
    const read = () => mediaVolume(page, true);
    await expect.poll(read).toBeCloseTo(1, 2);
    await focusPage(page, 420);
    await expect(async () => {
      const current = await read();
      if (Math.abs(current - 0.9) <= 0.02) return;
      expect(current).toBeCloseTo(1, 2);
      await volumeDown(page);
      await expect.poll(read, { timeout: 1_500 }).toBeCloseTo(0.9, 2);
    }).toPass({ timeout: 9_000 });
    await focusPage(page, 420);
    await volumeUp(page);
    await expect.poll(read).toBeCloseTo(1, 2);
    await volumeUp(page);
    await expect.poll(async () => (await toolbarBadge(page))?.text).toBe('110');
    await page.locator('iframe').evaluate(frame => frame.remove());
    await expect.poll(async () => (await toolbarBadge(page))?.text, { timeout: 6_000 }).toBe('');
  });
});

test('按住 Alt 时只有横向滚轮也能调节音量', async () => {
  await withPage(async page => {
    await openFixture(page, '/');
    await ready(page);
    await page.locator('#media').evaluate((element: HTMLMediaElement) => { element.volume = 0.5; });
    await focusPage(page);
    await page.mouse.move(200, 320);
    await page.keyboard.down('Alt');
    await page.mouse.wheel(100, 0);
    await page.keyboard.up('Alt');
    const wheel = await page.evaluate(() => (window as unknown as { __ottertapWheel?: WheelSnapshot }).__ottertapWheel);
    expect(wheel, '页面应收到滚轮事件').toBeTruthy();
    expect(wheel?.deltaY ?? -1, `应只有横向滚动量 ${JSON.stringify(wheel)}`).toBe(0);
    expect(wheel?.deltaX).not.toBe(0);
    expect(wheel?.altKey).toBe(true);
    expect(wheel?.shiftKey).toBe(false);
    const expected = volumeAfterWheel(50, wheel!);
    expect(expected).not.toBe(50);
    await expect.poll(() => mediaVolume(page)).toBeCloseTo(Math.min(expected, 100) / 100, 2);
  });
});

test('Alt + , . 0 调倍速、Alt + M 静音，在输入框里不触发', async () => {
  await withPage(async page => {
    await openFixture(page, '/keys');
    await ready(page);
    const state = () => page.locator('#media').evaluate((element: HTMLMediaElement) => ({ rate: element.playbackRate, muted: element.muted }));
    await focusPage(page, 300);
    await page.keyboard.press('Alt+Period');
    await expect.poll(state).toEqual({ rate: 1.25, muted: false });
    await page.keyboard.press('Alt+Period');
    await page.keyboard.press('Alt+Comma');
    await expect.poll(state).toEqual({ rate: 1.25, muted: false });
    await page.keyboard.press('Alt+Digit0');
    await expect.poll(state).toEqual({ rate: 1, muted: false });
    await page.keyboard.press('Alt+KeyM');
    await expect.poll(state).toEqual({ rate: 1, muted: true });
    await page.keyboard.press('Alt+KeyM');
    await expect.poll(state).toEqual({ rate: 1, muted: false });
    await page.locator('#field').focus();
    await page.keyboard.press('Alt+Period');
    await page.keyboard.press('Alt+KeyM');
    await page.waitForTimeout(300);
    expect(await state()).toEqual({ rate: 1, muted: false });
  });
});

test('1× 与之前的倍速来回切换，提示显示实际倍速', async () => {
  await withPage(async page => {
    if (!browser) throw new Error('浏览器还没有启动');
    await openFixture(page, '/keys');
    await ready(page);
    const rate = () => page.locator('#media').evaluate((element: HTMLMediaElement) => element.playbackRate);
    const hint = (text: string) => page.getByText(text, { exact: true });
    await focusPage(page, 300);
    await page.keyboard.press('Alt+Digit0');
    await page.waitForTimeout(300);
    expect(await rate(), '还没记过倍速时 Alt+0 不改变倍速').toBe(1);

    await page.keyboard.press('Alt+Period');
    await page.keyboard.press('Alt+Period');
    await expect.poll(rate).toBeCloseTo(1.5);
    await page.keyboard.press('Alt+Comma');
    await expect.poll(rate).toBeCloseTo(1.25);
    await page.keyboard.press('Alt+Digit0');
    await expect.poll(rate).toBe(1);
    await expect(hint('Speed 1×')).toBeVisible();
    await page.keyboard.press('Alt+Digit0');
    await expect.poll(rate).toBeCloseTo(1.25);
    await expect(hint('Speed 1.25×')).toBeVisible();

    await page.locator('#media').evaluate((element: HTMLMediaElement) => { element.playbackRate = 1.75; });
    await page.keyboard.press('Alt+Digit0');
    await expect.poll(rate).toBe(1);
    await page.keyboard.press('Alt+Digit0');
    await expect.poll(rate).toBeCloseTo(1.75);
    await expect(hint('Speed 1.75×')).toBeVisible();

    await page.locator('#media').evaluate((element: HTMLMediaElement) => {
      element.playbackRate = 2;
      element.playbackRate = 1;
    });
    expect(await rate()).toBe(1);
    await page.keyboard.press('Alt+Digit0');
    await expect.poll(rate).toBeCloseTo(2);
    await expect(hint('Speed 2×')).toBeVisible();

    const stored = await (await serviceWorker(browser)).evaluate(async key => {
      return JSON.stringify(await (globalThis as unknown as ExtensionGlobal).chrome.storage.local.get(key));
    }, settingsKey);
    expect(stored).not.toContain('recall');
  });
});

test('单键模式开启时 Alt+0 仍可在 1× 和之前的倍速间切换', async () => {
  if (!browser) throw new Error('浏览器还没有启动');
  const worker = await serviceWorker(browser);
  await saveSettings(worker, { ...defaultSettings(), singleKey: true });
  try {
    await withPage(async page => {
      await openFixture(page, '/keys');
      await ready(page);
      const rate = () => page.locator('#media').evaluate((element: HTMLMediaElement) => element.playbackRate);
      await focusPage(page, 300);
      await page.keyboard.press('Shift+Period');
      await expect.poll(rate).toBeCloseTo(1.25);
      await page.keyboard.press('Alt+Digit0');
      await expect.poll(rate).toBe(1);
      await page.keyboard.press('Alt+Digit0');
      await expect.poll(rate).toBeCloseTo(1.25);
    });
  } finally {
    await saveSettings(worker, defaultSettings());
  }
});

test('锁定倍速时来回切换后，站点改倍速会被写回新的目标', async () => {
  if (!browser) throw new Error('浏览器还没有启动');
  const worker = await serviceWorker(browser);
  await saveSettings(worker, { ...defaultSettings(), lockRate: true });
  try {
    await withPage(async page => {
      await openFixture(page, '/keys');
      await ready(page);
      const media = page.locator('#media');
      const rate = () => media.evaluate((element: HTMLMediaElement) => element.playbackRate);
      await focusPage(page, 300);
      await page.keyboard.press('Alt+Period');
      await expect.poll(rate).toBeCloseTo(1.25);
      await page.keyboard.press('Alt+Digit0');
      await expect.poll(rate).toBe(1);
      await media.evaluate((element: HTMLMediaElement) => { element.playbackRate = 1.25; });
      await expect.poll(rate, { timeout: 3_000 }).toBe(1);
      await page.keyboard.press('Alt+Digit0');
      await expect.poll(rate).toBeCloseTo(1.25);
      await media.evaluate((element: HTMLMediaElement) => { element.playbackRate = 1; });
      await expect.poll(rate, { timeout: 3_000 }).toBeCloseTo(1.25);
    });
  } finally {
    await saveSettings(worker, defaultSettings());
  }
});

test('用过 Alt+滚轮或 Alt+键后松开 Alt 被拦下，普通 Alt 按松与未匹配组合不拦', async () => {
  await withPage(async page => {
    await openFixture(page, '/keys');
    await ready(page);
    const media = page.locator('#media');
    await media.evaluate((element: HTMLMediaElement) => { element.volume = 0.5; });
    const released = await watchAltReleases(page);
    const overMedia = async () => {
      await page.evaluate(() => window.scrollTo(0, 0));
      const box = await media.boundingBox();
      if (!box) throw new Error('视频没有位置');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    };
    await focusPage(page, 300);

    await page.keyboard.press('Alt');
    expect(await released(), '单独按松 Alt 不拦截').toBe(false);

    await overMedia();
    await volumeUp(page);
    await expect.poll(() => mediaVolume(page)).toBeCloseTo(0.6, 2);
    expect(await released(), 'Alt+滚轮后松开 Alt 被拦下').toBe(true);

    await page.keyboard.press('Alt+KeyM');
    await expect.poll(() => media.evaluate((element: HTMLMediaElement) => element.muted)).toBe(true);
    expect(await released(), 'Alt+M 后松开 Alt 被拦下').toBe(true);

    await page.keyboard.press('Alt+KeyQ');
    expect(await released(), '没有匹配到我们的组合时不拦').toBe(false);

    await page.keyboard.down('Alt');
    await page.mouse.wheel(0, -100);
    await page.keyboard.down('Alt');
    await page.keyboard.down('Alt');
    await page.keyboard.up('Alt');
    expect(await released(), '按住 Alt 自动重复后松开仍被拦下').toBe(true);

    await page.locator('#field').focus();
    await overMedia();
    await volumeDown(page);
    expect(await released(), '焦点在输入框里时 Alt+滚轮后的松开也被拦下').toBe(true);
    await page.keyboard.press('Alt');
    expect(await released(), '输入框里普通 Alt 按松不拦').toBe(false);
  });
});

test('在 iframe 里的视频上 Alt+滚轮，焦点在顶层页面时松开 Alt 也被拦下', async () => {
  await withPage(async page => {
    await openFixture(page, '/frame');
    const read = () => mediaVolume(page, true);
    await expect.poll(read).toBeCloseTo(1, 2);
    const released = await watchAltReleases(page);
    await focusPage(page, 420);
    const box = await page.locator('iframe').boundingBox();
    if (!box) throw new Error('iframe 没有位置');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.down('Alt');
    await page.mouse.wheel(0, 100);
    await expect.poll(read).toBeCloseTo(0.9, 2);
    await page.waitForTimeout(100);
    await page.keyboard.up('Alt');
    expect(await released(), '顶层页面收到松开时已被 iframe 的手势标记').toBe(true);
    await page.keyboard.press('Alt');
    expect(await released()).toBe(false);
  });
});

test('悬停滚轮只作用在有声主播放器，静音信息流预览不拦截页面滚动', async () => {
  await withPage(async page => {
    await openFixture(page, '/feed');
    await ready(page);
    const main = page.locator('#media');
    const preview = page.locator('#preview');
    const play = (selector: string, muted: boolean, volume: number) => page.locator(selector).evaluate(async (element: HTMLMediaElement, options: { muted: boolean; volume: number }) => {
      element.muted = true;
      await element.play();
      element.muted = options.muted;
      element.volume = options.volume;
      return { paused: element.paused, muted: element.muted, volume: element.volume };
    }, { muted, volume });
    await play('#preview', true, 1);
    await play('#media', false, 0.5);
    await expect.poll(() => preview.evaluate((element: HTMLMediaElement) => ({ paused: element.paused, muted: element.muted }))).toEqual({ paused: false, muted: true });
    await expect.poll(() => main.evaluate((element: HTMLMediaElement) => ({ paused: element.paused, muted: element.muted, volume: element.volume }))).toEqual({ paused: false, muted: false, volume: 0.5 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const previewBox = await preview.boundingBox();
    if (!previewBox) throw new Error('预览没有位置');
    await page.mouse.move(previewBox.x + previewBox.width / 2, previewBox.y + previewBox.height / 2);
    await page.mouse.wheel(0, 120);
    await expect.poll(() => page.evaluate(() => window.scrollY), '静音预览上滚轮应滚动页面').toBeGreaterThan(0);
    expect(await preview.evaluate((element: HTMLMediaElement) => element.volume)).toBeCloseTo(1, 2);
    expect(await main.evaluate((element: HTMLMediaElement) => element.volume)).toBeCloseTo(0.5, 2);
    await page.evaluate(() => window.scrollTo(0, 0));
    const mainBox = await main.boundingBox();
    if (!mainBox) throw new Error('主播放器没有位置');
    await page.mouse.move(mainBox.x + mainBox.width / 2, mainBox.y + mainBox.height / 2);
    await page.waitForTimeout(300);
    await page.mouse.wheel(0, -100);
    await expect.poll(() => main.evaluate((element: HTMLMediaElement) => element.volume), '有声主播放器上裸滚轮调音量').toBeCloseTo(0.6, 2);
    expect(await page.evaluate(() => window.scrollY), '主播放器上滚轮不滚动页面').toBe(0);
  });
});

test('列表小视频即使有声播放也不拦截页面滚动，Alt+滚轮仍可调音量', async () => {
  await withPage(async page => {
    await openFixture(page, '/cards');
    const card = page.locator('#card');
    await expect.poll(() => card.evaluate((element: HTMLMediaElement) => element.readyState)).toBeGreaterThanOrEqual(1);
    await card.evaluate(async (element: HTMLMediaElement) => {
      element.muted = true;
      await element.play();
      element.muted = false;
      element.volume = 0.5;
    });
    await expect.poll(() => card.evaluate((element: HTMLMediaElement) => ({ paused: element.paused, muted: element.muted, volume: element.volume }))).toEqual({ paused: false, muted: false, volume: 0.5 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const box = await card.boundingBox();
    if (!box) throw new Error('小卡片没有位置');
    expect(box.width).toBeLessThan(1280 / 3);
    expect(box.height).toBeLessThan(720 / 3);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.screenshot({ path: test.info().outputPath('card-before.png') });
    await page.mouse.wheel(0, 120);
    await expect.poll(() => page.evaluate(() => window.scrollY), '小卡片上裸滚轮应滚动页面').toBeGreaterThan(0);
    expect(await card.evaluate((element: HTMLMediaElement) => element.volume), '小卡片音量不变').toBeCloseTo(0.5, 2);
    await page.screenshot({ path: test.info().outputPath('card-scrolled.png') });
    await page.evaluate(() => window.scrollTo(0, 0));
    const again = await card.boundingBox();
    if (!again) throw new Error('小卡片没有位置');
    await page.mouse.move(again.x + again.width / 2, again.y + again.height / 2);
    await page.keyboard.down('Alt');
    try { await page.mouse.wheel(0, -100); }
    finally { await page.keyboard.up('Alt'); }
    await expect.poll(() => card.evaluate((element: HTMLMediaElement) => element.volume), '小卡片上 Alt+滚轮仍调音量').toBeCloseTo(0.6, 2);
    expect(await page.evaluate(() => window.scrollY), 'Alt+滚轮不滚动页面').toBe(0);
  });
});

test('盖住主画面的侧栏聊天和文档大纲上，裸滚轮滚动列表且不改音量', async () => {
  await withPage(async page => {
    await openFixture(page, '/chat');
    const media = page.locator('#media');
    const chat = page.locator('#chat');
    const outline = page.locator('#outline');
    const overlay = page.locator('#overlay');
    await expect.poll(() => media.evaluate((element: HTMLMediaElement) => element.readyState)).toBeGreaterThanOrEqual(1);
    const stage = await media.boundingBox();
    if (!stage) throw new Error('主画面没有位置');
    expect(stage.width * 3).toBeGreaterThanOrEqual(1280);
    expect(stage.height * 3).toBeGreaterThanOrEqual(720);
    await media.evaluate(async (element: HTMLMediaElement) => {
      element.muted = true;
      await element.play();
      element.muted = false;
      element.volume = 0.5;
    });
    await expect.poll(() => media.evaluate((element: HTMLMediaElement) => ({ paused: element.paused, muted: element.muted, volume: element.volume }))).toEqual({ paused: false, muted: false, volume: 0.5 });
    const chatBox = await chat.boundingBox();
    if (!chatBox) throw new Error('聊天没有位置');
    expect(chatBox.x).toBeGreaterThan(stage.x);
    expect(chatBox.x + chatBox.width / 2).toBeLessThan(stage.x + stage.width);
    await page.mouse.move(chatBox.x + 36, chatBox.y + chatBox.height / 2);
    await page.waitForTimeout(350);
    await page.mouse.wheel(0, 160);
    await expect.poll(() => chat.evaluate((element: HTMLElement) => element.scrollTop), '聊天上的裸滚轮应滚动列表').toBeGreaterThan(20);
    expect(await media.evaluate((element: HTMLMediaElement) => element.volume), '聊天上的裸滚轮不改音量').toBeCloseTo(0.5, 2);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const chatScroll = await chat.evaluate((element: HTMLElement) => element.scrollTop);
    const outlineBox = await outline.boundingBox();
    if (!outlineBox) throw new Error('大纲没有位置');
    await page.mouse.move(outlineBox.x + outlineBox.width / 2, outlineBox.y + outlineBox.height / 2);
    await page.waitForTimeout(350);
    await page.mouse.wheel(0, 120);
    await expect.poll(() => outline.evaluate((element: HTMLElement) => element.scrollTop), '大纲上的裸滚轮应滚动大纲').toBeGreaterThan(20);
    expect(await media.evaluate((element: HTMLMediaElement) => element.volume)).toBeCloseTo(0.5, 2);
    expect(await chat.evaluate((element: HTMLElement) => element.scrollTop)).toBe(chatScroll);
    await page.waitForTimeout(350);
    await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
    await page.mouse.wheel(0, -100);
    await expect.poll(() => media.evaluate((element: HTMLMediaElement) => element.volume), '主画面上的裸滚轮仍调音量').toBeCloseTo(0.6, 2);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(await chat.evaluate((element: HTMLElement) => element.scrollTop)).toBe(chatScroll);
    const overlayBox = await overlay.boundingBox();
    if (!overlayBox) throw new Error('未知叠层没有位置');
    await page.waitForTimeout(350);
    await page.mouse.move(overlayBox.x + overlayBox.width / 2, overlayBox.y + overlayBox.height / 2);
    await page.mouse.wheel(0, -100);
    await expect.poll(() => media.evaluate((element: HTMLMediaElement) => element.volume), '认不出的叠层仍按主画面调音').toBeCloseTo(0.7, 2);
    const chatAgain = await chat.boundingBox();
    if (!chatAgain) throw new Error('聊天没有位置');
    await page.mouse.move(chatAgain.x + 36, chatAgain.y + 80);
    await page.waitForTimeout(350);
    await page.keyboard.down('Alt');
    try { await page.mouse.wheel(0, -100); }
    finally { await page.keyboard.up('Alt'); }
    await expect.poll(() => media.evaluate((element: HTMLMediaElement) => element.volume), '聊天上的 Alt+滚轮仍调音量').toBeCloseTo(0.8, 2);
    expect(await chat.evaluate((element: HTMLElement) => element.scrollTop), 'Alt+滚轮不滚动聊天').toBe(chatScroll);
    await page.waitForTimeout(350);
    await page.keyboard.down('Shift');
    try { await page.mouse.wheel(0, -100); }
    finally { await page.keyboard.up('Shift'); }
    await expect.poll(() => media.evaluate((element: HTMLMediaElement) => element.volume), '聊天上的 Shift+滚轮仍按粗调步长调音').toBeCloseTo(1, 2);
    expect(await chat.evaluate((element: HTMLElement) => element.scrollTop), 'Shift+滚轮不滚动聊天').toBe(chatScroll);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test('页面连续滚动经过视频不接管，停顿后重新滚动才调音量', async () => {
  await withPage(async page => {
    await openFixture(page, '/keys');
    await ready(page);
    const media = page.locator('#media');
    await media.evaluate((element: HTMLMediaElement) => {
      element.style.marginTop = '400px';
      element.volume = 0.5;
    });
    await page.mouse.move(100, 350);
    await page.mouse.wheel(0, 100);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(50);
    const box = await media.boundingBox();
    expect(box!.y).toBeLessThan(350);
    expect(box!.y + box!.height).toBeGreaterThan(350);
    await page.mouse.wheel(0, 50);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(120);
    expect(await mediaVolume(page)).toBeCloseTo(0.5, 2);
    await page.screenshot({ path: test.info().outputPath('page-scroll-over-video.png') });
    await page.waitForTimeout(350);
    const scroll = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, -100);
    await expect.poll(() => mediaVolume(page)).toBeCloseTo(0.6, 2);
    expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
    await page.screenshot({ path: test.info().outputPath('volume-after-rest.png') });
    // An explicit Alt gesture also works while a page-scroll gesture is still active.
    await page.mouse.move(700, 350);
    await page.mouse.wheel(0, 50);
    await volumeUp(page);
    await expect.poll(() => mediaVolume(page)).toBeCloseTo(0.7, 2);
  });
});

test('默认悬停在视频上直接滚轮调音量，不在视频上照常滚动；关闭后回落为 Alt+滚轮', async () => {
  await withPage(async page => {
    if (!browser) throw new Error('浏览器还没有启动');
    await openFixture(page, '/keys');
    await ready(page);
    const media = page.locator('#media');
    const hover = async () => {
      await page.evaluate(() => window.scrollTo(0, 0));
      const box = await media.boundingBox();
      if (!box) throw new Error('视频没有位置');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      return box;
    };
    await media.evaluate((element: HTMLMediaElement) => { element.volume = 0.5; });
    const box = await hover();
    await page.mouse.wheel(0, -100);
    await expect.poll(() => mediaVolume(page), '默认开启时裸滚轮调音量').toBeCloseTo(0.6, 2);
    expect(await page.evaluate(() => window.scrollY), '在视频上滚轮不滚动页面').toBe(0);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height + 200);
    await page.mouse.wheel(0, 100);
    await expect.poll(() => page.evaluate(() => window.scrollY), '不在视频上时页面照常滚动').toBeGreaterThan(0);
    expect(await mediaVolume(page)).toBeCloseTo(0.6, 2);

    await saveSettings(await serviceWorker(browser), { ...defaultSettings(), hoverWheel: false });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready(page);
    await media.evaluate((element: HTMLMediaElement) => { element.volume = 0.5; });
    await hover();
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(300);
    expect(await mediaVolume(page), '关闭后裸滚轮不调音量').toBeCloseTo(0.5, 2);
    await hover();
    await volumeUp(page);
    await expect.poll(() => mediaVolume(page), '关闭后 Alt+滚轮照常调音量').toBeCloseTo(0.6, 2);
  });
});

test('单键模式：M 静音、↑ 只在悬停视频时调音量，输入框里不触发', async () => {
  await withPage(async page => {
    if (!browser) throw new Error('浏览器还没有启动');
    await saveSettings(await serviceWorker(browser), { ...defaultSettings(), singleKey: true });
    await openFixture(page, '/keys');
    await ready(page);
    const media = page.locator('#media');
    await media.evaluate((element: HTMLMediaElement) => { element.volume = 0.5; });
    const muted = () => media.evaluate((element: HTMLMediaElement) => element.muted);
    await focusPage(page, 300);
    await page.keyboard.press('KeyM');
    await expect.poll(muted).toBe(true);
    await page.keyboard.press('KeyM');
    await expect.poll(muted).toBe(false);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(300);
    expect(await mediaVolume(page), '不在视频上时 ↑ 留给页面').toBeCloseTo(0.5, 2);
    const box = await media.boundingBox();
    if (!box) throw new Error('视频没有位置');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => mediaVolume(page)).toBeCloseTo(0.6, 2);
    await page.locator('#field').focus();
    await page.keyboard.press('KeyM');
    await expect(page.locator('#field')).toHaveValue('m');
    expect(await muted()).toBe(false);
  });
});

test('顶层页面的快捷键能控制 iframe 里的视频', async () => {
  await withPage(async page => {
    await openFixture(page, '/frame');
    const read = () => mediaVolume(page, true);
    await expect.poll(read).toBeCloseTo(1, 2);
    await focusPage(page, 420);
    await expect(async () => {
      const current = await read();
      if (Math.abs(current - 0.9) <= 0.02) return;
      expect(current).toBeCloseTo(1, 2);
      await volumeDown(page);
      await expect.poll(read, { timeout: 1_500 }).toBeCloseTo(0.9, 2);
    }).toPass({ timeout: 9_000 });
  });
});

test('打开按站点记住后，刷新页面能恢复音量', async () => {
  await withPage(async page => {
    if (!browser) throw new Error('浏览器还没有启动');
    const worker = await serviceWorker(browser);
    const settings = defaultSettings();
    settings.sitePrefs[host] = { volume: 1, rate: 1 };
    await saveSettings(worker, settings);
    await openFixture(page, '/');
    await focusPage(page);
    for (const expected of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]) await stepVolume(page, volumeDown, expected);
    await expect.poll(() => rememberedVolume(worker)).toBeCloseTo(0.4, 2);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => mediaVolume(page)).toBeCloseTo(0.4, 2);
  });
});

test('没有媒体的页面加载后不再定时上报', async () => {
  await withPage(async page => {
    if (!browser) throw new Error('浏览器还没有启动');
    const worker = await serviceWorker(browser);
    await worker.evaluate(() => {
      const root = globalThis as unknown as {
        __ottertapLog?: Array<{ type: string }>;
        __ottertapListening?: boolean;
        chrome: { runtime: { onMessage: { addListener: (listener: (message: { namespace?: string; type?: string }) => void) => void } } };
      };
      root.__ottertapLog = [];
      if (root.__ottertapListening) return;
      root.__ottertapListening = true;
      root.chrome.runtime.onMessage.addListener(message => {
        if (message?.namespace !== 'ottertap') return;
        root.__ottertapLog?.push({ type: message.type ?? '' });
      });
    });
    await page.goto(`${origin}/empty`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const startup = await worker.evaluate(() => {
      const root = globalThis as unknown as { __ottertapLog?: Array<{ type: string }> };
      const log = root.__ottertapLog ?? [];
      const counts: Record<string, number> = {};
      for (const item of log) counts[item.type] = (counts[item.type] ?? 0) + 1;
      root.__ottertapLog = [];
      return counts;
    });
    expect(startup.context ?? 0, '启动时应询问一次是否启用').toBeGreaterThan(0);
    await page.waitForTimeout(10_000);
    const tally = await worker.evaluate(() => {
      const log = (globalThis as unknown as { __ottertapLog?: Array<{ type: string }> }).__ottertapLog ?? [];
      const counts: Record<string, number> = {};
      for (const item of log) counts[item.type] = (counts[item.type] ?? 0) + 1;
      return counts;
    });
    expect(tally.context ?? 0, '加载完成后不应再定时询问 context').toBe(0);
    expect(tally.register ?? 0, '没有媒体时不应定时 register').toBe(0);
    expect(tally.read ?? 0, '没有媒体时浮动入口不应持续读取').toBeLessThan(3);
  });
});

test('英文设置页的快捷键一节不写死中文', async () => {
  await withPage(async page => {
    if (!browser) throw new Error('浏览器还没有启动');
    const extensionId = new URL((await serviceWorker(browser)).url()).host;
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const shortcuts = page.locator('#shortcuts');
    await expect(shortcuts).toBeVisible();
    await expect(shortcuts).toContainText('Keyboard shortcuts');
    await expect(shortcuts).toContainText('Play or pause');
    await expect(shortcuts).toContainText('Enter or exit picture-in-picture');
    await expect(shortcuts).toContainText('Edit shortcuts');
    await expect(shortcuts).toContainText('Not set');
    await expect(shortcuts).toContainText('On-page shortcuts');
    await expect(shortcuts).toContainText('Extension shortcuts work only while the browser window is focused.');
    await expect(shortcuts).toContainText('Mouse wheel');
    await expect(shortcuts).toContainText('Increase volume by 10 percentage points');
    await expect(shortcuts).toContainText('Decrease volume by 10 percentage points');
    await expect(shortcuts).toContainText('Adjust volume continuously');
    await expect(shortcuts).toContainText('On Mac, use Option instead of Alt.');
    await expect(shortcuts).toContainText('Alt + Mouse wheel');
    await expect(shortcuts).toContainText('Alt + .');
    await expect(shortcuts).toContainText('Alt + M');
    await expect(shortcuts).toContainText('Toggle between 1× and the previous speed');
    await expect(shortcuts).toContainText('Back to 1×, press again to restore');
    await expect(shortcuts).not.toContainText('Reset speed to 1×');
    await expect(shortcuts).toContainText('Single-key mode');
    await expect(shortcuts).toContainText('Scroll over the main player to change volume');
    await expect(shortcuts).not.toContainText('Alt + Shift');
    for (const chinese of ['快捷键', '滚轮', '提高音量', '降低音量']) await expect(shortcuts).not.toContainText(chinese);
  });
});

async function readActionPopup(fixture: Page) {
  if (!browser) throw new Error('浏览器还没有启动');
  await fixture.bringToFront();
  const worker = await serviceWorker(browser);
  await worker.evaluate(async () => {
    await (globalThis as unknown as { chrome: { action: { openPopup: () => Promise<void> } } }).chrome.action.openPopup();
  });
  const session = await fixture.context().newCDPSession(fixture);
  let targetId = '';
  await expect.poll(async () => {
    const { targetInfos } = await session.send('Target.getTargets');
    targetId = targetInfos.find(item => item.type === 'page' && item.url.endsWith('/popup.html'))?.targetId ?? '';
    return targetId;
  }).not.toBe('');
  const { sessionId } = await session.send('Target.attachToTarget', { targetId, flatten: false });
  let next = 1;
  const read = (expression: string) => new Promise<unknown>((resolve, reject) => {
    const id = next++;
    const timer = setTimeout(() => {
      session.off('Target.receivedMessageFromTarget', onMessage);
      reject(new Error('弹出面板没有响应'));
    }, 4_000);
    const onMessage = (event: { sessionId?: string; message: string }) => {
      if (event.sessionId !== sessionId) return;
      const message = JSON.parse(event.message) as { id?: number; error?: unknown; result?: { result?: { value?: unknown } } };
      if (message.id !== id) return;
      clearTimeout(timer);
      session.off('Target.receivedMessageFromTarget', onMessage);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result?.result?.value);
    };
    session.on('Target.receivedMessageFromTarget', onMessage);
    void session.send('Target.sendMessageToTarget', {
      sessionId,
      message: JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }),
    });
  });
  return read;
}

const pipButtonState = `(() => {
  const button = [...document.querySelectorAll('button')].find(item => item.getAttribute('aria-label') === 'Picture-in-picture' || item.getAttribute('aria-label') === 'Exit picture-in-picture');
  if (!button) return null;
  return { label: button.getAttribute('aria-label'), disabled: button.disabled, hint: document.getElementById('pip-hint')?.textContent ?? '' };
})()`;

test('单媒体弹出面板常用控制完整可见且说明可展开', async () => {
  await withPage(async page => {
    await openFixture(page, '/video');
    const read = await readActionPopup(page);
    try {
      await expect.poll(() => read(`document.querySelector('h1')?.textContent`)).toBe('OtterTap fixture');
      const layout = await read(`(() => {
        const root = document.documentElement;
        const panel = document.querySelector('[aria-label="Media controls"]');
        const presets = document.querySelector('[aria-labelledby="speed-label"]');
        return { height: panel.getBoundingClientRect().height, viewportHeight: root.clientHeight, scrollHeight: root.scrollHeight,
          overflowX: root.scrollWidth > root.clientWidth,
          controlsBottom: presets.getBoundingClientRect().bottom,
          playSize: document.querySelector('[aria-label="Play"]').getBoundingClientRect().width,
          presets: presets.querySelectorAll('button').length };
      })()`) as { height: number; viewportHeight: number; overflowX: boolean; controlsBottom: number; playSize: number; presets: number };
      console.log('[popup layout]', layout);
      expect(layout.height).toBeLessThanOrEqual(600);
      expect(layout.overflowX).toBe(false);
      expect(layout.controlsBottom).toBeLessThanOrEqual(layout.viewportHeight);
      expect(layout.playSize).toBeGreaterThanOrEqual(44);
      expect(layout.presets).toBe(8);
      const description = await read(`(() => {
        const trigger = document.querySelector('[data-slot="popover-trigger"]');
        trigger.click();
        return trigger.getAttribute('aria-label');
      })()`);
      await expect.poll(() => read(`document.querySelector('[data-slot="popover-description"]')?.textContent`)).toBe(description);
      expect(await read(`document.querySelector('[role="switch"][aria-label="Remember this site"]').getAttribute('aria-checked')`)).toBe('false');
    } finally { await page.keyboard.press('Escape'); }
  });
});

test('弹出面板预设改倍速后，Alt+0 记住的是这个倍速', async () => {
  await withPage(async page => {
    await openFixture(page, '/video');
    await ready(page);
    const rate = () => page.locator('#media').evaluate((element: HTMLMediaElement) => element.playbackRate);
    const read = await readActionPopup(page);
    try {
      await expect.poll(() => read(`(() => {
        const button = [...document.querySelectorAll('button')].find(item => item.getAttribute('aria-label') === '2× speed');
        if (!button) return 'missing';
        button.click();
        return 'clicked';
      })()`)).toBe('clicked');
      await expect.poll(rate).toBeCloseTo(2);
    } finally { await page.keyboard.press('Escape'); }
    await focusPage(page, 300);
    await page.keyboard.press('Alt+Digit0');
    await expect.poll(rate).toBe(1);
    await page.keyboard.press('Alt+Digit0');
    await expect.poll(rate).toBeCloseTo(2);
    await expect(page.getByText('Speed 2×', { exact: true })).toBeVisible();
  });
});

test('画中画按钮在视频上可点，音频和站点禁用时说明原因', async () => {
  await withPage(async page => {
    await openFixture(page, '/');
    const read = await readActionPopup(page);
    try {
      await expect.poll(() => read(pipButtonState)).toEqual({ label: 'Picture-in-picture', disabled: true, hint: "Audio can't use picture-in-picture." });
    } finally { await page.keyboard.press('Escape'); }
  });
  await withPage(async page => {
    await openFixture(page, '/pip-off');
    const read = await readActionPopup(page);
    try {
      await expect.poll(() => read(pipButtonState)).toEqual({ label: 'Picture-in-picture', disabled: true, hint: 'This site has turned off picture-in-picture.' });
    } finally { await page.keyboard.press('Escape'); }
  });
  await withPage(async page => {
    await openFixture(page, '/video');
    const available = await page.locator('#media').evaluate((element: HTMLVideoElement) => document.pictureInPictureEnabled === true && typeof element.requestPictureInPicture === 'function' && !element.disablePictureInPicture);
    const read = await readActionPopup(page);
    try {
      await expect.poll(() => read(pipButtonState)).toEqual(available
        ? { label: 'Picture-in-picture', disabled: false, hint: '' }
        : { label: 'Picture-in-picture', disabled: true, hint: "This browser can't use picture-in-picture." });
    } finally { await page.keyboard.press('Escape'); }
  });
});

test('已静音的其他标签会列在弹出面板，取消静音后不再列出', async () => {
  // Headless Chromium does not reliably mark a tab audible, so this covers mutedInfo only.
  await withPage(async page => {
    if (!browser) throw new Error('浏览器还没有启动');
    await openFixture(page, '/other');
    const worker = await serviceWorker(browser);
    const muted = await worker.evaluate(async url => {
      const chrome = (globalThis as unknown as ExtensionGlobal).chrome;
      const tab = (await chrome.tabs.query({ url })).find(item => item.url === url);
      if (tab?.id == null) return null;
      await chrome.tabs.update(tab.id, { muted: true });
      const next = await chrome.tabs.get(tab.id);
      return { id: tab.id, muted: next.mutedInfo?.muted === true, title: next.title ?? '' };
    }, page.url());
    expect(muted?.title).toBe('Other tab');
    expect(muted?.muted, '标签静音应与浏览器喇叭状态一致').toBe(true);
    const extensionId = new URL(worker.url()).host;
    const popup = await browser.newPage();
    try {
      await popup.goto(`chrome-extension://${extensionId}/popup.html`);
      const row = popup.getByRole('button', { name: 'Switch to Other tab' });
      await expect(row).toBeVisible();
      await popup.getByRole('button', { name: 'Unmute' }).click();
      await expect.poll(() => worker.evaluate(async id => {
        const next = await (globalThis as unknown as ExtensionGlobal).chrome.tabs.get(id);
        return next.mutedInfo?.muted === true;
      }, muted!.id)).toBe(false);
      await expect(row).toHaveCount(0);
      await expect(popup.getByText('No other tabs are playing audio.')).toBeVisible();
    } finally { await popup.close(); }
  });
});

type Levels = { rms: number[]; peak: number };

// Runs in the content script's isolated world: copies whatever the extension sends to its
// AudioContext destination into two analysers, so the test hears exactly what the user would.
const tapScript = `(() => {
  if (globalThis.__ottertapTapInstalled) return true;
  globalThis.__ottertapTapInstalled = true;
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (target, ...rest) {
    const result = connect.call(this, target, ...rest);
    if (target instanceof AudioDestinationNode && !globalThis.__ottertapTap) {
      const split = this.context.createChannelSplitter(2);
      connect.call(this, split);
      const analysers = [0, 1].map(index => {
        const analyser = this.context.createAnalyser();
        analyser.fftSize = 8192;
        connect.call(split, analyser, index);
        return analyser;
      });
      globalThis.__ottertapTap = () => {
        let peak = 0;
        const rms = analysers.map(analyser => {
          const data = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(data);
          let sum = 0;
          for (const value of data) { sum += value * value; peak = Math.max(peak, Math.abs(value)); }
          return Math.sqrt(sum / data.length);
        });
        return { rms, peak };
      };
    }
    return result;
  };
  return true;
})()`;

// Pass navigate to install the tap as soon as the content script's world exists, ahead of any restore on load.
async function tapExtensionAudio(page: Page, navigate?: () => Promise<unknown>) {
  const session = await page.context().newCDPSession(page);
  let found: (id: number) => void = () => {};
  const world = new Promise<number>(resolve => { found = resolve; });
  session.on('Runtime.executionContextCreated', ({ context }) => {
    if (context.auxData?.type !== 'isolated' || !context.name.startsWith('OtterTap')) return;
    void session.send('Runtime.evaluate', { expression: tapScript, contextId: context.id }).catch(() => {});
    found(context.id);
  });
  await session.send('Runtime.enable');
  await navigate?.();
  const contextId = await Promise.race([world, new Promise<number>((_, reject) => setTimeout(() => reject(new Error('找不到扩展内容脚本的执行环境')), 8_000))]);
  const evaluate = async (expression: string) => {
    const { result, exceptionDetails } = await session.send('Runtime.evaluate', { expression, contextId, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value as unknown;
  };
  expect(await evaluate(tapScript)).toBe(true);
  return { read: () => evaluate('globalThis.__ottertapTap?.() ?? null') as Promise<Levels | null> };
}

async function expectLevels(tap: Awaited<ReturnType<typeof tapExtensionAudio>>, label: string, expected: readonly number[], options: { tolerance?: number; maxPeak?: number } = {}) {
  const tolerance = options.tolerance ?? 0.15;
  const check = (levels: Levels | null) => {
    expect(levels, `${label}：扩展没有把媒体接到输出`).not.toBeNull();
    levels!.rms.forEach((value, index) => {
      expect(Math.abs(value - expected[index]!) <= expected[index]! * tolerance, `${label} 声道 ${index} 电平 ${value.toFixed(3)}，预期约 ${expected[index]!.toFixed(3)}`).toBe(true);
    });
    if (options.maxPeak !== undefined) expect(levels!.peak, `${label} 峰值`).toBeLessThanOrEqual(options.maxPeak);
    return levels!;
  };
  await expect(async () => { check(await tap.read()); }).toPass({ timeout: 8_000 });
  // The first passing window may still hold the glide; read again once it has settled.
  await new Promise(resolve => setTimeout(resolve, 300));
  const settled = check(await tap.read());
  console.log(`[levels] ${label}: L=${settled.rms[0]!.toFixed(3)} R=${settled.rms[1]!.toFixed(3)} peak=${settled.peak.toFixed(3)}`);
}

async function mediaRouted(page: Page) {
  return page.evaluate(() => {
    const media = document.querySelector('#media');
    if (!(media instanceof HTMLMediaElement)) return 'missing';
    const context = new AudioContext();
    try {
      context.createMediaElementSource(media);
      return 'not-connected';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return /already connected/i.test(message) ? 'connected' : message;
    } finally { void context.close(); }
  });
}

async function play(page: Page) {
  await focusPage(page);
  await page.locator('#media').evaluate((element: HTMLMediaElement) => element.play());
}

const channelControl = `(() => {
  const button = [...document.querySelectorAll('button')].find(item => item.getAttribute('aria-label')?.startsWith('Channels: '));
  if (!button) return null;
  return { label: button.getAttribute('aria-label'), disabled: button.disabled, hint: document.getElementById('channel-hint')?.textContent ?? '' };
})()`;

const chooseChannel = (name: string) => `(async () => {
  const button = [...document.querySelectorAll('button')].find(item => item.getAttribute('aria-label')?.startsWith('Channels: '));
  if (!button || button.disabled) return 'no-trigger';
  button.click();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const item = [...document.querySelectorAll('[role="menuitemradio"]')].find(node => node.textContent === ${JSON.stringify(name)});
    if (item) { item.click(); return 'chosen'; }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return 'no-item';
})()`;

const sendChannel = (mode: string) => `(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const page = await chrome.runtime.sendMessage({ namespace: 'ottertap', type: 'read', tabId: tab.id });
  return chrome.runtime.sendMessage({ namespace: 'ottertap', type: 'command', tabId: tab.id, id: page.media[0].id, command: { type: 'channel', value: ${JSON.stringify(mode)} } });
})()`;

const channelNames = { stereo: 'Stereo', mono: 'Mono', left: 'Left channel only', right: 'Right channel only' } as const;

test('默认立体声：打开弹出面板、在 100% 内调音量都不接入 Web Audio', async () => {
  await withPage(async page => {
    await openFixture(page, '/stereo');
    await ready(page);
    const tap = await tapExtensionAudio(page);
    await play(page);
    for (const expected of [0.9, 0.8]) await stepVolume(page, volumeDown, expected);
    const popup = await readActionPopup(page);
    try {
      await expect.poll(() => popup(channelControl)).toEqual({ label: 'Channels: Stereo', disabled: false, hint: '' });
    } finally { await page.keyboard.press('Escape'); }
    expect(await tap.read(), '没选非立体声时扩展不应创建输出链路').toBeNull();
    expect(await mediaRouted(page), '媒体不应被 createMediaElementSource 接管').toBe('not-connected');
  });
});

test('切换声道后两侧电平符合模式，切回立体声恢复原样，叠加 200% 放大不破音', async () => {
  await withPage(async page => {
    await openFixture(page, '/stereo');
    await ready(page);
    const tap = await tapExtensionAudio(page);
    await play(page);
    let popup = await readActionPopup(page);
    try {
      await expect.poll(() => popup(channelControl)).toEqual({ label: 'Channels: Stereo', disabled: false, hint: '' });
      for (const mode of ['mono', 'left', 'right', 'stereo', 'mono'] as const) {
        expect(await popup(chooseChannel(channelNames[mode]))).toBe('chosen');
        await expect.poll(() => popup(channelControl)).toMatchObject({ label: `Channels: ${channelNames[mode]}`, disabled: false });
        await expectLevels(tap, `${mode} @100%`, toneLevels[mode], { maxPeak: 1 });
      }
    } finally { await page.keyboard.press('Escape'); }
    await focusPage(page);
    for (let step = 0; step < 10; step += 1) { await volumeUp(page); await page.waitForTimeout(60); }
    await expect.poll(async () => (await toolbarBadge(page))?.text).toBe('200');
    expect(await mediaVolume(page)).toBeCloseTo(1, 2);
    await expectLevels(tap, 'mono @200%', toneLevels.mono.map(value => value * 2), { tolerance: 0.2, maxPeak: 1 });
    popup = await readActionPopup(page);
    try {
      await expect.poll(() => popup(channelControl)).toMatchObject({ label: 'Channels: Mono' });
      for (const mode of ['left', 'stereo'] as const) {
        expect(await popup(chooseChannel(channelNames[mode]))).toBe('chosen');
        await expect.poll(() => popup(channelControl)).toMatchObject({ label: `Channels: ${channelNames[mode]}` });
      }
    } finally { await page.keyboard.press('Escape'); }
    // Left at 200% would peak at 1.0; the limiter holds it under full scale.
    await expectLevels(tap, 'stereo @200%', toneLevels.stereo.map(value => value * 2), { tolerance: 0.25, maxPeak: 1 });
    expect(await mediaRouted(page)).toBe('connected');
  });
});

test('跨域且无 CORS 的媒体：声道入口置灰并说明原因，强行下发也不接入、不变无声', async () => {
  await withPage(async page => {
    await openFixture(page, '/cross');
    const tap = await tapExtensionAudio(page);
    await focusPage(page);
    const popup = await readActionPopup(page);
    const reason = 'This media is from another site, so its channels cannot be changed.';
    try {
      await expect.poll(() => popup(channelControl)).toEqual({ label: 'Channels: Stereo', disabled: true, hint: reason });
      expect(await popup(sendChannel('mono'))).toEqual({ error: reason });
      await expect.poll(() => popup(channelControl)).toEqual({ label: 'Channels: Stereo', disabled: true, hint: reason });
    } finally { await page.keyboard.press('Escape'); }
    expect(await tap.read()).toBeNull();
    expect(await mediaRouted(page)).toBe('not-connected');
  });
});

test('按站点记住的声道在下次打开时恢复，设置页摘要列出非立体声', async () => {
  await withPage(async page => {
    if (!browser) throw new Error('浏览器还没有启动');
    const worker = await serviceWorker(browser);
    const settings = defaultSettings();
    settings.sitePrefs[host] = { volume: 1, rate: 1, channel: 'left' };
    await saveSettings(worker, settings);
    const tap = await tapExtensionAudio(page, () => openFixture(page, '/stereo'));
    await ready(page);
    await play(page);
    const popup = await readActionPopup(page);
    try {
      await expect.poll(() => popup(channelControl)).toMatchObject({ label: 'Channels: Left channel only' });
      expect(await popup(`document.querySelector('[role="switch"][aria-label="Remember this site"]')?.getAttribute('aria-checked')`)).toBe('true');
    } finally { await page.keyboard.press('Escape'); }
    await expectLevels(tap, 'remembered left', toneLevels.left);
    const options = await browser.newPage();
    try {
      await options.goto(`chrome-extension://${new URL(worker.url()).host}/options.html`);
      await expect(options.locator('#memory')).toContainText(host);
      await expect(options.locator('#memory')).toContainText('100% · 1× · Left channel only');
    } finally { await options.close(); }
  });
});
