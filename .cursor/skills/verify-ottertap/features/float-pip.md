# 音量药丸里的画中画

展开音量药丸后，播放控制那一组里有一个图标按钮。未在画中画时无障碍名是 `Picture-in-picture`，已在时是 `Exit picture-in-picture`。点一下发送和弹出面板、扩展命令相同的 `{ type: 'pip' }`：未进入则进入，已进入则退出。

音频、网站关掉画中画、浏览器不支持，或视频还没加载好时，按钮禁用，下面用和面板 `#pip-hint` 相同的句子说明。已经在画中画里时仍可退出。不放在 `Open panel` 旁边，也不改贴边、半隐藏和全局位置。

## Sub-features

- 可切换。支持画中画的视频上，按钮可点。点一次进入，名字变成 `Exit picture-in-picture`，再点一次退出。
- 音频不进。`/audio` 上按钮禁用，说明是 `Audio can't use picture-in-picture.`。不会进入画中画。
- 原因与面板一致。站点禁用是 `This site has turned off picture-in-picture.`。浏览器不支持是 `This browser can't use picture-in-picture.`。还没加载好是 `Wait for the video to load, then try picture-in-picture again.`。点击后被拒绝时，药丸上的警告和面板是同一句：缺少手势，或 `Couldn't switch picture-in-picture. Try again.`。
- 不挡。按钮在 `Playback` 那一组，和上一条、下一条同一排（本页只有一条时没有那两个按钮）。`Open panel` 在倍速下面，盒子不相交。
- 位置不动。进入或退出前后，浮动入口的位置、`floatingPosition` 和 `sitePrefs` 不变。

## How to get to it (user POV)

1. 打开有视频的网页，点页面边缘的小獭。播放按钮下面有一个画中画图标。
2. 点一下，视频进到角落。再点一下，回到页面。
3. 换成音频，或网站关掉画中画：图标在，但点不了，下面有一句和弹出面板相同的说明。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive float-pip
```

会话已经 `launch` 且 `doctor` 通过之后跑。它不改 profile。夹具视频本身是一段没有画面的音频，旅程会在同一个 `#media` 上补一帧画面，再点药丸里的按钮。

1. 打开 `/video`，等视频有画面后展开药丸。`Picture-in-picture` 在 `Playback` 里，可点，和 `Open panel` 的盒子不相交。截 `pill-video.png`。
2. 点 `Picture-in-picture`。进入后名字变成 `Exit picture-in-picture`，再点一次退出，`#media` 不再是画中画元素。截 `pill-entered.png` 和 `pill-exited.png`。浏览器拒绝时，药丸上的警告须与接着在弹出面板点同一按钮得到的警告相同，并截 `pill-failed.png` 与 `popup-failed.png`。
3. 打开 `/audio`。按钮禁用，说明与弹出面板 `#pip-hint` 相同，页面没有画中画元素。截 `pill-audio.png`。
4. 打开 `/pip-off`。按钮禁用，说明与弹出面板相同。截 `pill-off.png`。
5. 打开 `/unseekable`。按钮禁用，说明与弹出面板相同。截 `pill-waiting.png`。
6. 打开 `/feed`。画中画、上一条、下一条都在 `Playback` 里，三者与 `Open panel` 的盒子都不相交。截 `pill-feed.png`。浮动入口位置、`floatingPosition` 和 `sitePrefs` 与这一步开始时相同。

成功时 `state.json` 的 `ok` 为 `true`。证据在 `/opt/cursor/artifacts/verify-ottertap/float-pip/`：`pill-video.png`、进入时的 `pill-entered.png` 与 `pill-exited.png` 或失败时的 `pill-failed.png` 与 `popup-failed.png`、`pill-audio.png`、`pill-off.png`、`pill-waiting.png`、`pill-feed.png`、`state.json`、`transcript.txt`。

按钮放在播放组、点击走 `{ type: 'pip' }`、禁用时不下发、失败句子与 `pipHint` 相同，由 `tests/float-pip.test.ts` 覆盖。

## Gotchas

- 无障碍名沿用 `Picture-in-picture` / `Exit picture-in-picture`，和面板按钮同名。按钮本身是图标。
- 禁用时的短句就是 `pipUnavailableAudio`、`pipDisabledBySite`、`pipUnsupported`、`pipNotReady`。点击被拒绝时走原来的 `pipNeedsGesture` 或 `pipFailed`，显示在药丸已有的警告里。
- 尚未就绪看的是 `readyState < 1`，和 `togglePictureInPicture` 拒绝进入的条件相同。已经在画中画里时不因此禁用，以便退出。
- 共享夹具的 `/video` 源是 wav，没有画面。无头 Chromium 对这种元素会拒绝画中画。旅程先给同一个元素补一帧，再点按钮。
- 不新增权限，也不写 `floatingPosition` 或 `sitePrefs`。
