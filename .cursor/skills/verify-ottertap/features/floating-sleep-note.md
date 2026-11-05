# 浮动旁注：睡眠倒计时

设置页「Floating controller」里的 `Countdown while sleeping` 默认关闭。关闭时，浮动入口旁边仍按 `Entry note` 显示音量或倍速，睡眠进行中也不改。

打开后，这一页的睡眠定时还在走时，旁注改成短倒计时，例如 `Sleep 12:04`。无障碍名用面板里已有的 `Sleep left {time}`。取消或到期后，回到打开之前的音量、倍速或关闭。旁注本身设成 `Hide` 时，只有定时进行中才出现这句，结束后再次消失。

倒计时和弹出面板用同一个向上取整的剩余秒数。它不写入扩展存储，也不改贴边、半隐藏和位置记忆。工具栏角标仍只在音量超过 100% 时出现，正文仍是不带百分号的数字。

这一项存在 `ottertap-settings-v1.floatingSleepNote`。缺这一项或不是布尔值时为关。它是全局设置，不是按站点记住的。

## Sub-features

- 开关。`switch` 名是 `Countdown while sleeping`。默认未按下。说明里写明默认关闭，以及这和工具栏超过 100% 的角标不是一回事。
- 进行中。`role="status"`，`aria-live="off"`，`data-slot="entry-note"`，`data-kind="sleep"`，`data-boost="false"`。正文是 `Sleep 14:59` 这种。无障碍名是 `Sleep left 14:59`。
- 取消。倒计时消失，旁注回到 `Entry note` 的规则。
- 导出导入。备份 JSON 带 `floatingSleepNote`。旧备份没有这个键时导入后仍是关。

## How to get to it (user POV)

1. 打开有视频的页面。浮动入口旁边是音量或倍速，睡眠定时开着时也一样。
2. 在设置页打开 `Countdown while sleeping`。定时还在走时，旁边改成剩余时间。
3. 取消睡眠后，旁边回到原来的音量或倍速。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-sleep-note
```

会话已经 `launch` 且 `doctor` 通过之后跑。改过 `scripts/session.mjs` 要先 `cleanup` 再 `launch`。旅程用夹具 `/keys`。它会改 `floatingSleepNote`，成功结束时关回去并取消定时。中途失败要 `cleanup` 再 `launch`。

1. 打开 `/keys`，不展开药丸。旁注是 `On-page volume 100%`。入口 `data-revealed="false"`、`data-side="right"`。
2. 弹出面板选 `Pause in 15 minutes`。开关仍关，旁注还是 `100%`，`data-kind` 不是 `sleep`。工具栏角标正文是空的。截 `note-off.png`。
3. 设置页 `Countdown while sleeping` 默认未按下。截 `settings-off.png`。打开后存储里 `floatingSleepNote` 为 `true`，`floatingNote` 仍是 `volume`，`floatingPosition` 仍是右侧 0.8。截 `settings-on.png`。
4. 回到夹具。旁注正文匹配 `Sleep 14:59` 这种，无障碍名是 `Sleep left` 加上同一时刻，`data-kind="sleep"`，`data-boost="false"`。半隐藏时整段在视口内。一两秒后数字变小。截 `note-countdown.png`。
5. 弹出面板 `Cancel sleep`。旁注回到 `On-page volume 100%`。截 `note-restored.png`。
6. 导出的 JSON 里 `floatingSleepNote` 为 `true`。把开关关掉，再导入这份备份。存储回到 `true`。再开 15 分钟，旁注再次变成 `Sleep …`。截 `note-imported.png`。
7. 取消定时，把开关关回去。`sitePrefs` 为空，`unknownStorageKeys` 为空，权限仍是 `["storage"]`。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/floating-sleep-note/`：`note-off.png`、`settings-off.png`、`settings-on.png`、`note-countdown.png`、`note-restored.png`、`export.json`、`note-imported.png`、`state.json`、`transcript.txt`。

选择、默认关闭、取消后回到原规则、以及导出导入由 `tests/floating-sleep-note.test.ts` 覆盖。工具栏角标的数字规则仍由 `tests/volume-badge.test.ts` 覆盖。

## Gotchas

- 页内音量滚轮会展开药丸，展开时旁注让开。这一程不滚轮，保持收起。
- 倍速提示也是 `role="status"`。倒计时的无障碍名以 `Sleep left ` 开头，正文以 `Sleep ` 开头。
- 倒计时的截止时间在标签页里，浮动入口大约每 700 毫秒读一次。出现和消失可以等这一拍，秒数则在本地往下走。
- 切到设置页后，工具栏弹出面板会关掉。取消定时要重新 `openActionPopup`，不能沿用切走之前的那一次连接。
- 这一程会写 profile。成功时 `floatingSleepNote` 回到 `false`，定时已取消。失败时先 `cleanup`。
