import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAmplifier } from '../lib/amplifier';

type LogEvent =
  | { type: 'connect'; from: string; to: string }
  | { type: 'param'; param: string; method: 'setValueAtTime' | 'setTargetAtTime'; value: number; time: number; timeConstant?: number };

class FakeParam {
  readonly events: Extract<LogEvent, { type: 'param' }>[] = [];
  #value: number;
  constructor(readonly name: string, value: number, private readonly log: LogEvent[]) {
    this.#value = value;
  }
  get value() { return this.#value; }
  set value(next: number) { throw new Error(`${this.name} 不应直接赋值 ${next}`); }
  setValueAtTime(value: number, time: number) {
    this.#value = value;
    const event = { type: 'param' as const, param: this.name, method: 'setValueAtTime' as const, value, time };
    this.events.push(event);
    this.log.push(event);
    return this;
  }
  setTargetAtTime(value: number, time: number, timeConstant: number) {
    const event = { type: 'param' as const, param: this.name, method: 'setTargetAtTime' as const, value, time, timeConstant };
    this.events.push(event);
    this.log.push(event);
    return this;
  }
  target() {
    const event = this.events.findLast(item => item.method === 'setValueAtTime' || item.method === 'setTargetAtTime');
    assert.ok(event, `${this.name} 没有排程`);
    return event;
  }
}

class FakeNode {
  readonly connections: FakeNode[] = [];
  disconnects = 0;
  constructor(readonly name: string, private readonly log: LogEvent[]) {}
  connect(destination: FakeNode) {
    this.connections.push(destination);
    this.log.push({ type: 'connect', from: this.name, to: destination.name });
    return destination;
  }
  disconnect() { this.disconnects += 1; }
}

class FakeGain extends FakeNode {
  readonly gain: FakeParam;
  constructor(readonly context: { currentTime: number }, log: LogEvent[]) {
    super('gain', log);
    this.gain = new FakeParam('gain', 1, log);
  }
}

class FakeCompressor extends FakeNode {
  readonly threshold: FakeParam;
  readonly knee: FakeParam;
  readonly ratio: FakeParam;
  readonly attack: FakeParam;
  readonly release: FakeParam;
  constructor(log: LogEvent[]) {
    super('compressor', log);
    this.threshold = new FakeParam('threshold', -24, log);
    this.knee = new FakeParam('knee', 30, log);
    this.ratio = new FakeParam('ratio', 12, log);
    this.attack = new FakeParam('attack', 0.003, log);
    this.release = new FakeParam('release', 0.25, log);
  }
}

class FakeContext {
  state: AudioContextState;
  currentTime = 0;
  readonly destination: FakeNode;
  readonly sources: FakeNode[] = [];
  readonly gains: FakeGain[] = [];
  readonly compressors: FakeCompressor[] = [];
  resumes = 0;
  constructor(readonly log: LogEvent[], state: AudioContextState, private readonly failSource: boolean) {
    this.state = state;
    this.destination = new FakeNode('destination', log);
  }
  resume() {
    this.resumes += 1;
    return Promise.resolve();
  }
  createMediaElementSource() {
    if (this.failSource) throw new Error('already connected');
    const source = new FakeNode('source', this.log);
    this.sources.push(source);
    return source;
  }
  createGain() {
    const gain = new FakeGain(this, this.log);
    this.gains.push(gain);
    return gain;
  }
  createDynamicsCompressor() {
    const compressor = new FakeCompressor(this.log);
    this.compressors.push(compressor);
    return compressor;
  }
}

function installAudio(options: { state?: AudioContextState; failSource?: boolean } = {}) {
  const log: LogEvent[] = [];
  const contexts: FakeContext[] = [];
  const state = options.state ?? 'running';
  const failSource = options.failSource ?? false;
  const view = {
    AudioContext: class extends FakeContext {
      constructor() {
        super(log, state, failSource);
        contexts.push(this);
      }
    },
    setTimeout: globalThis.setTimeout,
  } as unknown as typeof globalThis;
  return { view, contexts, log };
}

function chain(node: FakeNode) {
  const names = [node.name];
  let current = node;
  const seen = new Set<FakeNode>();
  while (current.connections.length) {
    assert.equal(current.connections.length, 1, `${current.name} 应只有一条输出`);
    const next = current.connections[0];
    assert.ok(next);
    assert.equal(seen.has(next), false);
    seen.add(next);
    names.push(next.name);
    current = next;
  }
  return names;
}

function element() {
  return {} as HTMLMediaElement;
}

test('超过 100% 时按 source → gain → 限幅器 → destination 连接，增益不超过 1 时不建图', async () => {
  const { view, contexts, log } = installAudio();
  const amplifier = createAmplifier(view);
  const media = element();
  assert.equal(amplifier.gain(media), 1);
  await amplifier.set(media, 1);
  assert.equal(contexts.length, 0);

  await amplifier.set(media, 2);
  assert.equal(contexts.length, 1);
  const context = contexts[0];
  assert.ok(context);
  assert.equal(context.sources.length, 1);
  assert.equal(context.gains.length, 1);
  assert.equal(context.compressors.length, 1);
  const source = context.sources[0];
  const gain = context.gains[0];
  const compressor = context.compressors[0];
  assert.ok(source && gain && compressor);
  assert.deepEqual(chain(source), ['source', 'gain', 'compressor', 'destination']);
  const connectedAt = log.findIndex(event => event.type === 'connect' && event.to === 'destination');
  const shapedAt = log.findIndex(event => event.type === 'param' && event.param === 'threshold');
  assert.ok(shapedAt >= 0 && shapedAt < connectedAt, '限幅参数应在接到输出之前写好');
  assert.equal(amplifier.gain(media), 2);
  assert.deepEqual(gain.gain.target(), { type: 'param', param: 'gain', method: 'setValueAtTime', value: 2, time: 0 });
  assert.deepEqual(compressor.ratio.target(), { type: 'param', param: 'ratio', method: 'setValueAtTime', value: 20, time: 0 });
  assert.deepEqual(compressor.threshold.target(), { type: 'param', param: 'threshold', method: 'setValueAtTime', value: -1, time: 0 });
  assert.deepEqual(compressor.knee.target(), { type: 'param', param: 'knee', method: 'setValueAtTime', value: 0, time: 0 });
  assert.deepEqual(compressor.attack.target(), { type: 'param', param: 'attack', method: 'setValueAtTime', value: 0.003, time: 0 });
  assert.deepEqual(compressor.release.target(), { type: 'param', param: 'release', method: 'setValueAtTime', value: 0.1, time: 0 });
  assert.equal(gain.gain.events.some(event => event.method === 'setTargetAtTime'), false);
});

test('运行中切换增益只平滑改参数，不拆接节点', async () => {
  const { view, contexts } = installAudio();
  const amplifier = createAmplifier(view);
  const media = element();
  await amplifier.set(media, 2);
  const context = contexts[0];
  assert.ok(context);
  const gain = context.gains[0];
  const compressor = context.compressors[0];
  assert.ok(gain && compressor);
  context.currentTime = 1.5;

  await amplifier.set(media, 1);
  assert.equal(contexts.length, 1);
  assert.equal(context.sources.length, 1);
  assert.equal(context.gains.length, 1);
  assert.equal(context.compressors.length, 1);
  assert.equal(context.sources[0]?.disconnects, 0);
  assert.equal(gain.disconnects, 0);
  assert.equal(compressor.disconnects, 0);
  assert.equal(context.destination.disconnects, 0);
  assert.equal(amplifier.gain(media), 1);
  assert.deepEqual(gain.gain.events.slice(-2), [
    { type: 'param', param: 'gain', method: 'setValueAtTime', value: 2, time: 1.5 },
    { type: 'param', param: 'gain', method: 'setTargetAtTime', value: 1, time: 1.5, timeConstant: 0.02 },
  ]);
  assert.deepEqual(compressor.ratio.events.slice(-2), [
    { type: 'param', param: 'ratio', method: 'setValueAtTime', value: 20, time: 1.5 },
    { type: 'param', param: 'ratio', method: 'setTargetAtTime', value: 1, time: 1.5, timeConstant: 0.02 },
  ]);
  assert.equal(compressor.threshold.events.length, 1);
  assert.equal(compressor.knee.events.length, 1);
  assert.equal(compressor.attack.events.length, 1);
  assert.equal(compressor.release.events.length, 1);

  context.currentTime = 2;
  await amplifier.set(media, 1.5);
  assert.equal(context.compressors.length, 1);
  assert.equal(compressor.disconnects, 0);
  assert.equal(amplifier.gain(media), 1.5);
  assert.equal(gain.gain.target().method, 'setTargetAtTime');
  assert.equal(gain.gain.target().value, 1.5);
  assert.equal(gain.gain.target().time, 2);
  assert.equal(compressor.ratio.target().value, 20);
  assert.equal(compressor.ratio.target().timeConstant, 0.02);

  await amplifier.set(media, 0.4);
  assert.equal(amplifier.gain(media), 0.4);
  assert.equal(gain.gain.target().value, 0.4);
  assert.equal(compressor.ratio.target().value, 1);
  assert.equal(context.compressors.length, 1);
  assert.equal(compressor.disconnects, 0);
});

test('两个媒体共用 AudioContext，各自有一条限幅链路', async () => {
  const { view, contexts } = installAudio();
  const amplifier = createAmplifier(view);
  const first = element();
  const second = element();
  await amplifier.set(first, 1.25);
  await amplifier.set(second, 2);
  assert.equal(contexts.length, 1);
  const context = contexts[0];
  assert.ok(context);
  assert.equal(context.sources.length, 2);
  assert.equal(context.gains.length, 2);
  assert.equal(context.compressors.length, 2);
  assert.notEqual(context.compressors[0], context.compressors[1]);
  for (const source of context.sources) assert.deepEqual(chain(source), ['source', 'gain', 'compressor', 'destination']);
  assert.equal(context.gains[0]?.gain.target().value, 1.25);
  assert.equal(context.compressors[0]?.ratio.target().value, 20);
  assert.equal(context.gains[1]?.gain.target().value, 2);
  assert.equal(amplifier.gain(first), 1.25);
  assert.equal(amplifier.gain(second), 2);
});

test('没有用户手势或媒体已被接管时不保留增益', async () => {
  const blocked = installAudio({ state: 'suspended' });
  const waiting = createAmplifier(blocked.view);
  const media = element();
  await assert.rejects(() => waiting.set(media, 2), /点击一次网页/);
  assert.equal(waiting.gain(media), 1);
  assert.equal(blocked.contexts.length, 1);
  assert.equal(blocked.contexts[0]?.sources.length, 0);
  assert.equal(blocked.contexts[0]?.compressors.length, 0);
  assert.equal(blocked.contexts[0]?.resumes, 1);

  const taken = installAudio({ failSource: true });
  const denied = createAmplifier(taken.view);
  await assert.rejects(() => denied.set(media, 1.5), /已被网页接管/);
  assert.equal(denied.gain(media), 1);
  assert.equal(taken.contexts[0]?.gains.length, 0);
  assert.equal(taken.log.some(event => event.type === 'connect'), false);
});
