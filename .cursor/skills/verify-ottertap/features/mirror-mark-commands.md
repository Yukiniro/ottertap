# 镜像与标记的快捷键

页内快捷键和扩展命令都能切换水平镜像、设下进度标记、跳回标记。默认都不占键，和画中画一样要自己绑。清除标记仍只在弹出面板。输入框或可编辑区域聚焦时，页内键和这三项扩展命令都不执行。

## Sub-features

- 改键。设置页「Keyboard shortcuts」的页内快捷键里有 `Mirror horizontally`、`Set mark`、`Jump to mark`。没绑定时按钮写 `Not set`。点一下再按新键，已打开的网页立即生效，不必打开单键模式。
- 冲突和恢复。录到已经被占用的键时，提示和现有改键一样，写明被谁占用，并且不保存。空着的键不算占用。`Restore default keys` 把这三项收回 `Not set`，其它默认键不动。
- 扩展命令。`mirror`、`mark-set`、`mark-jump` 出现在同一节的扩展快捷键列表和 `chrome.commands.getAll()` 里。说明分别是 `Mirror or restore the video`、`Set a progress mark`、`Jump to the progress mark`。没有 `suggested_key`，未绑定时是 `Not set`。建议键仍是原来四个。`Edit shortcuts` 仍打开浏览器的快捷键页。
- 页内生效。绑了键之后，视频上按镜像键只翻转当前画面，再按恢复。设标记记下当时的时间，跳到标记回到那个时间。单键模式保持关闭，`K` 仍留给网站。
- 输入框。焦点在文本框里时，这三个键不翻转、不改标记、不跳转。焦点回到页面后，跳到标记仍回到原来设下的时间。
- 音频。音频上按镜像键不会写上镜像标记。
- 不进站点记忆。`sitePrefs` 不出现镜像或标记。清除标记没有页内键，也没有扩展命令。

## How to get to it (user POV)

1. 打开 `chrome-extension://<extensionId>/options.html#shortcuts`。扩展快捷键里三项都是 `Not set`。页内快捷键里三个动作也是 `Not set`。`Restore default keys` 是灰的。
2. 给水平镜像录一个键。如果录到已经用于逐帧的 `,`，出现占用提示，键不变。换一个没人用的键，例如 `H`，马上保存。设标记和跳到标记同样改成 `B` 和 `N`。再把跳到标记录成 `H`，会提示已被水平镜像占用。
3. 打开能拖动进度的视频。不打开单键模式。按 `H` 画面左右翻转，再按恢复。按 `B` 记下当前时间，把进度拨走，按 `N` 回到刚才的时间。
4. 点进页面上的文本框再按这三个键，画面和进度都不动。
5. 点 `Restore default keys`。三个动作回到 `Not set`，`H` 不再翻转。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive mirror-mark-commands
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile，成功时把键位恢复成默认。同一会话只能跑一次，不要接在改过键位的旅程后面。

1. 从 service worker 读清单和 `chrome.commands.getAll()`。`mirror`、`mark-set`、`mark-jump` 没有 `suggested_key`，快捷键为空，说明与上面三句一致。建议键仍是 `play-pause`、`skip-back`、`skip-forward`、`mute`。权限仍只有 `storage`。
2. 打开设置页 `#shortcuts`。扩展列表这三行是 `Not set`，页内三个按钮也是 `Not set`，`Restore default keys` 禁用，`Clear mark` 不在这一节。截 `settings-unbound.png`。
3. 给 `Mirror horizontally` 录 `,`，冲突文案与现网改键一致，不保存。截 `settings-conflict.png`。再录 `H`。`Set mark` 录 `B`，`Jump to mark` 先录 `H` 看到占用提示，再录 `N`。单键模式仍关。截 `settings-bound.png`。
4. `/long` 停在约 12 秒。`K` 不改变播放。`H` 翻转当前视频，再按恢复。截 `fixture-mirrored.png`。`B` 设下标记，进度拨到约 40 秒后 `N` 跳回设下的时间。截 `fixture-jumped.png`。
5. 焦点放进文本框，输入几个字，再按 `H`、`B`、`N`。画面不翻转，进度停在约 40 秒。截 `fixture-typing.png`。焦点回到页面后再按 `N`，仍跳回原来的标记。
6. `/audio` 上按 `H`，音频没有镜像标记。截 `audio-plain.png`。全程 `sitePrefs` 仍是空对象。
7. 回到设置页点 `Restore default keys`。三个按钮回到 `Not set`，按钮再次禁用。截 `settings-restored.png`。`/long` 上 `H` 不再翻转。

成功时 `state.json` 的 `ok` 为 `true`。证据在 `/opt/cursor/artifacts/verify-ottertap/mirror-mark-commands/`：`settings-unbound.png`、`settings-conflict.png`、`settings-bound.png`、`fixture-mirrored.png`、`fixture-jumped.png`、`fixture-typing.png`、`audio-plain.png`、`settings-restored.png`、`state.json`、`transcript.txt`。

无头 Chromium 的按键不会派发扩展命令。命令分发、再按一次恢复镜像、输入框聚焦时不执行、没有媒体或站点停用时不执行，由 `tests/mirror-mark-command.test.ts` 对 `commands.onCommand` 覆盖。默认不占键、冲突回默认、按住不连发，由 `tests/mirror-mark-keybinds.test.ts` 覆盖。

## Gotchas

- 不要给这三项加 `suggested_key`。四个名额已经占满。
- 空字符串表示未绑定。冲突检测要跳过它，否则三项都未绑定时会被当成互相占用，整组键位被打回默认。
- 这三项不要求单键模式。没绑定的键不会拦截页面。
- 清除标记没有页内键，也没有扩展命令。
- 页内提示留给下一项。这一项成功或失败都不新做短暂提示。
- 设置页地址是 `chrome-extension://<extensionId>/options.html#shortcuts`，不是 `https://`。
