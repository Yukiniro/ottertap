# 1× 与之前的倍速来回切换

页内 `Alt+0` 和扩展命令 `rate-reset` 在 1× 与本页上一次非 1× 倍速之间来回切。单键模式开启时，`Alt+0` 仍然是这一个键。记住的倍速只在当前文档的内容脚本内存里，刷新或换页就没了。

## Sub-features

- 当前不是 1×：按下后变成 1×，并记住按下前的倍速。页面提示用 `Speed {rate}×`，乘号是 `×`。
- 当前是 1× 且本页记过：按下后切回那个倍速，提示显示实际生效的值。
- 当前是 1× 且没记过：`playbackRate` 保持 1。
- `Alt+.` / `Alt+,`、弹出面板预设、或直接改 `playbackRate`（站点菜单）之后再重置，记住的是最后一次非 1×。站点在两次 snapshot 之间把倍速改到非 1× 再改回 1× 时也一样，记住的是这次非 1×，不是更早的值。锁定倍速关着时同样成立。
- 设置里的「Lock playback speed」开着时，来回切换会把锁定目标改成刚写入的倍速。站点再改回去，会被写回新目标，而不是切换前的旧目标。
- 设置页快捷键说明：扩展命令是 `Toggle between 1× and the previous speed`，页内 `Alt + 0` 是 `Back to 1×, press again to restore`。

## How to get to it (user POV)

1. 打开有视频的页面，焦点放在页面空白处。
2. 按 `Alt+.` 加快，再按 `Alt+0` 回到 1×，再按一次 `Alt+0` 回到刚才的倍速。
3. 或者打开弹出面板点一个预设，再按两次 `Alt+0`。

## Driving it with Playwright

回归：

```bash
pnpm exec playwright test e2e/smoke.spec.ts -g "1× 与之前的倍速"
```

扩展命令 `rate-reset` 没有默认快捷键，页内按不出来。它和 `Alt+0` 走同一条 `applyRate`，由 `tests/rate-recall-background.test.ts` 触发 `commands.onCommand`。

夹具是 `/keys`。断言读 `#media.playbackRate`，并看页面上的 `Speed 1.5×` 这种状态文案。

## Gotchas

- 提示文案在开放 shadow root 里，`getByText('Speed 1.5×')` 能穿透。乘号是 `×`（U+00D7）。`Speed 1×` 不是 `Speed 1.5×` 的子串。
- 已经是 1× 且没记过时，背景仍会把当前倍速再提示一次，但 `playbackRate` 不变，也不会多发一条倍速指令。
- 锁定回写大约 200ms 后才发生。断言要等 `playbackRate` 被写回，不要在站点刚改完时立刻读。
- 每个文档各自记一份。iframe 里的视频用那一帧的记忆，不用顶层页面的。
- 站点菜单的往返要在倍速已经回到 1× 之后再按 `Alt+0`。Chrome 的 `ratechange` 在当前任务之后才派发，而且事件里没有倍速；同一轮脚本里先写成 2 再写成 1，两次事件读到的都是 1×。`1× 与之前的倍速来回切换` 的末尾要等 2× 的 `ratechange` 发生后再写回 1，然后 `Alt+0` 应变成 2×，而不是更早记住的 1.75×。这中间不打开弹出面板，也不靠下一次 snapshot。单元测试 `锁定关闭时，两次快照之间改到非 1× 再改回 1×` 在同步派发的 `ratechange` 之间不调用 `snapshot()`。
