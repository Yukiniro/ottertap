# 倍速增减步长

设置页的「Speed step」决定页内快捷键、弹出面板的加快 / 减慢按钮，以及扩展命令 `rate-faster` / `rate-slower` 一次改多少倍速。档位是 0.1×、0.25×、0.5×，默认 0.25×。存储里不是这三个值时按 0.25× 处理。弹出面板的预设按钮仍是一键跳到该档，不用这个步长。总倍率仍停在 0.25× 和 4×。当前倍速不在所选格子上时，先对齐到格子再走一步。

在没有这一项的版本里，这三处都写死 0.25×，设置页「Playback」也没有「Speed step」。默认 0.25× 时，行为和改动前一样。

## Sub-features

- 设置控件。在设置页「Playback」一节（`#playback`，紧挨「Volume step」）。组名 `Speed step`（`h3#rate-step-label` 给 `role="group"` 命名），里面三个按钮 `0.1×`、`0.25×`、`0.5×`，乘号是 `×`（U+00D7），选中的那个 `aria-pressed="true"`，默认是 `0.25×`。说明文案是 `On-page shortcuts, the popup faster and slower buttons, and browser extension commands all change speed by this step.`，存进 `ottertap-settings-v1.rateStep`。
- 页内快捷键。`Alt+.` 加快，`Alt+,` 减慢，每次这个步长。单键模式打开后，`>` 和 `<` 同样按这个步长。`Alt+0` 仍在 1× 和本页上一次非 1× 倍速之间来回切，不使用这个步长。内容脚本只上报方向，后台每次用当前设置计算，改完不用整页刷新。
- 弹出面板。倍速标题右侧两个按钮，无障碍名是 `Decrease speed by {step}×` 和 `Increase speed by {step}×`。点一下把当前倍速按这个步长增减。连点不等待上一次刷新，按已经发出的倍速继续走。已经是 4× 时加快按钮禁用；已经是 0.25× 时减慢按钮禁用。
- 扩展命令。`rate-faster` / `rate-slower` 在命令表里只表示方向。后台每次触发时读当前设置的步长，不需要单键模式。
- 快捷键说明。设置页「On-page shortcuts」和「Single-key mode keys」里加快 / 减慢的说明带上当前步长。

## How to get to it (user POV)

1. 打开扩展设置：`chrome-extension://<extensionId>/options.html#playback`。
2. 在 `Speed step` 里点 `0.1×` 或 `0.5×`。
3. 打开有视频的页面。按 Alt+. 或 Alt+,，倍速按所选步长变化。
4. 打开弹出面板，点加快或减慢，变化量与快捷键相同。
5. 要用 `>` `<`，先在「Shortcuts」打开 `Single-key mode`。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive rate-step
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile，同一会话只能跑一次。旅程用夹具 `/keys`。每一步都从用户路径走，只有把 `#media.playbackRate` 设成观察起点是前置：

1. 默认设置下打开 `/keys`，点页面空白处，`Alt+Period`。倍速从 1 到 1.25。再按 `Alt+Comma` 回到 1。
2. 新开设置页 `#playback`，不关闭夹具页。`Speed step` 的按钮依次是 `0.1×,0.25×,0.5×`，只有 `0.25×` 按下。截图后点 `0.1×`，存储里 `rateStep === 0.1`。
3. 回到原来的夹具页，不再加载。把倍速设回 1，再按 `Alt+Period`，倍速约为 1.1。
4. `openPopup()`。点 `Increase speed by 0.1×`，倍速约为 1.2。点 `Decrease speed by 0.1×`，回到约 1.1。
5. 设置页点 `0.5×`，存储里 `rateStep === 0.5`。打开 `#shortcuts`，`Single-key mode` 从关到开。`>` 那一行的说明是 `Increase speed by 0.5×`。
6. 回到夹具页，把倍速设回 1，点一下视频外的空白处，按 `Shift+Period`。倍速约为 1.5。
7. 把倍速设成 4，再按 `Alt+Period`，仍是 4。打开弹出面板，`Increase speed by 0.5×` 禁用。把倍速设成 0.25，按 `Alt+Comma`，仍是 0.25。`Decrease speed by 0.5×` 禁用。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/rate-step/`：`settings-default.png`、`settings-0.1.png`、`settings-0.5.png`、`fixture-default.png`、`fixture-0.1.png`、`fixture-0.5.png`、`popup-0.1.png`、`popup-limit.png`、`state.json`、`transcript.txt`。

没有 e2e。归一化、设置页和面板按钮由 `tests/rate-step.test.ts` 覆盖；热键和扩展命令由 `tests/rate-step-command.test.ts` 覆盖。默认 0.25× 的快捷键路径仍由 `e2e/smoke.spec.ts` 里点名的 Alt + , . 0 锁住；那条要在新的 profile 上跑，不能接在本条后面。

## Gotchas

- 扩展命令没有走通用户路径。无头 Chromium 里按键不会被当成扩展命令。命令这一条只有 `tests/rate-step-command.test.ts` 的证据。
- 预设按钮是绝对倍速，不是这个步长。不要用 `1.25× speed` 证明步长。
- 1.25 配 0.1 的下一步是 1.3，不是 1.35。步骤 3 先把倍速设回 1，避免把对齐看成步长错误。
- `>` 不开单键模式就没有效果。步骤 6 先打开单键模式再按。
- 步长和单键模式都写进 profile。用完 `cleanup` 再 `launch`。同一会话里先跑过本条，再跑默认 0.25× 的快捷键回归会失败。
