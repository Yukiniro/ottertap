# 切走标签后扩展命令仍控画中画

某一标签里当前选中的媒体正在画中画时，已绑定的扩展命令仍作用在那一条上：暂停、跳转、倍速、静音、音量、退出画中画。焦点可以在另一个 http(s) 标签，也可以在浏览器打不开内容脚本的内置页。内置页注入失败时不发送指令，也不显示成功提示。

没有画中画时，命令仍打到当时聚焦的标签，和原来一样。画中画里的那一条如果不是这个标签的选中媒体，命令也不改投。那个站点被停用时也不改投。

页内快捷键仍只从发出按键的那个页面走，输入框聚焦时内容脚本不把键交给后台。设置页「Keyboard shortcuts」的说明补一句：切走标签后，画中画里的媒体用扩展快捷键。

## Sub-features

- 改投。选中媒体的 `pip` 为真时，`play-pause`、`skip-forward`、`skip-back`、`mute`、`rate-faster`、`volume-up`、`pip` 都发到那一个标签的那一条媒体。
- 不改投。没有画中画、选中的不是正在画中画的那一条、或该站已停用时，命令留在聚焦标签。聚焦标签不是 http(s) 时不发送。
- 注入失败。内容脚本收不到消息时不发送，成功提示也不出现。
- 页内键。从另一个标签发出的页内快捷键仍只控制那个标签。
- 说明。八种语言的 `shortcutsDescription` 都写明切走标签后用扩展快捷键。不改权限，这条路径本身不往 `sitePrefs` 写画中画。

## How to get to it (user POV)

1. 打开设置里的快捷键。说明里能看到：离开这个标签之后，画中画里的媒体要用扩展快捷键。
2. 让视频进入画中画，再打开另一个网页。页内的静音键作用在眼前这个网页，不把画中画里的视频取消静音，也不让它退出画中画。
3. 回到视频所在的标签，页内静音键又能作用在这条视频上。焦点在输入框里时，这个键不再生效。
4. 已经绑过的扩展命令，在别的标签上按下，仍暂停、跳转、改倍速或退出画中画里的那一条。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-away-tab
```

会话已经 `launch` 且 `doctor` 通过之后跑。它不改 profile。

1. 权限仍只有 `storage`。打开 `chrome-extension://<extensionId>/options.html#shortcuts`，说明里有 `After you switch tabs, use an extension shortcut for picture-in-picture media.` 截 `settings-note.png`。
2. `/video` 补一帧画面，从音量药丸进入画中画。视频在播，并且是静音的。
3. 打开 `/audio` 并让它获得焦点。按 `Alt+M`。音频被静音。画中画里的视频仍静音、仍在播放、仍在画中画，倍速不变。截 `away-tab.png`。
4. 回到视频页，点页面空白处再按 `Alt+M`。这条视频取消静音，仍在画中画。
5. 焦点放进文本框再按 `Alt+M`。视频保持有声，仍在画中画。截 `typing.png`。
6. `sitePrefs` 仍是空的。

成功时 `state.json` 的 `ok` 为 `true`。证据在 `/opt/cursor/artifacts/verify-ottertap/pip-away-tab/`：`settings-note.png`、`away-tab.png`、`typing.png`、`state.json`、`transcript.txt`。

扩展命令在切标签之后打到画中画媒体、没有画中画时留在当前标签、内置页注入失败不假装成功、页内键不跟着画中画走，由 `tests/pip-away-tab.test.ts` 覆盖。无头 Chromium 的按键不会派发扩展命令。

## Gotchas

- 设置页地址是 `chrome-extension://<extensionId>/options.html#shortcuts`，不是 `https://`。
- 夹具视频是 wav，没有画面。旅程先补一帧，补帧时会把元素设成静音，后面用这一点区分「键打到了哪一页」。
- 页内 `Alt+M` 是静音，不写 `sitePrefs`。不要在这条旅程里按会记住倍速或音量的键。
- 扩展命令的快捷键要用户在 `chrome://extensions/shortcuts` 里绑定。四个建议键名额不变，`pip` 仍没有建议键。
