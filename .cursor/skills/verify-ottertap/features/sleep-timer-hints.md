# 睡眠定时：到期与临近页内提示

开始定时、取消，以及到期暂停成功时，页面顶部短暂出现和倍速提示同一块字样。开始是 `Sleep {minutes} min`（例如 `Sleep 2 min`），取消是 `Sleep cancelled`，到期暂停成功是 `Sleep timer ended, paused`。约一秒后淡出，不接收点击，也不改弹出面板里的说明。

到期前大约 1 分钟再提示一次 `About 1 minute left`。设置页「Playback」里的 `Warn about a minute before` 可以关掉，**默认开**。关掉之后，开始、取消和到期暂停成功仍会提示，只是不再出现临近那一句。提示过之后如果再续 15 分钟，新的截止时间前大约 1 分钟会再提示一次。正好 1 分钟的定时在开始那一刻不再另提示，开始那句已经说明时长。

媒体已经卸掉、已经暂停，或暂停失败时，不显示「已暂停」。续时仍只在弹出面板里说明，不另发一条页内提示。不另做调音层，也不把倒计时留在画面上。

## Sub-features

- 开始。成功时字样是 `Sleep 30 min` 这种，分钟数是这次设定的时长。弹出面板收起后，月亮按钮上的倒计时还在。媒体继续播放。
- 取消。成功时字样是 `Sleep cancelled`。倒计时消失，播放不变。没有正在走的定时时，不出现这句。
- 到期。暂停成功时字样是 `Sleep timer ended, paused`。当前媒体暂停，进度留在原处。已经暂停、媒体已卸或页面拒绝暂停时，没有这句。
- 临近。剩余大约 1 分钟时字样是 `About 1 minute left`，只出现一次，然后消失。默认开。
- 可关。设置开关关掉后，下一次超过 1 分钟的定时不再出现临近那句。再打开就恢复。导出和导入带上 `sleepSoonHint`。
- 不挡主控。字样在画面上方，`pointer-events-none`，不盖住播放器底部的控件。它还在时，弹出面板仍能取消或继续操作。

## How to get to it (user POV)

1. 打开设置，播放一节里「临近结束前提示」默认是开的。
2. 打开一个正在播放的视频，用睡眠定时选一个时长。页面顶部出现「睡眠 N 分钟」，随后消失。视频还在播。
3. 取消。出现「已取消睡眠」，随后消失。视频还在播。
4. 再设一个超过 1 分钟的时长。快到最后 1 分钟时出现「还剩约 1 分钟」，随后消失。到点出现「睡眠定时到，已暂停」，视频暂停。
5. 在设置里关掉临近提示。再设一个超过 1 分钟的定时，开始和取消仍有提示，临近那句不再出现。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive sleep-timer-hints
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile，成功时把临近提示开关开回去。同一会话不要接在改过播放设置、还没恢复的旅程后面。为了看到临近提示和「关掉之后不再出现」，整程大约 4 分钟：先等 2 分钟定时的临近和到期，再关开关，等过大约 1 分钟确认不再提示。

1. 设置页 `Warn about a minute before` 默认开，说明写明默认开启。截 `settings-on.png`。存储里这个值不是 `false`。
2. `/long` 设成循环，以免 120 秒的片子自己播完被当成定时暂停。弹出面板播放，自定义 `2` 分钟。出现 `Sleep 2 min`，不挡播放控件，随后消失。倒计时约 `2:00`。截 `toast-start.png`。
3. 点 `Cancel sleep`。出现 `Sleep cancelled`，随后消失。倒计时没了，媒体仍在播。截 `toast-cancel.png`。弹层还开着，直接再设 2 分钟。
4. 再出现 `Sleep 2 min`。截 `toast-start-again.png`。大约 60 秒后出现 `About 1 minute left`（不早于 45 秒，不晚于 80 秒），媒体仍在播，倒计时还在并接近 1 分钟。字样随后消失。截 `toast-soon.png`。
5. 再大约 60 秒，出现 `Sleep timer ended, paused`，媒体暂停，进度停住，标签还开着，面板回到 `Play`。截 `toast-due.png` 和 `fixture-paused.png`。
6. 关掉 `Warn about a minute before`。存储里 `sleepSoonHint` 为 `false`。截 `settings-off.png`。
7. 继续播放，再设 2 分钟。`Sleep 2 min` 仍出现。截 `toast-start-while-off.png`。接下来至少 70 秒里不出现 `About 1 minute left`，媒体仍在播。取消后出现 `Sleep cancelled`。截 `toast-cancel-while-off.png`。
8. 把开关开回去。存储里的设置带有 `sleepSoonHint: true`。权限仍是 `["storage"]`。

成功时 `state.json` 的 `ok` 为 `true`，`soonAfterSeconds` 约为 60，`dueAfterSoonSeconds` 约为 60，`soonSuppressed` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/sleep-timer-hints/`：`settings-on.png`、`toast-start.png`、`toast-cancel.png`、`toast-start-again.png`、`toast-soon.png`、`toast-due.png`、`fixture-paused.png`、`settings-off.png`、`toast-start-while-off.png`、`toast-cancel-while-off.png`、`state.json`、`transcript.txt`。

分钟窗口、取消后不再提示、续时把窗口往后挪、早醒和睡过点不再补提示，由 `tests/sleep-timer-hints.test.ts` 覆盖。开始、取消、到期只在成功时发提示，无媒体、无效分钟、已暂停和暂停失败不发，由 `tests/sleep-timer-hints-background.test.ts` 覆盖。开关默认开、坏值回落、导出导入和设置页点击，由 `tests/sleep-timer-hints-settings.test.ts` 覆盖。

## Gotchas

- 字样就是倍速那一块 `role="status"`。不要再做一层 overlay，也不要做持久倒计时。
- 临近提示的开关是 `sleepSoonHint`，缺省为开。旧备份导入后仍是开。倒计时本身仍不写入扩展存储。
- 已有的睡眠定时旅程用 `knownStorageKeys` 允许名单检查倒计时没有写进存储，设置原文另按前后相等比较。新增设置字段不会误报，新增存储键要同步改名单。
- 正好 1 分钟的定时不会在开始的同时再喊「还剩约 1 分钟」。旅程用 2 分钟才能看到临近提示。
- `/long` 大约 120 秒且不循环。这一程把元素的 `loop` 打开，只为了不让片子播完和 2 分钟到期叠在一起。
- 弹出面板在离开后会被浏览器关掉。关开关之前先关掉这次弹出面板，回到夹具页再开一次。
- 这一程会改设置。成功结束时开关是开的。
