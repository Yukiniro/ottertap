# 进出画中画的页内提示

进入或退出画中画成功时，页面顶部短暂出现和倍速提示同一块字样。进入是 `Picture-in-picture on`，退出是 `Picture-in-picture off`。约一秒后淡出，不接收点击，也不改弹出面板里的说明。失败时用已经有的 `pip*` 短说明，页内键和扩展命令仍走这块字样；面板和药丸上的失败说明仍留在原来的位置。

没有页内提示总开关。倍速提示一直会显示，这一轮的字样也默认显示。

## Sub-features

- 进入。成功时字样是 `Picture-in-picture on`。弹出面板、音量药丸、页内已绑定的键和扩展命令都显示。视频进入画中画。
- 退出。成功时字样是 `Picture-in-picture off`。四条路径都显示。视频回到页面。
- 失败。音频、网站关掉画中画、浏览器不支持、还没加载好、缺少手势或切换失败，短句仍是原来的 `pipUnavailableAudio`、`pipDisabledBySite`、`pipUnsupported`、`pipNotReady`、`pipNeedsGesture`、`pipFailed`。不另写一句。
- 不挡主控。字样在画面上方，不盖住播放器底部的控件，并且 `pointer-events-none`。它还在时，下一次切换仍然生效。淡出之后页面上不再留着这句字。
- 铺满画面。播放器铺满窗口时，字样仍出现在顶部，然后消失。
- 不进站点记忆。这些操作不给 `sitePrefs` 写画中画，也不改权限。

## How to get to it (user POV)

1. 打开能进画中画的视频。展开音量药丸，点画中画。视频进到角落，顶部出现 `Picture-in-picture on`。再点一次，出现 `Picture-in-picture off`，视频回到页面。字样随后消失。
2. 打开弹出面板，用同一颗按钮再进再出。页面上出现同样两句。
3. 在设置里给画中画绑一个页内键。按一下进入，再按退出。两句字样同样出现。输入框聚焦时这个键不切换，也不出现字样。
4. 扩展命令成功时也是这两句。浏览器拒绝时，字样是原来的失败短句。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-feedback
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile，成功时把键位恢复成默认。同一会话只能跑一次，不要接在改过键位的旅程后面。

1. 权限仍只有 `storage`。设置页把 `Enter or exit picture-in-picture` 绑成 `P`。单键模式保持关闭。
2. `/video` 补一帧画面。还没切换时没有画中画字样。截 `fixture-before.png`。
3. 展开药丸，点 `Picture-in-picture`。出现 `Picture-in-picture on`，视频进入画中画。字样不盖住视频底部控件，且不接收点击。字样还在时点 `Exit picture-in-picture`，出现 `Picture-in-picture off` 并退出。随后字样消失。截 `toast-float-on.png`、`toast-float-off.png`。
4. 弹出面板再进再出，分别出现这两句。截 `toast-panel-on.png`、`toast-panel-off.png`。字样随后消失。
5. `P` 再进再出，分别出现这两句。截 `toast-key-on.png`、`toast-key-off.png`。字样随后消失。
6. 把视频铺满窗口再按 `P`，`Picture-in-picture on` 仍在顶部。截 `toast-fullscreen.png`。再按 `P` 退出。截 `toast-fullscreen-off.png`。
7. 焦点在文本框里时按 `P`，不进入画中画，也不出现这两句。截 `fixture-typing.png`。
8. `/audio` 上按 `P`，字样是音频不能进画中画的那句，随后消失。截 `toast-audio.png`。
9. `/pip-off` 上按 `P`，字样是网站关掉画中画的那句（浏览器不支持时是不支持的那句），随后消失。截 `toast-off.png`。
10. 浮动入口位置、`floatingPosition` 和 `sitePrefs` 与开始时相同。设置页 `Restore default keys`。

成功时 `state.json` 的 `ok` 为 `true`。证据在 `/opt/cursor/artifacts/verify-ottertap/pip-feedback/`：`fixture-before.png`、`toast-float-on.png`、`toast-float-off.png`、`toast-panel-on.png`、`toast-panel-off.png`、`toast-key-on.png`、`toast-key-off.png`、`toast-fullscreen.png`、`toast-fullscreen-off.png`、`fixture-typing.png`、`toast-audio.png`、`toast-off.png`、`state.json`、`transcript.txt`。

无头 Chromium 的按键不会派发扩展命令。面板、药丸、页内键和扩展命令在成功时各发哪一句、失败时是否仍用原来的短说明，由 `tests/pip-feedback.test.ts` 覆盖。

## Gotchas

- 字样就是倍速那一块 `role="status"`。不要再做一层 overlay。
- 没有提示开关。不要为这一轮新加设置项。
- 动作仍是 `{ type: 'pip' }`。不要给指令加进或出的字段。
- 面板和药丸点失败时，说明仍出现在它们原来的警告里，不另做一条成功字样。页内键和扩展命令的失败仍用同一块字样里的 `pip*` 句子。
- 视频元素自己进入 Fullscreen API 时，页面上的字样会被挡在全屏元素后面，和倍速提示一样。铺满窗口看得到。
- 共享夹具的 `/video` 源是 wav，没有画面。旅程先给同一个元素补一帧，再点按钮。
- 这一程会改键。成功结束时恢复默认。同一会话不要再跑改键的旅程。
- 不新增权限，也不写 `sitePrefs`。
