import assert from 'node:assert/strict';
import { test } from 'node:test';
import { channelModes, createAmplifier } from '../lib/amplifier';
import type { ChannelMode } from '../lib/types';

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

interface Link { to: FakeNode; output: number; input: number }

class FakeNode {
  readonly links: Link[] = [];
  disconnects = 0;
  channelCount = 2;
  channelCountMode: ChannelCountMode = 'max';
  channelInterpretation: ChannelInterpretation = 'speakers';
  constructor(readonly name: string, private readonly log: LogEvent[]) {}
  connect(destination: FakeNode, output = 0, input = 0) {
    this.links.push({ to: destination, output, input });
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
  readonly splitters: FakeNode[] = [];
  readonly mergers: FakeNode[] = [];
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
  createChannelSplitter(outputs: number) {
    assert.equal(outputs, 2);
    const splitter = new FakeNode('splitter', this.log);
    this.splitters.push(splitter);
    return splitter;
  }
  createChannelMerger(inputs: number) {
    assert.equal(inputs, 2);
    const merger = new FakeNode('merger', this.log);
    this.mergers.push(merger);
    return merger;
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

function only(node: FakeNode) {
  assert.equal(node.links.length, 1, `${node.name} 应只有一条输出`);
  return node.links[0]!.to;
}

/** Walks source → gain → splitter → 4 weights → merger → compressor → destination and returns each node. */
function graph(source: FakeNode) {
  const gain = only(source) as FakeGain;
  const splitter = only(gain);
  assert.deepEqual([gain.name, splitter.name], ['gain', 'splitter']);
  assert.equal(splitter.links.length, 4);
  const weights: FakeGain[][] = [[], []];
  let merger: FakeNode | undefined;
  for (const link of splitter.links) {
    const weight = link.to as FakeGain;
    assert.equal(weight.name, 'gain');
    assert.equal(weight.links.length, 1);
    const out = weight.links[0]!;
    assert.equal(out.to.name, 'merger');
    assert.ok(!merger || merger === out.to, '四个权重应汇入同一个 merger');
    merger = out.to;
    assert.equal(weights[out.input]![link.output], undefined, '每个输入/输出声道组合只有一个权重');
    weights[out.input]![link.output] = weight;
  }
  assert.ok(merger);
  const compressor = only(merger) as FakeCompressor;
  assert.equal(compressor.name, 'compressor');
  assert.equal(only(compressor).name, 'destination');
  return { gain, splitter, weights, merger, compressor };
}

const weightsOf = (weights: FakeGain[][]) => weights.map(row => row.map(weight => weight.gain.target().value));
const expectedWeights: Record<ChannelMode, number[][]> = {
  stereo: [[1, 0], [0, 1]],
  mono: [[.5, .5], [.5, .5]],
  left: [[1, 0], [1, 0]],
  right: [[0, 1], [0, 1]],
};

function element() {
  return {} as HTMLMediaElement;
}

test('超过 100% 时按 source → gain → 声道矩阵 → 限幅器 → destination 连接，增益不超过 1 时不建图', async () => {
  const { view, contexts, log } = installAudio();
  const amplifier = createAmplifier(view);
  const media = element();
  assert.equal(amplifier.gain(media), 1);
  assert.equal(amplifier.channel(media), 'stereo');
  await amplifier.set(media, 1);
  assert.equal(contexts.length, 0);

  await amplifier.set(media, 2);
  assert.equal(contexts.length, 1);
  const context = contexts[0];
  assert.ok(context);
  assert.equal(context.sources.length, 1);
  assert.equal(context.gains.length, 5);
  assert.equal(context.splitters.length, 1);
  assert.equal(context.mergers.length, 1);
  assert.equal(context.compressors.length, 1);
  const { gain, compressor, weights } = graph(context.sources[0]!);
  assert.deepEqual([gain.channelCount, gain.channelCountMode, gain.channelInterpretation], [2, 'explicit', 'speakers'], '单声道媒体要先按扬声器规则铺满两个声道');
  assert.deepEqual(weightsOf(weights), expectedWeights.stereo);
  const connectedAt = log.findIndex(event => event.type === 'connect' && event.to === 'destination');
  const shapedAt = log.findIndex(event => event.type === 'param' && event.param === 'threshold');
  assert.ok(shapedAt >= 0 && shapedAt < connectedAt, '限幅参数应在接到输出之前写好');
  for (const weight of weights.flat()) assert.equal(weight.gain.events.every(event => event.method === 'setValueAtTime'), true, '建图时权重直接落位');
  assert.equal(amplifier.gain(media), 2);
  assert.equal(amplifier.channel(media), 'stereo');
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
  const { gain, compressor, weights } = graph(context.sources[0]!);
  context.currentTime = 1.5;

  await amplifier.set(media, 1);
  assert.equal(contexts.length, 1);
  assert.equal(context.sources.length, 1);
  assert.equal(context.gains.length, 5);
  assert.equal(context.compressors.length, 1);
  for (const node of [context.sources[0]!, ...context.gains, ...context.splitters, ...context.mergers, compressor, context.destination]) assert.equal(node.disconnects, 0);
  assert.equal(amplifier.gain(media), 1);
  assert.deepEqual(gain.gain.events.slice(-2), [
    { type: 'param', param: 'gain', method: 'setValueAtTime', value: 2, time: 1.5 },
    { type: 'param', param: 'gain', method: 'setTargetAtTime', value: 1, time: 1.5, timeConstant: 0.02 },
  ]);
  assert.deepEqual(compressor.ratio.events.slice(-2), [
    { type: 'param', param: 'ratio', method: 'setValueAtTime', value: 20, time: 1.5 },
    { type: 'param', param: 'ratio', method: 'setTargetAtTime', value: 1, time: 1.5, timeConstant: 0.02 },
  ]);
  assert.deepEqual(weightsOf(weights), expectedWeights.stereo);
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
  assert.equal(context.gains.length, 10);
  assert.equal(context.compressors.length, 2);
  assert.notEqual(context.compressors[0], context.compressors[1]);
  const [a, b] = context.sources.map(source => graph(source));
  assert.ok(a && b);
  assert.notEqual(a.merger, b.merger);
  assert.equal(a.gain.gain.target().value, 1.25);
  assert.equal(a.compressor.ratio.target().value, 20);
  assert.equal(b.gain.gain.target().value, 2);
  assert.equal(amplifier.gain(first), 1.25);
  assert.equal(amplifier.gain(second), 2);
});

test('没有用户手势或媒体已被接管时不保留增益和声道', async () => {
  const blocked = installAudio({ state: 'suspended' });
  const waiting = createAmplifier(blocked.view);
  const media = element();
  await assert.rejects(() => waiting.set(media, 2), /点击一次网页，再把音量/);
  await assert.rejects(() => waiting.setChannel(media, 'mono'), /点击一次网页，再切换声道/);
  assert.equal(waiting.gain(media), 1);
  assert.equal(waiting.channel(media), 'stereo');
  assert.equal(blocked.contexts.length, 1);
  assert.equal(blocked.contexts[0]?.sources.length, 0);
  assert.equal(blocked.contexts[0]?.compressors.length, 0);
  assert.equal(blocked.contexts[0]?.resumes, 2);

  const taken = installAudio({ failSource: true });
  const denied = createAmplifier(taken.view);
  await assert.rejects(() => denied.set(media, 1.5), /已被网页接管，无法放大/);
  await assert.rejects(() => denied.setChannel(media, 'left'), /已被网页接管，无法切换声道/);
  assert.equal(denied.gain(media), 1);
  assert.equal(denied.channel(media), 'stereo');
  assert.equal(taken.contexts[0]?.gains.length, 0);
  assert.equal(taken.log.some(event => event.type === 'connect'), false);
});

test('默认立体声：只调音量不超过 100% 或选立体声都不接入 Web Audio', async () => {
  const { view, contexts } = installAudio();
  const amplifier = createAmplifier(view);
  const media = element();
  await amplifier.setChannel(media, 'stereo');
  await amplifier.set(media, 1);
  await amplifier.setChannel(media, 'stereo');
  assert.equal(contexts.length, 0, '没选非立体声时不能创建 AudioContext');
  assert.equal(amplifier.channel(media), 'stereo');
  assert.equal(amplifier.gain(media), 1);
});

test('100% 以下选非立体声才接入，切换模式只平滑改权重，切回立体声恢复单位矩阵', async () => {
  const { view, contexts } = installAudio();
  const amplifier = createAmplifier(view);
  const media = element();
  await amplifier.setChannel(media, 'mono');
  assert.equal(contexts.length, 1);
  const context = contexts[0]!;
  const { gain, compressor, weights } = graph(context.sources[0]!);
  assert.equal(amplifier.channel(media), 'mono');
  assert.equal(amplifier.gain(media), 1);
  assert.deepEqual(weightsOf(weights), expectedWeights.mono);
  assert.equal(gain.gain.target().value, 1);
  assert.equal(compressor.ratio.target().value, 1, '不放大时限幅器保持直通');

  let time = 0;
  for (const mode of ['left', 'right', 'mono', 'stereo', 'right', 'stereo'] as const) {
    context.currentTime = time += 1;
    await amplifier.setChannel(media, mode);
    assert.equal(amplifier.channel(media), mode);
    assert.deepEqual(weightsOf(weights), expectedWeights[mode], mode);
    for (const weight of weights.flat()) {
      const target = weight.gain.target();
      assert.deepEqual([target.method, target.time, target.timeConstant], ['setTargetAtTime', time, 0.02], `${mode} 应平滑过渡`);
    }
  }
  assert.equal(context.sources.length, 1, '切换模式不重建链路');
  assert.equal(context.gains.length, 5);
  assert.equal(context.compressors.length, 1);
  for (const node of [context.sources[0]!, ...context.gains, ...context.splitters, ...context.mergers, compressor]) assert.equal(node.disconnects, 0);
  assert.equal(gain.gain.target().value, 1);
  assert.equal(compressor.ratio.target().value, 1);
});

test('声道和音量放大叠加：各自保留，限幅器只看增益', async () => {
  const { view, contexts } = installAudio();
  const amplifier = createAmplifier(view);
  const boosted = element();
  await amplifier.set(boosted, 2);
  await amplifier.setChannel(boosted, 'mono');
  const first = graph(contexts[0]!.sources[0]!);
  assert.deepEqual(weightsOf(first.weights), expectedWeights.mono);
  assert.equal(first.gain.gain.target().value, 2);
  assert.equal(first.compressor.ratio.target().value, 20);
  await amplifier.set(boosted, 1);
  assert.deepEqual(weightsOf(first.weights), expectedWeights.mono, '调回 100% 不影响声道');
  assert.equal(first.compressor.ratio.target().value, 1);
  assert.equal(amplifier.channel(boosted), 'mono');

  const mono = element();
  await amplifier.setChannel(mono, 'left');
  await amplifier.set(mono, 1.5);
  const second = graph(contexts[0]!.sources[1]!);
  assert.deepEqual(weightsOf(second.weights), expectedWeights.left);
  assert.equal(second.gain.gain.target().value, 1.5);
  assert.equal(second.compressor.ratio.target().value, 20);

  const racing = element();
  await Promise.all([amplifier.set(racing, 1.75), amplifier.setChannel(racing, 'right')]);
  assert.equal(contexts[0]!.sources.length, 3, '并发的两次调整只接入一次');
  const third = graph(contexts[0]!.sources[2]!);
  assert.deepEqual([amplifier.gain(racing), amplifier.channel(racing)], [1.75, 'right']);
  assert.equal(third.gain.gain.target().value, 1.75);
  assert.deepEqual(weightsOf(third.weights), expectedWeights.right);
});

test('任何模式（含切换途中）输出都不超过较响的输入声道', () => {
  assert.deepEqual(channelModes, ['stereo', 'mono', 'left', 'right']);
  const samples = [[1, 1], [1, -1], [-1, 1], [1, 0], [0, -1], [.3, -.9]] as const;
  for (const from of channelModes) for (const to of channelModes) for (const progress of [0, .25, .5, .9, 1]) {
    const weights = expectedWeights[from].map((row, output) => row.map((weight, input) => weight + (expectedWeights[to][output]![input]! - weight) * progress));
    for (const row of weights) assert.ok(Math.abs(row[0]! + row[1]! - 1) < 1e-9, `${from}→${to} 每行权重和为 1`);
    for (const [left, right] of samples) for (const row of weights) {
      assert.ok(Math.abs(row[0]! * left + row[1]! * right) <= Math.max(Math.abs(left), Math.abs(right)) + 1e-9, `${from}→${to} 在 ${progress} 处变响`);
    }
  }
});
