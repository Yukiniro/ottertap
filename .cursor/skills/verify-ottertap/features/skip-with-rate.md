# 快进 / 快退随倍速放大

设置页「Playback」里「Skip step」下面的开关 `Scale skip with speed`（`#settings-skip-with-rate`）默认关闭。关闭时，弹出面板、页内 `J` `L` `←` `→` 和扩展命令 `skip-back` / `skip-forward` 仍按配置步长跳固定秒数，和没有这个开关时一样。

打开后，实际跳转秒数 = 配置步长 × 当前播放倍速，再四舍五入到整数秒。例如步长 10 秒、当前 2×，跳 20 秒。倍速低于 0.5× 按 0.5× 算，高于 3× 按 3× 算，所以 4× 时 10 秒步长跳 30 秒，不会一次跳到 40 秒。弹出面板按钮的角标和 `aria-label`、页内提示，都显示这个实际秒数。三处用同一个计算。

设置页「Single-key mode keys」里的说明仍写配置步长，因为那里没有正在播放的倍速。页内提示才是实际秒数。

## Sub-features

- 设置控件。开关无障碍名 `Scale skip with speed`，说明文案是 `When on, each skip is the step times the current speed. A 10s step at 2× jumps about 20s. Speeds outside 0.5×-3× use those limits, and the hint shows the actual seconds.` 默认 `aria-checked="false"`。存进 `ottertap-settings-v1.skipWithRate`。缺这一项或不是布尔值 `true` 时按关闭处理。
- 弹出面板。按钮名 `Back {n} seconds` / `Forward {n} seconds`，小数字是 `{n}`。关闭时 `{n}` 是配置步长。打开时 `{n}` 是按当前倍速算出来的实际秒数，点一下 `currentTime` 变化这么多秒。
- 页内快捷键。内容脚本仍上报配置步长。后台用当前媒体的 `playbackRate` 计算实际秒数。`J` / `←` 后退，`L` / `→` 前进。只在「Single-key mode」打开后生效。跳完后页面顶部提示是 `Back {n} seconds` 或 `Forward {n} seconds`，`{n}` 是实际秒数。
- 扩展命令。`skip-back` / `skip-forward` 仍只表示方向。后台读配置步长和当前倍速，提示同样是实际秒数。

## How to get to it (user POV)

1. 打开有视频的页面，把倍速调到 2×。弹出面板进退按钮仍是 `Back 10 seconds` / `Forward 10 seconds`，点一下只动 10 秒。
2. 打开 `chrome-extension://<extensionId>/options.html#playback`，打开 `Scale skip with speed`。
3. 回到 2× 的视频。按钮变成 `Back 20 seconds` / `Forward 20 seconds`，点一下动 20 秒。
4. 打开 `Single-key mode`，按 `L` 或 `J`。页面提示写 20 秒，进度也动 20 秒。
5. 把倍速调到 4×。按钮和一次按键都是 30 秒，不是 40 秒。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive skip-with-rate
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile，同一会话只能跑一次，也不能接在 `drive skip-step` 后面。旅程用夹具 `/long`。只有把 `currentTime` 设成 60、把 `playbackRate` 设成观察用的倍速是前置：

1. 默认设置、倍速 2×。弹出面板按钮是 `Back 10 seconds` / `Forward 10 seconds`。点前进到 70，点后退回 60。截 `popup-off.png`。
2. 设置页 `#playback`。开关 `Scale skip with speed` 是关。截 `settings-off.png` 后打开，存储里 `skipWithRate === true`，`skipSeconds` 仍是 10。截 `settings-on.png`。再到 `#shortcuts` 打开 `Single-key mode`。
3. 新开 `/long`，倍速 2×，`currentTime` 60。按钮是 20 秒。点前进到 80，点后退回 60。截 `popup-on.png`。
4. 点空白处，按 `l` 到 80，提示 `Forward 20 seconds`，截 `toast-20.png`。按 `j` 回 60，提示 `Back 20 seconds`。
5. 把倍速改成 4×，`currentTime` 设回 60。按钮是 30 秒。点前进到 90，点后退回 60。截 `popup-clamped.png`。
6. 把倍速改成 0.25×，`currentTime` 设回 60。按 `j` 到 55，提示 `Back 5 seconds`。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/skip-with-rate/`：`popup-off.png`、`settings-off.png`、`settings-on.png`、`popup-on.png`、`toast-20.png`、`popup-clamped.png`、`state.json`、`transcript.txt`。

没有 e2e。计算、开关、导出导入、面板、热键和扩展命令由 `tests/skip-with-rate.test.ts` 覆盖。关闭时的固定秒数仍由 `drive skip-step` 锁住；那条要在新的 profile 上跑。

## Gotchas

- 扩展命令没有走通用户路径。无头 Chromium 里按键不会被当成扩展命令。命令这一条只有 `tests/skip-with-rate.test.ts` 的证据。
- `J` `L` 不开单键模式就没有效果。步骤 4 先打开单键模式。
- 提示大约只显示 1 秒。要在按下之后立刻看 `role="status"`，不要先等进度再找提示。
- 开关和单键模式都写进 profile。用完 `cleanup` 再 `launch`。同一会话里先跑过本条，再跑 `drive skip-step` 会因为开关或单键模式不再是默认而失败。
