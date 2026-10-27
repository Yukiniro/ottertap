# 进度标记

弹出面板给当前选中的媒体留一个进度标记：设下当前时间、跳回去、清掉。三个按钮在进度条那一行的右侧，标记画在进度条上方。只在这一页、这一条媒体上有效。关掉标签或换一条新的媒体元素后，标记不在。不写入扩展存储，也不做一串标记。

直播（`duration` 为无限）和还不能 seek 的媒体上，三个按钮都禁用，进度条下写一句短说明。可 seek 时，时间写在 `#progress-mark-status` 里给辅助技术读，不另占一行。已有的快进快退和逐帧照常可用。

## Sub-features

- 设标记。可 seek 时，按钮 `Set mark` 记下当前时间。状态变成 `Mark at {time}`，进度条上方出现标记。再设一次，只保留新的那一个时间。
- 跳到标记。`Jump to mark` 把进度跳回记下的时间。没有标记时按钮禁用，进度不动。
- 清除标记。`Clear mark` 去掉这一个标记。之后跳转按钮禁用，进度条上的标记消失，状态文案清空。
- 换媒体。同一页的另一条媒体没有这条的标记。回到刚才那一条，标记还在。
- 关标签。关掉这个标签再打开，新的媒体元素没有标记。
- 不可用。直播或没有可 seek 范围时，三个按钮 `disabled`，`#progress-mark-status` 是 `Live streams and media that can't be seeked can't keep a mark.` 进度条上没有标记。
- 与现有控制并存。设了标记之后，前进一档和下一帧仍改变进度，标记停在原来的时间。跳回去仍落到那个时间。

## How to get to it (user POV)

1. 打开能拖动进度的视频，例如夹具 `/long`。
2. 打开弹出面板。进度条右侧是 `Set mark`、`Jump to mark`、`Clear mark`。还没设时，后两个是灰的。
3. 点 `Set mark`。进度条上方出现标记，旁边写着时间。把进度往前拨，再点 `Jump to mark`，回到刚才的时间。
4. 关掉弹出面板再打开，标记还在。点 `Clear mark` 之后，跳转又变灰。
5. 同一页有两条视频时，换到另一条，标记不跟着过去。
6. 直播或还不能拖动进度的媒体上，三个按钮是灰的，并有一句说明。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive progress-mark
```

会话已经 `launch` 且 `doctor` 通过之后跑。它不改设置。旅程用夹具 `/long`、`/feed` 和 `/unseekable`：

1. `/long` 暂停在 12 秒。弹出面板里 `Jump to mark` 和 `Clear mark` 禁用，没有 `[data-progress-mark]`。点 `Set mark` 后状态是 `Mark at 00:12`，标记落在进度条约 10% 处。截 `popup-set.png`。
2. 点 `Forward 10 seconds`，进度大约到 22 秒，标记和文案仍是 12 秒。截 `popup-away.png`。再点 `Next frame`，只再挪一小步，标记不变。点 `Jump to mark` 回到约 12 秒。
3. 关掉弹出面板再打开，标记还在。截 `popup-reopened.png`。点 `Clear mark` 后跳转禁用、标记消失、进度仍停在约 12 秒。再点跳转，进度不动。截 `popup-cleared.png`。
4. 关掉这个标签，新开 `/long` 并停在 12 秒。弹出面板没有标记。
5. `/feed` 上给当前选中的那一条设标记，换到另一条时没有标记，也没有改另一条的进度。换回来标记还在，跳转只把原来那一条拉回去。截 `feed-other.png`。
6. `/unseekable` 上三个按钮禁用，说明与 `markUnavailable` 一致，没有标记。逐帧和前进按钮仍禁用。点设标记不改进度。截 `unseekable-popup.png`。
7. 全程 `chrome.storage.local` 和 `chrome.storage.session` 与设标记之前一致，存储文本里没有 `"mark"`。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/progress-mark/`：`popup-set.png`、`popup-away.png`、`popup-reopened.png`、`popup-cleared.png`、`feed-other.png`、`unseekable-popup.png`、`state.json`、`transcript.txt`。

设、跳、清、换媒体和直播不设，由 `tests/progress-mark.test.ts` 覆盖。面板按钮、标记位置和禁用说明由 `tests/progress-mark-panel.test.ts` 覆盖。

## Gotchas

- 标记记在页面里的媒体元素上，不在弹出面板的 React 状态里。关掉面板再打开还能看见；关掉标签就没了。
- 夹具 `/long` 约 120 秒。12 秒的标记大约在进度条 10% 处。显示时间按整秒截断，所以 12 秒写成 `00:12`。
- 直播有可拖动窗口时也不设标记。这条在单元测试里把 `duration` 设成无限。浏览器旅程用 `/unseekable` 看同一句禁用说明。
- 这一程不改 profile。
