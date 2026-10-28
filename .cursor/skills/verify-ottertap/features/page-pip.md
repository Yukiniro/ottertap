# 页内快捷键 → 画中画

页内快捷键可以绑定进入或退出画中画，和弹出面板、音量药丸、扩展命令是同一条 `{ type: 'pip' }`。默认不占键。绑上之后不必打开单键模式。输入框或可编辑区域聚焦时，这个页内键不触发。扩展命令 `pip` 仍在，没有建议键，也不和页内键互相占用。

## Sub-features

- 改键。设置页「Keyboard shortcuts」的页内快捷键里有 `Enter or exit picture-in-picture`。没绑定时按钮写 `Not set`。点一下再按新键，已打开的网页立即生效。
- 冲突和恢复。录到已经被占用的键时，提示和现有改键一样，写明被谁占用，并且不保存。空着的键不算占用。`Restore default keys` 把这一项收回 `Not set`，其它默认键不动。
- 扩展命令并存。`pip` 仍出现在扩展快捷键列表和 `chrome.commands.getAll()` 里，说明仍是 `Enter or exit picture-in-picture`，没有 `suggested_key`，未绑定仍是 `Not set`。建议键仍是原来四个。页内绑了键之后，扩展命令的快捷键仍是空的。
- 页内切换。绑了键之后，给夹具补上画面，按这个键进入画中画，再按一次退出。浏览器拒绝时，页面顶部的短句是面板已有的失败说明：缺少手势，或 `Couldn't switch picture-in-picture. Try again.`。
- 输入框。焦点在文本框里时，这个键交给网页，不进入画中画，也不弹出说明。
- 不可用。音频、网站关掉画中画、视频还没加载好时，按键后的短句分别与弹出面板 `#pip-hint` 相同。

## How to get to it (user POV)

1. 打开 `chrome-extension://<extensionId>/options.html#shortcuts`。扩展快捷键里的画中画是 `Not set`。页内快捷键里的 `Enter or exit picture-in-picture` 也是 `Not set`。`Restore default keys` 是灰的。
2. 给页内画中画录一个键。如果录到已经用于逐帧的 `,`，出现占用提示，键不变。换一个没人用的键，例如 `P`。再去给水平镜像录 `P`，会提示已被画中画占用。
3. 打开有画面的视频。不打开单键模式。按 `P` 进入画中画，再按退出。浏览器拒绝时，页面上方出现和面板相同的一句。
4. 点进页面上的文本框再按 `P`，字打进文本框，画面不进画中画。
5. 换成音频、关掉画中画的视频，或还没加载的视频，按 `P`。短句和弹出面板相同。
6. 点 `Restore default keys`。这一项回到 `Not set`，`P` 不再切换。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive page-pip
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile，成功时把键位恢复成默认。同一会话只能跑一次，不要接在改过键位的旅程后面。

1. 从 service worker 读清单和 `chrome.commands.getAll()`。`pip` 没有 `suggested_key`，快捷键为空，说明是 `Enter or exit picture-in-picture`。建议键仍是 `play-pause`、`skip-back`、`skip-forward`、`mute`。权限仍只有 `storage`。
2. 打开设置页 `#shortcuts`。扩展列表这一行是 `Not set`，页内按钮也是 `Not set`，`Restore default keys` 禁用，单键模式仍关。截 `settings-unbound.png`。
3. 给 `Enter or exit picture-in-picture` 录 `,`，冲突文案与现网改键一致，不保存。截 `settings-conflict.png`。再录 `P`。给 `Mirror horizontally` 录 `P`，提示已被画中画占用，然后按 Esc 取消。单键模式仍关。截 `settings-bound.png`。扩展命令 `pip` 的快捷键仍是空的。
4. `/video` 补一帧画面后，`K` 不改变播放。`P` 进入画中画再退出。截 `fixture-entered.png` 和 `fixture-exited.png`。浏览器拒绝时，页面短句须是面板已有的失败说明，并截 `fixture-failed.png`。接着在弹出面板点同一按钮，警告也是这几句之一，截 `popup-failed.png`。
5. 焦点放进文本框，输入几个字，再按 `P`。字符留在文本框里，不进入画中画，也不出现画中画说明。截 `fixture-typing.png`。
6. `/audio`、`/pip-off`、`/unseekable` 上按 `P`。短句分别与弹出面板 `#pip-hint` 相同。截 `fixture-audio.png`、`fixture-off.png`、`fixture-waiting.png`。
7. 回到设置页点 `Restore default keys`。按钮回到 `Not set`，按钮再次禁用。截 `settings-restored.png`。再按 `P` 不再切换，也不出现说明。全程 `sitePrefs` 仍是空对象。

成功时 `state.json` 的 `ok` 为 `true`。证据在 `/opt/cursor/artifacts/verify-ottertap/page-pip/`：`settings-unbound.png`、`settings-conflict.png`、`settings-bound.png`、`fixture-typing.png`、`fixture-audio.png`、`fixture-off.png`、`fixture-waiting.png`、`settings-restored.png`、`state.json`、`transcript.txt`。进入时还有 `fixture-entered.png` 与 `fixture-exited.png`；拒绝时还有 `fixture-failed.png` 与 `popup-failed.png`。

无头 Chromium 的按键不会派发扩展命令。两条路径都发送 `{ type: 'pip' }`、再按一次仍是同一条指令、失败短句与面板那几句相同、没有媒体时不发送，由 `tests/page-pip-command.test.ts` 覆盖。默认不占键、空键不算冲突、Ctrl 或 Alt 不走页内键、按住不连发，由 `tests/page-pip-keybinds.test.ts` 覆盖。

## Gotchas

- 不要给扩展命令 `pip` 加 `suggested_key`。四个名额已经占满。
- 空字符串表示未绑定。冲突检测要跳过它，否则和其它未绑定的动作会被当成互相占用，整组键位被打回默认。
- 这一项不要求单键模式。没绑定的键不会拦截页面。
- 输入框聚焦时，内容脚本在派发页内键之前就返回，和其它页内快捷键相同。扩展命令仍走原来的 `commands.onCommand`，这次不改它何时执行。
- 共享夹具的 `/video` 源是 wav，没有画面。无头 Chromium 对这种元素会拒绝画中画。旅程先给同一个元素补一帧，再按键。按键经过后台再回到页面，用户手势可能已经丢掉，这时短句用现有的 `pipNeedsGesture` 或 `pipFailed`，并和面板点击失败的那一句对照。
- 不可用时的短句就是 `pipUnavailableAudio`、`pipDisabledBySite`、`pipNotReady`，和面板 `#pip-hint` 相同。
- 设置页地址是 `chrome-extension://<extensionId>/options.html#shortcuts`，不是 `https://`。
