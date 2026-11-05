# 切走标签时自动进入画中画

设置页「Playback」里的 `Picture-in-picture when you switch tabs`，默认关。打开后，当前标签变成不可见时，如果这个标签当前选中的是一条正在播放的视频，就让它进入画中画。音频、已暂停、已结束、本站被网站规则停用、网站关掉画中画、视频还没加载好、本页已有画中画、浏览器拒绝，都不进，也不出提示。任何一次退出画中画（药丸、面板、扩展命令或画中画窗口自己的按钮）之后 10 秒内再切走，不会马上又进。

开关关闭时行为和以前完全一样。手动进出画中画、页内快捷键和扩展命令的路由都不变。「滚出视口自动进」见 `pip-auto-scroll.md`，「回来自动退」是另一个开关，见 `pip-auto-exit.md`，按站点排除见 `pip-auto-excluded-sites.md`。

## Sub-features

- 默认关。新装或没有这个键时为关；只有 `true` 才算开。导出导入带上 `autoPipOnHide`。
- 切走即进。开启后，选中的播放中视频在标签变成 hidden 时调用同一个 `requestPictureInPicture`。
- 两条入口一道门槛。标签隐藏时自己试一次（浏览器在用户刚操作过页面时放行）；同时在顶层页面注册 Media Session 的 `enterpictureinpicture` 回调，浏览器判断可以自动进时会调用它。两条都走 `shouldAutoPip`。
- 不进的情况。音频、暂停、已结束、`disablePictureInPicture`、`readyState < 1`、本页已有画中画元素、本站被网站规则停用。
- 冷却。本帧里任何 `leavepictureinpicture` 之后 10 秒（`autoPipCooldownMs`）内不自动进。
- 安静失败。浏览器拒绝时吞掉错误，不弹药丸警告、不出页内字样；下次切走还会再试一次，不会连发。
- 不改权限，不写 `sitePrefs`。

## How to get to it (user POV)

1. 打开设置页「Playback」，打开 `Picture-in-picture when you switch tabs`。
2. 打开有视频的网页，播放，然后切到另一个标签。视频出现在角落的画中画窗口里。
3. 点画中画窗口的「返回标签」或药丸里的 `Exit picture-in-picture` 退出，马上再切走，不会又进；过十来秒再切走，又会进。
4. 暂停后切走、换成音频、或在停用了小獭的网站上，都不会进。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-hide
```

会话已经 `launch` 且 `doctor` 通过之后跑。整程约 45 秒，结束时把开关关回去、网站规则恢复为全部网站，所以不留 profile 改动。

这条旅程不在会话的 Playwright 上下文里切标签：Playwright 给每个页面开了焦点模拟，页面永远是 `visible`。它用同一个构建、同一个 Chromium 可执行文件，另起一个不带 Playwright 默认覆盖的浏览器（`connectOverCDP` 的 `noDefaults`），profile 在 `/tmp/ottertap-verify/<id>/profile-pip-auto-hide`，结束时只结束自己 spawn 的那个进程并删掉这个目录。夹具仍由 `routedHtml` 提供。页面状态用不带手势的 CDP `Runtime.evaluate` 读，只有点页面这一下算用户手势。

1. 打开 `options.html#playback`，开关为关，存储里没有打开。截 `settings-off.png`。
2. 打开 `/video`，补一帧画面并播放。点一下页面空白处，再切到 `/silent` 标签。夹具页收到 `hidden`，没有画中画。截 `fixture-off.png`。
3. 回设置页点开关。`aria-checked` 为 `true`，存储 `autoPipOnHide: true`。截 `settings-on.png`。
4. 回到视频，点页面后切走。`document.pictureInPictureElement` 是 `#media`。回来后药丸是 `Exit picture-in-picture` 和 `In picture-in-picture`。截 `pill-entered.png`。
5. 点药丸退出，马上点页面再切走：不进（冷却）。等到退出后 10.5 秒，再点页面切走：又进。
6. 再从药丸退出，点 `Pause`，等过冷却，点页面切走：不进。截 `fixture-paused.png`。
7. 从药丸播放，等页面的激活过期（`navigator.userActivation.isActive` 为假），不点页面直接切走：浏览器拒绝，不进，页面没有画中画字样也没有警告。截 `fixture-refused.png`。
8. 打开 `/audio`，让它循环播放，点页面切走：不进。截 `fixture-audio.png`。
9. 把网站规则改成排除 `media.ottertap.test`（直接写存储，作准备），回到 `/video` 播放，点页面切走：不进。截 `fixture-excluded.png`。恢复全部网站，在设置页关掉开关；`sitePrefs` 为空，权限只有 `storage`。

成功时 `state.json` 的 `ok` 为 `true`，各步的 `visibility`、`seen`、`pip`、`paused` 都记在里面。证据在 `/opt/cursor/artifacts/verify-ottertap/pip-auto-hide/`：`settings-off.png`、`fixture-off.png`、`settings-on.png`、`pill-entered.png`、`fixture-paused.png`、`fixture-refused.png`、`fixture-audio.png`、`fixture-excluded.png`、`state.json`、`transcript.txt`。

门槛、冷却、Media Session 钩子的挂卸、拒绝不抛错、设置默认值和导出导入由 `tests/auto-pip.test.ts` 覆盖。

## Gotchas

- 真实 Chrome 里，标签隐藏时用户如果几秒内没碰过页面，自己发起的请求会被拒（`NotAllowedError`）。这时靠 Media Session 回调：Chrome 134 起在满足它自己的条件（顶层页面、在播且最近两秒有声、站点注册了回调、媒体参与度够或用户允许）时调用，并可能先问一次是否允许本站自动画中画。无头 Chromium 不会触发这条，旅程只能证明隐藏标签这一条；回调那条由单测覆盖。
- 注册 `enterpictureinpicture` 会盖掉页面自己注册的同名回调；只在开关打开且本站启用时注册，关掉时撤下。
- 选中来自后台下发给本帧的 `selected`。本帧没有选中（选中在别的 iframe，或从没选过且关了「跟随开始播放的媒体」）时不进。
- 冷却从本帧的 `leavepictureinpicture` 算起。shadow DOM 里的视频这个事件不一定冒到文档上，和 `media.ts` 里现有的监听一样。
- 夹具的 `/audio` 只有一秒且不循环，旅程先打开 `loop`，否则切走时它已经停了。
- Playwright 的 `evaluate` 自带用户手势；要测「浏览器拒绝」就不能在切走前用它读页面。
