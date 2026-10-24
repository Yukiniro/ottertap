# 滚轮方向

悬停滚轮和 Alt+滚轮默认向上滚动时加大音量。设置页「Playback」里的 `Wheel direction` 可以改成向下滚动时加大音量。改完之后，已经打开的网页上同一手势立刻反过来，不用刷新。

方向键、扩展命令 `volume-up` / `volume-down`、弹出面板和音量药丸上的滑块都不看这个选项。页面自己的滚动方向也不变：光标不在主播放器上时，向下滚轮仍让页面向下走。

## Sub-features

- 设置选项。在「Volume step」和低音量细档下面，`id="settings-wheel-direction"`，无障碍名是 `Wheel direction`。两个按钮是 `Up increases` 和 `Down increases`。默认 `Up increases` 按下。说明写明只作用于主播放区上的滚轮和 Alt + wheel，页面仍照常滚动，方向键、扩展命令和滑块不变。存进 `ottertap-settings-v1.wheelDirection`，取值 `up` 或 `down`。缺省或非法值当作 `up`。
- 悬停滚轮。光标在主播放器上时，裸滚轮按这个方向改音量。内容脚本仍按物理方向上报刻度，方向在应用时乘上去，所以切换后下一格就反过来。
- Alt+滚轮。页面任意位置同样按这个方向。关着悬停滚轮时，Alt+滚轮仍然跟着方向走。
- 页面滚动。不在主播放器上的滚轮继续交给页面，向下仍增加 `scrollY`，音量不变。

## How to get to it (user POV)

1. 打开扩展设置：`chrome-extension://<extensionId>/options.html#playback`。`Wheel direction` 里 `Up increases` 默认按下。
2. 打开有视频的页面，把音量调到大约 50%。光标放在主播放器上向上滚一格，音量增加。
3. 把光标移到播放器外面，向下滚，页面往下走，音量不动。
4. 选 `Down increases`。回到刚才的页面，不要刷新。同一向上滚轮改为减小音量；向下滚轮改为加大音量。播放器外面的向下滚轮仍让页面往下走。
5. 再选回 `Up increases`。同一向上滚轮重新加大音量。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive wheel-direction
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile，同一会话只能跑一次。旅程用夹具 `/keys`。把 `#media.volume` 设成观察起点只是前置，动作本身是滚轮：

1. 打开设置页 `#playback`。`Wheel direction` 里 `Up increases` 的 `aria-pressed` 是 `true`，`Down increases` 是 `false`。说明可见。截图。
2. 打开 `/keys`，把音量设成 0.5，等手势间隔过去，光标在视频上 `mouse.wheel(0, -100)`。音量约 0.6，`window.scrollY` 不变。
3. 光标移到视频下方，`mouse.wheel(0, 120)`。`scrollY` 增加，音量仍约 0.6。滚回顶部。
4. 点 `Down increases`，存储里 `wheelDirection === 'down'`。不刷新夹具页。
5. 再在视频上 `mouse.wheel(0, -100)`。音量约 0.5。Alt+同样向上一格，音量约 0.4。`mouse.wheel(0, 100)` 把音量加回约 0.5。
6. 再把光标移到视频下方，`mouse.wheel(0, 120)`。`scrollY` 仍增加，音量不变。
7. 点回 `Up increases`。不刷新。视频上 `mouse.wheel(0, -100)` 音量约 0.6。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/wheel-direction/`：`settings-up.png`、`fixture-up.png`、`page-scroll-up.png`、`settings-down.png`、`fixture-down.png`、`page-scroll-down.png`、`state.json`、`transcript.txt`。

方向键和扩展命令在方向反转后仍按原来的增减，这一条没有走用户路径。证据在 `tests/wheel-direction-background.test.ts`。

## Gotchas

- 方向看的是应用这一格时存储里的值。设置页保存后，后台下一次滚轮就用新方向，不用等页面刷新。
- 50% 以上用音量步长，默认 10%。低于 25% 时细档仍然是 1%，只是加减反过来。测方向时从 50% 起步，避免和细档缠在一起。
- 连续滚轮间隔小于 300ms 且中途离开播放器，剩余事件留给页面。测页面滚动之后要停一下，再回到播放器上滚。
- 这个选项写进 profile。用完 `cleanup` 再 `launch`。
