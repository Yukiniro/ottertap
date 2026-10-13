import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { normalizeDomain, normalizeSettings, isSiteEnabled } from '../lib/settings';
import { applyMediaCommand, createMediaController, isMediaCommand, mediaSnapshot } from '../lib/media';
import { formatTime } from '../lib/utils';

test('网站规则匹配域名及子域名，并拒绝内置页和后缀伪装', () => {
  const settings = normalizeSettings({ siteMode: 'allow', sites: ['*.YouTube.COM', 'https://bilibili.com/video/1'] });
  assert.deepEqual(settings.sites, ['youtube.com', 'bilibili.com']);
  assert.equal(isSiteEnabled('https://www.youtube.com/watch?v=1', settings), true);
  assert.equal(isSiteEnabled('https://youtube.com.evil.test/', settings), false);
  assert.equal(isSiteEnabled('https://notyoutube.com/', settings), false);
  assert.equal(isSiteEnabled('chrome://extensions/', settings), false);
  assert.equal(isSiteEnabled('file:///tmp/a.html', settings), false);
  assert.equal(isSiteEnabled('https://m.bilibili.com/', { ...settings, siteMode: 'exclude' }), false);
  assert.equal(isSiteEnabled('https://example.com/', { ...settings, siteMode: 'exclude' }), true);
  assert.equal(isSiteEnabled('https://example.com/', { ...settings, sites: [] }), false);
});
test('设置加载防止无效数据覆盖默认值，域名输入支持网址和国际域名', () => {
  assert.equal(normalizeDomain('https://www.bilibili.com/video/123?q=x'), 'www.bilibili.com');
  assert.equal(normalizeDomain('例子.中国'), 'xn--fsqu00a.xn--fiqs8s');
  for (const value of ['', 'a b.com', 'javascript:alert(1)', 'ftp://example.com', 'https://user:pass@example.com']) assert.throws(() => normalizeDomain(value));
  const settings = normalizeSettings({ theme: 'oops', floating: 'yes', sites: ['x.com', 'x.com', 12, ''], siteMode: 'oops' });
  assert.deepEqual(settings, { theme: 'system', floating: true, siteMode: 'all', sites: ['x.com'] });
});
function fixture(ranges = [[0, 100]]) {
  const window = new Window({ url: 'https://example.com' });
  window.document.title = '示例媒体';
  const media = window.document.createElement('video');
  window.document.body.append(media);
  Object.defineProperty(media, 'seekable', { value: { length: ranges.length, start: (i: number) => ranges[i]![0], end: (i: number) => ranges[i]![1] } });
  return { window, media: media as unknown as HTMLMediaElement, document: window.document as unknown as Document };
}
test('跳转限于可播放范围，直播窗口和分段空隙不会越界', async () => {
  const { media } = fixture([[20, 40], [60, 100]]);
  media.currentTime = 22;
  await applyMediaCommand(media, { type: 'skip', value: -10 }); assert.equal(media.currentTime, 20);
  await applyMediaCommand(media, { type: 'seek', value: 55 }); assert.equal(media.currentTime, 60);
  await applyMediaCommand(media, { type: 'seek', value: 200 }); assert.equal(media.currentTime, 100);
  await assert.rejects(applyMediaCommand(fixture([]).media, { type: 'seek', value: 10 }), /不可跳转/);
});
test('静音保留音量，调高音量取消静音，非法值不触碰媒体', async () => {
  const { media } = fixture(); media.volume = .75;
  await applyMediaCommand(media, { type: 'mute' }); assert.equal(media.muted, true); assert.equal(media.volume, .75);
  await applyMediaCommand(media, { type: 'mute' }); assert.equal(media.muted, false);
  media.muted = true;
  await applyMediaCommand(media, { type: 'volume', value: .4 }); assert.equal(media.volume, .4); assert.equal(media.muted, false);
  await applyMediaCommand(media, { type: 'rate', value: 1.5 }); assert.equal(media.playbackRate, 1.5);
  for (const command of [{ type: 'volume', value: -1 }, { type: 'volume', value: 2 }, { type: 'rate', value: NaN }, { type: 'seek', value: Infinity }, { type: 'evil', value: 1 }]) {
    assert.equal(isMediaCommand(command), false);
    await assert.rejects(applyMediaCommand(media, command as never));
  }
  assert.equal(media.volume, .4);
});
test('媒体发现支持开放 Shadow DOM、动态移除和稳定 ID', async () => {
  const { media, document, window } = fixture();
  const host = document.createElement('div'); document.body.append(host);
  document.body.append(document.createElementNS('http://www.w3.org/2000/svg', 'video'));
  const shadow = host.attachShadow({ mode: 'open' }); shadow.append(document.createElement('audio'));
  const controller = createMediaController(document);
  const first = controller.snapshot(); assert.equal(first.length, 2);
  assert.equal(controller.snapshot()[0]!.id, first[0]!.id);
  media.remove(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(controller.snapshot().length, 1);
  await assert.rejects(controller.command(first[0]!.id, { type: 'pause' }), /已移除/);
  controller.destroy(); await window.happyDOM.close();
});
test('播放失败向上传递；未知时长正确序列化为直播', async () => {
  const { media, document } = fixture();
  media.play = async () => { throw new Error('NotAllowedError'); };
  await assert.rejects(applyMediaCommand(media, { type: 'play' }), /NotAllowedError/);
  Object.defineProperty(media, 'duration', { value: Infinity });
  assert.equal(mediaSnapshot(media, '1', document).duration, null);
  assert.equal(mediaSnapshot(media, '1', document).live, true);
  assert.equal(formatTime(272), '04:32'); assert.equal(formatTime(3661), '1:01:01');
  assert.equal(formatTime(Infinity), '直播');
});
