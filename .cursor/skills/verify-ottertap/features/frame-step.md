# 逐帧前进 / 后退

页内 `,` 后退一帧，`.` 前进一帧。不需要打开单键模式。播放中会先暂停，再移动一帧。弹出面板把 `Previous frame` 和 `Next frame` 放在播放键两侧。可 seek 时「先暂停再走一帧」写在按钮的 `title` 和屏幕阅读说明里，避免把面板撑过现有高度。不可 seek 时同一句禁用说明显示在进度条下。

直播（`duration` 为无限）和还不能 seek 的媒体不移动。按钮禁用，快捷键弹出说明：`Live streams and media that can't be seeked don't support frame step.`

`,` / `.` 不占用现有默认键：`Alt+,` / `Alt+.` 仍是减慢 / 加快，单键模式的 `<` / `>` 仍是倍速，`J` / `K` / `L` 和方向键仍是跳转和播放。按住临时加速的 `Alt+Shift+.` 也不变。

帧长优先用播放时采样到的帧间隔，其次用视频轨道的帧率，否则按 1/30 秒。已经停在帧边界上时，再按一次走完整的一帧。

## Sub-features

- 页内快捷键。`,` 上一帧，`.` 下一帧。单键模式开或关都生效。输入框里不生效。`Alt+,` / `Alt+.` 仍改倍速。
- 先暂停。正在播放时按 `.`，媒体变为暂停，进度大约前进一帧，不会按快进秒数跳。
- 弹出面板。播放键左侧是 `Previous frame`，右侧是 `Next frame`。可 seek 时 `#frame-step-hint` 仍是 `Pauses playback, then moves one frame.`，只给辅助技术读，悬停按钮也能看到。点一下发出一帧。
- 不可用。直播或没有可 seek 范围时两个按钮 `disabled`，说明是 `Live streams and media that can't be seeked don't support frame step.` 页内按键弹出同一句，进度不变。
- 快捷键说明。设置页「On-page shortcuts」里有 `,` 和 `.`，说明是 `Pause, then previous frame` / `Pause, then next frame`。下面一段写明先暂停，以及直播和不可 seek 时不动。

## How to get to it (user POV)

1. 打开有视频的网页，点页面空白处。
2. 按 `.` 前进一帧，按 `,` 后退一帧。如果正在播放，会先停住。
3. 打开弹出面板，点播放键旁边的 `Next frame` 或 `Previous frame`。悬停能看到会先暂停。
4. 直播或还不能拖动进度的媒体上，按钮是灰的，并有一句说明。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive frame-step
```

会话已经 `launch` 且 `doctor` 通过之后跑。它不改设置，同一会话可以再跑。旅程用夹具 `/video`、`/keys` 和 `/unseekable`：

1. `/video` 暂停在 0.5 秒。按 `.` 大约到 0.5 + 1/30 秒，仍暂停。再按 `,` 回到约 0.5 秒。截 `fixture-step.png`。
2. 打开弹出面板，点 `Next frame`，再前进大约一帧。`#frame-step-hint` 是 `Pauses playback, then moves one frame.`。截 `popup-frame.png`。
3. 播放后按 `.`，应变为暂停，进度只挪一小步，不是快进的 10 秒。`Alt+.` 仍把倍速从 1 加到 1.25。
4. 设置页「On-page shortcuts」能看到 `,` 和 `.`，以及先暂停的说明。`Alt + .` 仍是加快。截 `settings-shortcuts.png`。
5. `/keys` 聚焦 `Field` 再按 `.`，进度不变。
6. `/unseekable` 没有可 seek 范围。弹出面板两个逐帧按钮禁用，并显示不能逐帧的说明。截 `unseekable-popup.png`。页内按 `.` 弹出同一句说明，进度仍是 0。截 `toast-unavailable.png`。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/frame-step/`：`fixture-step.png`、`popup-frame.png`、`settings-shortcuts.png`、`unseekable-popup.png`、`toast-unavailable.png`、`state.json`、`transcript.txt`。

帧长、键位和直播不 seek 由 `tests/frame-step.test.ts` 覆盖。面板按钮由 `tests/frame-step-panel.test.ts` 覆盖。热键下发和失败提示由 `tests/frame-step-command.test.ts` 覆盖。

## Gotchas

- 夹具是 1 秒的无画面音频，没有真实视频帧。暂停时按 1/30 秒走。先播放再逐帧时，浏览器可能采到别的间隔，所以那一步只断言暂停并且没有按 10 秒跳。
- 直播有可拖动窗口时也不逐帧。这条在单元测试里把 `duration` 设成无限，夹具页做不到，所以浏览器旅程用 `/unseekable` 看同一句禁用说明。
- 提示在开放 shadow root 里。文案来自 `frameStepUnavailable`。
- 这一程不改 profile。
