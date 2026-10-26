import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

test.use({ channel: 'chromium' });
const root = fileURLToPath(new URL('../site/out/', import.meta.url));
let server: Server;
let origin: string;

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url!, 'http://localhost').pathname;
    const file = resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
    if (!file.startsWith(resolve(root) + sep)) { response.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      const type = ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wav': 'audio/wav' } as Record<string, string>)[extname(file)] ?? 'application/octet-stream';
      response.writeHead(200, { 'content-type': type, 'content-length': body.length }).end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('官网测试服务器未启动');
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

test('官网媒体尚未加载时不能操作，加载后面板和浮动控制同一媒体', async ({ page }) => {
  let release = () => {};
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/demo.wav', async route => { await waiting; await route.continue(); });
  try {
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    const panel = page.locator('[data-hero-demo] [aria-label="Media controls"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('..')).toHaveAttribute('inert', '');
    await expect(page.getByRole('button', { name: 'Play demo media' })).toBeDisabled();
    release();
    await expect(panel.locator('..')).not.toHaveAttribute('inert', '');
    await panel.getByRole('button', { name: '1.5× speed', exact: true }).click();
    await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.playbackRate)).toBe(1.5);
    await page.getByRole('button', { name: /^Open the volume pill/ }).click();
    const floating = page.getByRole('complementary', { name: 'Floating controller' });
    await expect(floating.getByRole('button', { name: '1.5× speed', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await floating.getByRole('button', { name: '2× speed', exact: true }).click();
    await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.playbackRate)).toBe(2);
  } finally { release(); }
});

test('官网媒体加载失败显示说明，面板和演示按钮不再假装执行成功', async ({ page }) => {
  await page.route('**/demo.wav', route => route.abort());
  await page.goto(origin);
  await expect(page.locator('[data-hero-demo]').getByRole('alert')).toContainText('The demo media could not load. Reload the page to try again.');
  await expect(page.locator('[data-hero-demo] [aria-label="Media controls"]').locator('..')).toHaveAttribute('inert', '');
  await expect(page.getByRole('button', { name: 'Play demo media' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Reset demo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /^Open the volume pill/ })).toHaveCount(0);
});
