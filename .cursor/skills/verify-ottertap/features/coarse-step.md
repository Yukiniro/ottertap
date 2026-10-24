# Shift 粗调步长

设置页「Playback」里除了「Volume step」，还有「Coarse step」。不按修饰键时，悬停滚轮和 Alt+滚轮仍用音量步长；音量低于 25% 且细档开着时仍用 1%。按住 Shift 滚动时改用粗调步长，松开后回到原来的步长。第一版修饰键写死 Shift。

粗调步长的档位同样是 5%、10%、20%，默认 20%。缺省或非法值当作 20%，所以和默认 10% 的音量步长幅度不同。方向键、扩展命令和音量滑块不看粗调步长。

## Sub-features

- 设置控件。在「Volume step」说明下面，`id="settings-coarse-step"`，无障碍名是 `Coarse step`。三个按钮 `5%`、`10%`、`20%`，默认 `20%` 按下。说明写明按住 Shift 滚动用这个步长，优先于低于 25% 的自动细调，松开回到音量步长；方向键、扩展命令和滑块不变；Alt + wheel 仍可在任意位置调音，同时按住 Shift 才用这个步长。存进 `ottertap-settings-v1.coarseStep`。
- 悬停滚轮。光标在主播放器上时，按住 Shift 的一格用粗调步长，并跳过 `volumeStepForWheel`。不按 Shift 的行为与改动前相同。不在主播放器上的 Shift+滚轮仍留给页面，不会变成任意位置调音。
- Alt+滚轮。任意位置仍然调音。同时按住 Shift 时用粗调步长，不按 Shift 时仍走音量步长或低音量 1%。
- 输入框。文本框、文本域或可编辑区域聚焦时，Shift+滚轮不拦截。Alt+滚轮在输入框聚焦时仍然调音。

## How to get to it (user POV)

1. 打开扩展设置：`chrome-extension://<extensionId>/options.html#playback`。`Volume step` 默认 `10%`，`Coarse step` 默认 `20%`，两段说明都在。
2. 打开有视频的页面，把音量调到大约 50%。光标放在主播放器上滚一格，音量增加 10%。按住 Shift 再滚一格，音量增加 20%。
3. 把音量调到大约 10%。不按 Shift 滚一格只增加 1%。按住 Shift 滚一格增加 20%。
4. 点一下页面上的输入框，再按住 Shift 在播放器上滚动，音量不变。按住 Alt 和 Shift 滚动，音量仍按粗调步长变化。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive coarse-step
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile，同一会话只能跑一次，而且不能接在 `drive volume-step` 或 `drive fine-wheel` 后面。旅程用夹具 `/keys`。把 `#media.volume` 设成观察起点只是前置，动作本身是滚轮：

1. 打开设置页 `#playback`。`Volume step` 只有 `10%` 按下，`Coarse step` 只有 `20%` 按下。两段说明都可见。截图。
2. 打开 `/keys`，把音量设成 0.5，等手势间隔过去，光标在视频上 `mouse.wheel(0, -100)`。音量约 0.6，页面不滚动。
3. 按住 Shift 再 `mouse.wheel(0, -100)`。音量约 0.8。
4. 光标移到视频下方，按住 Shift 向下滚。`scrollY` 增加，音量仍约 0.8。滚回顶部。
5. 把音量设成 0.1。悬停滚轮向上到约 0.11。再按住 Shift 向上到约 0.31。
6. `focus({ preventScroll: true })` 点到 `#field`。按住 Shift 在视频上向上滚，音量仍约 0.31。
7. 输入框仍聚焦，按住 Alt 和 Shift 在视频上向上滚。音量约 0.51。
8. 把粗调步长改成 `5%`，音量步长仍是 10。不刷新夹具页。从 0.5 悬停滚轮到约 0.6，Shift 滚轮到约 0.65，松开 Shift 的 Alt+滚轮再到约 0.75。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/coarse-step/`：`settings-default.png`、`fixture-10.png`、`fixture-shift.png`、`fixture-fine.png`、`fixture-typing.png`、`settings-5.png`、`fixture-5.png`、`state.json`、`transcript.txt`。

方向键和扩展命令不看粗调步长，这一条没有走用户路径。证据在 `tests/coarse-step-background.test.ts`。

## Gotchas

- 步长在应用手势时决定。Shift 按住时调用方先选粗调步长，不调用 `volumeStepForWheel`。
- 有的浏览器会把 Shift+滚轮改成横向滚动量。主播放器上这种事件仍按粗调步长调音。没有 Shift 的横向滚轮留给页面。
- 输入框聚焦看的是焦点，不看指针下面是不是输入框。`/keys` 的 `#field` 在页面下方，聚焦时要 `preventScroll`，否则视频会滚出视口。
- 关掉悬停滚轮后，单独的 Shift+滚轮不再调音；Alt+Shift 仍然用粗调步长。
- 粗调步长写进 profile。用完 `cleanup` 再 `launch`。同一会话里先跑过 `drive volume-step` 会把音量步长改掉。
