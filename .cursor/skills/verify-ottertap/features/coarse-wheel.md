# 滚轮粗调步长

有时要一下拉到大概音量，有时要一格一格抠。设置页「Playback」里的 `Coarse step` 是按住 Shift 滚动时用的步长，档位是 20% 和 50%，默认 50%。没按 Shift 时，悬停滚轮和 Alt+滚轮仍用「Volume step」，音量低于 25% 且 `Finer wheel steps below 25%` 开着时仍用 1%。按住 Shift 时用粗调步长，并且优先于那档 1%。松开 Shift 后下一格回到原来的步长。

Shift 不改变滚轮在哪里生效。光标在主播放器上时，Shift+滚轮调音量。光标不在主播放器上时，Shift+滚轮仍交给页面。Alt+滚轮仍可在任意位置调音；Alt+Shift+滚轮也是任意位置，只是用粗调步长。输入框聚焦时，不按 Alt 的 Shift+滚轮不拦截。

单键模式的 ↑ ↓、扩展命令 `volume-up` / `volume-down`，以及弹出面板和音量药丸上的滑块，都不看粗调步长。

## Sub-features

- 设置控件。在「Volume step」说明下面，`id="settings-coarse-volume-step"`，组名 `Coarse step`。两个按钮 `20%`、`50%`，默认 `50%` 按下。说明写明按住 Shift 用这个步长，松开回到音量步长或低于 25% 的 1%，Shift 优先于自动细档，Alt+Shift 仍可在任意位置调音，输入框聚焦时不拦截，方向键、扩展命令和滑块不变。存进 `ottertap-settings-v1.coarseVolumeStep`。缺省或非法值当作 50。音量步长的说明仍在旁边。
- 悬停滚轮。光标在主播放器上时，按住 Shift 的一格用粗调步长，页面不滚动。松开后再滚，回到音量步长或 1%。内容脚本只多报一个 Shift 标记，步长在应用时决定。
- Alt+滚轮。页面任意位置仍可调音。加上 Shift 后用粗调步长，不加 Shift 时仍用音量步长或 1%。关着悬停滚轮时，Alt 和 Alt+Shift 都仍然生效。
- 输入框。焦点在文本框里时，主播放器上的 Shift+滚轮不改音量。同一焦点下 Alt+滚轮和 Alt+Shift+滚轮仍改音量。

## How to get to it (user POV)

1. 打开扩展设置：`chrome-extension://<extensionId>/options.html#playback`。`Coarse step` 默认是 `50%`，旁边能看到音量步长和粗调步长两段说明。
2. 打开有视频的页面，把音量调到大约 10%。光标放在主播放器上滚一格，音量增加 1%。按住 Shift 再滚一格，音量增加 50%，来到 60% 一带。松开后再滚一格，因为已经高于 25%，按音量步长增加，默认是 10%。
3. 把粗调步长改成 `20%`。把音量调到大约 4%，按住 Shift 滚一格到 24% 一带，松开后再滚一格，仍是 1%。再把音量调到 40%，不按 Shift 按 10% 变，按住 Shift 按 20% 变。
4. 光标移到播放器外面，按住 Shift 滚，页面滚动，音量不变。按住 Alt 滚，按音量步长变。按住 Alt 和 Shift 滚，按粗调步长变。
5. 点一下页面上的输入框，再回到播放器上按住 Shift 滚，音量不变。按住 Alt 滚仍按音量步长变，按住 Alt 和 Shift 滚按粗调步长变。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive coarse-wheel
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile，同一会话只能跑一次，而且不能接在 `drive volume-step` 后面。旅程用夹具 `/keys`（视频下面有 `Field` 输入框）。把 `#media.volume` 设成观察起点只是前置，动作本身是滚轮：

1. 打开设置页 `#playback`。`Coarse step` 的按钮是 `20%` 和 `50%`，只有 `50%` 按下。音量步长说明和粗调说明都可见。截图。
2. 打开 `/keys`，把音量设成 0.1，等手势间隔过去，光标在视频上 `mouse.wheel(0, -100)`。音量约 0.11。
3. 按住 Shift 再向上滚一格。音量约 0.61。松开后再向上滚一格。音量约 0.71。
4. 设置页点粗调的 `20%`，存储里 `coarseVolumeStep === 20`，`volumeStep` 仍是 10。不刷新夹具页。把音量设成 0.04，按住 Shift 向上一格，音量约 0.24。松开后再向上一格，音量约 0.25。
5. 把音量设成 0.4。不按 Shift 向上一格，音量约 0.5。按住 Shift 向上一格，音量约 0.7。
6. 光标移到视频下方，按住 Shift 向下滚。`scrollY` 增加，音量不变。滚回顶部后，在视频下方按住 Alt 向上滚，音量约 0.8，页面不动。再按住 Alt 和 Shift 向上滚，音量约 1，页面不动。
7. 把音量设回 0.4，聚焦 `Field`，滚回顶部。视频上按住 Shift 向上滚，音量仍约 0.4。按住 Alt 向上滚，音量约 0.5。按住 Alt 和 Shift 向上滚，音量约 0.7。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/coarse-wheel/`：`settings-default.png`、`fixture-fine.png`、`fixture-coarse.png`、`fixture-release.png`、`settings-20.png`、`fixture-20.png`、`page-scroll.png`、`fixture-typing.png`、`state.json`、`transcript.txt`。

方向键和扩展命令不走粗档，这一条没有走用户路径。证据在 `tests/coarse-wheel-background.test.ts`。

## Gotchas

- 步长看的是应用手势时的音量和当时有没有按住 Shift。连滚跨过 25% 时，没按 Shift 的下一格会回到音量步长。
- 从 50% 按默认粗档 50% 向上正好到 100%。从低于 100% 一步跨过 100% 时会先停在 100%。
- 播放器外的 Shift+滚轮是页面滚动，不是「任意位置调音」。任意位置仍是 Alt。
- 输入框聚焦时只放开不带 Alt 的滚轮。Alt+滚轮和 Alt+Shift+滚轮照常调音。
- 这个选项写进 profile。用完 `cleanup` 再 `launch`。同一会话里先跑过 `drive volume-step` 会把音量步长改掉。
