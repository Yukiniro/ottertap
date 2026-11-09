# 跨标签安静：统一短提示与设置说明

静音其他、只听当前、撤销三个动作，从面板、页内键或扩展命令、自动静音三路触发，真实成功之后都复用倍速、PiP 等已有的页内短提示（页面顶部居中的小字样，约 1 秒淡出，`pointer-events: none`，不挡主控）。没有新的开关、存储键或权限，也不改动作本身的行为。

三条成功提示：

| 动作 | 英文 | 简体中文 |
| --- | --- | --- |
| 静音其他（面板、自动） | `Muted other tabs` | 已静音其他 |
| 只听当前（面板、页内键、扩展命令） | `Hearing only this tab` | 只听当前 |
| 撤销（面板、页内键、扩展命令、撤销自动） | `Mute undone` | 已撤销 |

提示显示在用户当前所在标签的顶层页面。视频正在画中画时，它的来源页（可能是后台标签）不会出现提示，原生画中画窗口里也不能注入，不声称在窗口里绘制。

什么算「真实成功」：

- 静音其他：至少一个标签这次从有声改成了静音，并且没有失败。重复点击、列表里只有已静音的标签、没有目标，都不提示。
- 只听当前：至少一个标签这次被改写（静音其他、或取消当前标签的静音），并且没有失败。
- 撤销：真的恢复了至少一个标签。没有记录、或没有一个还能安全恢复，沿用原来的 `Those tabs can't be safely unmuted.`。
- 自动：与自动静音记下新批次、起 5 秒冷却是同一个条件，所以 5 秒内最多一条。

失败仍用已有的短说明。面板自己在面板里写失败，不在页面上重复；页内键和扩展命令沿用原来的失败与不可用说明；自动路径失败不起冷却，所以失败说明按同样的 5 秒去重，不会每次播放都弹。

设置页「Playback」的 `Mute other tabs when this starts playing` 说明只有两句：先说你在这个标签里开始播放时，其他正在出声的标签会被静音；再说只用浏览器的标签静音、不改音量，网页自己开始的播放不会触发。默认关闭由开关状态体现，不再写进文案。冷却、撤销只恢复可归属的上一批、后台和已在播的不触发等完整边界写在 [auto-mute-others.md](auto-mute-others.md) 和 `CONTEXT.md`，不放进设置页。八种语言都有这段说明和三条提示。

文案参考的几处官方说明（只借写法，没有照搬）：Vivaldi 帮助的 Muting Tabs 一节把动作一句话说清，细则放在文章里，设置项只留短标签 <https://help.vivaldi.com/desktop/tabs/tab-features/>；Vivaldi 博客用行为命名「Play Only In Active Tab」「Prioritize Active Tab」 <https://vivaldi.com/blog/sound-in-vivaldi/>；Firefox 扩展 Smart Tab Mute 的上架说明用一句结论加一个具体场景 <https://addons.mozilla.org/en-GB/firefox/addon/smart-tab-mute/>；Auto Mute Tabs 的上架说明只有一句「Mutes all other tabs when a tab starts playing audio」 <https://addons.mozilla.org/en-US/firefox/addon/auto-mute-tabs-ext/>。

## Sub-features

- 面板。`Hear only this tab`、`Mute others`、`Undo mute others` 成功后，来源页各出一条字样。
- 页内键和扩展命令。只听当前、撤销成功后出一条字样。没有目标、没有记录沿用原来的说明，不显示成功。
- 自动。自动静音成功出 `Muted other tabs`。冷却内重复播放既不静音也不出字样。撤销自动那一批显示 `Mute undone`。
- 普通页、全屏、浮动。字样在控制器的页内状态区，浮动药丸在字样出现时仍可点。浏览器允许全屏时，全屏里同样出现。
- 去重。自动成功和冷却同条件；自动失败说明 5 秒内最多一条。
- 不新增设置。导出的设置键与存储键一致，没有任何提示开关；导入导出沿用 #202/#203 已有的开关和键位。

## How to get to it (user POV)

1. 另一个标签正在出声。在设置里给 `Hear only this tab` 绑 Y、给撤销绑 U（或直接用弹出面板）。
2. 点面板的 `Hear only this tab`，或在页面上按 Y：当前页顶部出现 `Hearing only this tab`，其他标签被浏览器静音。
3. 点 `Undo mute others` 或按 U：出现 `Mute undone`。
4. 打开设置里的自动静音，用小獭播放当前媒体：出现 `Muted other tabs`。5 秒内再播放不会再弹，也不会再静音。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive quiet-feedback
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改 profile（自动静音开关和两个页内键），成功或失败都会恢复默认并取消音乐标签的静音。夹具是 `/video`、`/tone-music`。

1. 权限仍只有 `storage`。设置页说明只有两句，含 `browser's tab mute`、`volume stays as it is`、`by itself`，不超过 260 个字符，不再写 `Off by default` 和 `5 seconds`。截 `settings-description.png`。
2. 给只听当前绑 Y、撤销绑 U。只打开 `/video`，按 Y 出现 `No other tab is playing, and this tab is already audible.`，按 U 出现 `Those tabs can't be safely unmuted.`，都不是成功提示，也没有批次。截 `toast-no-target.png`。
3. 打开正在出声的 `/tone-music`。弹出面板依次点 `Hear only this tab`、`Undo mute others`、`Mute others`、`Undo mute others`，`/video` 上依次出现 `Hearing only this tab`、`Mute undone`、`Muted other tabs`、`Mute undone`，音乐标签随之静音和恢复。截 `toast-panel-heard.png`、`toast-panel-undone.png`、`toast-panel-muted.png`、`popup-after.png`。
4. 页内键：按 Y 出现 `Hearing only this tab`，字样在控制器的状态区，浮动药丸 `trial` 点击不被挡；按 U 出现 `Mute undone`。媒体音量前后不变。
5. 浏览器允许全屏时，全屏里按 Y、U 同样出现字样。截 `toast-fullscreen.png`。
6. 画中画：`/video` 补一帧画面并从浮动药丸进入画中画，再打开 `/audio` 作为用户当前页。在 `/audio` 上按 Y、U，以及用弹出面板点 `Hear only this tab`、`Undo mute others`，字样都出现在 `/audio`；`/video` 的控制器状态区没有出现任何字样，画中画不退出。截 `toast-pip-current.png`。无法检查画中画窗口本身（浏览器自有窗口，无头环境不可截图），也无法在浏览器里触发扩展命令，那条路径由 `tests/quiet-hotkeys-background.test.ts` 断言提示只发到发命令的标签。
7. 打开自动静音，重载 `/video`。在媒体上按空格：音乐被静音，出现 `Muted other tabs`，起 5 秒冷却。截 `toast-auto.png`。取消音乐静音后冷却内再按空格：音乐保持有声，0.8 秒内没有任何字样。冷却到点后再按空格再次出现一条。按 U 出现 `Mute undone`。
8. 导出设置：键与存储键一致，不含任何提示开关；自动静音和两个键在里面。关掉开关后导回，三项带回。结束时关闭自动静音、恢复默认键，`sitePrefs` 为空，没有名单外的存储键。

整批失败、部分失败、没有来源标签、冷却内重复和自动失败 5 秒去重，由 `tests/quiet-feedback-background.test.ts` 覆盖。文案键、八语覆盖由 `tests/quiet-feedback.test.ts` 和 `tests/locales.test.ts` 覆盖。

## Evidence

- `settings-description.png` — 自动静音的设置说明
- `toast-no-target.png` — 没有目标时沿用原来的说明
- `toast-panel-heard.png`、`toast-panel-undone.png`、`toast-panel-muted.png` — 面板三路
- `popup-after.png` — 面板
- `toast-fullscreen.png` — 全屏（浏览器允许时）
- `toast-pip-current.png` — 视频在画中画时，提示出现在用户当前页
- `toast-auto.png` — 自动静音成功
- `export.json` — 导出
- `state.json` — 成功时 `ok: true`
- `transcript.txt`

## Verification

- 单元：`tests/quiet-feedback.test.ts`、`tests/quiet-feedback-background.test.ts`、`tests/quiet-hotkeys-background.test.ts`
- 浏览器：`node .cursor/skills/verify-ottertap/scripts/session.mjs drive quiet-feedback`，以及 `quiet-hotkeys`、`listen-current`、`mute-others-undo`、`auto-mute-others`
