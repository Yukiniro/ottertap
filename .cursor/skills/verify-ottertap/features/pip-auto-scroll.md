# 主视频滚出视口时自动进入画中画

设置页「Playback」里的 `Picture-in-picture when the video scrolls out of view`，默认关，和 `Picture-in-picture when you switch tabs` 互不绑定。打开后，当前选中、正在播放、并且在视口里以主画面大小（两边都至少占视口三分之一）出现过的视频，被滚到可见比例不超过 10% 时进入画中画。往下滚一点、还露出三成左右时不进。一次滚出最多进一次；要等它重新露出至少一半，下一次滚出才再算。

信息流小卡片、未选中的媒体、音频、开局就在视口外的视频、本站被网站规则停用、网站关掉画中画、本页已有画中画、全屏（Fullscreen API、浏览器全屏和能可靠识别的网页全屏）时都不进。退出全屏后再按规则判断。浏览器拒绝时不出提示；下一次在页面上点击、按键或开始播放时再试。滚出时关掉画中画，要等滚回视频后才会再进；任何一次退出画中画之后 10 秒内也不进（与切走自动画中画同一个冷却）。

自动退出是另一个开关（见 `pip-auto-exit.md`）。按站点排除见 `pip-auto-excluded-sites.md`。不做 Document PiP。

## Sub-features

- 默认关。只有 `true` 才算开。导出导入带上 `autoPipOnScroll`；打开它不改 `autoPipOnHide`，反过来也一样。
- 保守阈值。可见比例按视口能显示的部分算（`visibleShare`），比视口还高的播放器也能算满。不超过 `scrollOutShare`（0.1）算滚出，至少 `scrollInShare`（0.5）才重新上膛。
- 只看选中的主画面。观察对象是本帧选中的那一条视频；上膛时用 `isMainStageSize` 判断大小，小卡片永远不上膛。
- 同一道门槛。进之前走 `shouldAutoPip`（在播、视频、可进画中画、本页没有画中画、冷却），再看 `hoverFullscreenActive`。
- 浏览器的手势要求。滚轮滚动本身不算用户激活；刚点过或按过键时才放行。拒绝后不弹提示，`pointerup`、`keydown`、`play` 和 `fullscreenchange` 时再试同一道门槛。
- 开关关着时不建 `IntersectionObserver`，也不挂这些监听。不改权限，不写 `sitePrefs`。

## How to get to it (user POV)

1. 打开设置页「Playback」，打开 `Picture-in-picture when the video scrolls out of view`。
2. 打开有主播放器的网页，播放，往下滚到评论区。播放器几乎看不见时，画面出现在角落的画中画窗口里。
3. 只往下滚一点、播放器还露出一截时不会进。
4. 在评论区关掉画中画，继续往下读不会又弹出来；滚回播放器再滚走，会再进。
5. 用滚轮滚了很久没点过页面时，浏览器可能拒绝；在页面上点一下或按个键就会进。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-scroll
```

会话已经 `launch` 且 `doctor` 通过之后跑。整程约 90 秒，结束时把开关关回去，不留 profile 改动。

按「写旅程前的两条硬规则」第 1 条，这条旅程不在会话的 Playwright 上下文里断言：它和 `pip-auto-hide` 共用 `launchPlainBrowser`，另起一个 `connectOverCDP({ noDefaults: true })` 的 Chromium，profile 在 `/tmp/ottertap-verify/<id>/profile-pip-auto-scroll`，结束时只结束自己 spawn 的进程并删掉目录。页面状态和滚动都用不带手势的 CDP `Runtime.evaluate`（滚动等同滚轮，不给激活）；只有点页面左侧空白处、以及明确带 `userGesture` 的播放和全屏调用算手势。夹具是 `/feed`：上面是 240×135 的 `Feed preview`，下面是 640×360 的 `Main player`，再下面有 1600px 空白。

1. 设置页开关为关，存储里没有打开。截 `settings-off.png`。
2. `/feed` 给 `Main player` 补一帧并播放（自动跟随选中它）。点页面后滚到 1200：不进。截 `fixture-off.png`。
3. 回设置页打开开关。存储 `autoPipOnScroll: true`，`Picture-in-picture when you switch tabs` 仍为关、`autoPipOnHide` 不是 `true`。截 `settings-on.png`。
4. 滚回页顶，点页面，再滚到只露出约三成：不进。截 `fixture-partial.png`。
5. 点页面后滚走：`#media` 进入画中画。截 `fixture-entered.png`。再在 1140–1240 之间抖动并点页面，`enterpictureinpicture` 仍只有 1 次。
6. 在视口外退出画中画，再点页面：不进。等过 10 秒冷却，滚回页顶再滚走（带点击）：又进。
7. 等点击激活过期（`navigator.userActivation.isActive` 为假），滚回页顶再滚走：浏览器拒绝，没有画中画、没有字样、没有警告。截 `fixture-refused.png`。点一下页面：进。截 `fixture-retry.png`。
8. 暂停主视频，滚走（带点击）：不进。截 `fixture-paused.png`。在视口外带手势开始播放：进。
9. 播放 `Feed preview`，浮动入口 `title` 改成 `Feed preview`。点页面后滚走：小卡片不进，仍在播放但未选中的 `Main player` 也不进。截 `fixture-card.png`。重新播放主视频，入口回到 `Main player`。
10. 给页面加上网页全屏标记 `bpx-state-web-fullscreen`，滚走（带点击）：不进。去掉标记后点一下：进。
11. 暂停后滚走，把空白区块 `requestFullscreen()`，在全屏里带手势开始播放并点页面：不进。截 `fixture-fullscreen.png`。退出全屏后若主视频仍在视口外则直接进，否则点页面再滚走：进。截 `fixture-after-fullscreen.png`。
12. 在设置页关掉开关；`autoPipOnHide` 不是 `true`，`sitePrefs` 为空，权限只有 `storage`。

成功时 `state.json` 的 `ok` 为 `true`，各步的 `scrollY`、`share`、`pip`、`entered`、`gesture`、`fullscreen` 都记在里面。证据在 `/opt/cursor/artifacts/verify-ottertap/pip-auto-scroll/`：`settings-off.png`、`fixture-off.png`、`settings-on.png`、`fixture-partial.png`、`fixture-entered.png`、`fixture-refused.png`、`fixture-retry.png`、`fixture-paused.png`、`fixture-card.png`、`fixture-fullscreen.png`、`fixture-after-fullscreen.png`、`state.json`、`transcript.txt`。

阈值、上膛与滞回、小卡片、开局在视口外、暂停后播放、拒绝后重试、滚出时关掉不再进、冷却、Fullscreen API 与网页全屏门槛、开关和释放时撤下观察器、设置默认值、导出导入、并发合并和设置页开关由 `tests/auto-pip-scroll.test.ts` 覆盖。

## Gotchas

- Chrome 的 `requestPictureInPicture` 要用户激活，激活约 5 秒过期；滚轮滚动不产生激活，键盘滚动（PageDown、空格、方向键）会。所以纯滚轮滚走时常被拒，要靠下一次点击或按键再试。
- 另一个元素进入 Fullscreen API 全屏时，这个 Chromium 把页面滚动重置到顶部附近，主视频在布局里又算可见（`IntersectionObserver` 不看遮挡），所以浏览器里证明的是「全屏期间不进、退出后按规则进」；全屏门槛本身的 Fullscreen API 分支由单测覆盖，网页全屏标记分支在浏览器里证明。
- 浏览器全屏（F11）也算全屏，沿用 `hoverFullscreenActive`；自动化浏览器里 `navigator.webdriver` 为真，这一支不会误判。
- 选中来自后台下发给本帧的 `selected`。本帧没有选中时不观察任何元素。
- 旅程的 `Alt+.` 在这个普通连接的浏览器里不可靠，选中用浮动入口的 `title` 判断。
- Playwright 的 `evaluate` 自带用户手势；要测「浏览器拒绝」就不能在滚走前用它读页面或滚动。
