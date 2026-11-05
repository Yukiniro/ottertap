# 不自动画中画的站点

在某些域名上关掉全部自动画中画：切走自动进入（`pip-auto-hide.md`）、滚出自动进入（`pip-auto-scroll.md`）、回来自动退出（`pip-auto-exit.md`）都不起作用。名单存在 `ottertap-settings-v1.autoPipExcludedSites`，不是新的顶层存储键；一个域名包含它的子域名。手动进出画中画（弹出面板、音量药丸、页内键、扩展命令）照常可用。

判断用标签的地址（内容脚本拿到的 `pageUrl`），和网站规则、弹出面板显示的 host 一致，所以嵌在别站里的播放器跟着所在页面走。它和「Site rules」（`siteMode` / `sites`）、「Sites without the floating button」（`floatingHiddenSites`）是三张独立名单，互不写入。名单为空时行为与以前完全一样。

## Sub-features

- 面板一键加入。工具栏弹出面板媒体卡片里、host 旁边的画中画加斜杠按钮 `No auto picture-in-picture on this site`（`aria-pressed`）。只在本站启用了小獭、且 `autoPipOnHide` 或 `autoPipOnScroll` 打开时出现；本站已在名单里时即使开关都关也出现，方便撤销。按下只写当前主机名；再点撤销，会连父域名条目一起去掉。它放在已有的 host 行里，弹出面板不会因此变高。
- 自动进入不再发生。名单里的站点切走标签、滚走主播放器都不进画中画，也不出提示。内容脚本给三个模块的 `enabled()` 统一套上 `allowsAutoPip(pageUrl, settings)`，名单变化时 `sync()` 会解开 Media Session 的 `enterpictureinpicture` 处理。
- 自动退出也不再发生。自动进入后再把本站加入名单，滚回来或回到标签时画中画留着，要自己关。
- 手动照常。名单里的站点从音量药丸手动进出画中画仍然成功。
- 其他站点。另一个域名上的自动进出照常。
- 设置页名单。`#playback` 三个自动开关下面的 `Sites without automatic picture-in-picture`，有 `Filter sites without auto picture-in-picture` 筛选框（含 `Current site`）、`No sites match.`，每条有 `Allow automatic picture-in-picture on {site} again`。空时写 `No sites yet. While an automatic switch is on, …`。
- 备份。导出的 JSON 里有 `settings.autoPipExcludedSites`；导入后名单回来。旧备份没有这一项时导入为空名单。并发保存时与另外两张名单一样按差异合并。

## How to get to it (user POV)

1. 设置页「Playback」打开任一自动进入画中画的开关。
2. 打开有视频的网页，点工具栏图标，在媒体卡片的站点名旁点画中画加斜杠的按钮。
3. 想恢复时，在弹出面板再点一下这个按钮；或在设置页 `Sites without automatic picture-in-picture` 里点该站点右侧的 ×。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-excluded-sites
```

和另外三条自动画中画旅程一样，另起一个不带 Playwright 默认覆盖的 Chromium（`launchPlainBrowser`），读状态和滚动都走不带手势的 CDP，见 `../SKILL.md` 的硬规则 1。夹具在 `media.ottertap.test`，对照站点 `https://elsewhere.test/video` 由这个浏览器的 `context.route` 拦截。

1. 设置页 `#playback` 名单为空，说明里有 `separate from Site rules and from Sites without the floating button`。截图。
2. 三个开关都关时，弹出面板里没有 `No auto picture-in-picture on this site`。截图。
3. 打开三个自动开关。`/video` 切走自动进入，回来自动退出，作为对照。
4. 弹出面板点该按钮，变为按下。截图。存储里 `autoPipExcludedSites` 是 `["media.ottertap.test"]`，`floatingHiddenSites`、`siteMode`、`sites` 不变。
5. 冷却过后切走标签，不进画中画，视频仍在播。截图。
6. `/feed` 滚走主播放器，不进画中画。截图。
7. 从药丸 `Picture-in-picture` 手动进入、`Exit picture-in-picture` 退出都成功。截图药丸。
8. 弹出面板撤销，`/feed` 滚走自动进入；画中画开着时再加入名单，滚回播放器等 1.5 秒仍在画中画。截图。
9. `https://elsewhere.test/video` 切走自动进入，回来自动退出。截图。
10. 设置页名单有这个 host；筛选 `nothing-here` 出现无匹配，筛选 `media.ottertap` 回来。截图。`#backup` 导出，`export.json` 的 `settings.autoPipExcludedSites` 是 `["media.ottertap.test"]`。点 `Allow automatic picture-in-picture on media.ottertap.test again`，名单变空。导入刚才的文件，名单回来。
11. 弹出面板撤销，截图；本站切走再次自动进入、回来自动退出。
12. 关掉三个开关。名单为空、`sitePrefs` 为空、`unknownStorageKeys` 为空，权限仍只有 `storage`。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/pip-auto-excluded-sites/`：`settings-empty.png`、`popup-switches-off.png`、`popup-excluded.png`、`fixture-hide-skipped.png`、`fixture-scroll-skipped.png`、`pill-manual.png`、`popup-included.png`、`popup-excluded-while-open.png`、`fixture-exit-skipped.png`、`fixture-elsewhere.png`、`settings-listed.png`、`export.json`、`popup-restored.png`、`state.json`、`transcript.txt`。

单元测试在 `tests/auto-pip-excluded-sites.test.ts`。
