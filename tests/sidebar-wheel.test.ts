import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { bareVolumeWheel } from '../lib/hotkey';
import { sidebarBlocksBareWheel, sidebarWheelIgnore, sidebarWheelSelector } from '../lib/sidebar-wheel';

function page() {
  const window = new Window({ url: 'https://example.com/watch' });
  return { window, document: window.document };
}

function pathOf(start: object) {
  const nodes: EventTarget[] = [];
  let current: object | null = start;
  const seen = new Set<object>();
  while (current && !seen.has(current)) {
    seen.add(current);
    nodes.push(current as EventTarget);
    const element = current as { parentElement?: object | null; getRootNode?: () => object; nodeType?: number; ownerDocument?: object | null; host?: unknown };
    if (element.parentElement) { current = element.parentElement; continue; }
    const root = element.getRootNode?.();
    const shadowHost = root && root !== current ? (root as { host?: unknown }).host : undefined;
    if (typeof shadowHost === 'object' && shadowHost) { current = root as object; continue; }
    if (element.nodeType === 11 && typeof element.host === 'object' && element.host) { current = element.host; continue; }
    const doc = element.ownerDocument;
    if (doc && current !== doc) { current = doc; continue; }
    break;
  }
  return nodes;
}

function bare(path: EventTarget[], extra: Partial<{ altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; deltaX: number; deltaY: number }> = {}) {
  const event = { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, deltaX: 0, deltaY: 100, composedPath: () => path, ...extra };
  const stage = true;
  return bareVolumeWheel(event, stage) && !sidebarBlocksBareWheel(event);
}

test('选择器只点名聊天列和文档大纲，不用会包住页面的宽标签', () => {
  const parts = sidebarWheelSelector.split(',').map(item => item.trim());
  for (const broad of ['aside', 'nav', 'main', 'div', '#chat', '#secondary', '[role="complementary"]', '.sidebar', '[role="log"]']) {
    assert.equal(parts.includes(broad), false, broad);
  }
  assert.equal(new Set(parts).size, parts.length);
});

test('YouTube 和 Twitch 聊天、文档大纲会放行；认不出的叠层保持主播放区', () => {
  const { document } = page();
  const video = document.createElement('video');
  const stage = document.createElement('div');
  const chat = document.createElement('div');
  chat.className = 'chat-scrollable-area__message-container';
  chat.setAttribute('data-test-selector', 'chat-scrollable-area__message-container');
  const line = document.createElement('span');
  chat.append(line);
  const youtube = document.createElement('ytd-live-chat-frame');
  const message = document.createElement('div');
  youtube.append(message);
  const outline = document.createElement('aside');
  outline.className = 'VPDocAside';
  const link = document.createElement('a');
  outline.append(link);
  const unknown = document.createElement('aside');
  unknown.id = 'chat';
  const note = document.createElement('div');
  unknown.append(note);
  stage.append(video, chat, youtube, outline, unknown);
  document.body.append(stage);

  assert.equal(sidebarWheelIgnore(pathOf(line)), true);
  assert.equal(sidebarWheelIgnore(pathOf(message)), true);
  assert.equal(sidebarWheelIgnore(pathOf(link)), true);
  assert.equal(sidebarWheelIgnore(pathOf(note)), false, '只有 id=chat 的 aside 不是已知容器');
  assert.equal(sidebarWheelIgnore(pathOf(video)), false);
  assert.equal(bare(pathOf(line)), false, '聊天上的裸滚轮不调音');
  assert.equal(bare(pathOf(video)), true, '主画面仍可调音');
  assert.equal(bare(pathOf(note)), true, '认不出的叠层仍走主播放区');
});

test('指针在媒体元素上时，包住它的大纲祖先也不抢走滚轮', () => {
  const { document } = page();
  const aside = document.createElement('div');
  aside.className = 'theme-doc-toc-desktop';
  const video = document.createElement('video');
  aside.append(video);
  document.body.append(aside);
  assert.equal(sidebarWheelIgnore(pathOf(video)), false);
  assert.equal(bare(pathOf(video)), true);
});

test('Alt 和 Shift 不因忽略区放行', () => {
  const { document } = page();
  const chat = document.createElement('div');
  chat.className = 'chat-room__content';
  const line = document.createElement('span');
  chat.append(line);
  document.body.append(chat);
  const path = pathOf(line);
  assert.equal(sidebarBlocksBareWheel({ altKey: true, shiftKey: false, ctrlKey: false, metaKey: false, composedPath: () => path }), false);
  assert.equal(sidebarBlocksBareWheel({ altKey: false, shiftKey: true, ctrlKey: false, metaKey: false, composedPath: () => path }), false);
  assert.equal(sidebarBlocksBareWheel({ altKey: false, shiftKey: false, ctrlKey: true, metaKey: false, composedPath: () => path }), false);
  assert.equal(bare(path, { altKey: true, deltaY: -100 }), false, 'Alt 不走裸滚轮这条，由调用方单独把目标传下去');
  assert.equal(bare(path, { shiftKey: true, deltaY: -100 }), true, 'Shift 粗调仍算音量手势');
});

test('常见文档站大纲和 Bilibili 直播聊天列', () => {
  const { document } = page();
  const samples = [
    ['div', 'theme-doc-sidebar-container'],
    ['nav', 'md-sidebar md-sidebar--primary'],
    ['div', 'chat-history-panel'],
    ['div', 'nextra-toc'],
    ['div', 'bd-sidebar-secondary'],
    ['div', 'wy-nav-side'],
  ] as const;
  for (const [tag, className] of samples) {
    const column = document.createElement(tag);
    column.className = className;
    const item = document.createElement('span');
    column.append(item);
    document.body.append(column);
    assert.equal(sidebarWheelIgnore(pathOf(item)), true, className);
  }
  const fumadocs = document.createElement('aside');
  fumadocs.id = 'nd-toc';
  const item = document.createElement('a');
  fumadocs.append(item);
  document.body.append(fumadocs);
  assert.equal(sidebarWheelIgnore(pathOf(item)), true, '#nd-toc');
});

test('开放 shadow root 里的 Twitch 聊天仍能沿 composedPath 认出', () => {
  const { window, document } = page();
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  const chat = document.createElement('div');
  chat.setAttribute('data-test-selector', 'video-chat-message-list');
  chat.className = 'video-chat__message-list';
  const line = document.createElement('span');
  chat.append(line);
  shadow.append(chat);
  const video = document.createElement('video');
  document.body.append(host, video);
  let path: EventTarget[] = [];
  window.addEventListener('wheel', event => { path = (event as unknown as { composedPath(): EventTarget[] }).composedPath(); }, true);
  line.dispatchEvent(new window.WheelEvent('wheel', { bubbles: true, composed: true, deltaY: 80 }));
  assert.ok(path.length > 1);
  assert.equal(sidebarWheelIgnore(path), true);
  assert.equal(sidebarWheelIgnore(pathOf(video)), false);
});
