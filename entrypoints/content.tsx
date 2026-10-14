import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { createMediaController, isMediaCommand } from '../lib/media';
import { extensionStore } from '../lib/extension-store';
import { createExtensionClient } from '../lib/extension-client';
import { FloatingController } from '../components/floating';
import { ThemeProvider } from '../components/theme';
import '../assets/style.css';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  allFrames: true,
  cssInjectionMode: 'ui',
  async main(ctx) {
    const controller = createMediaController(document);
    let enabled = false;
    const refreshContext = async () => {
      try { enabled = (await browser.runtime.sendMessage({ namespace: 'ottertap', type: 'context' }))?.enabled === true; }
      catch { enabled = false; }
    };
    await refreshContext();
    const unwatch = extensionStore.watch(() => { void refreshContext(); });
    const register = () => {
      if (enabled && ctx.isValid && controller.snapshot().length) void browser.runtime.sendMessage({ namespace: 'ottertap', type: 'register' }).catch(() => {});
    };
    register(); ctx.setInterval(register, 2000);
    const listener: Parameters<typeof browser.runtime.onMessage.addListener>[0] = (message, sender, sendResponse) => {
      if (sender.id !== browser.runtime.id || message?.namespace !== 'ottertap') return;
      if (!['snapshot', 'command'].includes(message.type)) return;
      void (async () => {
      if (message.type === 'snapshot') return { media: enabled ? controller.snapshot() : [] };
      if (message.type === 'command') {
        try {
          if (!enabled || !isMediaCommand(message.command) || typeof message.id !== 'string') throw new Error('当前页面不可控制。');
          // Refresh the registry when a command arrives before the first snapshot.
          controller.snapshot();
          await controller.command(message.id, message.command);
          return { ok: true };
        } catch (error) { return { error: error instanceof Error ? error.message : '媒体操作失败。' }; }
      }
      })().then(sendResponse, () => sendResponse({ error: '媒体通信失败，请刷新网页后重试。' }));
      return true;
    };
    browser.runtime.onMessage.addListener(listener);
    ctx.onInvalidated(() => { unwatch(); controller.destroy(); browser.runtime.onMessage.removeListener(listener); });
    if (window.top !== window) return;
    const client = createExtensionClient();
    const ui = await createShadowRootUi(ctx, {
      name: 'ottertap-controller',
      position: 'overlay',
      anchor: 'body',
      isolateEvents: ['keydown', 'keyup', 'keypress'],
      onMount(container) {
        container.className = 'ottertap-root';
        const root = createRoot(container);
        root.render(<ThemeProvider store={extensionStore} target={container}><FloatingController client={client} /></ThemeProvider>);
        return root;
      },
      onRemove(root) { root?.unmount(); }
    });
    ui.mount();
    ctx.onInvalidated(() => ui.remove());
  }
});
