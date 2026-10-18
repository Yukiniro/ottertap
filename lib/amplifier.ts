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

// Peaks above about -1 dB are held under full scale. A few milliseconds of attack
// catches the clip; the release is long enough not to ride individual bass cycles.
const limiterThreshold = -1;
const limiterKnee = 0;
const limiterRatio = 20;
const limiterAttack = 0.003;
const limiterRelease = 0.1;
const passthroughRatio = 1;
const glideSeconds = 0.02;

function place(param: AudioParam, value: number, time: number) {
  param.setValueAtTime(value, time);
}

function glide(param: AudioParam, value: number, time: number) {
  param.setValueAtTime(param.value, time);
  param.setTargetAtTime(value, time, glideSeconds);
}

function tune(gain: AudioParam, compressor: DynamicsCompressorNode, value: number, time: number, smooth: boolean) {
  const write = smooth ? glide : place;
  write(gain, value, time);
  // ratio 1 is unity gain through the curve, so the node can stay connected.
  write(compressor.ratio, value > 1 ? limiterRatio : passthroughRatio, time);
  if (smooth) return;
  place(compressor.threshold, limiterThreshold, time);
  place(compressor.knee, limiterKnee, time);
  place(compressor.attack, limiterAttack, time);
  place(compressor.release, limiterRelease, time);
}

export type Amplifier = ReturnType<typeof createAmplifier>;

export function createAmplifier(view: typeof globalThis) {
  let context: AudioContext | undefined;
  const nodes = new WeakMap<HTMLMediaElement, Promise<{ gain: GainNode; compressor: DynamicsCompressorNode }>>();
  const connect = async (element: HTMLMediaElement, value: number) => {
    context ??= new view.AudioContext();
    if (context.state !== 'running') await Promise.race([context.resume(), new Promise(resolve => view.setTimeout(resolve, 300))]);
    if (context.state !== 'running') throw new Error(i18n.t('needUserGesture'));
    let source: MediaElementAudioSourceNode;
    try { source = context.createMediaElementSource(element); }
    catch { throw new Error(i18n.t('mediaTakenOver')); }
    const gain = context.createGain();
    const compressor = context.createDynamicsCompressor();
    tune(gain.gain, compressor, value, context.currentTime, false);
    source.connect(gain).connect(compressor).connect(context.destination);
    return { gain, compressor };
  };
  const gains = new WeakMap<HTMLMediaElement, number>();
  return {
    gain: (element: HTMLMediaElement) => gains.get(element) ?? 1,
    async set(element: HTMLMediaElement, value: number) {
      let node = nodes.get(element);
      if (!node) {
        if (value === 1) return;
        node = connect(element, value);
        nodes.set(element, node);
        node.catch(() => nodes.delete(element));
        await node;
        gains.set(element, value);
        return;
      }
      const graph = await node;
      tune(graph.gain.gain, graph.compressor, value, graph.gain.context.currentTime, true);
      gains.set(element, value);
    }
  };
}
