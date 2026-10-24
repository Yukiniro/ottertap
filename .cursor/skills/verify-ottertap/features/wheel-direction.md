# 滚轮方向

设置页「Playback」里的 `Wheel direction` 决定悬停滚轮和 Alt+滚轮哪一边增大音量。两个选项是 `Scroll up increases volume` 和 `Scroll down increases volume`。默认是向上滚动增大音量，和没有这一项时的行为一样。改成向下增大之后，同一手势立刻反过来；页面本身的滚动方向不变。

低音量细档仍然只决定步长。方向是向下增大时，音量低于 25% 的一格仍是 1%，只是增减跟着滚轮反过来。单键模式的 ↑ ↓、扩展命令 `volume-up` / `volume-down`，以及弹出面板和音量药丸上的滑块，都不看这个选项。

## Sub-features

- 设置控件。在「Volume step」和 `Finer wheel steps below 25%` 下面。组名 `Wheel direction`（`h3#wheel-direction-label` 给 `role="group"` 命名）。两个按钮的名字就是 `Scroll up increases volume` 和 `Scroll down increases volume`，选中的那个 `aria-pressed="true"`。说明写明只影响主播放区上的滚轮和 Alt+滚轮，页面滚动、方向键、扩展命令和音量滑块不变，并且默认向上增大。存进 `ottertap-settings-v1.wheelDirection`，取值 `up` 或 `down`。缺省或非法值当作 `up`。
- 悬停滚轮。光标在主播放器上时，裸滚轮按这个方向增减，页面不滚动。内容脚本仍只上报滚轮刻度；方向在应用时读取，所以设置页一切换，已打开的页面下一格就反过来。
- Alt+滚轮。页面任意位置同样按这个方向。关着悬停滚轮时，Alt+滚轮仍然跟着方向走。
- 页面滚动。光标不在主播放器上时，滚轮仍滚动页面：向下滚动让页面向下走，音量不变。
- 细档。低于 25% 时一格仍是 1%。达到或超过 25% 时仍用「Volume step」。关掉细档后，反向的滚轮用音量步长。

## How to get to it (user POV)

1. 打开扩展设置：`chrome-extension://<extensionId>/options.html#playback`。`Wheel direction` 默认按下 `Scroll up increases volume`。
2. 打开有视频的页面。光标放在主播放器上向上滚一格，音量增加。
3. 改成 `Scroll down increases volume`。不刷新页面，再向上滚同一格，音量减少；向下滚一格，音量增加。
4. 把光标移出主播放器再向下滚，页面照常向下滚动，音量不变。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive wheel-direction
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile，同一会话只能跑一次，而且不能接在 `drive volume-step` 或 `drive fine-wheel` 后面。旅程用夹具 `/keys`。把 `#media.volume` 设成观察起点只是前置，动作本身是滚轮或单键：

1. 打开设置页 `#playback`。`Wheel direction` 的按钮是 `Scroll up increases volume` 和 `Scroll down increases volume`，只有前者按下。说明可见。截图。
2. 打开 `/keys`，把音量设成 0.5，光标在视频上 `mouse.wheel(0, -100)`。音量约 0.6，`scrollY` 仍是 0。
3. 回到设置页，点 `Scroll down increases volume`。存储里 `wheelDirection === "down"`，`fineWheel` 仍开，`volumeStep` 仍是 10。不重新加载夹具页。
4. 再 `mouse.wheel(0, -100)`。音量约 0.5。接着 `mouse.wheel(0, 100)`。音量约 0.6，页面仍不滚动。
5. 光标移到视频下方，`mouse.wheel(0, 100)`。`scrollY` 增加，音量不变。
6. 滚回顶部。Alt+向下滚轮到约 0.7，Alt+向上滚轮回到约 0.6。
7. 把音量设成 0.1，再向下滚一格。音量约 0.11，细档的 1% 还在。
8. 打开 `Single-key mode`。把音量设成 0.4，点一下视频后按 `ArrowUp`。音量约 0.5，方向键不跟着反向。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/wheel-direction/`：`settings-up.png`、`fixture-up.png`、`settings-down.png`、`fixture-reversed.png`、`fixture-down.png`、`page-scroll.png`、`fixture-fine.png`、`fixture-arrow.png`、`state.json`、`transcript.txt`。

扩展命令在滚轮反向后仍按音量步长增大，这一条没有走用户路径。无头 Chromium 里按键不会被当成扩展命令。证据在 `tests/wheel-direction-background.test.ts`。

## Gotchas

- 方向看的是应用这一格时的设置。连滚中途改设置，下一格就用新方向，不用等页面刷新。
- 向上的刻度在像素模式里是 `deltaY` 为负。反向只改音量增减，不改这个事件本身，所以页面滚动的方向不变。
- 显示成 25% 就不再用 1% 细档。反向不改变这条边界。
- 单键 ↑ ↓ 必须先打开单键模式，并且指针在视频上。它们用百分点，不用滚轮方向。
- 这个选项和单键模式都写进 profile。用完 `cleanup` 再 `launch`。同一会话里先跑过 `drive volume-step` 或 `drive fine-wheel` 会把步长、细档或单键模式改掉。
