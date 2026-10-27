# 播放中自动跟随

设置页「Playback」的 `Follow the media that starts playing`（`#settings-follow-playing`）默认开启。页面上另一条视频或音频开始播放时，当前选中改到它。弹出面板、浮动控制和页内快捷键都作用在新目标上。

关掉之后，别的媒体开始播放不再改选中。刚在面板里点选的一条会再保持几秒，这段时间里自动跟随不覆盖。页面上只有一条媒体时，和没有这条跟随时一样：面板标题仍是它，倍速和暂停仍作用在它身上。

## Sub-features

- 开关。`#playback` 里的 `Follow the media that starts playing`，`aria-checked` 默认 `true`。说明里写明默认开启、刚点选的媒体会再保持几秒，以及只有一条媒体时和现在一样。
- 跟随。`/feed` 上点播当前没选中的那一条后，弹出面板标题换成它，浮动入口的标题也换成它，页内 `Alt+.` 只改它的倍速。
- 浮动。展开音量药丸点暂停，停的是刚开始播放的那一条，另一条保持暂停。
- 关闭。关掉开关后再播放另一条，面板标题不变，`Alt+.` 仍改原来那一条的倍速。
- 让路。重新打开后，在面板里点选一条，紧接着播放另一条。短时间内标题留在点选的那一条，`Alt+.` 改的是它。过了这个窗口再播放，标题又跟上。
- 单媒体。`/video` 播放后标题仍是 `Fixture video`。`Alt+.` 和面板暂停都作用在这一条上。

## How to get to it (user POV)

1. 打开 `chrome-extension://<extensionId>/options.html#playback`。
2. 确认 `Follow the media that starts playing` 开着。
3. 打开有不止一条媒体的网页，播放另一条。面板、浮动入口和页内快捷键改去控制它。
4. 关掉开关后，再播放别的媒体，控制仍留在原来那一条。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive auto-follow-playing
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile，同一会话只能跑一次。旅程用夹具 `/feed` 和 `/video`：

1. 设置页确认开关开着，说明里能看到 stays selected for a few seconds，以及 one media。截图。
2. 打开 `/feed`。弹出面板记下当前标题，播放另一条。标题换成那一条。截图。
3. 浮动入口的标题含这条的名字。页内 `Alt+.` 只把它的倍速调到 1.25×，另一条仍是 1×。
4. 展开药丸点暂停。刚播放的那一条停下，另一条仍暂停。截图。
5. 关掉开关。存储里 `followPlaying === false`。再播放另一条，面板标题不变。`Alt+.` 改的是原来那一条。截图。
6. 重新打开开关。在面板里点选另一条，立刻播放当前这条。短时间内标题留在点选的那一条，`Alt+.` 改的是点选的那一条。截图。
7. 过了让路窗口再播放一次，标题跟上这条。
8. 打开 `/video` 并播放。标题仍是 `Fixture video`。`Alt+.` 把它调到 1.25×，面板暂停让它停下。截图。成功时开关是开。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/auto-follow-playing/`：`settings-on.png`、`popup-followed.png`、`pill-followed.png`、`settings-off.png`、`popup-held.png`、`popup-single.png`、`state.json`、`transcript.txt`。

让路窗口、默认值和设置页只改这一项由 `tests/follow-playing.test.ts` 覆盖。选中切换由 `tests/follow-playing-background.test.ts` 覆盖。

## Gotchas

- 让路只计面板里的点选。弹出面板自己补上的第一次选择不会挡住跟随。
- 已经在播的媒体不会再发一次 play。要验证窗口结束后能跟上，需要先暂停再播放。
- 夹具视频没有 `autoplay`。两条都暂停时，面板先选中文档顺序里的第一条。
- 这一程结束时 `followPlaying` 是开。用完 `cleanup` 再 `launch`。
