# 扩展命令 → 画中画

扩展命令 `pip` 对活动标签页里当前选中的媒体切换画中画，和弹出面板的「Picture-in-picture」按钮是同一条 `{ type: 'pip' }`。已在画中画里再触发则退出。没有默认建议键：Chrome 只接受四个 `suggested_key`，名额仍是 `play-pause`、`skip-back`、`skip-forward`、`mute`。用户在 `chrome://extensions/shortcuts` 自行绑定。

## Sub-features

- 命令登记。`chrome.commands.getAll()` 里有 `pip`，说明是 `Enter or exit picture-in-picture`，未绑定时 `shortcut` 为空。清单权限仍只有 `storage`。
- 设置页。`chrome-extension://<extensionId>/options.html#shortcuts` 的扩展快捷键列表多一行，未绑定显示 `Not set`。`Edit shortcuts` 仍在。这一行只出现在扩展快捷键里，页内快捷键表不增加画中画。
- 面板路径。视频上按钮可点（浏览器不支持时按钮禁用，提示 `This browser can't use picture-in-picture.`）。音频提示 `Audio can't use picture-in-picture.`。带 `disablepictureinpicture` 的视频，在浏览器支持画中画时提示 `This site has turned off picture-in-picture.`。
- 命令执行。对当前选中媒体发送 `{ type: 'pip' }`。站点停用、没有媒体、或页面不是 http(s) 时不发送。失败时页内提示复用面板那几句：音频、站点禁用、浏览器不支持、缺少手势、未加载、切换失败。其它错误不显示提示。

## How to get to it (user POV)

1. 打开 `chrome-extension://<extensionId>/options.html#shortcuts`，在扩展快捷键里看到 `Enter or exit picture-in-picture`，旁边是 `Not set`。
2. 到浏览器的扩展快捷键页把这一项绑上，例如 `Alt+P`。焦点在网页上时按下，当前视频进入或退出画中画，不必打开弹出面板。
3. 当前是音频，或站点关了画中画：按下后页面上方出现和面板 `#pip-hint` 相同的句子。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive extension-pip
```

会话已经 `launch` 且 `doctor` 通过之后跑它。旅程会清掉旧的 `extension-pip/` 证据再写新的。

1. 从 service worker 读清单和 `chrome.commands.getAll()`。`pip` 没有 `suggested_key`，快捷键为空，说明是 `Enter or exit picture-in-picture`。建议键仍是那四个。权限仍是 `storage`。
2. 打开设置页 `#shortcuts`。扩展快捷键列表里这一行是 `Not set`，`Edit shortcuts` 可见。截 `settings-shortcuts.png`。
3. 打开 `/video`，弹出面板里看画中画按钮。浏览器支持时按钮可点，点下去要么进入画中画，要么出现面板已有的失败说明。浏览器不支持时按钮禁用并说明原因。
4. 打开 `/audio`，按钮禁用，提示音频不能进画中画。截 `popup-audio.png`。
5. 打开 `/pip-off`，按钮禁用，提示与浏览器是否支持画中画一致。

成功时 `state.json` 的 `ok` 为 `true`。证据在 `/opt/cursor/artifacts/verify-ottertap/extension-pip/`：`settings-shortcuts.png`、`popup-video.png`、可能有的 `popup-video-after.png`、`popup-audio.png`、`popup-pip-off.png`、`state.json`、`transcript.txt`。

命令真正被快捷键触发这一步，无头 Chromium 按键不会派发扩展命令。分发、退出仍发 `{ type: 'pip' }`、停用站点和无媒体不执行、失败提示键，由 `tests/pip-command.test.ts` 对 `commands.onCommand` 覆盖。映射和「不占第五个建议键」在 `tests/hotkey.test.ts`。面板按钮文案的回归是 `e2e/smoke.spec.ts` 里「画中画按钮在视频上可点，音频和站点禁用时说明原因」。

## Gotchas

- 不要给 `pip` 加 `suggested_key`。四个名额已经占满。
- 页内 Alt / 单键模式没有画中画键。`Alt+P` 只有在用户把它绑成扩展命令之后才切换画中画。
- 浮动入口没有画中画按钮。
- 扩展命令触发的 `requestPictureInPicture` 若被拒绝（`NotAllowedError`），页面提示用现有的 `pipNeedsGesture`，和面板点击失败是同一句，里面仍写「这次点击」。其它拒绝（例如无头 Chromium 里这次点击得到的 `Couldn't switch picture-in-picture. Try again.`）走 `pipFailed`。都不是静默。不要为此加 `scripting` 或其它权限。
- 这次无头 Chromium 里 `pictureInPictureEnabled` 为 true，按钮可点，但 `button.click()` 没有进入画中画，面板底部出现 `Couldn't switch picture-in-picture. Try again.`。
- 设置页地址是 `chrome-extension://<extensionId>/options.html#shortcuts`，不是 `https://`。
