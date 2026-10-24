# 低音量滚轮细步长

音量已经很低时，固定的音量步长一格跳得太多。设置页「Playback」里的 `Finer wheel steps below 25%` 默认开启。当前音量按浮动入口和弹出面板显示的百分数四舍五入后低于 25% 时，悬停滚轮和 Alt+滚轮一格改 1%。达到或超过 25% 时，仍用「Volume step」里的 5%、10% 或 20%。关掉开关后，滚轮全程用那个步长。

单键模式的 ↑ ↓、扩展命令 `volume-up` / `volume-down`，以及弹出面板和音量药丸上的滑块，都不看这个开关。滑块仍是 1% 一档。按住 Shift 时滚轮改用粗调步长，优先于这里的自动细档。见 [coarse-wheel.md](coarse-wheel.md)。

## Sub-features

- 设置开关。在「Volume step」说明下面，`id="settings-fine-wheel"`。文案是 `Finer wheel steps below 25%`。说明写明低于 25% 时悬停滚轮和 Alt+滚轮用 1%，以上用音量步长，方向键、扩展命令和滑块不变，并且默认开启。存进 `ottertap-settings-v1.fineWheel`。缺省或非法值当作开启，显式 `false` 保持关闭。
- 悬停滚轮。光标在主播放器上时，裸滚轮一格按上面的规则选步长。内容脚本只上报滚轮刻度，步长在应用时按当时的音量决定，所以连滚跨过 25% 的下一格会回到常规步长。
- Alt+滚轮。页面任意位置同样按这个规则。关着悬停滚轮时，Alt+滚轮仍然细调。
- 显示一致。滚完之后，音量药丸和弹出面板的 `Volume` 滑块显示同一个百分数，媒体元素音量是这个百分数除以 100。

## How to get to it (user POV)

1. 打开扩展设置：`chrome-extension://<extensionId>/options.html#playback`。`Finer wheel steps below 25%` 默认是开。
2. 打开有视频的页面，把音量调到大约 10%。光标放在主播放器上滚一格，音量增加 1%。再连滚几格，仍然每次 1%。
3. 把音量调到 40% 以上再滚一格，按「Volume step」变化，默认是 10%。
4. 关掉开关后，10% 上的滚轮也按「Volume step」变化。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive fine-wheel
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile，同一会话只能跑一次，而且不能接在 `drive volume-step` 后面。旅程用夹具 `/keys`。把 `#media.volume` 设成观察起点只是前置，动作本身是滚轮、单键或滑块：

1. 打开设置页 `#playback`。`Finer wheel steps below 25%` 的开关 `aria-checked="true"`。截图。
2. 打开 `/keys`，把音量设成 0.1，等手势间隔过去，光标在视频上 `mouse.wheel(0, -100)`。音量约 0.11。展开音量药丸，`Volume` 的 `aria-valuenow` 是 11。打开工具栏弹出面板，里面的 `Volume` 也是 11。
3. 再连滚四格。音量约 0.15，而不是按 10% 跳到 50% 一带。
4. 把音量设成 0.4，再等间隔，悬停滚轮向上一格。音量约 0.5。
5. 把音量设成 0.15，Alt+滚轮向上一格。音量约 0.16。
6. 打开 `Single-key mode`。把音量设回 0.1，点一下视频后按 `ArrowUp`。音量约 0.2，细档不作用在方向键上。
7. 关掉 `Finer wheel steps below 25%`，存储里 `fineWheel === false`。再从 0.1 悬停滚轮到约 0.2，Alt+滚轮再到约 0.3。
8. 重新加载夹具页，清掉滚轮留在药丸上的乐观百分数。把音量设成 0.5，在音量药丸的滑块上按 `ArrowUp`。音量约 0.51，滑块仍是 1%。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/fine-wheel/`：`settings-on.png`、`pill-11.png`、`popup-11.png`、`fixture-15.png`、`fixture-50.png`、`settings-off.png`、`fixture-off.png`、`slider-51.png`、`state.json`、`transcript.txt`。

扩展命令在低音量仍用音量步长，这一条没有走用户路径。无头 Chromium 里按键不会被当成扩展命令。证据在 `tests/fine-wheel-background.test.ts`。

## Gotchas

- 步长看的是应用手势时的音量，不是滚轮事件发生时页面上还没更新的那个数。连滚时每一格都按上一格落地后的百分数重选。
- 显示成 25% 就用常规步长。24.6% 会四舍五入成 25，不再细调。
- 静音时药丸和面板显示 0%，所以细档开着时滚轮从 1% 开始，并取消静音。
- 单键 ↑ ↓ 必须先打开单键模式，并且指针在视频上。滑块上的方向键属于药丸，不走单键音量。
- 滚轮会把乐观百分数留在已展开的药丸上。之后用脚本改元素音量，药丸不会跟着改，方向键会从那个旧百分数起步。测滑块前要重新加载页面。
- 这个开关和单键模式都写进 profile。用完 `cleanup` 再 `launch`。同一会话里先跑过 `drive volume-step` 会把步长和单键模式改掉。
