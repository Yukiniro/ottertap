# 睡眠定时：快捷键与扩展命令

设置页「Keyboard shortcuts」里有两条睡眠定时动作：`Start the sleep timer at the default length` 和 `Cancel the sleep timer`。页内键和扩展命令列表各有一行，**默认都不占键**，用户自己在设置里绑页内键，在浏览器快捷键页绑扩展命令。改键、撞键提示和 `Restore default keys` 走和其他页内键同一条路径。

开始按设置「Playback」里 `Shortcut sleep length` 的时长从现在起计时。可选 15 / 30 / 45 / 60 分钟，出厂 30 分钟。定时进行中再按开始，从现在起按默认时长重新计时，不叠加。取消在没有定时时说 `No sleep timer is running.`。文本框聚焦时两个键和两条扩展命令都不触发。成功的页内字样沿用睡眠提示：`Sleep {minutes} min`、`Sleep cancelled`。

## Sub-features

- 不占键。新装和恢复默认后，两行页内键都是 `Not set`，扩展命令没有建议键，`Restore default keys` 不因为它们变成可点。没有任何「已被占用」的误报。
- 改键与撞键。录 `,` 时提示被「Pause, then previous frame」占用，不保存。录一个空闲键就保存。取消录已给开始的那个键时，提示被「Start the sleep timer at the default length」占用。
- 默认时长。`Shortcut sleep length` 四档，出厂 30 分钟。改了之后已打开的页面下一次按键就用新时长，不用刷新。导出导入带上 `sleepDefaultMinutes`，旧备份和坏值回到 30。
- 开始。没有可控媒体时不处理这个键。进行中再按，截止时间换成现在加默认时长。
- 取消。成功时显示 `Sleep cancelled`，播放不变。没有定时时显示 `No sleep timer is running.`。
- 输入框。文本框聚焦时，两个键照常输入字符，不开始也不取消。扩展命令在这时也不动。
- 扩展命令。`sleep-start`、`sleep-cancel` 出现在 manifest 和 `chrome://extensions/shortcuts`，没有建议键，原来的 4 个建议键不变。

## How to get to it (user POV)

1. 打开设置的「Keyboard shortcuts」。扩展命令和页内键里各有「按默认时长开始睡眠定时」「取消睡眠定时」，都显示未设置。
2. 点页内那行的按键按钮，按一个没被占用的键，比如 Z。再给取消绑 X。
3. 到「Playback」看「快捷键睡眠时长」，默认 30 分钟。
4. 打开正在播放的视频，按 Z。页面顶部出现「睡眠 30 分钟」，弹出面板里倒计时约 30 分钟。
5. 回设置改成 15 分钟，回到视频再按 Z。倒计时从现在起约 15 分钟。
6. 按 X，出现「已取消睡眠」，视频继续播。再按 X，提示当前没有定时。
7. 点进页面里的输入框打字，Z 和 X 只是输入字符。
8. 想用浏览器级快捷键，就在浏览器的扩展快捷键页给这两条命令绑键。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive sleep-hotkeys
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改 profile 的页内键和默认时长，成功时恢复默认键并把时长改回 30 分钟。整程大约 25 秒。

1. 权限仍是 `["storage"]`。manifest 里 `sleep-start`、`sleep-cancel` 没有 `suggested_key`，原来的 4 个建议键不变。`chrome.commands.getAll()` 里两条快捷键为空，说明是英文文案。
2. 设置页 `#shortcuts`：两条扩展命令行和两个页内键按钮都显示 `Not set`，`Restore default keys` 不可点，单键模式关。截 `settings-unbound.png`。
3. 点 `Change the key for Start the sleep timer at the default length. Now Not set.`，按 `,`。提示 `, is already used for “Pause, then previous frame”. ...`，存储不变。再按 `Z`，存储 `keybinds.sleepStart` 为 `z`，没有错误提示。
4. 给取消按 `Z`。提示 `Z is already used for “Start the sleep timer at the default length”. ...`。截 `settings-conflict.png`。再按 `X`，存储 `keybinds.sleepCancel` 为 `x`。截 `settings-bound.png`。扩展命令仍未绑定。
5. `Shortcut sleep length` 组有 `15 min`、`30 min`、`45 min`、`60 min`，`30 min` 按下，存储为 30。截 `settings-length-30.png`。
6. `/long` 设成循环，用弹出面板播放后关掉面板。页面按 `Z`，出现 `Sleep 30 min`。截 `toast-start-30.png`。弹出面板倒计时在 29:00 到 30:00 之间。截 `popup-30.png`。
7. 设置里点 `15 min`，存储为 15。截 `settings-length-15.png`。回页面按 `Z`，不刷新页面，出现 `Sleep 15 min`。截 `toast-start-15.png`。倒计时在 14:00 到 15:00 之间。截 `popup-15.png`。
8. 按 `X`，出现 `Sleep cancelled`。截 `toast-cancel.png`。弹出面板没有倒计时，媒体仍在播。截 `popup-cancelled.png`。再按 `X`，出现 `No sleep timer is running.`。截 `toast-idle.png`。
9. 页面里插一个输入框，聚焦后输入 `hi` 再按 `z`、`x`。值是 `hizx`，没有睡眠字样，弹出面板没有倒计时。截 `fixture-typing.png`。
10. 设置页点 `Restore default keys`，两个按钮回到 `Not set`。时长点回 `30 min`。截 `settings-restored.png`。回页面按 `Z`，没有字样也没有倒计时。`sitePrefs` 仍是 `{}`。

成功时 `state.json` 的 `ok` 为 `true`，`started30` 和 `restarted15` 是当时的倒计时，`cancelled`、`restored` 为 `true`，`typingValue` 为 `hizx`。证据写到 `/opt/cursor/artifacts/verify-ottertap/sleep-hotkeys/`：`settings-unbound.png`、`settings-conflict.png`、`settings-bound.png`、`settings-length-30.png`、`toast-start-30.png`、`popup-30.png`、`settings-length-15.png`、`toast-start-15.png`、`popup-15.png`、`toast-cancel.png`、`popup-cancelled.png`、`toast-idle.png`、`fixture-typing.png`、`settings-restored.png`、`state.json`、`transcript.txt`。

无头 Chromium 不能按键触发扩展命令。两条命令的分发由 `tests/sleep-hotkeys-background.test.ts` 覆盖：按存储里的默认时长开始，改设置后下一次用新时长，重按从现在起重新计时，取消与无定时的提示，文本框聚焦和没有媒体时不处理。默认不占键、撞键归属、按键解析、重复按键只算一次、设置默认值和导出导入、设置页点选，由 `tests/sleep-hotkeys.test.ts` 覆盖。

## Gotchas

- 空字符串就是未绑定，永远不算撞键。不要给这两条预设默认键，也不要在 manifest 里加 `suggested_key`，Chrome 最多 4 个建议键。
- 默认时长只能是面板那四档。自定义分钟只在面板里，不进这个设置。
- 存储里有 `sleepDefaultMinutes`、`sleepStart`、`sleepCancel`。旧的睡眠旅程用整段存储文本排除 `sleep`，要先把这些键名换掉再检查。
- 页内键在内容脚本里已经按输入框过滤。扩展命令不经过页面键盘，后台另按 `collect` 的 `typing` 判断。
- 弹出面板打开时页面没有焦点。按页内键之前先关掉面板，点一下夹具页。
- 这一程改了键和时长。成功或失败退出前都会把键恢复成未绑定。
