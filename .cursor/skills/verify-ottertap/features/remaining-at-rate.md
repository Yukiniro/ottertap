# 本集剩余

弹出面板进度条下面加一行估算：可跳转、并且知道总时长时，用媒体时钟还剩的时间除以当前倍速，写成 `About {time} left in this episode ({rate}×)`。倍速一变，时间和括号里的倍速都变。进度条还在，这一行不代替它。

直播（`duration` 为无限）、不知道总时长，或还不能 seek 时，这一行不出现，也不编一个时间。睡眠倒计时写的是 `Sleep left {time}`，和这一行不是同一句。不做「累计省下多少时间」。不写扩展存储，不新开权限。

## Sub-features

- 折算。暂停在已知位置时，1× 的剩余等于媒体时钟剩余；2× 约为它的一半，允许取整到整秒。
- 改倍速。点弹出面板的倍速预设后，这一行改用新的倍速重算。
- 不误显示。直播时进度右侧是 `Live`，这一行不在。没有来源、不能 seek 的媒体进度右侧是 `--:--`，这一行也不在。
- 和睡眠分开。睡眠进行中，标题栏状态是 `Sleep left {time}`，进度区仍是 `left in this episode`。两句互相不包含对方的说法。月亮按钮上仍只显示倒计时数字。
- 高度。单媒体面板不超过 600px。这一行是 `text-xs`，紧贴进度时间；面板区块间距是 8px，底部内边距是 8px，用来给这一行留出位置。

## How to get to it (user POV)

1. 打开能拖动进度、知道总时长的视频，例如夹具 `/long`。
2. 打开弹出面板。进度条还在，下面一行写着按 1× 还要多久。
3. 点 `2× speed`。这一行大约变成刚才的一半，并写上 `2×`。再点 `1.5× speed`，数字再变。
4. 点月亮，选 `Pause in 15 minutes`。标题栏状态是 `Sleep left …`，进度区仍是本集剩余。
5. 直播或还不能拖动的媒体上，没有这一行。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive remaining-at-rate
```

会话已经 `launch` 且 `doctor` 通过之后跑。它不改设置。

1. `/long` 暂停在开头。弹出面板 `#episode-remaining` 是 `About 02:00 left in this episode (1×)` 这一类，进度条 `Playback progress` 还在，面板高度不超过 600px。截 `popup-1x.png`。
2. 点 `2× speed`。显示的秒数约为媒体时钟剩余的一半，括号里是 `2×`。截 `popup-2x.png`。
3. 点 `1.5× speed`。秒数改成按 1.5× 折算的结果，和 2× 时不同。截 `popup-1.5x.png`。
4. 选 `Pause in 15 minutes`。`#sleep-timer-status` 是 `Sleep left` 加按钮上的时间，`#episode-remaining` 仍是本集那一句。两句互不包含。截 `popup-with-sleep.png`。再 `Cancel sleep`。
5. 把这条视频换成 `MediaSource` 时长为无限的直播。进度右侧变成 `Live`，`#episode-remaining` 消失。截 `popup-live.png`。
6. `/unseekable` 上没有 `#episode-remaining`，进度右侧是 `--:--`。截 `unseekable-popup.png`。
7. `ottertap-settings-v1` 与开始前一致。权限仍是 `["storage"]`。暂停长视频可能写下已有的接着看账本，那不是这一行写的。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/remaining-at-rate/`：`popup-1x.png`、`popup-2x.png`、`popup-1.5x.png`、`popup-with-sleep.png`、`popup-live.png`、`unseekable-popup.png`、`state.json`、`transcript.txt`。

折算、无效输入和面板上的四类不显示由 `tests/remaining.test.ts` 与 `tests/remaining-panel.test.ts` 覆盖。

## Gotchas

- 不要再加一整行控件。单媒体面板以 600px 为上限，e2e「单媒体弹出面板常用控制完整可见」会量高度。这一行不再另加上边距，面板底部内边距是 8px。
- 页面脚本盖住 `duration` 的属性，内容脚本的隔离世界看不见。直播要让元素自己的 `duration` 变成无限。
- 临近睡眠的页内提示是 `About 1 minute left`。本集剩余必须写明 episode，不能用同一句。
