# 只听当前与撤销：页内快捷键和扩展命令

设置页「Keyboard shortcuts」里有两条跨标签安静动作：`Hear only this tab`（只听当前）和 `Undo the last mute others`（撤销上一次静音其他）。页内键和扩展命令列表各有一行，**默认都不占键**。改键、撞键提示和 `Restore default keys` 走和其他页内键同一条路径。

只听当前和弹出面板的 `Hear only this tab` 是同一个动作：静音其他正在出声的标签，当前标签若被浏览器静音则取消，并写入同一次静音批次。撤销恢复这次实际改过、且仍能归属的前态。没有其他发声标签且当前可听时，页内显示原来的 `No other tab is playing, and this tab is already audible.`。没有可恢复的记录时，显示 `Those tabs can't be safely unmuted.`。成功不另加提示。

全屏和普通页面用同一套页内键，不需要打开弹出面板。文本框、文本域、可编辑区域和组合输入聚焦时不触发。

## Sub-features

- 不占键。新装和恢复默认后，两行页内键都是 `Not set`，扩展命令没有建议键，`Restore default keys` 不因为它们变成可点。空键不报占用。
- 改键与撞键。录 `,` 时提示被「Pause, then previous frame」占用，不保存。录一个空闲键就保存。撤销录已给只听当前的那个键时，提示被「Hear only this tab」占用。
- 只听当前。没有目标时显示原来的不可用说明，不写批次，也不把当前标签静音。有其他出声标签时只静音那些标签。预先已静音的标签不进批次。当前标签被浏览器静音时一并取消，批次记下静音前态。媒体元素自己的音量不变。
- 撤销。恢复上一次只听当前实际改过的标签。没有记录时显示原来的不可用说明，不改动其他静音标签。
- 输入。文本框、文本域、可编辑区域聚焦时，两个键照常输入字符。组合输入中的按下和松开也不触发。
- 扩展命令。`listen-current`、`undo-mute-others` 出现在 manifest 和 `chrome://extensions/shortcuts`，没有建议键，原来的 4 个建议键不变。命令作用在用户正在看的标签，不改去画中画所在的标签。
- 导入导出。导出的 `keybinds.listenCurrent` 和 `keybinds.undoMuteOthers` 能导回来。旧备份没有这两项时是未绑定。已有键名不变。

## How to get to it (user POV)

1. 打开设置的「Keyboard shortcuts」。扩展命令和页内键里各有「只听当前」「撤销上一次静音其他」，都显示未设置。
2. 点页内「只听当前」的按键按钮，按一个没被占用的键，比如 Y。再给撤销绑 U。
3. 打开正在出声的页面，不打开弹出面板，按 Y。其他正在出声的标签被静音；当前这一页若被浏览器静音，则恢复出声。
4. 按 U，刚才静音或取消静音的标签回到之前的状态。再按一次，页面说明这次没有可恢复的记录。
5. 点进输入框打字，Y 和 U 只是输入字符。
6. 想用浏览器级快捷键，就在浏览器的扩展快捷键页给这两条命令绑键。它们控制的是当前这个标签，不是画中画所在的那个标签。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive quiet-hotkeys
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改 profile 的页内键，成功时恢复默认。扩展命令的按键分发、画中画标签不抢当前标签、输入框聚焦、没有活动标签，由 `tests/quiet-hotkeys-background.test.ts` 覆盖。

1. 权限仍是 `["storage"]`。manifest 里 `listen-current`、`undo-mute-others` 没有 `suggested_key`，原来的 4 个建议键不变。`chrome.commands.getAll()` 里两条快捷键为空，说明是英文文案。
2. 设置页 `#shortcuts`：两条扩展命令行和两个页内键按钮都显示 `Not set`，`Restore default keys` 不可点，没有占用提示，单键模式关。截 `settings-unbound.png`。
3. 点 `Change the key for Hear only this tab. Now Not set.`，按 `,`。提示 `, is already used for “Pause, then previous frame”. ...`，存储不变。截 `settings-conflict.png`。再按 `Y`，存储 `keybinds.listenCurrent` 为 `y`。
4. 给撤销按 `Y`。提示 `Y is already used for “Hear only this tab”. ...`。再按 `U`，存储 `keybinds.undoMuteOthers` 为 `u`。截 `settings-bound.png`。扩展命令仍未绑定。已有的播放键仍是 `k`。
5. 只打开正在播放的 `/tone-current`，不打开弹出面板，按 Y。出现 `No other tab is playing, and this tab is already audible.`，当前标签未静音，没有批次。截 `toast-idle.png`。
6. 打开 `/tone-music`，并把 `/tone-held` 预先静音。回到当前页按 Y。只静音音乐，Held 和当前页不进批次，媒体音量不变，成功没有新提示。截 `fixture-heard.png`。
7. 按 U 恢复音乐。再按 U，出现 `Those tabs can't be safely unmuted.`，Held 仍静音。截 `toast-undo-idle.png`。
8. 输入框、文本域、可编辑区域聚焦时按 Y、U，只输入字符。组合输入的 Y 不拦截、不静音。截 `fixture-typing.png`。
9. 浏览器静音当前标签后再按 Y：当前标签取消静音，音乐静音，批次含当前标签 `previousMuted: true`。按 U 回到静音。
10. 浏览器允许全屏时，全屏里 Y 和 U 做同样的事。截 `fixture-fullscreen.png`。无头环境拒绝全屏时，这一步记一笔，前面不打开面板的按键已经覆盖页内路径。
11. 导出 JSON 含 `listenCurrent: "y"` 和 `undoMuteOthers: "u"`，已有键不变。恢复默认后按 Y 无效果。再导入，两个键回来，按 Y 再次静音音乐，按 U 恢复。结束时恢复默认。`sitePrefs` 为空，没有名单外的存储键。

## Verification

- 单元：`tests/quiet-hotkeys.test.ts`、`tests/quiet-hotkeys-background.test.ts`
- 浏览器：`node .cursor/skills/verify-ottertap/scripts/session.mjs drive quiet-hotkeys`
