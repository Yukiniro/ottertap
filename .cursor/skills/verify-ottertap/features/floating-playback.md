# 浮动药丸里的播放和跳转

展开页面边缘的浮动药丸后，音量条旁边可以播放或暂停当前媒体，并按设置里的快进快退步长后退、前进各一档。步长和「步长随倍速」与弹出面板是同一套计算、同一条 `play` / `pause` / `skip` 指令。不在这里放画中画或声道。

音量滑块、静音和倍速仍在原来的位置。播放一行加在倍速卡片顶部，卡片宽度不变，所以不会比原来更往画面中间伸。

## Sub-features

- 播放 / 暂停。展开后的对话框里有 `Play` / `Pause`，精确匹配。点一下发出和弹出面板相同的 `play` 或 `pause`。直播和不可跳转时这个按钮仍可用。
- 后退 / 前进。无障碍名与弹出面板相同：默认 `Back 10 seconds` / `Forward 10 seconds`。按钮上的数字就是这个秒数。点一下 `currentTime` 变化这么多秒。秒数来自设置里的 `Skip step`。
- 步长随倍速。`Scale skip with speed` 关闭时，2× 仍跳配置步长。打开后按步长 × 当前倍速，四舍五入。2× 的 10 秒跳 20 秒，4× 限制成 30 秒，0.25× 按 0.5× 跳 5 秒。显示的倍速还在刷新时，秒数跟着已经显示的倍速走，和弹出面板的瞄准倍速一样。
- 不可用。没有可 seek 范围时（常见于直播或还没加载），两个跳转按钮 `disabled`，旁边写 `Live streams and media that can't be seeked can't jump.` 按钮的 `title` 和 `#floating-skip-hint` 是同一句。有可跳窗口的直播仍可跳，和弹出面板一样。
- 原有控件。`Volume` 滑块、`Mute` / `Unmute`、`Speed` 组的加快 / 减慢和预设都还在。这条路径不写入站点记忆。

## How to get to it (user POV)

1. 打开有视频的页面，点页面边缘的小獭。
2. 点播放，再点暂停。
3. 点后退或前进。秒数和设置里的步长一致；打开「步长随倍速」后，和弹出面板按钮上的数字一样。
4. 直播或还不能拖动进度时，后退和前进是灰的，并有一句说明。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-playback
```

会话已经 `launch` 且 `doctor` 通过之后跑。旅程用夹具 `/long` 和 `/unseekable`。它会改 `Skip step` 和 `Scale skip with speed`，成功结束时改回去。中途失败要 `cleanup` 再 `launch`，不要接在 `drive skip-step` 或 `drive skip-with-rate` 后面。

1. 打开 `/long`，展开药丸。音量滑块按下方向键后 `#media.volume` 约为 0.99。点 `Increase speed by 0.25×`，倍速约为 1.25，再点 `1× speed` 回到 1。
2. 点 `Play`，视频开始播放并且 `currentTime` 前进。点 `Pause`，停住后进度不再前进。
3. 停在 40 秒。点 `Forward 10 seconds` 到约 50 秒，再点 `Back 10 seconds` 回到约 40 秒。
4. 设置页把 `Skip step` 改成 `30s`，不刷新夹具。药丸按钮变成 `Forward 30 seconds`，从 40 秒点一下到约 70 秒。再改回 `10s`。
5. 打开 `Scale skip with speed`，在药丸里点 `2× speed`。按钮变成 `Forward 20 seconds`。从 40 秒点前进到约 60 秒。打开弹出面板，进退按钮也是 `Back 20 seconds` / `Forward 20 seconds`。
6. 打开 `/unseekable`。后退和前进禁用，说明是 `Live streams and media that can't be seeked can't jump.` 进度仍是 0。
7. 把 `Scale skip with speed` 关掉。`sitePrefs` 仍为空。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/floating-playback/`：`pill-playing.png`、`fixture-playing.png`、`pill-30.png`、`pill-20.png`、`popup-20.png`、`pill-unseekable.png`、`state.json`、`transcript.txt`。

假浏览器里的播放暂停、步长、随倍速、4× / 0.25× 边界、直播窗口和不可跳转说明由 `tests/floating-playback.test.ts` 覆盖。音量和倍速的完整路径仍由 `drive floating-speed` 和 `tests/floating-speed.test.ts` 覆盖。

## Gotchas

- `/video` 只有约 1 秒，量不出 10 秒步长。这一程用 `/long`。
- 弹出面板要用 `chrome.action.openPopup()`，不要把 `popup.html` 开成标签。
- 不可跳转的说明在开放 shadow root 里，文案来自 `skipUnavailable`。
- 有可跳窗口的直播不在夹具里。那条和 4×、0.25× 的边界在单元测试里。
- 这一程会写 profile。成功时步长回到 10 秒、随倍速关闭。失败时先 `cleanup`。
