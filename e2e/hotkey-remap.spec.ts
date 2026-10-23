import { chromium, expect, test, type BrowserContext } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const origin = 'https://media.ottertap.test';
const extensionPath = fileURLToPath(new URL('../.output/chrome-mv3/', import.meta.url));
const settingsKey = 'ottertap-settings-v1';

function silentWav() {
  const samples = 8000;
  const bytes = new Uint8Array(44 + samples).fill(128);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => { for (let index = 0; index < value.length; index += 1) bytes[offset + index] = value.charCodeAt(index); };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, 'data');
  view.setUint32(40, samples, true);
  return Buffer.from(bytes).toString('base64');
}

const fixture = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Remap fixture</title></head><body style="height:1200px"><audio id="media" src="data:audio/wav;base64,${silentWav()}" preload="auto" loop controls></audio></body></html>`;

let browser: BrowserContext | undefined;

test.beforeAll(async () => {
  browser = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
    deviceScaleFactor: 1,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--lang=en-US'],
  });
  await browser.route(`${origin}/**`, route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fixture }));
});

test.afterAll(async () => {
  await browser?.close();
});

test('设置页改键后已打开的网页立即换键，撞键有提示，可恢复默认', async () => {
  const context = browser!;
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  const stored = () => worker.evaluate(async key => {
    const storage = (globalThis as unknown as { chrome: { storage: { local: { get: (key: string) => Promise<Record<string, unknown>> } } } }).chrome.storage.local;
    return (await storage.get(key))[key] as { singleKey?: boolean; keybinds?: Record<string, string> } | undefined;
  }, settingsKey);

  const page = await context.newPage();
  await page.goto(`${origin}/remap`);
  await page.getByRole('button', { name: /volume pill/i }).waitFor();
  const paused = () => page.locator('#media').evaluate((element: HTMLMediaElement) => element.paused);
  const press = async (key: string) => {
    await page.bringToFront();
    await page.mouse.click(600, 600);
    await page.keyboard.press(key);
  };

  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${extensionId}/options.html#shortcuts`);
  await settings.getByRole('switch', { name: 'Single-key mode' }).click();
  await expect.poll(async () => (await stored())?.singleKey).toBe(true);
  const reset = settings.getByRole('button', { name: 'Restore default keys' });
  await expect(reset).toBeDisabled();

  await settings.getByRole('button', { name: /^Change the key for Play or pause\. Now K\.$/ }).click();
  await settings.keyboard.press('KeyJ');
  await expect(settings.getByRole('alert')).toHaveText('J is already used for “Back 10 seconds”. Press another key, or change that one first.');
  await settings.keyboard.press('KeyP');
  await expect(settings.getByRole('button', { name: /^Change the key for Play or pause\. Now P\.$/ })).toBeVisible();
  await expect(settings.getByRole('alert')).toHaveCount(0);
  await expect.poll(async () => (await stored())?.keybinds?.toggle).toBe('p');

  await press('KeyK');
  await page.waitForTimeout(300);
  expect(await paused()).toBe(true);
  await press('KeyP');
  await expect.poll(paused).toBe(false);
  await press('KeyP');
  await expect.poll(paused).toBe(true);

  await settings.bringToFront();
  await reset.click();
  await expect.poll(async () => (await stored())?.keybinds?.toggle).toBe('k');
  await expect(reset).toBeDisabled();
  await press('KeyK');
  await expect.poll(paused).toBe(false);
  await press('KeyK');
  await expect.poll(paused).toBe(true);
  await settings.close();
  await page.close();
});
