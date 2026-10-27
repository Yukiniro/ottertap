# 静音其他发声标签

弹出面板在「其他正在播放的标签页」标题旁提供 `Mute others`。点一下，把列表里的标签全部交给浏览器静音（标签喇叭变成静音）。当前标签页不在这个列表里，它的音量和播放不变。已经静音的标签再写一次也可以。不做「全部取消静音」。每一行的静音按钮和切换标签还在。

列表为空时不显示这个按钮，只留原来的「No other tabs are playing audio.」。有任何一条没静音成功，或静音后读回来仍是未静音，按钮下面出现 `Couldn't mute the other tabs.`，那一条的喇叭保持未静音。不改其他标签页里的音量滑块，也不写入记住此站点。

## Sub-features

- 静音其他。列表里至少有一条时，标题右侧是 `Mute others`。点下去之后，每一条的 `aria-pressed` 为真，无障碍名变成 `Unmute`。浏览器里这些标签的 `mutedInfo.muted` 为真。
- 当前标签。当前页的音量、静音和倍速不变，这个标签的浏览器喇叭也不被静音。
- 空列表。没有其他发声或已静音标签时，按钮不出现。
- 失败。某一条静音调用失败，或浏览器确认后它仍未静音，或确认列表读不到：出现 `Couldn't mute the other tabs.`，失败的那一条不显示成已静音。成功的那一条仍与浏览器喇叭一致。
- 逐条操作。每一行仍可单独静音或取消静音，也可切换到那个标签。
- 不进站点记忆。`sitePrefs` 不变。

## How to get to it (user POV)

1. 打开当前想听的页面，例如夹具上正在出声的 `Current show`。
2. 另开至少两个正在出声的标签，例如 `Music tab` 和 `Meeting tab`。
3. 打开弹出面板。列表标题旁是 `Mute others`。
4. 点一下。另外两个标签的喇叭变成静音，当前页声音还在。
5. 需要某一条时，用那一行的喇叭按钮单独取消静音。
6. 关掉其他发声标签后，按钮消失，只剩一句没有其他标签在播放。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive mute-other-tabs
```

它不改 profile。旅程用夹具 `/tone-current`、`/tone-music`、`/tone-meeting`。这三个页面播的是有声的循环短音，用来让浏览器把标签标成 audible。

1. 只有 `/tone-current` 时打开弹出面板。没有 `Mute others`，文案是 `No other tabs are playing audio.`。当前媒体音量约 40%，标签未静音。截 `popup-empty.png`。
2. 打开另外两个有声标签。弹出面板列出 `Music tab` 和 `Meeting tab`，`Mute others` 可点。两条都还没静音。截 `popup-ready.png`。
3. 点 `Mute others`。两条的浏览器 `mutedInfo.muted` 为真，行内按钮为 `Unmute` 且按下。没有 `[role="alert"]`。当前标签仍未静音，媒体音量仍约 40%，另外两页的 `volume` 仍是点之前的 0.7 和 0.55。`sitePrefs` 不变。截 `popup-muted.png`。
4. 点 `Music tab` 那一行的 `Unmute`。只有这一条的浏览器喇叭恢复，`Meeting tab` 仍静音，当前音量不变。
5. 关掉另外两个标签。按钮消失，空列表文案回来。截 `popup-empty-again.png`。

失败路径不在这条旅程里：无头浏览器里 `tabs.update` 静音很少失败。单元测试 `tests/mute-other-tabs.test.ts` 覆盖调用失败、浏览器没有静音、以及确认列表读不到时不把行显示成已静音。

## Gotchas

- 列表来自浏览器的 `audible` 或标签静音，不是页面里的 `video.muted`。静音其他写的是标签静音，所以网页里的音量滑块数字不变。
- 无头 Chromium 带 `--mute-audio`。静音短音频不会让标签变成 audible，所以这条旅程用有声循环短音，并等到 `chrome.tabs` 的 `audible` 为真再点按钮。
- 当前标签由打开弹出面板时的活动标签决定，不会出现在「其他」列表里。
