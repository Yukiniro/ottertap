# 选中变化的短暂反馈

当前选中从一条媒体换到另一条时，能看出控的是哪一块。视频在画面外沿出现一圈轻轮廓，大约一秒内淡出，不接收点击，也不留在画面上。同一时刻只有刚选中的那一条带着轮廓。音频没有画面，页面顶部用和倍速提示同一块字样写 `Audio selected`。倍速提示仍可出现。不另做调音层，也不写入记住此站点。

自动跟随、面板点选，以及单键模式下指着另一条媒体按音量键，都会触发这一次反馈。第一次只是记下当前这条时不出现。

## Sub-features

- 跟随。`/feed` 上已经选中一条时，点播另一条。只有新的那一条出现轮廓。轮廓的动画大约一秒。画面中心仍点在视频上。
- 倍速并存。轮廓还在时按 `Alt+.`，顶部出现 `Speed 1.25×`，轮廓仍在这条视频上。
- 淡出。大约一秒后两条视频都不再带这圈轮廓，画面中心仍点在视频上。
- 面板。在列表里点另一条，轮廓改到那一条，上一条没有。
- 键切。打开单键模式，指针放在没选中的那一条上按 `↑`。轮廓改到这一条。成功后关掉单键模式。
- 音频。`/mixed` 上视频已选中时，播放旁边的音频。顶部出现 `Audio selected`，视频和音频都没有轮廓。再在面板里点回视频，轮廓只在视频上。
- 不挡。字样 `pointer-events` 为 `none`。轮廓出现时视频中心仍命中视频本身。

## How to get to it (user POV)

1. 打开有不止一条视频的网页，播放另一条。刚开始播放的那一条外沿闪一圈，然后消失。
2. 打开弹出面板，在列表里点另一条。轮廓改到点中的那一条。
3. 打开单键模式，鼠标放在另一条视频上按向上键。轮廓改到这一条。
4. 页面上是音频时，顶部短暂出现「已选中音频」，不在音频上画框。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive selection-highlight
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会暂时打开单键模式，成功时关掉。同一会话只能跑一次。

1. 打开 `/feed`，等弹出面板先选中一条。播放另一条。只有这条带 `ottertap-selection-ring`，动画时长约一秒，画面中心命中视频。截 `ring-followed.png`。
2. 轮廓还在时按 `Alt+.`。状态字样为 `Speed 1.25×`，轮廓仍在这条上。截 `ring-with-speed.png`。
3. 等到两条都没有轮廓。画面中心仍命中视频。
4. 在面板列表里点回原来那一条。轮廓只在它上面。截 `ring-panel.png`。
5. 设置页打开 `Single-key mode`。指针移到另一条视频上按 `ArrowUp`。轮廓只在这一条上。截 `ring-key.png`。关掉单键模式。
6. 打开 `/mixed`。面板先是 `Fixture video`。播放 `Fixture audio`。状态字样为 `Audio selected`，两个元素都没有轮廓。字样不接收点击。截 `toast-audio.png`。
7. 面板点回 `Fixture video`。轮廓只在视频上。音频没有轮廓。
8. `sitePrefs` 仍是空对象，`singleKey` 为关，`followPlaying` 仍开。

成功时 `state.json` 的 `ok` 为 `true`。证据在 `/opt/cursor/artifacts/verify-ottertap/selection-highlight/`：`ring-followed.png`、`ring-with-speed.png`、`ring-panel.png`、`ring-key.png`、`toast-audio.png`、`state.json`、`transcript.txt`。

轮廓怎么加上又去掉、音频为什么不画框，由 `tests/selection-highlight.test.ts` 覆盖。哪一次选中变化会发高亮、音频改发哪句短提示，由 `tests/selection-highlight-background.test.ts` 覆盖。

## Gotchas

- 页面上还没有记下选中时，第一次播放只锁住目标，不出现轮廓。要先等面板标题出现，再播放另一条。
- 打开媒体列表会让当前那一条再闪一次。点到另一条之后，晚到的这次请求不会把轮廓画回上一条。
- 单键模式的 `↑` 会改音量。这一程结束时把单键模式关掉。
- 音频和倍速共用页面顶部那一块字样。视频的轮廓和倍速字样可以同时看见。
