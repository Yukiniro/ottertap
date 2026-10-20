import { i18n } from '#i18n';
import type { ChannelMode } from './types';

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

// Weights for [left out, right out] from [left in, right in]. Every row sums to 1, so no mode
// is louder than the louder input channel, and gliding between two modes stays within that bound.
const channelWeights: Record<ChannelMode, readonly (readonly number[])[]> = {
  stereo: [[1, 0], [0, 1]],
  mono: [[.5, .5], [.5, .5]],
  left: [[1, 0], [1, 0]],
  right: [[0, 1], [0, 1]]
};
export const channelModes = Object.keys(channelWeights) as ChannelMode[];
export const isChannelMode = (value: unknown): value is ChannelMode => channelModes.includes(value as ChannelMode);

// Peaks above about -1 dB are held under full scale. A few milliseconds of attack
// catches the clip; the release is long enough not to ride individual bass cycles.
const limiterThreshold = -1;
const limiterKnee = 0;
const limiterRatio = 20;
const limiterAttack = 0.003;
const limiterRelease = 0.1;
const passthroughRatio = 1;
const glideSeconds = 0.02;
// Events that grant user activation, so an AudioContext may start inside their listeners.
const gestureEvents = ['pointerdown', 'pointerup', 'keydown'] as const;

function place(param: AudioParam, value: number, time: number) {
  param.setValueAtTime(value, time);
}

function glide(param: AudioParam, value: number, time: number) {
  param.setValueAtTime(param.value, time);
  param.setTargetAtTime(value, time, glideSeconds);
}

interface Graph { gain: GainNode; matrix: GainNode[][]; compressor: DynamicsCompressorNode }
interface Mix { gain: number; channel: ChannelMode }
const unity: Mix = { gain: 1, channel: 'stereo' };

function tune({ gain, matrix, compressor }: Graph, mix: Mix, time: number, smooth: boolean) {
  const write = smooth ? glide : place;
  write(gain.gain, mix.gain, time);
  // ratio 1 is unity gain through the curve, so the node can stay connected.
  write(compressor.ratio, mix.gain > 1 ? limiterRatio : passthroughRatio, time);
  channelWeights[mix.channel].forEach((row, output) => row.forEach((weight, input) => write(matrix[output]![input]!.gain, weight, time)));
  if (smooth) return;
  place(compressor.threshold, limiterThreshold, time);
  place(compressor.knee, limiterKnee, time);
  place(compressor.attack, limiterAttack, time);
  place(compressor.release, limiterRelease, time);
}

export type Amplifier = ReturnType<typeof createAmplifier>;

/** Routes media through Web Audio only once a gain above 1 or a non-stereo channel mode is asked for. */
export function createAmplifier(view: typeof globalThis) {
  let context: AudioContext | undefined;
  const nodes = new WeakMap<HTMLMediaElement, Promise<Graph>>();
  const mixes = new WeakMap<HTMLMediaElement, Mix>();
  const connect = async (element: HTMLMediaElement, mix: Mix, purpose: 'gain' | 'channel') => {
    const audio = context ??= new view.AudioContext();
    if (audio.state !== 'running') await Promise.race([audio.resume(), new Promise(resolve => view.setTimeout(resolve, 300))]);
    if (audio.state !== 'running') throw new Error(i18n.t(purpose === 'channel' ? 'channelNeedsGesture' : 'needUserGesture'));
    let source: MediaElementAudioSourceNode;
    try { source = audio.createMediaElementSource(element); }
    catch { throw new Error(i18n.t(purpose === 'channel' ? 'channelTakenOver' : 'mediaTakenOver')); }
    const gain = audio.createGain();
    // Mono media becomes two equal channels here, the way speakers would play it.
    gain.channelCount = 2;
    gain.channelCountMode = 'explicit';
    gain.channelInterpretation = 'speakers';
    const splitter = audio.createChannelSplitter(2);
    const matrix = [0, 1].map(() => [0, 1].map(() => audio.createGain()));
    const merger = audio.createChannelMerger(2);
    const compressor = audio.createDynamicsCompressor();
    const graph = { gain, matrix, compressor };
    tune(graph, mix, audio.currentTime, false);
    source.connect(gain).connect(splitter);
    matrix.forEach((row, output) => row.forEach((weight, input) => {
      splitter.connect(weight, input);
      weight.connect(merger, 0, output);
    }));
    merger.connect(compressor).connect(audio.destination);
    return graph;
  };
  const update = async (element: HTMLMediaElement, change: Partial<Mix>) => {
    let node = nodes.get(element);
    if (!node) {
      const mix = { ...unity, ...change };
      if (mix.gain === 1 && mix.channel === 'stereo') return;
      node = connect(element, mix, change.channel ? 'channel' : 'gain');
      nodes.set(element, node);
      node.catch(() => nodes.delete(element));
      await node;
      mixes.set(element, mix);
      return;
    }
    const graph = await node;
    const mix = { ...(mixes.get(element) ?? unity), ...change };
    tune(graph, mix, graph.gain.context.currentTime, true);
    mixes.set(element, mix);
  };
  // A remembered mode is restored when the page loads, usually before the autoplay policy lets
  // the context start. The mode is kept and applied on the next gesture on the page.
  const deferred = new Map<HTMLMediaElement, ChannelMode>();
  const listen = (on: boolean) => { for (const type of gestureEvents) (on ? view.addEventListener : view.removeEventListener).call(view, type, retry, true); };
  const retry = () => {
    listen(false);
    const waiting = [...deferred];
    deferred.clear();
    for (const [element, mode] of waiting) if (element.isConnected) void setChannel(element, mode).catch(() => {});
  };
  const setChannel = async (element: HTMLMediaElement, mode: ChannelMode) => {
    deferred.delete(element);
    try { await update(element, { channel: mode }); }
    catch (error) {
      if (context?.state !== 'running') {
        if (!deferred.size) listen(true);
        deferred.set(element, mode);
      }
      throw error;
    }
  };
  return {
    gain: (element: HTMLMediaElement) => mixes.get(element)?.gain ?? 1,
    channel: (element: HTMLMediaElement) => mixes.get(element)?.channel ?? 'stereo',
    set: (element: HTMLMediaElement, value: number) => update(element, { gain: value }),
    setChannel,
    dispose() { listen(false); deferred.clear(); }
  };
}
