# 按住临时加速

设置页「Playback」的 `Hold for a temporary speed`（`#settings-hold-boost`）默认关闭。打开后，媒体页按住 `Alt+Shift+.` 立刻把当前媒体设成旁边的 `Temporary speed`（默认 `2×`，与默认倍速同一列 0.25 档），并显示 `Temporary speed {rate}×`。松开后恢复按住前的倍速。单键模式另外可以用 `S`。

临时倍速只写当前 `playbackRate`。不写入「记住此站点」，不改 `defaultRate`。输入框、文本域和可编辑区域里不触发。锁定倍速开着时，按住期间用临时值；松开回到按下前的锁定目标，而不是站点刚改过的瞬时值。

关闭时，`Alt+Shift+.` 仍和原来一样按一下步进，不会停在临时档直到松手。

## Sub-features

- 开关。`#playback` 里的 `Hold for a temporary speed`，`aria-checked` 默认 `false`。说明里写明 `Alt + Shift + .` 和单键 `S`。
- 档位。同一节的 `Temporary speed`（`h3#hold-boost-rate-label` 给 `role="group"` 命名）。按钮文案与默认倍速相同，例如 `2×`、`1.5×`。默认按下 `2×`。
- 按住与松开。夹具页焦点不在输入框时，按下 `Alt+Shift+Period`，`#media.playbackRate` 变为所选档，状态文案是 `Temporary speed 1.5×` 这种。松开 `Period` 后回到按下前的倍速，提示消失。
- 不污染记忆。按住前后 `ottertap-settings-v1` 的 `defaultRate` 和 `sitePrefs` 不变。
- 输入框。`/keys` 上聚焦 `Field` 再按住，倍速不变。
- 锁定。锁定开着、站点记忆是 2× 时，把倍速改成 1 会被写回 2×；按住临时档，松开仍回到 2×。

## How to get to it (user POV)

1. 打开 `chrome-extension://<extensionId>/options.html#playback`。
2. 打开 `Hold for a temporary speed`，临时档留在 `2×` 或改成别的档。
3. 打开有视频的网页，点页面空白处，按住 `Alt+Shift+.`。松手后速度回到按住之前。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive hold-boost
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile，同一会话只能跑一次。旅程用夹具 `/video` 和 `/keys`：

1. 设置页确认开关关闭、`Temporary speed` 按下 `2×`。截图。`Default speed` 仍是 `Follow the page`。
2. 打开 `/video`。按一次 `Alt+Shift+Period` 再松开。倍速约 1.25，没有 `Temporary speed` 提示。截图。
3. 打开开关，把临时档改成 `1.5×`。截图。存储里 `holdBoost === true`、`holdBoostRate === 1.5`、`defaultRate == null`。
4. 把夹具倍速设成 1，按住 `Alt+Shift+Period`。倍速约 1.5，提示为 `Temporary speed 1.5×`。截图。松开后倍速约 1，提示消失。`sitePrefs` 仍为空。
5. 写入站点记忆 2× 和默认倍速 1.25×，重新加载。倍速约 2。再按住又松开，回到约 2。存储里的站点倍速仍是 2，默认倍速仍是 1.25。
6. 打开锁定。把倍速改成 1，等它回到约 2。按住到 1.5×，松开回到约 2。
7. 打开 `/keys`，聚焦 `Field`，按住组合键，倍速不变。
8. 打开单键模式，在夹具空白处按住 `S`，倍速到 1.5×，松开回到约 2。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/hold-boost/`：`settings-off.png`、`fixture-off.png`、`settings-on.png`、`fixture-hold.png`、`fixture-release.png`、`state.json`、`transcript.txt`。

归一化、键位和锁定共存由 `tests/hold-boost.test.ts` 覆盖。「不写存储」由 `tests/hold-boost-background.test.ts` 覆盖。

## Gotchas

- 关闭时 `Alt+Shift+.` 仍会步进，因为 `>` 本来就是加速键。只有开关打开后，这一组才变成按住临时档。
- 松开要认物理键 `Period` 或 `KeyS`。先松开 Shift 再松开 `.` 也要还原。
- 提示在开放 shadow root 里，文案来自 `holdRateHint`。乘号是 `×`。
- 这一程会记住 `media.ottertap.test` 并打开单键模式。用完 `cleanup` 再 `launch`。
