import { i18n } from '#i18n';

export const maxGain = 2;

export function splitVolume(value: number) {
  return { volume: Math.min(value, 1), gain: Math.max(value, 1) };
}

// Cross-origin media without CORS outputs silence once routed through Web Audio.
export function canAmplify(element: HTMLMediaElement, document: Document) {
  const source = element.currentSrc;
  if (!source) return false;
  const url = new URL(source, document.URL);
  if (['blob:', 'data:'].includes(url.protocol)) return true;
  return url.origin === new URL(document.URL).origin || element.hasAttribute('crossorigin');
}

export type Amplifier = ReturnType<typeof createAmplifier>;

export function createAmplifier(view: typeof globalThis) {
  let context: AudioContext | undefined;
  const nodes = new WeakMap<HTMLMediaElement, Promise<GainNode>>();
  const connect = async (element: HTMLMediaElement) => {
    context ??= new view.AudioContext();
    if (context.state !== 'running') await Promise.race([context.resume(), new Promise(resolve => view.setTimeout(resolve, 300))]);
    if (context.state !== 'running') throw new Error(i18n.t('needUserGesture'));
    let source: MediaElementAudioSourceNode;
    try { source = context.createMediaElementSource(element); }
    catch { throw new Error(i18n.t('mediaTakenOver')); }
    const node = context.createGain();
    source.connect(node).connect(context.destination);
    return node;
  };
  const gains = new WeakMap<HTMLMediaElement, number>();
  return {
    gain: (element: HTMLMediaElement) => gains.get(element) ?? 1,
    async set(element: HTMLMediaElement, value: number) {
      let node = nodes.get(element);
      if (!node) {
        if (value === 1) return;
        node = connect(element);
        nodes.set(element, node);
        node.catch(() => nodes.delete(element));
      }
      (await node).gain.value = value;
      gains.set(element, value);
    }
  };
}
