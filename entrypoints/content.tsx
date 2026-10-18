import { i18n } from '#i18n';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { createHotkeyInput, hotkeyFromKeyboard, isFloatingEvent, rateHintEvent, volumeGestureEvent } from '../lib/hotkey';
import { createMediaController, isMediaCommand, mediaPresenceEvent } from '../lib/media';
import { maxEffectiveVolume, shouldReportVolume, volumeReportIntervalMs } from '../lib/volume-badge';
import { isSiteEnabled } from '../lib/settings';
import { extensionStore } from '../lib/extension-store';
import { createExtensionClient } from '../lib/extension-client';
import type { Settings } from '../lib/types';
import { FloatingController } from '../components/floating';
import { RateHint } from '../components/rate-hint';
import { ThemeProvider } from '../components/theme';
import '../assets/style.css';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  allFrames: true,
  cssInjectionMode: 'ui',
  async main(ctx) {
    let enabled = false;
    let tabHasMedia = false;
    let localPresent = false;
    let pageMedia = false;
    let reported: number | null = null;
    let pageUrl = '';
    let watched: Settings | undefined;
    let presenceEpoch = 0;
    let heartbeat = 0;
    const announce = () => {
      const present = localPresent || tabHasMedia;
      if (present === pageMedia) return;
      pageMedia = present;
      if (window.top !== window) return;
      window.dispatchEvent(new CustomEvent(mediaPresenceEvent));
    };
    const syncHeartbeat = (volume: number | null) => {
      const amplified = volume != null && volume > 1;
      if (amplified && !heartbeat) heartbeat = ctx.setInterval(reportVolume, volumeReportIntervalMs);
      if (!amplified && heartbeat) { clearInterval(heartbeat); heartbeat = 0; }
    };
    const reportVolume = () => {
      if (!ctx.isValid) return;
      const media = enabled ? controller.snapshot() : [];
      const volume = media.length ? maxEffectiveVolume(media) : null;
      localPresent = volume != null;
      announce();
      syncHeartbeat(volume);
      const decision = shouldReportVolume(volume, reported);
      if (!decision) return;
      if ('present' in decision) {
        reported = null;
        void browser.runtime.sendMessage({ namespace: 'ottertap', type: 'register', present: false }).catch(() => {});
        return;
      }
      reported = decision.volume;
      void browser.runtime.sendMessage({ namespace: 'ottertap', type: 'register', volume: decision.volume }).catch(() => {});
    };
    const controller = createMediaController(document, reportVolume);
    const applyWatched = () => {
      if (!pageUrl || !watched) return;
      const next = isSiteEnabled(pageUrl, watched);
      if (next === enabled) return;
      enabled = next;
      reportVolume();
    };
    const listener: Parameters<typeof browser.runtime.onMessage.addListener>[0] = (message, sender, sendResponse) => {
      if (sender.id !== browser.runtime.id || message?.namespace !== 'ottertap') return;
      if (message.type === 'tabMedia') {
        if (window.top !== window) return;
        presenceEpoch += 1;
        tabHasMedia = message.hasMedia === true;
        announce();
        return;
      }
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
    const onPageHide = () => {
      if (reported == null) return;
      reported = null;
      localPresent = false;
      syncHeartbeat(null);
      announce();
      void browser.runtime.sendMessage({ namespace: 'ottertap', type: 'register', present: false }).catch(() => {});
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('wheel', onWheel, { capture: true, passive: false });
    document.addEventListener('volumechange', reportVolume, true);
    window.addEventListener('pagehide', onPageHide);
    const unwatch = extensionStore.watch(settings => { watched = settings; applyWatched(); });
    ctx.onInvalidated(() => {
      unwatch(); controller.destroy(); if (heartbeat) clearInterval(heartbeat); browser.runtime.onMessage.removeListener(listener); hotkeys.dispose();
      document.removeEventListener('volumechange', reportVolume, true); window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true); window.removeEventListener('wheel', onWheel, true);
    });
    const epoch = presenceEpoch;
    try {
      const result = await browser.runtime.sendMessage({ namespace: 'ottertap', type: 'context' });
      enabled = result?.enabled === true;
      pageUrl = typeof result?.url === 'string' ? result.url : '';
      // A push that arrives while this request is in flight is newer than the response.
      if (window.top === window && presenceEpoch === epoch) tabHasMedia = result?.hasMedia === true;
    } catch { enabled = false; pageUrl = ''; }
    if (watched && pageUrl) enabled = isSiteEnabled(pageUrl, watched);
    reportVolume();
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
