import { i18n } from '#i18n';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { createHotkeyInput, hotkeyFromKeyboard, isFloatingEvent, rateHintEvent, volumeGestureEvent } from '../lib/hotkey';
import { createMediaController, isMediaCommand } from '../lib/media';
import { maxEffectiveVolume, volumeReportIntervalMs } from '../lib/volume-badge';
import { extensionStore } from '../lib/extension-store';
import { createExtensionClient } from '../lib/extension-client';
import { FloatingController } from '../components/floating';
import { RateHint } from '../components/rate-hint';
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
    let reported = false;
    const reportVolume = () => {
      if (!ctx.isValid) return;
      const media = enabled ? controller.snapshot() : [];
      if (!media.length) {
        if (!reported) return;
        reported = false;
        void browser.runtime.sendMessage({ namespace: 'ottertap', type: 'register', present: false }).catch(() => {});
        return;
      }
      reported = true;
      void browser.runtime.sendMessage({ namespace: 'ottertap', type: 'register', volume: maxEffectiveVolume(media) }).catch(() => {});
    };
    const unwatch = extensionStore.watch(() => { void refreshContext().then(reportVolume); });
    const register = () => { void refreshContext(); reportVolume(); };
    register();
    ctx.setInterval(register, volumeReportIntervalMs);
    const listener: Parameters<typeof browser.runtime.onMessage.addListener>[0] = (message, sender, sendResponse) => {
      if (sender.id !== browser.runtime.id || message?.namespace !== 'ottertap') return;
      if (!['snapshot', 'command', 'highlight', 'reveal', 'rateHint'].includes(message.type)) return;
      void (async () => {
      if (message.type === 'rateHint') {
        if (typeof message.rate === 'number' && Number.isFinite(message.rate)) window.dispatchEvent(new window.CustomEvent(rateHintEvent, { detail: message.rate }));
        return { ok: true };
      }
      if (message.type === 'reveal') {
        window.dispatchEvent(new window.CustomEvent(volumeGestureEvent));
        if (typeof message.percent === 'number') window.dispatchEvent(new window.CustomEvent('ottertap-volume', { detail: message.percent }));
        return { ok: true };
      }
      if (message.type === 'snapshot') return { media: enabled ? controller.snapshot() : [] };
      if (message.type === 'highlight') { if (enabled && typeof message.id === 'string') controller.flash(message.id); return { ok: true }; }
      if (message.type === 'command') {
        try {
          if (!enabled || !isMediaCommand(message.command) || typeof message.id !== 'string') throw new Error(i18n.t('pageNotControllable'));
          // Refresh the registry when a command arrives before the first snapshot.
          controller.snapshot();
          const applied = await controller.command(message.id, message.command);
          if (message.command.type === 'volume' || message.command.type === 'mute') reportVolume();
          return message.command.type === 'rate' ? { ok: true, rate: applied } : { ok: true };
        } catch (error) { return { error: error instanceof Error ? error.message : i18n.t('mediaCommandFailed') }; }
      }
      })().then(sendResponse, () => sendResponse({ error: i18n.t('mediaMessageFailed') }));
      return true;
    };
    browser.runtime.onMessage.addListener(listener);
    const hotkeys = createHotkeyInput(action => {
      void browser.runtime.sendMessage({ namespace: 'ottertap', type: 'hotkey', action }).then(result => {
        if (typeof result?.percent === 'number') window.dispatchEvent(new CustomEvent('ottertap-volume', { detail: result.percent }));
      }).catch(() => {});
    });
    const shortcutActive = () => enabled && (controller.snapshot().length > 0 || tabHasMedia);
    const onKey = (event: KeyboardEvent) => {
      if (!shortcutActive()) return;
      const action = hotkeyFromKeyboard(event);
      // Volume keyup stays with the page. Rate keyup is swallowed so a site shortcut cannot take a second step.
      if (event.type === 'keyup' && action?.type !== 'rate') return;
      // Volume keys inside the floater keep its own slider. Rate keys stay on this listener so the hint can show.
      if (isFloatingEvent(event) && action?.type !== 'rate') return;
      hotkeys.key(event);
    };
    const onWheel = (event: WheelEvent) => { if (shortcutActive()) hotkeys.wheel(event); };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('wheel', onWheel, { capture: true, passive: false });
    ctx.onInvalidated(() => {
      unwatch(); controller.destroy(); browser.runtime.onMessage.removeListener(listener); hotkeys.dispose();
      window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true); window.removeEventListener('wheel', onWheel, true);
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
        container.lang = i18n.t('locale');
        const root = createRoot(container);
        root.render(<ThemeProvider store={extensionStore} target={container}><FloatingController client={client} /><RateHint /></ThemeProvider>);
        return root;
      },
      onRemove(root) { root?.unmount(); }
    });
    ui.mount();
    ctx.onInvalidated(() => ui.remove());
  }
});
