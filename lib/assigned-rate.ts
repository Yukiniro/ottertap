/** Fired synchronously from the playbackRate setter with the value just written. */
export const assignedRateEvent = 'ottertap-assigned-rate';

/** Holds that value for the duration of the event. Removed before the setter returns. */
export const assignedRateAttribute = 'data-ottertap-assigned-rate';

const marker = 'ottertapAssignedRate';

/**
 * Chromium queues `ratechange`, so a burst such as `2` then `1` is already `1`
 * when the event runs. Publish each assigned value immediately instead.
 * The page and the content script have separate prototypes; call this in both.
 */
interface AssignedRateWindow {
  HTMLMediaElement?: typeof HTMLMediaElement;
  CustomEvent: typeof CustomEvent;
}

export function installAssignedRateHook(view: Window) {
  const host = view as unknown as AssignedRateWindow;
  const proto = host.HTMLMediaElement?.prototype;
  if (!proto) return;
  const current = Object.getOwnPropertyDescriptor(proto, 'playbackRate');
  if (!current?.get || !current.set || current.configurable === false) return;
  const previous = current.set as typeof current.set & { [marker]?: boolean };
  if (previous[marker]) return;
  const { get, set } = current;
  const assign: typeof previous = function (this: HTMLMediaElement, value: number) {
    const before = get.call(this);
    set.call(this, value);
    const after = get.call(this);
    if (Object.is(after, before)) return;
    this.setAttribute(assignedRateAttribute, String(after));
    try { this.dispatchEvent(new host.CustomEvent(assignedRateEvent)); }
    finally { this.removeAttribute(assignedRateAttribute); }
  };
  assign[marker] = true;
  Object.defineProperty(proto, 'playbackRate', {
    configurable: true,
    enumerable: current.enumerable ?? true,
    get,
    set: assign,
  });
}
