import { i18n } from '#i18n';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { createHoldGesture } from '../lib/hold-gesture';
import { holdRateEvent } from '../lib/hold-rate';
import { actionHintEvent, actionHintText, createHotkeyInput, isFloatingEvent, isTypingEvent, rateHintEvent, volumeGestureEvent } from '../lib/hotkey';
import { createMediaController, isMediaCommand, mediaPresenceEvent } from '../lib/media';
import { rateLockEvent } from '../lib/rate-lock';
import { maxEffectiveVolume, shouldReportVolume, volumeReportIntervalMs } from '../lib/volume-badge';
import { isSiteEnabled, normalizeHoldRate, normalizeSkipSeconds, normalizeVolumeStep } from '../lib/settings';
import { normalizeKeybinds } from '../lib/keybinds';
import { extensionStore } from '../lib/extension-store';
import { createExtensionClient } from '../lib/extension-client';
import { defaultSettings, type Settings } from '../lib/types';
import { createHoverWheelGesture } from '../lib/hover-wheel';
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
    let contextKeys = { singleKey: defaultSettings.singleKey, hoverWheel: defaultSettings.hoverWheel, skipSeconds: defaultSettings.skipSeconds, volumeStep: defaultSettings.volumeStep, holdBoost: defaultSettings.holdBoost, holdBoostRate: defaultSettings.holdBoostRate, holdSkip: defaultSettings.holdSkip, keybinds: defaultSettings.keybinds };
    let lockedLocalId = '';
    let selectionEpoch = 0;
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
      if (message.type === 'selected') {
        selectionEpoch += 1;
        lockedLocalId = typeof message.id === 'string' && /^\d+$/.test(message.id) ? message.id : '';
        return;
      }
      if (!['snapshot', 'command', 'highlight', 'reveal', 'rateHint', 'actionHint', 'rateLockHint', 'hold', 'holdHint'].includes(message.type)) return;
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
      if (message.type === 'holdHint') {
        const rate = typeof message.rate === 'number' && Number.isFinite(message.rate) ? message.rate : null;
        window.dispatchEvent(new window.CustomEvent(holdRateEvent, { detail: rate }));
        return { ok: true };
      }
      if (message.type === 'hold') {
        if (enabled && typeof message.id === 'string') {
          controller.snapshot();
          if (message.phase === 'start' && typeof message.rate === 'number') controller.beginHold(message.id, message.rate);
          else controller.endHold(message.id);
        }
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
    const gesture = createHoldGesture(() => performance.now());
    let holdTimer = 0;
    const clearHoldTimer = () => {
      if (!holdTimer) return;
      window.clearTimeout(holdTimer);
      holdTimer = 0;
    };
    const sendHold = (phase: 'start' | 'end') => {
      void browser.runtime.sendMessage({ namespace: 'ottertap', type: 'holdRate', phase }).catch(() => {});
    };
    const scheduleHoldSkip = () => {
      clearHoldTimer();
      if (!gesture.waiting()) return;
      const delay = gesture.remaining();
      holdTimer = window.setTimeout(() => {
        holdTimer = 0;
        const effect = gesture.tick();
        if (effect.type === 'start') sendHold('start');
        else if (effect.type === 'arm') scheduleHoldSkip();
      }, delay);
    };
    const releaseHold = () => {
      clearHoldTimer();
      if (gesture.cancel()) sendHold('end');
    };
    let pointer: { x: number; y: number } | null = null;
    const finishSkip = (direction: -1 | 1, skipSeconds: number) => hotkeys.press({ type: 'skip', delta: direction * normalizeSkipSeconds(skipSeconds) });
    const onPointer = (event: PointerEvent) => { pointer = event.type === 'pointerout' && !event.relatedTarget ? null : { x: event.clientX, y: event.clientY }; };
    const onKey = (event: KeyboardEvent) => {
      // A frame without media, or focus in a text field, still receives the Alt release of a gesture made elsewhere.
      if (event.key === 'Alt') { hotkeys.key(event); return; }
      const source = watched ?? contextKeys;
      const boost = source.holdBoost && shortcutActive() && !isTypingEvent(event);
      const floatingArrow = isFloatingEvent(event) && event.key.startsWith('Arrow');
      const effect = gesture.key(event, { boost, skip: boost && source.holdSkip && source.singleKey && !floatingArrow, singleKey: source.singleKey, keybinds: source.keybinds });
      if (effect.type !== 'ignore') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if ((effect.type === 'start' || effect.type === 'consume') && effect.armAlt) hotkeys.arm();
        if (effect.type === 'start') sendHold('start');
        else if (effect.type === 'end') {
          if (!gesture.waiting()) clearHoldTimer();
          sendHold('end');
        } else if (effect.type === 'arm') scheduleHoldSkip();
        else if (effect.type === 'skip') {
          clearHoldTimer();
          finishSkip(effect.direction, source.skipSeconds);
        }
        return;
      }
      if (!shortcutActive() || isTypingEvent(event)) return;
      // Arrows inside the floater belong to its slider and to docking the otter.
      if (floatingArrow) return;
      hotkeys.key(event, { singleKey: source.singleKey, skipSeconds: source.skipSeconds, volumeStep: source.volumeStep, keybinds: source.keybinds, target: source.singleKey ? controller.pointed(pointer, true) : undefined });
    };
    const hoverGesture = createHoverWheelGesture();
    const onWheel = (event: WheelEvent) => {
      const active = shortcutActive();
      const source = watched ?? contextKeys;
      const hover = source.hoverWheel;
      const pointed = active && hover ? controller.hoverAt({ x: event.clientX, y: event.clientY }, lockedLocalId) : undefined;
      const target = pointed?.id;
      const bareTarget = hoverGesture(!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.deltaY && pointed?.stage ? target : undefined, event.timeStamp);
      if (active) hotkeys.wheel(event, event.altKey ? target : bareTarget, source.volumeStep);
    };
    const onPageHide = () => {
      releaseHold();
      if (reported == null) return;
      reported = null;
      localPresent = false;
      syncHeartbeat(null);
      announce();
      void browser.runtime.sendMessage({ namespace: 'ottertap', type: 'register', present: false }).catch(() => {});
    };
    const onHoldCancel = () => releaseHold();
    const onVisibility = () => { if (document.visibilityState === 'hidden') releaseHold(); };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('blur', onHoldCancel);
    window.addEventListener('wheel', onWheel, { capture: true, passive: false });
    window.addEventListener('pointermove', onPointer, { capture: true, passive: true });
    window.addEventListener('pointerout', onPointer, { capture: true, passive: true });
    document.addEventListener('volumechange', reportVolume, true);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    let floatingWhilePlaying = false;
    let floatingWhilePlayingEpoch = 0;
    const noteFloatingWhilePlaying = (value: boolean) => {
      floatingWhilePlayingEpoch += 1;
      floatingWhilePlaying = value;
    };
    const onPlayback = (event: Event) => {
      if (window.top !== window || floatingWhilePlaying !== true) return;
      if (!(event.target instanceof HTMLMediaElement)) return;
      window.dispatchEvent(new CustomEvent(mediaPresenceEvent));
    };
    document.addEventListener('play', onPlayback, true);
    document.addEventListener('pause', onPlayback, true);
    const unwatch = extensionStore.watch(settings => { watched = settings; noteFloatingWhilePlaying(settings.floatingWhilePlaying); applyWatched(); });
    const floatingWhilePlayingLoad = floatingWhilePlayingEpoch;
    void extensionStore.load().then(settings => {
      if (floatingWhilePlayingEpoch !== floatingWhilePlayingLoad) return;
      floatingWhilePlaying = settings.floatingWhilePlaying;
    }).catch(() => {});
    ctx.onInvalidated(() => {
      releaseHold();
      unwatch(); controller.destroy(); if (heartbeat) clearInterval(heartbeat); browser.runtime.onMessage.removeListener(listener); hotkeys.dispose();
      document.removeEventListener('play', onPlayback, true); document.removeEventListener('pause', onPlayback, true);
      document.removeEventListener('volumechange', reportVolume, true); window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onHoldCancel);
      window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true); window.removeEventListener('wheel', onWheel, true);
      window.removeEventListener('pointermove', onPointer, true); window.removeEventListener('pointerout', onPointer, true);
    });
    const epoch = presenceEpoch;
    const selectionAtContext = selectionEpoch;
    let contextLock = false;
    try {
      const result = await browser.runtime.sendMessage({ namespace: 'ottertap', type: 'context' });
      enabled = result?.enabled === true;
      pageUrl = typeof result?.url === 'string' ? result.url : '';
      contextLock = result?.lockRate === true;
      contextKeys = { singleKey: result?.singleKey === true, hoverWheel: result?.hoverWheel !== false, skipSeconds: normalizeSkipSeconds(result?.skipSeconds), volumeStep: normalizeVolumeStep(result?.volumeStep), holdBoost: result?.holdBoost === true, holdBoostRate: normalizeHoldRate(result?.holdBoostRate), holdSkip: result?.holdSkip === true, keybinds: normalizeKeybinds(result?.keybinds) };
      // A push that arrives while this request is in flight is newer than the response.
      if (window.top === window && presenceEpoch === epoch) tabHasMedia = result?.hasMedia === true;
      if (selectionEpoch === selectionAtContext) lockedLocalId = typeof result?.selectedLocalId === 'string' && /^\d+$/.test(result.selectedLocalId) ? result.selectedLocalId : '';
    } catch { enabled = false; pageUrl = ''; }
    if (watched && pageUrl) enabled = isSiteEnabled(pageUrl, watched);
    controller.setLockRate(enabled && (watched ? watched.lockRate : contextLock));
    reportVolume();
    if (window.top !== window) return;
    const client = createExtensionClient();
    const openPanel = async (id: string) => {
      try {
        const result = await browser.runtime.sendMessage({ namespace: 'ottertap', type: 'openPopup', id });
        return result?.ok === true;
      } catch {
        return false;
      }
    };
    const ui = await createShadowRootUi(ctx, {
      name: 'ottertap-controller',
      position: 'overlay',
      anchor: 'body',
      isolateEvents: ['keydown', 'keyup', 'keypress'],
      onMount(container) {
        container.className = 'ottertap-root';
        container.lang = i18n.t('locale');
        const root = createRoot(container);
        root.render(<ThemeProvider store={extensionStore} target={container}><FloatingController client={client} openPanel={openPanel} hideOnSite /><RateHint /><RateLockNotice /></ThemeProvider>);
        return root;
      },
      onRemove(root) { root?.unmount(); }
    });
    ui.mount();
    ctx.onInvalidated(() => ui.remove());
  }
});
