# 睡眠定时

弹出面板标题栏的「Sleep timer」月亮按钮给当前标签开一个倒计时，到点后硬暂停小獭这时正在控制的那一条媒体。档位是 15 / 30 / 45 / 60 分钟，另有 1 到 180 的自定义整分钟。默认不开。

倒计时挂在这个标签顶层框架的内容脚本里，关掉弹出面板不取消。到点时后台按当前选中找目标，所以换了选中只改「到期要停谁」，不会立刻停掉原来那一条。只停这一条：不淡出、不关标签、不清进度、不写记住此站点，也不碰别的标签。不写扩展存储，权限仍只有 `storage`。整页刷新或关标签后倒计时随页面一起消失。

页内快捷键和浮动旁注倒计时都不在这一项里。取消和再续 +15 见 [sleep-timer-cancel.md](sleep-timer-cancel.md)。开始、取消、到期和临近的页内提示见 [sleep-timer-hints.md](sleep-timer-hints.md)。

## Sub-features

- 入口。面板标题栏里设置齿轮左边的月亮按钮，无障碍名 `Sleep timer`。没开时只有图标。放在标题栏是为了不增加面板高度：单媒体面板已经贴着弹出窗口 600px 的上限。
- 无媒体。页面上没有可控制的媒体时按钮 `aria-disabled="true"` 并变淡，`aria-describedby` 指向 `#sleep-timer-status` 的 `No media to pause on this page.`，悬停 title 也是这句。按钮仍可聚焦，点开只给这句说明，没有档位。
- 档位。点开后弹层标题 `Pause after`，说明写明只停这个标签里小獭控制的那一条、关面板不取消。四个按钮的无障碍名是 `Pause in 15 minutes` 到 `Pause in 60 minutes`，字面是 `15 min` 这种。
- 自定义。输入框无障碍名 `Custom minutes`，占位 `1–180 min`。空、0、181、小数时 `Start` 禁用。
- 倒计时。选定后弹层收起，按钮带 `data-running`，图标旁是剩余时间（`15:00`、超过一小时是 `1:30:00`），屏幕阅读器读 `#sleep-timer-status` 的 `Sleep left {time}`。这句话和进度区的本集剩余分开，不叫「本集剩余」。再选一档会用新的时长重新开始。
- 关面板不取消。关掉弹出面板再打开，倒计时还在并继续往下走。
- 到期。到点时当前选中的媒体暂停，进度留在原处，标签不关。按钮回到只有图标。已经暂停的不再发命令。
- 跟随选中。同一页有两条时，开定时后在媒体列表里换到另一条，两条都继续播；到点只停换过去的那一条。

## How to get to it (user POV)

1. 打开一个有视频或音频的网页，点工具栏图标打开弹出面板。
2. 点面板右上角齿轮左边的月亮，选 `30 min`，或在自定义框里填分钟再点 `Start`。
3. 月亮旁出现倒计时。可以关掉面板，过一会儿再打开，倒计时还在。
4. 到点时这条媒体暂停，进度条停在原处。月亮旁的倒计时消失。
5. 打开一个没有媒体的页面，月亮是淡的，点开只写着没有可暂停的媒体。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive sleep-timer
```

会话已经 `launch` 且 `doctor` 通过之后跑。它不改设置。为了不干等 15 分钟，到期部分用自定义 1 分钟，整程约 70 秒：

1. 打开夹具 `/silent`（没有媒体）。弹出面板标题栏里 `Sleep timer` 是 `aria-disabled`，`#sleep-timer-status` 是 `No media to pause on this page.`。点开只有这句说明，没有档位和自定义框。截 `popup-no-media.png`。
2. `/long` 停在 5 秒。标题栏入口可用、只有图标，单媒体面板高度不超过 600px。截 `popup-off.png`。点 `Play`，再点开入口，四个档位齐全，说明写明只停当前这一条。截 `popup-presets.png`。
3. 点 `Pause in 15 minutes`，弹层收起，按钮约 `15:00`，`#sleep-timer-status` 与之一致。截 `popup-15.png`。再点开，自定义填 `1` 点 `Start`，倒计时换成约 `01:00`。截 `popup-custom.png`。关掉面板。
4. `/feed` 两条都播放。面板里选 `Feed preview`，开 1 分钟，再换到 `Main player`。等一会儿两条都还在播，倒计时还在。截 `feed-switched.png`。
5. 回到 `/long` 再开面板，倒计时比第 3 步少、媒体仍在播。截 `popup-reopened.png`。
6. 等到期：`/long` 在开定时后约 60 秒暂停，`currentTime` 留在暂停处且之后不变，标签还开着。`/feed` 上 `Main player` 暂停，`Feed preview` 仍在播。
7. `/long` 的面板里倒计时消失、播放按钮是 `Play`。截 `popup-expired.png` 和 `fixture-paused.png`。
8. `ottertap-settings-v1` 与开始前一致。`chrome.storage.local` 和 `chrome.storage.session` 里没有倒计时；设置键 `sleepSoonHint` 是临近提示开关，不算定时本身。权限仍是 `["storage"]`。

成功时 `state.json` 的 `ok` 为 `true`，`pausedAfterSeconds` 约为 60，`panelHeight` 不超过 600。证据写到 `/opt/cursor/artifacts/verify-ottertap/sleep-timer/`：`popup-no-media.png`、`popup-off.png`、`popup-presets.png`、`popup-15.png`、`popup-custom.png`、`feed-switched.png`、`popup-reopened.png`、`popup-expired.png`、`fixture-paused.png`、`state.json`、`transcript.txt`。

分钟校验、到点只触发一次、早醒和睡眠后晚醒由 `tests/sleep-timer.test.ts` 覆盖。后台只把定时交给顶层框架、无媒体和无效分钟被拒、到期只停当时的当前选中、iframe 发来的到期不算、不写存储由 `tests/sleep-timer-background.test.ts` 覆盖。面板的不可用说明、入口在标题栏、档位、自定义校验、倒计时和失败说明由 `tests/sleep-timer-panel.test.ts` 覆盖。

## Gotchas

- 倒计时在页面里，不在弹出面板的 React 状态里，也不在后台。后台 service worker 可能早已被回收，到点时由页面叫醒它。
- 到点时后台用和扩展命令相同的规则找「当前控制的那一条」：有选中用选中，选中所在框架没回应就不停；没有选中时用面板也会显示的那一条（正在出声的优先）。
- 截止时间是墙上时间。电脑睡眠后醒来，过了点就立刻暂停；计时器早醒会按剩余时间再等。
- 不要把入口挪回面板下方的列表。多一行就让单媒体面板超过 600px，e2e「单媒体弹出面板常用控制完整可见」会失败。
- 档位弹层有淡入动画，截图前要等动画结束，否则弹层是半透明的。
- 这一程不改 profile，但会在 `/long` 暂停时照常写一条接着看进度，那是暂停本身的行为。
