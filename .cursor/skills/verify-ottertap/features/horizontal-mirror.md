# 水平镜像

弹出面板可以把当前选中的视频画面左右翻转。默认关。只作用在这一条视频元素上，本页有效，不写入「记住此站点」。换到另一条媒体时，那一条默认不镜像；已经翻转过的那一条还保持翻转，直到关掉或离开页面。音频没有画面，开关不可用。不改音量、静音、倍速和进度，也不改元素原来的 `transform` 和布局盒子。

浮动药丸里没有单独的扩展位，这一版放在弹出面板播放卡片的标题右侧，避免把面板撑高。

## Sub-features

- 开关。无障碍名是 `Mirror horizontally`，角色是 `switch`。视频上默认 `aria-checked="false"`。
- 开启。当前视频的画面水平翻转（元素上的 `scale` 为 `-1 1`，并带 `data-ottertap-mirror`）。同一页的其他视频不变。
- 关闭。立刻去掉翻转，并还原开启前这个元素自己的 inline `scale`。
- 换媒体。另一条默认关。回到已经翻转的那一条，开关重新为开。
- 重新加载。新的视频元素默认不镜像，即使刚才开过，也即使「Remember this site」开着。
- 音频。开关禁用，`#mirror-hint` 为 `Audio has no picture, so it cannot be mirrored.`
- 不进站点记忆。`sitePrefs` 里不会出现镜像字段。记住的仍是音量、倍速和声道。

## How to get to it (user POV)

1. 打开带视频的页面，例如夹具 `/video`。
2. 打开弹出面板。播放卡片标题右侧就是「Mirror horizontally」。
3. 点开。画面左右对调，声音不变。再点一次恢复。
4. 同一页有多条视频时（夹具 `/feed`），用面板顶部的媒体列表换一条。新的那条开关是关的。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive horizontal-mirror
```

它会改写 profile：中途打开「Remember this site」，成功结束时关掉并忘掉 `media.ottertap.test`。同一会话只能跑一次。

1. `/video` 上开关默认关。点开后 `#media` 水平翻转，音量、倍速、进度和布局盒子不变，`transform` 也不变。`sitePrefs` 没有镜像字段。截图。再点关闭，画面恢复。
2. 再次点开后重新加载 `/video`。新页面默认不镜像。
3. `/feed` 上只翻转当前选中的那一条。换到另一条，开关为关，那一条的画面不翻转，刚才那一条仍翻转。刷新后两条都恢复。
4. `/audio` 上开关禁用，提示与 `mirrorUnavailableAudio` 一致，音频元素没有翻转，声音不变。
5. 回到 `/video`，打开「Remember this site」，再打开镜像。存储里的站点偏好没有 `mirror`。重新加载后画面和开关都是关。最后关掉「Remember this site」。

单元测试在 `tests/mirror.test.ts` 和 `tests/mirror-panel.test.ts`。`pnpm e2e` 不单独点这条开关。

## Gotchas

- 镜像记在视频元素上，不跟「当前选中」这条全局状态走。换走再换回来，已经翻转的那一条仍是翻转的。
- 用 CSS 的 `scale: -1 1`，不改 `transform`，所以页面自己的变换还在。布局盒子不变。
- 音频指令会被拒绝，不会给 `audio` 写翻转标记。
- 重新加载或换到新元素都会回到默认关。这是为了换片时不要突然镜像。
