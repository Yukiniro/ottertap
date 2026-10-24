# 仅全屏时用悬停滚轮调音量

窗口里追剧时，悬停在主播放区上的裸滚轮仍会调音量。有的人只想在全屏时这样，平时滚动页面。设置页「Keyboard shortcuts」里的 `Only use the hover wheel in fullscreen` 默认关闭。关掉时不读取全屏状态，悬停滚轮和现在一样。

打开后，只有页面或视频处于全屏时，光标在主播放区上的裸滚轮才调音量。全屏包括浏览器的 Fullscreen API、铺满屏幕且没有工具栏的窗口全屏，以及能可靠认出来的网页全屏：常见播放器的网页全屏标记，或指针下那层固定铺满窗口、层级足够高、并且包着媒体的盒子。剧场模式不算。非全屏时裸滚轮滚动页面，音量不变。退出全屏后下一格裸滚轮立刻交还给页面，不等待滚轮停稳。

Alt+滚轮不看这个开关。非全屏时按住 Alt 再滚，仍然调音量。

## Sub-features

- 设置开关。在 `Scroll over the main player to change volume` 下面，`id="settings-fullscreen-wheel"`。文案是 `Only use the hover wheel in fullscreen`。说明写明默认关闭、开启后只有全屏（含铺满窗口但没用浏览器全屏的播放器）才用裸滚轮调音，否则滚动页面，并且非全屏时 Alt + wheel 仍然可以调音量。存进 `ottertap-settings-v1.fullscreenWheel`。缺省或非法值当作关闭，显式 `true` 才开启。
- 开关关闭。主播放区上的裸滚轮仍调音量，页面不滚动。实现上此时不读取全屏。
- 开关开启且未全屏。同一位置的裸滚轮不调音量，页面往下走。
- 进入全屏。悬停裸滚轮重新调音量。网页全屏用播放器标记即可，不要求先调用 Fullscreen API。
- 退出全屏。下一格裸滚轮立刻滚动页面。
- Alt+滚轮。开关开着、页面不是全屏时，Alt+滚轮仍按音量步长调音量。

## How to get to it (user POV)

1. 打开扩展设置：`chrome-extension://<extensionId>/options.html#shortcuts`。`Only use the hover wheel in fullscreen` 默认是关，悬停滚轮开关仍是开。
2. 打开有视频的页面，光标放在主播放器上滚一格。音量变化，页面不动。
3. 打开这个开关。同一位置再滚，音量不变，页面滚动。
4. 按住 Alt 再滚。音量变化。
5. 让播放器进入网页全屏或浏览器全屏。光标放在画面上滚，音量变化。
6. 退出全屏后再滚。页面立刻恢复滚动。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive fullscreen-wheel
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile，成功时把开关关回去。同一会话不要接在改过悬停滚轮或音量步长的旅程后面。旅程用夹具 `/keys`。把 `#media.volume` 设成观察起点只是前置，动作本身是滚轮：

1. 打开设置页 `#shortcuts`。`Only use the hover wheel in fullscreen` 的开关 `aria-checked="false"`，悬停滚轮仍是开。说明里能看到非全屏时 Alt + wheel 仍然调音量。截图。
2. 打开 `/keys`，把音量设成 0.5，等手势间隔过去，光标在视频上 `mouse.wheel(0, -100)`。音量约 0.6，`scrollY` 仍是 0。
3. 打开开关。存储里 `fullscreenWheel === true`，`hoverWheel` 不被关掉。截图。
4. 滚回顶部，把音量留在 0.6，等间隔，光标在视频上 `mouse.wheel(0, 120)`。`scrollY > 0`，音量仍约 0.6。
5. 再滚回顶部。按住 Alt，`mouse.wheel(0, -100)`。音量约 0.7，`scrollY` 仍是 0。
6. 给视频套上带 `bpx-state-web-fullscreen` 的固定满窗盒子。等间隔后悬停向上一格。音量约 0.8，页面不滚动。
7. 拆掉这个盒子，不额外等待，立刻在视频上向下滚。页面往下走，音量仍约 0.8。
8. 点页面上的按钮对 `#media` 调用 `requestFullscreen()`。进入全屏后悬停向上一格。音量约 0.9，页面不滚动。按 Escape 退出后立刻向下滚。页面往下走，音量仍约 0.9。
9. 把开关关回去。存储里 `fullscreenWheel` 不再是 `true`。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/fullscreen-wheel/`：`settings-default.png`、`fixture-default.png`、`settings-on.png`、`fixture-scroll.png`、`fixture-alt.png`、`fixture-pseudo.png`、`fixture-exit.png`、`fixture-api.png`、`fixture-api-exit.png`、`state.json`、`transcript.txt`。

开关的归一化和「关闭时不读全屏」在 `tests/fullscreen-wheel.test.ts`。后台 `context` 带上这个字段在 `tests/fullscreen-wheel-background.test.ts`。

## Gotchas

- 开关关闭时主播放区规则不变：静音预览、不够大的卡片、连续滚动经过视频，都还是原来的行为。
- 剧场模式、普通大窗口、只是把 `body` 固定住来锁滚动，都不算全屏。
- 几何判断只看指针下那一层，并且这层要包着视频或音频。旁边一块铺满窗口的横幅不算。
- 进入全屏后，如果刚才那一下滚动还没停稳，剩余的滚轮仍留给页面。停稳后再滚才调音量。退出则不等这一下。
- 无头浏览器的视口经常比 `screen` 大或小，这本身不算全屏。旅程用 Fullscreen API 和网页全屏标记，不靠窗口尺寸。
