# 弹出面板媒体列表

一页有不止一条媒体时，弹出面板列出每一条。每条有短名称、正在播放或暂停，以及是不是当前选中。点一条，播放、暂停和其余控制改到这一条。

短名称先用元素自己的标题或无障碍名，否则用地址里的文件名，再否则用 `Video 2` 这种序号。不用页面标题。满五条时，列表上方出现 `Filter media`，按短名称的子串过滤。过滤只藏起不匹配的行，不改当前选中，也不改页面上的媒体。没有匹配时显示 `No media match.`。只有一条媒体时，列表和过滤都不出现。

不读取网站的私有接口，也不做缩略图。

## Sub-features

- 单媒体。`/video` 上没有 `#popup-media`，也没有 `Filter media`。标题仍是这条媒体。
- 状态。`/feed` 上一条在播、另一条暂停时，列表里能看出谁在播，当前选中有 `aria-checked`。
- 点选。点另一条之后，面板标题换成它，播放和暂停作用在它身上，另一条的播放状态不动。
- 过滤。`/playlist` 有五条。过滤框无障碍名是 `Filter media`。输入 `beta` 后只显示 `Beta reel`，标题仍留在原来那一条，页面上仍是五条视频。输入 `zzzz` 时出现 `No media match.`。清空后五条都回来。
- 名称。五条分别是标题 `Alpha reel`、`Beta reel`、`Gamma reel`，文件名 `delta-reel`，以及没有名称时的 `Video 5`。行里不出现页面标题 `Playlist page`。

## How to get to it (user POV)

1. 打开只有一条视频的网页。弹出面板不列出媒体。
2. 打开有不止一条的网页。打开媒体列表，看谁在播、谁被选中，点另一条。
3. 打开有五条以上媒体的网页。在 `Filter media` 里输入名称的一部分，列表只剩匹配的行。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive panel-media-list
```

会话已经 `launch` 且 `doctor` 通过之后跑。它不改 profile。旅程用夹具 `/video`、`/feed` 和 `/playlist`：

1. 打开 `/video`。弹出面板没有媒体列表，也没有过滤框。标题是 `Fixture video`。截图。
2. 打开 `/feed`，两条都先暂停。面板记下当前标题后，播放另一条。标题跟上这一条。打开列表：正在播放的那一条写着 `Playing` 并且选中，另一条写着 `Paused`。截图。
3. 点回原来那一条。点 `Play` 后它开始播放，另一条仍在播放。再点 `Pause`，只有点中的这一条停下。
4. 打开 `/playlist`。列表有 `Alpha reel`、`Beta reel`、`Gamma reel`、`delta-reel`、`Video 5`，没有页面标题。过滤框在。
5. 输入 `beta`。只剩 `Beta reel`，标题仍是 `Alpha reel`，页面上仍是五条视频。截图。
6. 输入 `zzzz`。没有行，并出现 `No media match.`，标题不变。截图。
7. 清空后五条回来。点 `Beta reel` 再点 `Play`。只有 `#beta` 在播。
8. `sitePrefs` 仍是空的。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/panel-media-list/`：`popup-single.png`、`popup-rows.png`、`popup-filtered.png`、`popup-nomatch.png`、`state.json`、`transcript.txt`。

短名称的来源、四条时不出现过滤，以及过滤不改选中，由 `tests/panel-media-list.test.ts` 覆盖。

## Gotchas

- 过滤把不匹配的行留在文档里并标上 `data-filtered`，这样选中不会因为行被卸掉而丢掉。数可见行时要跳过这个属性。
- 夹具视频没有 `autoplay`。两条都暂停时，面板先选中文档顺序里的第一条。
- `/playlist` 里没有名称的那一条，面板标题会退回页面标题。列表上它显示 `Video 5`。
- 这一程不改设置。用完可以继续别的不依赖 profile 的旅程，也可以 `cleanup`。
