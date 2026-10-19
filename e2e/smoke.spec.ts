import { chromium, expect, test, type BrowserContext, type Page, type Worker } from '@playwright/test';

const host = 'media.ottertap.test';
const origin = `https://${host}`;
const extensionPath = decodeURIComponent(new URL('../.output/chrome-mv3/', import.meta.url).pathname);
const settingsKey = 'ottertap-settings-v1';

type SitePref = { volume?: number; rate?: number };
type Settings = {
  theme: 'system';
  floating: boolean;
  floatingPosition: { side: 'right'; y: number };
  siteMode: 'all';
  sites: string[];
  sitePrefs: Record<string, SitePref>;
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

function documentHtml(body: string, title = 'OtterTap fixture') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body style="min-height:100vh">${body}</body></html>`;
}

const pages: Record<string, string> = {
  '/': documentHtml(`<audio id="media" src="${wav}" preload="auto"></audio>`),
  '/empty': documentHtml('<p>empty</p>'),
  '/frame': documentHtml('<iframe title="embedded media" src="/embed" style="width:320px;height:180px;border:0"></iframe>'),
  '/embed': documentHtml(`<video id="media" src="${wav}" preload="auto" playsinline></video>`),
  '/other': documentHtml(`<audio id="media" src="${wav}" preload="auto"></audio>`, 'Other tab'),
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

async function pressVolume(page: Page, key: 'ArrowUp' | 'ArrowDown', expected: number, read: () => Promise<number> = () => mediaVolume(page)) {
  await page.keyboard.press(`Alt+Shift+${key}`);
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
    for (const expected of [0.9, 0.8, 0.7, 0.6, 0.5]) await pressVolume(page, 'ArrowDown', expected);
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

test('Alt+Shift+↑ 从 95% 先停在 100%，再按一次到 110%，且媒体音量不超过 1', async () => {
  await withPage(async page => {
    await openFixture(page, '/');
    await ready(page);
    await page.locator('#media').evaluate((element: HTMLMediaElement) => { element.volume = 0.95; });
    await focusPage(page);
    await page.keyboard.press('Alt+Shift+ArrowUp');
    await expect.poll(() => mediaVolume(page)).toBeCloseTo(1, 2);
    await openPill(page);
    await expect.poll(() => shownPercent(page)).toBe(100);
    await focusPage(page);
    await page.keyboard.press('Alt+Shift+ArrowUp');
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
    await page.keyboard.press('Alt+Shift+ArrowUp');
    await expect.poll(() => mediaVolume(page)).toBeCloseTo(1, 2);
    await page.keyboard.press('Alt+Shift+ArrowUp');
    await expect.poll(async () => (await toolbarBadge(page))?.text).toBe('110');
    const boosted = await toolbarBadge(page);
    expect(boosted?.title).toBe('Volume is boosted to 110%');
    expect(boosted?.color).toEqual([0xe4, 0x57, 0x2e, 255]);
    await page.keyboard.press('Alt+Shift+ArrowDown');
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
      await page.keyboard.press('Alt+Shift+ArrowDown');
      await expect.poll(read, { timeout: 1_500 }).toBeCloseTo(0.9, 2);
    }).toPass({ timeout: 9_000 });
    await focusPage(page, 420);
    await page.keyboard.press('Alt+Shift+ArrowUp');
    await expect.poll(read).toBeCloseTo(1, 2);
    await page.keyboard.press('Alt+Shift+ArrowUp');
    await expect.poll(async () => (await toolbarBadge(page))?.text).toBe('110');
    await page.locator('iframe').evaluate(frame => frame.remove());
    await expect.poll(async () => (await toolbarBadge(page))?.text, { timeout: 6_000 }).toBe('');
  });
});

test('按住 Alt+Shift 时只有横向滚轮也能调节音量', async () => {
  await withPage(async page => {
    await openFixture(page, '/');
    await ready(page);
    await page.locator('#media').evaluate((element: HTMLMediaElement) => { element.volume = 0.5; });
    await focusPage(page);
    await page.mouse.move(200, 320);
    await page.keyboard.down('Alt');
    await page.keyboard.down('Shift');
    await page.mouse.wheel(100, 0);
    await page.keyboard.up('Shift');
    await page.keyboard.up('Alt');
    const wheel = await page.evaluate(() => (window as unknown as { __ottertapWheel?: WheelSnapshot }).__ottertapWheel);
    expect(wheel, '页面应收到滚轮事件').toBeTruthy();
    expect(wheel?.deltaY ?? -1, `应只有横向滚动量 ${JSON.stringify(wheel)}`).toBe(0);
    expect(wheel?.deltaX).not.toBe(0);
    expect(wheel?.altKey).toBe(true);
    expect(wheel?.shiftKey).toBe(true);
    const expected = volumeAfterWheel(50, wheel!);
    expect(expected).not.toBe(50);
    await expect.poll(() => mediaVolume(page)).toBeCloseTo(Math.min(expected, 100) / 100, 2);
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
      await page.keyboard.press('Alt+Shift+ArrowDown');
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
    for (const expected of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]) await pressVolume(page, 'ArrowDown', expected);
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
    await expect(shortcuts).toContainText('Edit shortcuts');
    await expect(shortcuts).toContainText('Not set');
    await expect(shortcuts).toContainText('On-page shortcuts');
    await expect(shortcuts).toContainText('Extension shortcuts work only while the browser window is focused.');
    await expect(shortcuts).toContainText('Mouse wheel');
    await expect(shortcuts).toContainText('Increase volume by 10 percentage points');
    await expect(shortcuts).toContainText('Decrease volume by 10 percentage points');
    await expect(shortcuts).toContainText('Adjust volume continuously');
    await expect(shortcuts).toContainText('On Mac, use Option instead of Alt.');
    await expect(shortcuts).toContainText('Alt + Shift + ↑');
    await expect(shortcuts).toContainText('Alt + Shift + ↓');
    await expect(shortcuts).toContainText('Alt + Shift + Mouse wheel');
    for (const chinese of ['快捷键', '滚轮', '提高音量', '降低音量']) await expect(shortcuts).not.toContainText(chinese);
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
