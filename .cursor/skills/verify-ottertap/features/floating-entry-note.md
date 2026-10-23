# 浮动入口旁注

不展开音量药丸，也能在浮动入口旁边看到当前音量或倍速。默认优先音量。音量是 100% 且倍速不是 1× 时，旁注改成倍速。设置里可以改成始终显示倍速，或关掉旁注。

半隐藏时旁注在朝向页面的一侧，整段都在视口里。悬停让入口完全露出时，旁注跟着走，仍然完整。展开药丸时旁注让开，避免挡在音量条和倍速卡片上；收起后继续显示。

超过 100% 的音量沿用音量药丸里的强调色（`--volume-boost`）。旁注正文带 `%` 或 `×`。无障碍名是 `On-page volume {percent}%` 或 `On-page speed {rate}×`。工具栏角标只在超过 100% 时出现，正文是不带百分号的数字，标题是 `Volume is boosted to {percent}%`。两套文案不要混用。

这一项存在 `ottertap-settings-v1.floatingNote`，取值 `volume`（默认）、`rate`、`off`。缺这一项或不是这三个值时按 `volume`。它是全局设置，不是按站点记住的。

## Sub-features

- 旁注。`role="status"`，`aria-live="off"`，名字以 `On-page ` 开头。正文是 `100%` 或 `1.25×` 这种。`data-kind` 是 `volume` 或 `rate`。只有显示超过 100% 的音量时 `data-boost="true"`。
- 优先音量。设置组名 `Entry note`，按钮 `Prefer volume` / `Prefer speed` / `Hide`。默认 `Prefer volume` 按下。说明里写明这和工具栏超过 100% 的角标不是一回事。
- 优先倍速。始终显示倍速，包括 1×，也不使用音量强调色。
- 关闭。旁注从页面上消失，浮动入口还在，药丸仍可展开。

## How to get to it (user POV)

1. 打开有视频的页面，看页面边缘半隐藏的小獭。旁边已经写着当前音量。
2. 把倍速调离 1×，音量仍是 100% 时，旁边改成倍速。音量离开 100% 后回到百分比。
3. 在设置页「Floating controller」里改成优先倍速，或关闭。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-entry-note
```

会话已经 `launch` 且 `doctor` 通过之后跑。旅程用夹具 `/keys`。它会改 `floatingNote`，成功结束时改回 `volume`。中途失败要 `cleanup` 再 `launch`。

1. 打开 `/keys`，不展开药丸。旁注是 `On-page volume 100%`，正文 `100%`。入口 `data-revealed="false"`，旁注的盒子在视口内。
2. 悬停入口，`data-revealed="true"`，旁注仍是 `100%` 且仍在视口内。移开后回到半隐藏。
3. `Alt+.` 到 1.25×。药丸仍收起，旁注变成 `On-page speed 1.25×`。`Alt+,` 回到 1×，旁注回到 `100%`。
4. `Alt+滚轮` 把音量调到约 90%。收起自动打开的药丸后，旁注是 `On-page volume 90%`。再加快到 1.25×，旁注仍是 `90%`。
5. 音量回到 100% 时旁注改回倍速。再向上一格到 110%。旁注是 `On-page volume 110%`，`data-boost="true"`，正文带 `%`。工具栏角标正文是 `110`，标题是 `Volume is boosted to 110%`。
6. 设置页把 `Entry note` 改成 `Prefer speed`。旁注变成 `On-page speed 1.25×`，`data-boost="false"`。再点 `Hide`，旁注消失。点回 `Prefer volume`，旁注回到 `On-page volume 110%`。`sitePrefs` 仍为空。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/floating-entry-note/`：`half-hidden.png`、`hover.png`、`speed.png`、`volume.png`、`boost.png`、`settings-volume.png`、`settings-rate.png`、`prefer-speed.png`、`settings-off.png`、`hidden.png`、`state.json`、`transcript.txt`。

选择、100% 例外、强调色和设置写入由 `tests/floating-note.test.ts` 覆盖。工具栏角标的数字规则仍由 `tests/volume-badge.test.ts` 覆盖。

## Gotchas

- 页内音量滚轮会按原来的行为展开药丸。要在收起状态下读旁注，先点页面空白让药丸收起。
- 倍速提示也是 `role="status"`，名字是 `Speed 1.25×`。旁注的名字以 `On-page ` 开头。
- 旁注无障碍名不要写成 `Volume is boosted to …`。那句是工具栏标题。
- 这一程会写 profile。成功时 `floatingNote` 回到 `volume`。失败时先 `cleanup`。
