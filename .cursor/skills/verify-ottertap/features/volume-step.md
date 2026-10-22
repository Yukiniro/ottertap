# 音量调节步长

设置页的「Volume step」决定悬停滚轮、Alt+滚轮、单键模式的 ↑ ↓，以及扩展命令 `volume-up` / `volume-down` 一次改多少个百分点。档位是 5%、10%、20%，默认 10%。存储里不是这三个值时按 10% 处理。弹出面板和浮动音量滑块仍按 1% 连续拖动，不使用这个步长。

在没有这一项的版本里，这三处离散手势都写死 10 个百分点，设置页「Playback」也没有「Volume step」。把步长改成 5% 之后，同一页不重新加载，悬停滚轮一格只动 5 个百分点；改成 20% 之后，Alt+滚轮和单键 ↑ ↓ 一格动 20 个百分点。默认 10% 时，行为和改动前一样。

## Sub-features

- 设置控件。在设置页「Playback」一节（`#playback`，紧挨「Skip step」）。组名 `Volume step`（`h3#volume-step-label` 给 `role="group"` 命名），里面三个按钮 `5%`、`10%`、`20%`，选中的那个 `aria-pressed="true"`，默认是 `10%`。说明文案是 `The scroll wheel, single-key arrow keys, and browser extension commands all change volume by this step.`，存进 `ottertap-settings-v1.volumeStep`。
- 滚轮。光标在主播放器上时，裸滚轮一格（像素模式 `delta` 100）按这个步长增减。Alt+滚轮在页面任意位置同样按这个步长。内容脚本从当前设置读取步长，改完不用整页刷新。
- 单键方向键。`↑` 增加、`↓` 减少，每次这个步长。只在「Single-key mode」打开、并且指针在视频上或视频有焦点时生效。设置页「Single-key mode keys」里 `↑` / `↓` 的说明带上当前百分点。
- 扩展命令。`volume-up` / `volume-down` 在命令表里只表示方向。后台每次触发时读当前设置的步长，不需要单键模式。
- 跨过 100%。从 100% 以下一步跨过去，或从上面一步跨回来，先停在 100%，下一步才离开。媒体元素音量不超过 1。

## How to get to it (user POV)

1. 打开扩展设置：`chrome-extension://<extensionId>/options.html#playback`。
2. 在 `Volume step` 里点 `5%` 或 `20%`。
3. 打开有视频的页面。光标放在主播放器上滚一格，或按住 Alt 再滚一格。音量按所选步长变化。
4. 要用 ↑ ↓，先在「Shortcuts」打开 `Single-key mode`，指针放在视频上再按。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive volume-step
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile，同一会话只能跑一次。旅程用夹具 `/keys`（带尺寸的视频）。每一步都从用户路径走，只有把 `#media.volume` 设成观察起点是前置：

1. 默认设置下打开 `/keys`，把音量设成 0.5，光标移到视频中心，`mouse.wheel(0, -100)`。音量约 0.6。
2. 新开设置页 `#playback`，不关闭夹具页。`Volume step` 的按钮依次是 `5%,10%,20%`，只有 `10%` 按下。截图后点 `5%`，存储里 `volumeStep === 5`。
3. 回到原来的夹具页，不再加载。再滚一格，音量约 0.65。
4. 设置页点 `20%`，存储里 `volumeStep === 20`。打开 `#shortcuts`，`Single-key mode` 从关到开。`↑` 那一行的说明是 `Increase volume by 20 percentage points`。
5. 回到夹具页，Alt+滚轮向上一格，音量约 0.85。松开 Alt，点一下视频让它获得焦点，再按 `ArrowDown` 回到约 0.65，按 `ArrowUp` 回到约 0.85。
6. 把音量设成 0.95，等手势间隔过去，再 Alt+滚轮向上。浮动滑块先显示 100，再向上显示 120，元素音量仍约为 1。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/volume-step/`：`settings-default.png`、`settings-5.png`、`settings-20.png`、`fixture-10.png`、`fixture-5.png`、`fixture-20.png`、`fixture-snap-100.png`、`fixture-snap-120.png`、`state.json`、`transcript.txt`。

没有 e2e。归一化、热键、扩展命令由 `tests/volume-step.test.ts`、`tests/volume-hotkey.test.ts`、`tests/volume-command.test.ts` 覆盖。默认 10% 的滚轮路径仍由 `drive wheel-volume` 和 `e2e/smoke.spec.ts` 里点名的滚轮测试锁住；那条旅程要在新的 profile 上跑，不能接在本条后面。

## Gotchas

- 扩展命令没有走通用户路径。无头 Chromium 里按键不会被当成扩展命令。命令这一条只有 `tests/volume-command.test.ts` 的证据。
- `↑` `↓` 不开单键模式、指针不在视频上就没有效果。步骤 5 先打开单键模式再按。
- 滑块拖动和滑块上的方向键仍是 1% 一档，用来精调。不要用滑块证明这个步长。
- 从 85% 按 20% 向上会先停在 100%，不是 105%。步骤 5 用向下再向上，避开这次跨越；步骤 6 专门看跨越。
- 步长和单键模式都写进 profile。用完 `cleanup` 再 `launch`。同一会话里先跑过本条，再跑 `drive wheel-volume` 会因步长不再是 10 而失败。
