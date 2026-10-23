# 仅在播放时显示浮动入口

设置页「Floating controller」的 `Show only while the selected media is playing`（`#settings-floating-while-playing`）默认关闭。关闭时，只要当前网页启用了小獭并且有选中的媒体，浮动入口就在，和现在一样，暂停也在。

打开后，入口只在当前选中的媒体正在播放时出现。暂停会先留一小会儿再隐藏，避免快速暂停、播放把入口闪到点不到。没有选中媒体时马上隐藏。还没在这个开关打开后播放过的暂停页，一上来就不显示，不会先闪一下。

这和「悬停在主播放区直接用滚轮调音量」是两件事。入口藏起来时，主播放区上的滚轮仍按那个开关调音量。

## Sub-features

- 开关。`#floating` 里的 `Show only while the selected media is playing`，`aria-checked` 默认 `false`。说明里写明暂停会稍后再隐藏、没有选中马上隐藏、默认关闭，以及滚轮音量不受影响。
- 关闭时。夹具 `/video` 暂停，浮动入口仍然可见。
- 播放时。打开开关后，正在播放的夹具上入口可见。
- 暂停。暂停后短时间里入口还在，随后隐藏。
- 再播放。入口重新出现。
- 快速暂停、播放。连续短暂停再播放，入口保持可见。
- 滚轮。入口因暂停隐藏时，主播放区裸滚轮仍能把音量从 50% 调到 60%，且 `hoverWheel` 仍是开。

## How to get to it (user POV)

1. 打开 `chrome-extension://<extensionId>/options.html#floating`。
2. 打开 `Show only while the selected media is playing`。
3. 打开有视频的网页。播放时页面边缘出现浮动入口；暂停一小会儿后入口消失；再播放又出现。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-while-playing
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile，同一会话只能跑一次。旅程用夹具 `/video`：

1. 设置页确认开关关闭，说明里能看到 quick pause and play，以及 Scrolling over the main player。悬停滚轮开关仍是开。截图。
2. 打开 `/video`。视频暂停，浮动入口仍在。截图。播放后入口仍在。
3. 打开开关。存储里 `floatingWhilePlaying === true`，`floating` 和 `hoverWheel` 不被关掉。截图。
4. 回到夹具并播放。入口可见。截图。
5. 暂停。短时间里入口还在，之后隐藏。截图。
6. 入口隐藏时，把音量设成 0.5，在主播放区向上滚轮，音量到约 0.6。入口仍隐藏。
7. 再播放。入口出现。截图。
8. 连续几次短暂停再播放，每次采样时入口都在，最后停在播放。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/floating-while-playing/`：`settings-off.png`、`fixture-paused-off.png`、`settings-on.png`、`fixture-playing.png`、`fixture-paused.png`、`fixture-playing-again.png`、`state.json`、`transcript.txt`。

归一化、防抖和设置页只改这一项由 `tests/floating-while-playing.test.ts` 覆盖。

## Gotchas

- 暂停后的停留是为了防抖，不是让人在暂停后继续用入口。停稳后入口会隐藏。
- 夹具视频默认暂停，没有 `autoplay`。开关关闭时入口仍应出现，这是 launch 探针能看见入口的原因。
- 入口在开放 shadow root 里。隐藏是整块 `aside` 不渲染，不是半透明。
- 这一程会把 `floatingWhilePlaying` 留在打开。用完 `cleanup` 再 `launch`。
