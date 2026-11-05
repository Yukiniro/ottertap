# 自动进出画中画的反馈

自动进入或自动退出画中画成功时，页面上出现和手动相同的短暂字样：`Picture-in-picture on` / `Picture-in-picture off`（`pipOnHint` / `pipOffHint`）。浏览器拒绝、音频、网站关掉画中画时，用原来的短说明，不显示成功字样，并且大约 10 秒内不再请求、不再把这句刷第二次。暂停、已结束、开关关着、已经在画中画里、全屏、只在阈值附近抖一下，都不出这句。

设置页「Playback」三个自动开关上方有一段说明：默认都关，只动正在播放的选中视频，手动进出照常，成功和失败分别走上面这两类字样。说明只是界面文案，不新增存储键。

手动进出画中画的提示见 `pip-feedback.md`。切走、滚出、回来退出、按站点排除见各自的功能文件。不做常驻状态条，不做调音浮层。

## Sub-features

- 成功复用手动那一块。自动请求的 promise 成功才派 `pipOnHint`，自动 `exitPictureInPicture` 成功才派 `pipOffHint`。字样是 `role="status"`、不挡点击，大约一秒后淡出。手动按钮和快捷键不经过这条自动路径，不会被多提示一次。
- 失败复用原来的短说明。音频、网站 `disablePictureInPicture`、还没加载好、浏览器不支持，以及 `requestPictureInPicture` / `exitPictureInPicture` 被拒绝，都走和手动失败相同的 `pip*` 句子。
- 一次失败，一段安静。切走、滚出、自动退出共用内容脚本里的同一段约 10 秒（`autoPipCooldownMs`）。这段里不再请求，也不把同一句再显示一次。成功进入不占用这段，所以回来或滚回来仍能退出。
- 边界不连闪。滚出要先以主画面出现过，再几乎看不见才进，一次滚出最多进一次；退出要可见且至少一半回到视口并停约半秒。阈值附近滚动或可见性来回抖，不进出，也不刷字样。
- 设置说明。`autoPipIntro` 写明默认全关、仅播放中的选中视频、与手动进出并存、成功与失败的字样，以及失败后大约 10 秒不再试。八种界面语言都有这句。

## How to get to it (user POV)

1. 打开设置页「Playback」，三个自动开关上方读到那段说明，三个开关默认关。
2. 打开切走和回来退出。播放视频，切到别的标签：视频进画中画，页面短暂出现「画中画开」。回到标签：画中画关掉，出现「画中画关」。马上再切走，不进，也不再出现「画中画开」。
3. 换成正在播放的音频再切走：不进，出现音频不能进画中画的短句。马上再切走，这句不重复。
4. 换成网站关掉了画中画的视频再切走：不进，出现站方关闭的短句。
5. 关掉切走、打开滚出。把主播放器滚出视口：进一次，出现「画中画开」。在滚出位置附近上下抖、再点一下，不重复进出。只滚回一点不退。滚回播放器：退出，出现「画中画关」。
6. 等点击激活过期，再把播放器滚走：浏览器拒绝，出现原来的手势短句，不出现新的「画中画开」。马上点页面不进。大约 10 秒后再点，才再进。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-feedback
```

会话已经 `launch` 且 `doctor` 通过之后跑。这一程另起不带 Playwright 默认覆盖的 Chromium，因为要断言切走后页面变成 `hidden`，并且拒绝路径不能带上 Playwright 的 `evaluate` 手势。读页面用 CDP `Runtime.evaluate`。整程大约 40 秒（其中约 10 秒是等失败冷却），结束时三个开关关回去。它不改会话的 profile。

1. 设置页「Playback」读到 `These three switches are all off by default.`、`only the selected video`、`only while it is playing`、`yourself still works`。三个开关都是关。截 `settings-intro.png`。
2. `/video` 补一帧播放，打开切走和回来退出。点一下页面再切走：`#media` 进入画中画，提示记录里恰好一次 `Picture-in-picture on`。回到标签：字样是 `Picture-in-picture off`，`role="status"` 且不挡点击，画中画空。截 `toast-off.png`。马上再切走：仍空，开的次数仍是 1。
3. `/audio` 循环播放后切走：恰好一次 `Audio can't use picture-in-picture.`，没有开的字样，没有画中画。截 `toast-audio.png`。马上再切走：这句仍是一次。
4. `/pip-off` 播放后切走：恰好一次 `This site has turned off picture-in-picture.`，没有开的字样。马上再切走：仍是一次。
5. 关掉切走、打开滚出，自动退出仍开。`/feed` 的主播放器补一帧，点一下再滚走：进入一次，开的字样一次。在 1140 / 1260 / 1180 之间抖再点一下：进入次数仍是 1，仍在画中画，开的字样仍是一次。只露出约三成：仍在画中画，没有关的字样。滚回页顶：画中画空，关的字样恰好一次。截 `toast-scroll-off.png`。
6. 等退出冷却和点击激活都过期，再滚走：出现手势短句，开的字样仍是一次，没有画中画。马上点页面：仍不进，短句仍是一次。再等约 10 秒后点页面：进入，开的字样变成两次。
7. 三个开关关回去。`sitePrefs` 为空，`unknownStorageKeys` 为空，权限只有 `storage`。

成功时 `state.json` 的 `ok` 为 `true`。证据在 `/opt/cursor/artifacts/verify-ottertap/pip-auto-feedback/`：`settings-intro.png`、`toast-off.png`、`toast-audio.png`、`toast-scroll-off.png`、`state.json`、`transcript.txt`。

八种语言的说明、切走成功与失败冷却、滚出与切走共用一段安静、阈值抖动不连刷、退出失败只提示一次、手动请求不走自动提示，以及设置页能读到这段说明，由 `tests/auto-pip-feedback.test.ts` 覆盖。

## Gotchas

- 会话的 Playwright 上下文让页面永远 `visible`，切标签断言只能在普通连接的浏览器里做。
- Playwright 的 `evaluate` 自带用户手势。拒绝路径必须用 CDP，且 `userGesture: false`。
- 提示在扩展的开放 shadow root 里。页面脚本用 `MutationObserver` 记 `[role="status"]` 的文本；字样清空时把「上一次」记空，同一句再次出现仍能数到。
- 失败冷却活在这一页的内容脚本里。换到另一份夹具页会重新装上脚本，安静窗口不跟着走；同一页里马上再切走或再滚，才会被挡住。滚出这一段用新开的标签，避免上一页留在同一标签上的选中 id 对上信息流里的第一条。
- 成功进入不占这 10 秒，所以同一轮里回来或滚回来仍会退出。退出成功或任何失败才会占上。
