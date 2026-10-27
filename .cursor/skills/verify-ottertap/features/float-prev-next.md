# 音量药丸里的上一条 / 下一条

展开音量药丸后，播放控制下面有两个短按钮：`Previous media` 和 `Next media`。按钮上的字是 `Previous` / `Next`。只在这一页至少有两条媒体时出现。只有一条时这两个按钮不在页面上，不占高度。

点一下按当前页面顺序切到上一条或下一条，走到末尾回到第一条。药丸保持展开，音量、播放和倍速改去控制新的那一条。弹出面板的标题和页内 `Alt+.` 也对准这一条。视频外沿出现和选中变化相同的一圈轻轮廓。不改贴边、半隐藏和全局位置，不把完整列表放进药丸，也不写入记住此站点。

## Sub-features

- 两条才出现。`/video` 只有一条时，展开的药丸里没有 `Previous media` 和 `Next media`。`Open panel` 仍在。
- 可切换。`/feed` 上两条都暂停时，先选中页面顺序的第一条 `Feed preview`。点 `Next media` 后，浮动入口的标题、弹出面板标题都变成 `Main player`。轮廓只在主视频上。药丸里的播放只播放这一条。`Alt+.` 只加快这一条。
- 回到上一条。再点 `Previous media`，标题回到 `Feed preview`，轮廓只在预览上。`Alt+.` 只加快这一条。
- 不挡。两个按钮在播放那一组里，`Open panel` 在倍速下面。它们的盒子不相交，上一条在打开面板的上方。
- 位置不动。切换前后浮动入口的位置不变，存储里的 `floatingPosition` 和 `sitePrefs` 也不变。

## How to get to it (user POV)

1. 打开只有一条视频的网页，点页面边缘的小獭。药丸里能调节播放，没有上一条或下一条。
2. 打开有不止一条视频的网页，再点小獭。播放按钮下面出现上一条和下一条，打开面板的按钮还在下面。
3. 点下一条。药丸还开着，控的是另一条。画面外沿闪一下。页内快捷键和弹出面板也控这一条。
4. 点上一条，回到刚才那条。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive float-prev-next
```

会话已经 `launch` 且 `doctor` 通过之后跑。它不改 profile。

1. 打开 `/video`，展开药丸。没有 `Previous media` 和 `Next media`。`Open panel` 可见。截 `pill-one.png`。
2. 打开 `/feed`，等浮动入口标题以 `Feed preview` 开头。展开药丸。两个按钮都在播放那一组里，和 `Open panel` 的盒子不相交。截 `pill-two.png`。
3. 点 `Next media`。只有 `#media` 带 `ottertap-selection-ring`。入口标题和弹出面板标题都是 `Main player`。截 `ring-next.png` 和 `popup-next.png`。
4. 药丸里点 `Play`。只有主视频开始播放。把页面焦点放在视频下方的空白处，按 `Alt+.`。只有主视频变成 1.25×。再点 `Pause`，主视频停住。
5. 点 `Previous media`。只有 `#preview` 带轮廓。弹出面板标题回到 `Feed preview`。截 `ring-prev.png` 和 `popup-prev.png`。再按 `Alt+.`，只有预览变成 1.25×，主视频仍是 1.25×。
6. 浮动入口的位置与第 2 步相同。`sitePrefs` 仍是空对象，`floatingPosition` 与开始时相同。`Open panel` 仍可见，且仍不与上一条、下一条相交。

成功时 `state.json` 的 `ok` 为 `true`。证据在 `/opt/cursor/artifacts/verify-ottertap/float-prev-next/`：`pill-one.png`、`pill-two.png`、`ring-next.png`、`popup-next.png`、`ring-prev.png`、`popup-prev.png`、`state.json`、`transcript.txt`。

按钮何时出现、点击走手动选中、播放作用在新目标上，以及不写设置，由 `tests/float-prev-next.test.ts` 覆盖。轮廓本身沿用选中切换，不在药丸里再画一次。

## Gotchas

- 无障碍名是 `Previous media` / `Next media`，和快捷键动作同名。按钮上可见的短字是 `Previous` / `Next`。
- 顺序用当前页面里的媒体列表，和扩展命令的上一条、下一条相同，走到末尾回到第一条。
- 点击走面板点选那条手动选中，所以自动跟随会让路一小段时间，轮廓也由这次选中变化发出。
- 只有一条时不要用隐藏样式留着按钮，那一行根本不渲染。
- `/feed` 上两条都暂停时，先选中的是 DOM 顺序的第一条 `Feed preview`。
