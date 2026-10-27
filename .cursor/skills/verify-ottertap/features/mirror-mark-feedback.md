# 镜像与标记的页内提示

切换水平镜像、设下进度标记、跳回标记成功时，页面顶部短暂出现和倍速提示同一块字样。约一秒后淡出，不接收点击，也不改弹出面板里的说明。失败时用已经有的那句短说明，同样走这块字样。清除标记成功时不出现新字样。

没有页内提示总开关。倍速提示一直会显示，这一轮的字样也默认显示。

## Sub-features

- 镜像。打开时字样是 `Mirror on`，关掉时是 `Mirror off`。页内已绑定的键、扩展命令和弹出面板开关都显示。画面跟着翻转或恢复。
- 设标记。成功时字样是 `Marked`。进度停在设下的时间。
- 跳到标记。成功时字样是 `Back to mark`。进度回到设下的时间。
- 失败。还不能 seek 时，字样是原来的 `markUnavailable`。没有标记就跳，字样是 `markMissing`。音频上切换镜像，字样是 `mirrorUnavailableAudio`。还不能落到目标时间时，字样是 `cannotSeek`。
- 不挡主控。字样在画面上方，不盖住播放器底部的控件，并且 `pointer-events-none`。它还在时，下一次按键仍然生效。淡出之后页面上不再留着这句字。
- 铺满画面。播放器铺满窗口时，字样仍出现在顶部，然后消失。浏览器允许文档全屏时，文档全屏里也看得到。
- 不进站点记忆。这些操作不给 `sitePrefs` 写镜像或标记。

## How to get to it (user POV)

1. 在设置页给水平镜像、设标记、跳到标记各绑一个键。不必打开单键模式。
2. 打开能拖动进度的视频。按镜像键，画面翻转，顶部出现 `Mirror on`。再按一次，出现 `Mirror off`，画面恢复。
3. 按设标记，出现 `Marked`。把进度拨走，按跳到标记，出现 `Back to mark`，进度回去。
4. 打开弹出面板，用开关和两个按钮做同样三件事，页面上出现同样的字样。清除标记后没有新的成功字样。
5. 直播或不能拖动的视频上按设标记，出现原来那句不能设标记的说明。还没设过就跳，出现没有标记的说明。音频上按镜像键，出现音频不能镜像的说明。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive mirror-mark-feedback
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile，成功时把键位恢复成默认。同一会话只能跑一次，不要接在改过键位的旅程后面。

1. 设置页把 `Mirror horizontally`、`Set mark`、`Jump to mark` 绑成 `H`、`B`、`N`。单键模式保持关闭。
2. `/long` 停在约 12 秒。`H` 出现 `Mirror on` 并翻转。字样不盖住视频底部控件，且不接收点击。字样还在时再按 `H`，出现 `Mirror off` 并恢复。随后字样消失。截 `toast-mirror-on.png`、`toast-mirror-off.png`。
3. `B` 出现 `Marked`，进度仍在约 12 秒。截 `toast-marked.png`。拨到约 40 秒后 `N` 出现 `Back to mark` 并跳回。截 `toast-jump.png`。字样随后消失。
4. 焦点在文本框里时按 `H`，不翻转，也不出现 `Mirror on`。
5. 把视频铺满窗口再按 `H`，`Mirror on` 仍在顶部。截 `toast-fullscreen.png`。再按 `H` 恢复。浏览器若允许文档全屏，全屏里再看一次 `Mirror on`，然后退出。
6. 弹出面板打开镜像，页面出现 `Mirror on`。截 `toast-panel-mirror.png`。再点 `Set mark` 和 `Jump to mark`，分别出现 `Marked` 和 `Back to mark`。等字样消失后点 `Clear mark`，没有新的成功字样，进度不动。
7. `/unseekable` 上按 `B`，字样是不能设标记的那句说明，进度仍是 0。截 `toast-unseekable.png`。
8. `/audio` 上按 `H`，字样是音频不能镜像的那句说明，元素没有镜像标记。截 `toast-audio.png`。
9. 新开的 `/long` 上还没设标记就按 `N`，字样是没有标记的那句说明，进度不动。截 `toast-missing.png`。字样随后消失。
10. 设置页 `Restore default keys`。`sitePrefs` 仍是空对象。

成功时 `state.json` 的 `ok` 为 `true`。证据在 `/opt/cursor/artifacts/verify-ottertap/mirror-mark-feedback/`：`toast-mirror-on.png`、`toast-mirror-off.png`、`toast-marked.png`、`toast-jump.png`、`toast-fullscreen.png`、`toast-panel-mirror.png`、`toast-unseekable.png`、`toast-audio.png`、`toast-missing.png`、`state.json`、`transcript.txt`。

键控、扩展命令和面板各自在成功时发哪一句、失败时发哪一句，由 `tests/mirror-mark-feedback.test.ts` 覆盖。浏览器旅程不派发扩展命令。

## Gotchas

- 字样就是倍速那一块 `role="status"`。不要再做一层 overlay。
- 没有提示开关。不要为这一轮新加设置项。
- 清除标记成功时不提示。失败仍用原来的短说明。
- 视频元素自己进入 Fullscreen API 时，页面上的字样会被挡在全屏元素后面，和倍速提示一样。铺满窗口和文档全屏看得到。
- 这一程会改键。成功结束时恢复默认。同一会话不要再跑改键的旅程。
