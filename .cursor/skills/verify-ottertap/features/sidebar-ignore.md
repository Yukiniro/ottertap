# 侧栏聊天和文档大纲不抢滚轮

指针落在常见直播聊天或文档大纲上时，悬停裸滚轮不调音量，也不 `preventDefault`，列表照常滚动。认不出的区域仍按主播放区规则。第一版没有用户 CSS 选择器，也没有自定义规则。

这叠在主播放区判定之上。聊天或大纲盖住够大的主画面时，几何上指针仍在视频矩形里，但事件路径落在已知容器上，裸滚轮就放行。主画面上、以及盖在主画面上但认不出的叠层上，裸滚轮仍调音量。

Alt+滚轮和 Shift 粗调不受这个忽略影响。指针在聊天上按住 Alt 或 Shift 再滚，仍调音量，列表不动。

## Sub-features

- 直播聊天。Twitch 的 `.chat-scrollable-area__message-container`、`[data-test-selector="video-chat-message-list"]`、`.chat-room__content`，YouTube 的 `ytd-live-chat-frame` / `yt-live-chat-renderer` / `yt-live-chat-item-list-renderer`，以及 Bilibili 直播的 `.chat-history-panel`。
- 文档大纲。VitePress `.VPSidebar` / `.VPDocAside`，Docusaurus `.theme-doc-sidebar-container` / `.theme-doc-toc-desktop` / `.theme-doc-toc-mobile`，Nextra `.nextra-sidebar-container` / `.nextra-toc`，MkDocs Material `.md-sidebar`，Fumadocs `#nd-sidebar` / `#nd-toc`，Read the Docs `.wy-nav-side`，PyData `.bd-sidebar-primary` / `.bd-sidebar-secondary`。
- 主画面优先。事件路径先碰到 `video` 或 `audio` 时不忽略，避免选择器包住画面时误伤。
- 修饰键。Alt+滚轮、Shift 粗调、Ctrl/Meta 缩放都不因忽略区改道。

## How to get to it (user POV)

1. 打开带侧栏聊天的直播页，或带右侧大纲的文档页。回归夹具是 `https://media.ottertap.test/chat`：960×540 的主画面上，右侧盖着 Twitch 聊天选择器，左上盖着 VitePress 大纲，左下盖着一块没有这些选择器的备注。
2. 指针放在聊天或大纲上滚轮。列表自己动，音量不变，页面不滚。
3. 指针放回主画面中间，或放在那块备注上，滚轮仍调音量。
4. 再回到聊天，按住 Alt 或 Shift 滚轮。音量变，聊天列表不动。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive sidebar-ignore
pnpm exec playwright test e2e/smoke.spec.ts -g "盖住主画面的侧栏聊天"
```

会话已经 `launch` 且 `doctor` 通过之后跑。它不改 profile，可以和 `drive wheel-volume` 共用一个会话。选择器矩阵在 `tests/sidebar-wheel.test.ts`。

1. 打开 `/chat`，等到浮动入口。`#media` 有声播放，音量 0.5。画面宽高都至少占 1280×720 视口的三分之一，聊天中心落在画面矩形内。
2. 光标移到 `#chat` 中心，停至少 300ms，`mouse.wheel(0, 160)`。`#chat.scrollTop > 20`，音量仍约 0.5，`scrollY` 为 0。截图。
3. 光标移到 `#outline` 中心，再停至少 300ms，向下滚。大纲 `scrollTop > 20`，音量仍约 0.5，聊天滚动位置不变。截图。
4. 光标移到画面中心，再停至少 300ms，`mouse.wheel(0, -100)`。音量约 0.6，页面和聊天都不动。截图。
5. 光标移到 `#overlay` 中心，再停至少 300ms，向上滚。音量约 0.7。这块没有已知选择器，所以仍是主画面。截图。
6. 回到聊天，按住 Alt 向上滚。音量约 0.8，聊天 `scrollTop` 不变。截图。
7. 仍在聊天上，按住 Shift 向上滚。音量约 1（默认粗调 20%），聊天 `scrollTop` 不变。截图。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/sidebar-ignore/`：`chat-before.png`、`chat-scrolled.png`、`outline-scrolled.png`、`player-after.png`、`overlay-after.png`、`chat-alt.png`、`chat-shift.png`、`state.json`、`transcript.txt`。

## Gotchas

- 忽略只发生在会调音的裸滚轮上。容器不在已知选择器里时，盖住主画面的叠层仍调音量。不要为了多覆盖一种站点把 `aside`、`nav` 或 `#chat` 加进去。
- 从聊天滚到主画面，要先停至少 300ms，否则连续手势会把这次滚动留给页面。这和主播放区外起滚是同一条规则。
- YouTube 聊天正文在同源 iframe 里。内容脚本 `allFrames`，iframe 文档里的 `yt-live-chat-renderer` 自己匹配；那个 frame 里通常没有视频，本来也不会调音。父页面上盖住画面的 `ytd-live-chat-frame` 才需要这条短路。
