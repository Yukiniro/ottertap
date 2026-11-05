# 回到标签或视频回到视口时自动退出画中画

设置页「Playback」里的 `Leave picture-in-picture when you return to the tab or the video`，默认关，和 `Picture-in-picture when you switch tabs`、`Picture-in-picture when the video scrolls out of view` 互不绑定。打开后，只有这两个开关这一轮自己打开的画中画，会在用户回到视频面前时自己关掉：标签页是 `visible`，并且那条视频的可见比例至少 `scrollInShare`（0.5），这个状态保持约 `autoPipExitDelayMs`（500ms）。

手动进入的画中画（弹出面板、音量药丸、页内键、扩展命令、网页自带按钮）从不因这项被关。自动进入后被手动关掉，或被另一条画中画顶掉，这一轮就结束，之后再手动进入也不算自动。关掉开关后不再自动退；同一轮里再打开，会按规则退。

按站点排除见 `pip-auto-excluded-sites.md`。自动进出的页内提示和失败冷却见 `pip-auto-feedback.md`。不做 Document PiP。

## Sub-features

- 默认关。只有 `true` 才算开。导出导入和并发合并带上 `autoPipExitOnReturn`；打开它不改 `autoPipOnHide` / `autoPipOnScroll`，反过来也一样。它在 `ottertap-settings-v1` 里，不是新的顶层存储键。
- 会话标记。`createAutoPip` 和 `createScrollPip` 在自己的 `requestPictureInPicture()` 成功后调用 `onEntered`，内容脚本把它接到 `createAutoPipExit(...).mark`。手动进出走 `lib/media.ts` 的切换，不经过这两个模块，所以不会被标记。
- 回来的条件。页面可见，且被标记的视频可见比例至少 0.5（与滚出路径重新上膛的阈值相同，`visibleShare` 同一套算法）。切走进入的那一轮，回到标签时视频通常就在视口里；滚出进入的那一轮，回到标签但视频仍在视口外时不退，滚回才退。
- 防抖。回来的状态要连续保持约 500ms 才退；中途又切走或又滚出就取消。只露出三成不算回来，和滚出时 0.1 的阈值之间有滞回。自动退出触发 `leavepictureinpicture`，两条进入路径照旧进入 10 秒冷却，所以退出后不会马上又进。
- 清标记。任何 `leavepictureinpicture` 之后，只要被标记的视频不再处于画中画（按它所在的树根判断，兼顾 shadow DOM），这一轮就结束。退出前也再核对一次。
- 开关关着、或没有自动会话时不建 `IntersectionObserver`。不改权限，不写 `sitePrefs`。成功退出时的短提示见 `pip-auto-feedback.md`。

## How to get to it (user POV)

1. 打开设置页「Playback」，打开 `Picture-in-picture when you switch tabs`（或滚出那一项），再打开 `Leave picture-in-picture when you return to the tab or the video`。
2. 播放一个视频，点一下页面后切到别的标签：视频进入画中画。
3. 切回来：约半秒后画中画自己关掉，视频继续在页面里播放。
4. 自己从音量药丸打开画中画，切走再切回来：画中画留着。
5. 打开滚出那一项时，往下滚到评论区：进入画中画；只往回滚一点不关，滚回播放器才关。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-exit
```

会话已经 `launch` 且 `doctor` 通过之后跑。整程约 90 秒，结束时三个开关都关回去，不留 profile 改动。

按「写旅程前的两条硬规则」第 1 条，这条旅程不在会话的 Playwright 上下文里断言：它和 `pip-auto-hide`、`pip-auto-scroll` 共用 `launchPlainBrowser`，另起一个 `connectOverCDP({ noDefaults: true })` 的 Chromium，profile 在 `/tmp/ottertap-verify/<id>/profile-pip-auto-exit`，结束时只结束自己 spawn 的进程并删掉目录。读页面状态和滚动用不带手势的 CDP `Runtime.evaluate`；切标签用 `Target.activateTarget`。每次去设置页拨开关前先暂停夹具视频，免得切走开关在路上自动进入；回来后再播放。

1. 三个开关默认关，存储里 `autoPipExitOnReturn` 不是 `true`。截 `settings-off.png`。
2. 只打开切走开关。`/video` 补一帧播放，点页面后切走：进入画中画。回来 1.5 秒后仍在画中画。截 `fixture-off.png`。手动退出。
3. 打开自动退出：存储 `autoPipExitOnReturn: true`，`autoPipOnHide` 仍为 `true`、`autoPipOnScroll` 不是 `true`，滚出开关仍为关。截 `settings-on.png`。
4. 过了冷却，点页面后切走：进入。回来后约半秒自己退出（`closedAfterMs`），视频仍在播。截 `fixture-returned.png`。
5. 紧接着点页面再切走：冷却期内不又进。
6. 从药丸 `Picture-in-picture` 手动进入，切走再回来，1.5 秒后仍在画中画，药丸是 `Exit picture-in-picture`。截 `pill-manual.png`。从药丸退出。
7. 过了冷却，切走自动进入，然后在夹具标签上只停约 150ms 又切走：页面记到过 `visible`，画中画还在，`leavepictureinpicture` 次数不变。再回来停住：退出。
8. 关掉切走开关、打开滚出开关。`/feed` 的 `Main player` 补一帧播放，点页面后滚走：进入。滚回到只露出约三成并点页面，1.2 秒后仍在画中画。截 `fixture-partial.png`。滚回页顶：退出。截 `fixture-scrolled-back.png`。马上点页面再滚走：冷却期内不又进。
9. 过了冷却，滚回再滚走：进入。切走再回来，视频仍在视口外，1.5 秒后仍在画中画。截 `fixture-away-tab.png`。滚回页顶：退出。
10. 关掉自动退出，存储写回 `false`。过了冷却，滚走进入，滚回页顶 1.5 秒后仍在画中画。进入时的「画中画开」已经淡出，没有「画中画关」，也没有警告。截 `fixture-switch-off.png`。手动退出。
11. 关掉滚出开关。三个开关都是 `false`，`sitePrefs` 为空，权限只有 `storage`。

成功时 `state.json` 的 `ok` 为 `true`，各步的 `visibility`、`seen`（`visibilitychange` 顺序）、`scrollY`、`share`、`pip`、`entered`、`left`、`paused` 都记在里面。证据在 `/opt/cursor/artifacts/verify-ottertap/pip-auto-exit/`：`settings-off.png`、`fixture-off.png`、`settings-on.png`、`fixture-returned.png`、`pill-manual.png`、`fixture-partial.png`、`fixture-scrolled-back.png`、`fixture-away-tab.png`、`fixture-switch-off.png`、`state.json`、`transcript.txt`。

设置默认值、导出导入、并发合并、两条进入路径打标记、手动进入不打、手动退出或被顶掉后清标记、路过标签与阈值附近抖动不退、自动退出后的冷却、开关关闭与等待中途关闭、设置页开关由 `tests/auto-pip-exit.test.ts` 覆盖。

## Gotchas

- 会话的 Playwright 上下文让页面永远 `visible`，切标签断言只能在普通连接的浏览器里做。
- Chrome 的 `requestPictureInPicture` 要用户激活。旅程每次自动进入前都点一下页面左侧空白处；滚走用不带手势的 CDP，和真实滚轮一样。
- 去设置页拨开关会让夹具页变 `hidden`。不先暂停，切走开关可能在这时自动进入，干扰后面的断言。
- 浏览器经 Media Session `enterpictureinpicture` 自动进入的画中画，Chrome 自己也可能在回到标签时关掉；这时与本开关的结果一致，不是失败。
