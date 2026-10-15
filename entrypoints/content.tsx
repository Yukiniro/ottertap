import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { createHotkeyInput, isFloatingEvent, volumeGestureEvent } from '../lib/hotkey';
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
    let tabHasMedia = false;
    const refreshContext = async () => {
      try {
        const result = await browser.runtime.sendMessage({ namespace: 'ottertap', type: 'context' });
        enabled = result?.enabled === true;
        tabHasMedia = result?.hasMedia === true;
      } catch { enabled = false; tabHasMedia = false; }
    };
    await refreshContext();
    const unwatch = extensionStore.watch(() => { void refreshContext(); });
    const register = () => {
      void refreshContext();
      if (enabled && ctx.isValid && controller.snapshot().length) void browser.runtime.sendMessage({ namespace: 'ottertap', type: 'register' }).catch(() => {});
    };
    register(); ctx.setInterval(register, 2000);
    const listener: Parameters<typeof browser.runtime.onMessage.addListener>[0] = (message, sender, sendResponse) => {
      if (sender.id !== browser.runtime.id || message?.namespace !== 'ottertap') return;
      if (!['snapshot', 'command', 'highlight', 'reveal'].includes(message.type)) return;
      void (async () => {
      if (message.type === 'reveal') {
        window.dispatchEvent(new window.CustomEvent(volumeGestureEvent));
        if (typeof message.percent === 'number') window.dispatchEvent(new window.CustomEvent('ottertap-volume', { detail: message.percent }));
        return { ok: true };
      }
      if (message.type === 'snapshot') return { media: enabled ? controller.snapshot() : [] };
      if (message.type === 'highlight') { if (enabled && typeof message.id === 'string') controller.flash(message.id); return { ok: true }; }
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
    const hotkeys = createHotkeyInput(action => {
      void browser.runtime.sendMessage({ namespace: 'ottertap', type: 'hotkey', action }).then(result => {
        if (typeof result?.percent === 'number') window.dispatchEvent(new CustomEvent('ottertap-volume', { detail: result.percent }));
      }).catch(() => {});
    });
    const shortcutActive = () => enabled && (controller.snapshot().length > 0 || tabHasMedia);
    const onKey = (event: KeyboardEvent) => { if (!isFloatingEvent(event) && shortcutActive()) hotkeys.key(event); };
    const onWheel = (event: WheelEvent) => { if (shortcutActive()) hotkeys.wheel(event); };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('wheel', onWheel, { capture: true, passive: false });
    ctx.onInvalidated(() => {
      unwatch(); controller.destroy(); browser.runtime.onMessage.removeListener(listener); hotkeys.dispose();
      window.removeEventListener('keydown', onKey, true); window.removeEventListener('wheel', onWheel, true);
    });
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
