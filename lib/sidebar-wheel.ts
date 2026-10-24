/**
 * Recognized scrollable sidebars. A pointer here releases the unmodified hover wheel.
 * Selectors name the column itself. A video element on the path still wins, so a
 * selector that happens to wrap the picture does not take the wheel away from it.
 * Unknown containers stay on the main-stage rule. There is no user selector list.
 */
export const sidebarWheelSelector = [
  'ytd-live-chat-frame',
  'yt-live-chat-renderer',
  'yt-live-chat-item-list-renderer',
  '.chat-scrollable-area__message-container',
  '[data-test-selector="chat-scrollable-area__message-container"]',
  '[data-test-selector="video-chat-message-list"]',
  '.video-chat__message-list',
  '.chat-room__content',
  '.chat-history-panel',
  '.VPSidebar',
  '.VPDocAside',
  '.theme-doc-sidebar-container',
  '.theme-doc-toc-desktop',
  '.theme-doc-toc-mobile',
  '.nextra-sidebar-container',
  '.nextra-toc',
  '.md-sidebar',
  '#nd-sidebar',
  '#nd-toc',
  '.wy-nav-side',
  '.bd-sidebar-primary',
  '.bd-sidebar-secondary',
].join(',');

type Matchable = { localName: string; matches(selector: string): boolean };

function matchable(node: EventTarget): Matchable | null {
  if (typeof node !== 'object' || node === null) return null;
  const candidate = node as Partial<Matchable>;
  if (typeof candidate.localName !== 'string' || typeof candidate.matches !== 'function') return null;
  return candidate as Matchable;
}

/** True when the event path is inside a known chat column or doc outline, and not on the media itself. */
export function sidebarWheelIgnore(path: readonly EventTarget[]) {
  for (const node of path) {
    const element = matchable(node);
    if (!element) continue;
    if (element.localName === 'video' || element.localName === 'audio') return false;
    try {
      if (element.matches(sidebarWheelSelector)) return true;
    } catch {
      return false;
    }
  }
  return false;
}

type BareWheelEvent = {
  altKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  composedPath(): EventTarget[];
};

/**
 * The unmodified hover wheel lets the sidebar scroll.
 * Alt and Shift still adjust volume; those gestures are not a page scroll.
 */
export function sidebarBlocksBareWheel(event: BareWheelEvent) {
  if (event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) return false;
  return sidebarWheelIgnore(event.composedPath());
}
