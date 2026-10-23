# 同键：短按跳进度、长按临时加速

设置页「Playback」里，`Hold for a temporary speed` 打开之后，才可以打开 `Short press skips, hold speeds up`（`#settings-hold-skip`）。默认关闭，开关在按住临时加速关掉时不可用。

打开后，单键模式里的快进和快退键（`J` / `←`、`L` / `→`）按按下的时长区分：

- 短按（不到 300ms）：仍按当前步长跳一次。按下时不跳，松手才跳。
- 按住满 300ms：进入旁边的临时倍速。松开后恢复按住前的倍速，不再额外跳一段。
- `Alt + Shift + .` 和单键 `S` 仍是立刻按住加速，和这条并存。

临时倍速只写当前 `playbackRate`。不写入「记住此站点」，不改 `defaultRate`。输入框、文本域和可编辑区域里不触发。关闭时，快进和快退仍是按下就跳，包括按住时的连跳。

## Sub-features

- 开关。`#playback` 里的 `Short press skips, hold speeds up`。按住临时加速关闭时 `disabled`，`aria-checked` 默认 `false`。
- 短按。夹具暂停在 60 秒、1×。按下 `L` 的前 80ms 进度和倍速都不变；松开后到 70 秒，倍速仍是 1×，没有 `Temporary speed` 提示。`J` 短按回到 50 秒。
- 长按。同一起点按住 `L`，倍速到临时 `2×`，进度仍在 60 秒附近，提示为 `Temporary speed 2×`。松开后回到 1×，进度仍不跳。`→` 同样。
- 关闭时不变。同键开关关着、单键模式开着时，按下 `L` 立刻从 60 秒到 70 秒。
- 独立键仍在。同键开着时，按住 `Alt+Shift+.` 仍立刻到临时倍速，松开还原。
- 不污染记忆。上述操作前后 `defaultRate` 仍空，`sitePrefs` 没有这个夹具站的倍速。
- 输入框。`/keys` 上聚焦 `Field` 再按住 `L`，进度和倍速都不变。

## How to get to it (user POV)

1. 打开 `chrome-extension://<extensionId>/options.html#playback`。
2. 打开 `Hold for a temporary speed`，再打开 `Short press skips, hold speeds up`。
3. 在「Keyboard shortcuts」打开 `Single-key mode`。
4. 打开有视频的网页，点页面空白处。点一下 `L` 跳一段；按住 `L` 则加速，松手后速度回来，不再多跳。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive hold-skip-combo
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile，同一会话只能跑一次。旅程用夹具 `/long` 和 `/keys`：

1. 设置页确认按住临时加速关闭，同键开关关闭且不可用。截 `settings-before.png`。存储里 `holdSkip` 不为 `true`，`defaultRate` 为空。
2. 打开按住临时加速和单键模式，同键开关仍关闭。打开 `/long`，暂停在 60 秒、1×。按下 `L` 立刻到 70 秒，倍速仍是 1×。
3. 打开同键开关。截 `settings-after.png`。存储里 `holdSkip === true`、`holdBoost === true`、`defaultRate == null`。
4. 重新加载夹具，仍暂停在 60 秒。短按 `L`：按下 80ms 内进度和倍速不变，松开到 70 秒。截 `fixture-tap.png`。
5. 回到 60 秒、1×。按住 `L` 到临时 2×，进度仍约 60 秒，提示为 `Temporary speed 2×`。截 `fixture-hold.png`。松开回到 1×，进度仍约 60 秒，提示消失。截 `fixture-release.png`。`sitePrefs` 仍没有这个站的倍速。
6. 短按 `J` 到 50 秒。按住 `→` 到 2× 且进度不动，松开回到 1× 且进度仍不动。
7. 按住 `Alt+Shift+.` 立刻到 2×，松开回到 1×。
8. 打开 `/keys`，聚焦 `Field`，按住 `L`，进度和倍速不变。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/hold-skip-combo/`：`settings-before.png`、`settings-after.png`、`fixture-tap.png`、`fixture-hold.png`、`fixture-release.png`、`state.json`、`transcript.txt`。

归一化、阈值和键位由 `tests/hold-skip-combo.test.ts` 覆盖。按住本身不写存储仍由 `tests/hold-boost-background.test.ts` 覆盖，这条不另起后台状态。

## Gotchas

- 阈值是 300ms。短按断言要停在 80ms 左右再松开，长按要等倍速变成临时档，不要用固定的按键重复间隔。
- 松开认物理键。先松开别的修饰键再松开 `L` 或方向键，也要还原，并且不再跳。
- 视频要暂停再量进度，否则播放本身会把 `currentTime` 往前推，分不清有没有多跳一段。
- 提示在开放 shadow root 里，文案来自 `holdRateHint`。乘号是 `×`。
- 浮动入口上的方向键仍归入口移动，不进这条。
- 这一程会打开单键模式和按住临时加速。用完 `cleanup` 再 `launch`。
