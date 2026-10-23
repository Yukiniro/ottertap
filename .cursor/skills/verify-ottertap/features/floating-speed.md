# 浮动药丸里的倍速

展开页面边缘的浮动药丸后，音量条旁边可以直接改当前媒体的倍速，不用打开工具栏弹出面板。减号和加号使用设置里的倍速步长（`Speed step`，默认 0.25×）。预设按钮和设置页「Speed presets」是同一份列表。改完后，页面顶部出现原来的倍速提示（`Speed 1.25×` 这种）。没有点过「记住此站点」时，不会因此写入站点记忆。

输入框或可编辑区域聚焦时，页内快捷键仍不拦截打字，和原来的浮动控制器一样。

## Sub-features

- 展开层。浮动入口的无障碍名仍匹配 `/volume pill/i`。点开后对话框名是 `Volume pill`。音量滑块名仍是 `Volume`，静音按钮仍是 `Mute` / `Unmute`。
- 倍速组。对话框里 `group` 的名字是 `Speed`。减号 / 加号的无障碍名与弹出面板相同：`Decrease speed by {step}×`、`Increase speed by {step}×`，乘号是 `×`（U+00D7），数字来自 `rateStep`。已经是 0.25× 时减号禁用，已经是 4× 时加号禁用。连点不等待上一次刷新，按已经发出的倍速继续走。
- 预设。同一组里的按钮无障碍名是 `1.25× speed` 这种 `speedOption`。列表来自 `ottertap-settings-v1.ratePresets`，和弹出面板、设置页同一份。当前倍速落在某个预设上时，那个按钮 `aria-pressed="true"`。
- 提示。成功改完后复用页内 `role="status"` 的倍速提示，文案是 `Speed {rate}×`。不新开一套提示。
- 站点记忆。这条路径只发送倍速指令。站点还没被记住时，存储里的 `sitePrefs` 保持为空。已经记住的站点仍按原来的指令路径更新，和音量滑块、弹出面板一样。

## How to get to it (user POV)

1. 打开有视频的页面，点页面边缘的小獭，展开音量药丸。
2. 在音量条旁边点加号、减号，或点一个预设。
3. 听到或看到播放变快，页面上方短暂出现倍速提示。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-speed
```

会话已经 `launch` 且 `doctor` 通过之后跑。旅程用夹具 `/keys`。它会改设置里的倍速步长和预设，成功结束时再改回去。中途失败就要 `cleanup` 再 `launch`，不要接在依赖默认 0.25× 或默认预设的旅程后面。

1. 打开 `/keys`，展开药丸。音量滑块先显示 100%，按下方向键后 `#media.volume` 约为 0.99。点 `Mute` 再点 `Unmute`，音量仍约 0.99。
2. `Speed` 组里能看到默认预设 `0.75× speed` 到 `4× speed`，`1× speed` 按下。点 `Increase speed by 0.25×`，`#media.playbackRate` 约为 1.25，状态提示是 `Speed 1.25×`。
3. 点 `2× speed`，倍速约为 2，提示是 `Speed 2×`。存储里 `sitePrefs` 仍是空的。
4. 聚焦 `Field`，输入 `hi`。字符进输入框。再按 `Alt+Period`，倍速保持约 2。
5. 设置页把 `Speed step` 改成 `0.5×`，不刷新夹具。回到夹具点 `Increase speed by 0.5×`，倍速从 2 到约 2.5。把倍速设成 4 后，加快按钮禁用。
6. 设置页去掉 `4×` 预设。夹具上的药丸里不再有 `4× speed`。然后恢复默认预设，并把步长改回 `0.25×`。`sitePrefs` 仍为空。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/floating-speed/`：`fixture-step.png`、`pill-step.png`、`pill-preset.png`、`settings-step.png`、`pill-presets.png`、`state.json`、`transcript.txt`。

假浏览器里的步长、预设、提示、音量回归和「不写站点记忆」由 `tests/floating-speed.test.ts` 覆盖。默认 0.25× 的页内快捷键仍由 `e2e/smoke.spec.ts` 里点名的 Alt + , . 0 锁住。

## Gotchas

- 预设按钮是绝对倍速，不是步长。不要用 `2× speed` 证明步长。
- 提示大约一秒后消失。截图要在提示出现后马上拍。
- 入口无障碍名仍包含 `volume pill`。选择器不要改成只匹配倍速。
- 这条旅程会写 profile。成功时步长和预设会恢复；失败时先 `cleanup`。
