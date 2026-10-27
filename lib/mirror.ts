import { i18n } from '#i18n';

const marker = 'data-ottertap-mirror';
const flip = '-1 1';
const previousScale = new WeakMap<HTMLElement, string>();

/** True only when this extension flipped that video. A new element has no marker, so it stays off. */
export function isHorizontallyMirrored(element: HTMLMediaElement) {
  return element.localName === 'video' && element.hasAttribute(marker);
}

/**
 * Flip the video's picture with the independent `scale` property so an existing `transform` stays put.
 * The layout box does not change, and audio is untouched. Audio elements have no picture.
 * The marker lives on the element for this page only. It is not a site preference.
 */
export function setHorizontalMirror(element: HTMLMediaElement, on: boolean) {
  if (element.localName !== 'video') throw new Error(i18n.t('mirrorUnavailableAudio'));
  if (on) {
    if (element.hasAttribute(marker)) return;
    previousScale.set(element, element.style.getPropertyValue('scale'));
    element.style.setProperty('scale', flip);
    element.setAttribute(marker, '');
    return;
  }
  if (!element.hasAttribute(marker)) return;
  const previous = previousScale.get(element) ?? '';
  previousScale.delete(element);
  if (previous) element.style.setProperty('scale', previous);
  else element.style.removeProperty('scale');
  element.removeAttribute(marker);
}
