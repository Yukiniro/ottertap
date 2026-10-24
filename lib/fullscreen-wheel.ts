/**
 * Bare hover-wheel can be limited to fullscreen.
 * The switch defaults off. Off, or a pointer that is not on the main stage, returns today's answer and does not read fullscreen.
 */
export function bareHoverStage(stage: boolean, fullscreenOnly: boolean, active: () => boolean) {
  if (!stage || fullscreenOnly !== true) return stage;
  return active();
}

/** Players that fill the window without the Fullscreen API. Theater mode is intentionally absent. */
const pseudoFullscreenSelector = [
  '.bpx-state-web-fullscreen',
  '.bilibili-player-video-web-fullscreen',
  '.xgplayer-is-cssfullscreen',
  '.dplayer-web-fullscreen',
  '.art-fullscreen-web',
  '.plyr--fullscreen-fallback',
].join(',');

/** A fixed box must sit above ordinary page layers before it counts as web fullscreen. */
const pseudoCoverZIndex = 1000;

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitIsFullScreen?: boolean;
};

type FullscreenView = Window & { fullScreen?: boolean };

function apiFullscreen(doc: FullscreenDocument) {
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement || doc.webkitIsFullScreen);
}

/** F11 and other browser-chrome fullscreen. A normal window keeps a toolbar gap, so a large viewport alone does not match. */
function pageFillsScreen(view: FullscreenView) {
  if (view.fullScreen === true) return true;
  try {
    if (view.matchMedia('(display-mode: fullscreen)').matches) return true;
  } catch { /* matchMedia can throw on a detached view */ }
  const screen = view.screen;
  if (!screen || screen.width <= 0 || screen.height <= 0) return false;
  if (view.outerWidth <= 0 || view.outerHeight <= 0) return false;
  if (Math.abs(view.innerWidth - screen.width) > 2 || Math.abs(view.innerHeight - screen.height) > 2) return false;
  const heightGap = view.outerHeight - view.innerHeight;
  const widthGap = Math.abs(view.outerWidth - view.innerWidth);
  return heightGap >= 0 && heightGap <= 8 && widthGap <= 8;
}

function readableWindows(view: Window) {
  const list: Window[] = [];
  try {
    const top = view.top;
    if (top && top !== view) list.push(top);
  } catch { /* cross-origin top */ }
  list.push(view);
  return list;
}

function coversViewport(element: Element, view: Window) {
  let position = '';
  let zIndex = '';
  try {
    const style = view.getComputedStyle(element);
    position = style.position;
    zIndex = style.zIndex;
  } catch { return false; }
  if (position !== 'fixed') return false;
  const z = Number.parseInt(zIndex, 10);
  if (!Number.isFinite(z) || z < pseudoCoverZIndex) return false;
  const rect = element.getBoundingClientRect();
  const width = view.innerWidth;
  const height = view.innerHeight;
  if (width <= 0 || height <= 0) return false;
  return rect.width >= width * 0.98 && rect.height >= height * 0.98 && rect.top <= 2 && rect.left <= 2 && rect.right >= width - 2 && rect.bottom >= height - 2;
}

function markedPseudo(element: Element) {
  try { return element.matches(pseudoFullscreenSelector); }
  catch { return false; }
}

function containsMedia(element: Element) {
  if (element.localName === 'video' || element.localName === 'audio') return true;
  try { return element.querySelector('video, audio') != null; }
  catch { return false; }
}

function acrossShadow(node: Element): Element | null {
  const parent: Element | null = node.parentElement;
  if (parent) return parent;
  const root: Node = node.getRootNode();
  if (root.nodeType !== 11 || !('host' in root)) return null;
  return (root as ShadowRoot).host;
}

/** Known class, native video fullscreen, or a fixed high layer that actually wraps the media. `html` and `body` do not count as a geometric cover. */
function chainPseudo(start: Element, view: Window) {
  const doc = start.ownerDocument;
  let node: Element | null = start;
  const seen = new Set<Element>();
  while (node && !seen.has(node)) {
    seen.add(node);
    if (markedPseudo(node)) return true;
    const native = node as HTMLVideoElement & { webkitDisplayingFullscreen?: boolean };
    if (node.localName === 'video' && native.webkitDisplayingFullscreen === true) return true;
    if (node !== doc.body && node !== doc.documentElement && containsMedia(node) && coversViewport(node, view)) return true;
    node = acrossShadow(node);
  }
  return false;
}

function videosDisplayingFullscreen(doc: Document) {
  try {
    for (const video of doc.querySelectorAll('video')) {
      const native = video as HTMLVideoElement & { webkitDisplayingFullscreen?: boolean };
      if (native.webkitDisplayingFullscreen === true) return true;
    }
  } catch { return false; }
  return false;
}

/** Page Fullscreen API, browser fullscreen, a known web-fullscreen marker, or a fixed cover under the pointer. */
export function hoverFullscreenActive(view: Window, point?: { x: number; y: number }) {
  for (const current of readableWindows(view)) {
    let doc: Document;
    try { doc = current.document; }
    catch { continue; }
    if (apiFullscreen(doc as FullscreenDocument) || pageFillsScreen(current as FullscreenView)) return true;
    try {
      if (doc.querySelector(pseudoFullscreenSelector) || videosDisplayingFullscreen(doc)) return true;
    } catch { /* a cross-origin document can throw on query */ }
  }
  if (!point) return false;
  let hit: Element | null = null;
  try { hit = view.document.elementFromPoint(point.x, point.y); }
  catch { return false; }
  return hit ? chainPseudo(hit, view) : false;
}
