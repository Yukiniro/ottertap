import { i18n } from '#i18n';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { actionHintEvent, actionHintText, createHotkeyInput, isFloatingEvent, isTypingEvent, rateHintEvent, volumeGestureEvent } from '../lib/hotkey';
import { createMediaController, isMediaCommand, mediaPresenceEvent } from '../lib/media';
import { rateLockEvent } from '../lib/rate-lock';
import { maxEffectiveVolume, shouldReportVolume, volumeReportIntervalMs } from '../lib/volume-badge';
import { isSiteEnabled, normalizeSkipSeconds } from '../lib/settings';
import { extensionStore } from '../lib/extension-store';
import { createExtensionClient } from '../lib/extension-client';
import { defaultSettings, type Settings } from '../lib/types';
import { FloatingController } from '../components/floating';
import { RateHint, RateLockNotice } from '../components/rate-hint';
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
    let contextKeys = { singleKey: defaultSettings.singleKey, hoverWheel: defaultSettings.hoverWheel, skipSeconds: defaultSettings.skipSeconds };
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
    const controller = createMediaController(document, reportVolume, () => {
      void browser.runtime.sendMessage({ namespace: 'ottertap', type: 'rateLock' }).catch(() => {});
    });
    const applyWatched = () => {
      if (!pageUrl || !watched) return;
      const next = isSiteEnabled(pageUrl, watched);
      const changed = next !== enabled;
      enabled = next;
      controller.setLockRate(enabled && watched.lockRate);
      if (changed) reportVolume();
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
      if (message.type === 'altUsed') { hotkeys.arm(); return; }
      if (!['snapshot', 'command', 'highlight', 'reveal', 'rateHint', 'actionHint', 'rateLockHint'].includes(message.type)) return;
      void (async () => {
      if (message.type === 'actionHint') {
        const label = actionHintText(typeof message.key === 'string' ? message.key : '', message.seconds);
        if (label) window.dispatchEvent(new window.CustomEvent(actionHintEvent, { detail: label }));
        return { ok: true };
      }
      if (message.type === 'rateHint') {
        if (typeof message.rate === 'number' && Number.isFinite(message.rate)) window.dispatchEvent(new window.CustomEvent(rateHintEvent, { detail: message.rate }));
        return { ok: true };
      }
      if (message.type === 'rateLockHint') {
        window.dispatchEvent(new window.CustomEvent(rateLockEvent));
        return { ok: true };
      }
      if (message.type === 'reveal') {
        window.dispatchEvent(new window.CustomEvent(volumeGestureEvent));
        if (typeof message.percent === 'number') window.dispatchEvent(new window.CustomEvent('ottertap-volume', { detail: message.percent }));
        return { ok: true };
      }
      if (message.type === 'snapshot') {
        if (!enabled) return { media: [], recallRate: null };
        return { media: controller.snapshot(), recallRate: controller.recallRate() };
      }
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
    const hotkeys = createHotkeyInput((action, target) => {
      void browser.runtime.sendMessage({ namespace: 'ottertap', type: 'hotkey', action, target }).then(result => {
        if (typeof result?.percent === 'number') window.dispatchEvent(new CustomEvent('ottertap-volume', { detail: result.percent }));
      }).catch(() => {});
    }, () => {
      // The Alt release goes to the focused frame, which is not this one when the wheel landed in another frame.
      if (!document.hasFocus()) void browser.runtime.sendMessage({ namespace: 'ottertap', type: 'altUsed' }).catch(() => {});
    });
    const shortcutActive = () => enabled && (controller.snapshot().length > 0 || tabHasMedia);
    let pointer: { x: number; y: number } | null = null;
    const onPointer = (event: PointerEvent) => { pointer = event.type === 'pointerout' && !event.relatedTarget ? null : { x: event.clientX, y: event.clientY }; };
    const onKey = (event: KeyboardEvent) => {
      // A frame without media, or focus in a text field, still receives the Alt release of a gesture made elsewhere.
      if (event.key === 'Alt') { hotkeys.key(event); return; }
      if (!shortcutActive() || isTypingEvent(event)) return;
      // Arrows inside the floater belong to its slider and to docking the otter.
      if (isFloatingEvent(event) && event.key.startsWith('Arrow')) return;
      const source = watched ?? contextKeys;
      hotkeys.key(event, { singleKey: source.singleKey, skipSeconds: source.skipSeconds, target: source.singleKey ? controller.pointed(pointer, true) : undefined });
    };
    const onWheel = (event: WheelEvent) => {
      if (!shortcutActive()) return;
      hotkeys.wheel(event, (watched ?? contextKeys).hoverWheel ? controller.pointed({ x: event.clientX, y: event.clientY }, false) : undefined);
    };
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
    window.addEventListener('pointermove', onPointer, { capture: true, passive: true });
    window.addEventListener('pointerout', onPointer, { capture: true, passive: true });
    document.addEventListener('volumechange', reportVolume, true);
    window.addEventListener('pagehide', onPageHide);
    const unwatch = extensionStore.watch(settings => { watched = settings; applyWatched(); });
    ctx.onInvalidated(() => {
      unwatch(); controller.destroy(); if (heartbeat) clearInterval(heartbeat); browser.runtime.onMessage.removeListener(listener); hotkeys.dispose();
      document.removeEventListener('volumechange', reportVolume, true); window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true); window.removeEventListener('wheel', onWheel, true);
      window.removeEventListener('pointermove', onPointer, true); window.removeEventListener('pointerout', onPointer, true);
    });
    const epoch = presenceEpoch;
    let contextLock = false;
    try {
      const result = await browser.runtime.sendMessage({ namespace: 'ottertap', type: 'context' });
      enabled = result?.enabled === true;
      pageUrl = typeof result?.url === 'string' ? result.url : '';
      contextLock = result?.lockRate === true;
      contextKeys = { singleKey: result?.singleKey === true, hoverWheel: result?.hoverWheel !== false, skipSeconds: normalizeSkipSeconds(result?.skipSeconds) };
      // A push that arrives while this request is in flight is newer than the response.
      if (window.top === window && presenceEpoch === epoch) tabHasMedia = result?.hasMedia === true;
    } catch { enabled = false; pageUrl = ''; }
    if (watched && pageUrl) enabled = isSiteEnabled(pageUrl, watched);
    controller.setLockRate(enabled && (watched ? watched.lockRate : contextLock));
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
        root.render(<ThemeProvider store={extensionStore} target={container}><FloatingController client={client} /><RateHint /><RateLockNotice /></ThemeProvider>);
        return root;
      },
      onRemove(root) { root?.unmount(); }
    });
    ui.mount();
    ctx.onInvalidated(() => ui.remove());
  }
});
