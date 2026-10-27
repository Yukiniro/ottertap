/** How long the selection ring takes to fade. It does not stay on the picture. */
export const selectionRingMs = 1000;

export const selectionRingClass = 'ottertap-selection-ring';

export const selectionRingName = 'ottertap-selection-ring';

/** Page-level style. Injected into the element's document or shadow root so the keyframes resolve there. */
export const selectionRingCss = `@keyframes ${selectionRingName}{from{outline-color:rgba(228,87,46,.9)}to{outline-color:rgba(228,87,46,0)}}.${selectionRingClass}{outline:2px solid rgba(228,87,46,.9);outline-offset:3px;animation:${selectionRingName} ${selectionRingMs}ms ease-out forwards}`;

const styleId = 'ottertap-selection-ring-style';
const active = new Set<HTMLElement>();
const endings = new WeakMap<HTMLElement, (event: AnimationEvent) => void>();
const timers = new WeakMap<HTMLElement, number>();
const generation = new WeakMap<HTMLElement, number>();
let nextGeneration = 0;

function shadowRootOf(element: HTMLElement): ShadowRoot | null {
  const root = element.getRootNode();
  // A shadow root has a host. Comparing constructors fails when the test DOM does not publish ShadowRoot globally.
  if (root !== element.ownerDocument && 'host' in root && (root as ShadowRoot).host) return root as ShadowRoot;
  return null;
}

function ensureStyle(element: HTMLElement) {
  const root = shadowRootOf(element);
  const parent = root ?? element.ownerDocument;
  if (parent.querySelector(`#${styleId}`)) return;
  const style = element.ownerDocument.createElement('style');
  style.id = styleId;
  style.textContent = selectionRingCss;
  if (root) root.append(style);
  else (element.ownerDocument.head ?? element.ownerDocument.documentElement).append(style);
}

/** Drop the ring immediately. A finished animation also comes through here. */
export function clearSelectionRings(element?: HTMLElement) {
  const list = element ? [element] : [...active];
  for (const node of list) {
    const onEnd = endings.get(node);
    if (onEnd) node.removeEventListener('animationend', onEnd);
    endings.delete(node);
    const timer = timers.get(node);
    if (timer) node.ownerDocument.defaultView?.clearTimeout(timer);
    timers.delete(node);
    generation.delete(node);
    node.classList.remove(selectionRingClass);
    active.delete(node);
  }
}

/**
 * One light ring on this element. Any earlier ring in this frame is removed first.
 * The CSS animation fades the outline within about a second. Outline does not take clicks, so the picture stays usable.
 */
export function showSelectionRing(element: HTMLElement) {
  ensureStyle(element);
  for (const other of [...active]) if (other !== element) clearSelectionRings(other);
  const onEnd = endings.get(element);
  if (onEnd) element.removeEventListener('animationend', onEnd);
  const mine = ++nextGeneration;
  generation.set(element, mine);
  element.classList.remove(selectionRingClass);
  void element.offsetWidth;
  element.classList.add(selectionRingClass);
  active.add(element);
  const finish = (event: AnimationEvent) => {
    if (event.target !== element) return;
    if (event.animationName !== selectionRingName) return;
    if (generation.get(element) !== mine) return;
    clearSelectionRings(element);
  };
  endings.set(element, finish);
  element.addEventListener('animationend', finish);
  const timer = element.ownerDocument.defaultView?.setTimeout(() => {
    if (generation.get(element) === mine) clearSelectionRings(element);
  }, selectionRingMs + 80);
  if (timer) timers.set(element, timer);
}
