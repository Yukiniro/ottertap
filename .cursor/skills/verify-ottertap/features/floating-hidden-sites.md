# 按站点隐藏浮动入口

只在某些域名上不显示浮动入口。名单存在 `ottertap-settings-v1.floatingHiddenSites`，一个域名包含它的子域名。名单里的站点上，工具栏弹出面板和页内快捷键照常可用，其他站点不受影响。

它和「Site rules」（`siteMode` / `sites`，整站启用或停用小獭）是两件事。隐藏浮动不会停用扩展，也不会写进 `sites`；整站停用也不会写进这份名单。全局 `Show the floating button on web pages` 仍是总开关。

## Sub-features

- 药丸一键隐藏。展开音量药丸后，`Open panel` 同一行右侧的眼睛按钮 `Hide floating on this site`。点了以后入口马上消失，页面顶部提示 `Floating button hidden on this site`，存储里多出当前 host。
- 面板按钮。工具栏弹出面板 `Floating controller` 那一行、全局开关左边的眼睛按钮 `Hide floating on this site`（`aria-pressed`）。全局浮动开着、本站启用了小獭时才出现。按下即隐藏，再点即撤销；撤销会连父域名条目一起去掉，入口才会真正回来。它和全局开关挤在同一行，弹出面板不会因此超过 600px。
- 面板与快捷键不受影响。隐藏后同一页和刷新后，`Alt+.` 仍把倍速调到 1.25×；弹出面板仍能播放、暂停。
- 其他站点。另一个域名上的入口照常出现。
- 设置页名单。`#floating` 里的 `Sites without the floating button`，逐条列出，每条有 `Show the floating button on {site} again`。空时写 `No sites yet.`。撤销后已打开的页面不刷新也能看到入口回来。
- 备份。导出的 JSON 里有 `settings.floatingHiddenSites`；导入后名单回来，已打开的页面入口随之隐藏。旧备份没有这一项时导入为空名单。

## How to get to it (user POV)

1. 打开有视频的网页，点页面边缘的浮动入口展开音量药丸。
2. 点 `Open panel` 右边的眼睛图标。入口消失，顶部提示已隐藏。
3. 想恢复时，点工具栏图标，在弹出面板 `Floating controller` 那一行再点一下眼睛按钮；或打开设置页 `Floating controller`，在 `Sites without the floating button` 里点该站点右侧的 ×。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-hidden-sites
```

会话已经 `launch` 且 `doctor` 通过之后跑。旅程会改写 profile，但成功时把名单清空、网站规则不动。夹具 `/video` 在 `media.ottertap.test`；对照站点 `https://elsewhere.test/video` 由这一程临时 `context.route` 拦截，结束时 `unroute`。

1. 设置页 `#floating` 的名单为空，说明里有 `separate from Site rules`。截图。
2. 打开 `/video`，展开药丸，看到 `Hide floating on this site` 和 `Open panel`。截图后点眼睛按钮。入口隐藏，顶部提示出现。存储里 `floatingHiddenSites` 是 `["media.ottertap.test"]`，`floating` 仍开，`siteMode` 仍是 `all`，`sites` 仍为空。截图。
3. 同一页按 `Alt+.` 到 1.25×，`Alt+0` 回 1×。刷新后再按一次仍生效，且等 1.5 秒仍没有入口。
4. 打开工具栏弹出面板。`Hide floating on this site` 眼睛按钮为按下（`aria-pressed=true`）。截图。点 `Play` 后视频播放，点 `Pause` 后暂停。
5. 打开 `https://elsewhere.test/video`，入口可见。截图。
6. 设置页 `#backup` 导出。`export.json` 里 `settings.floatingHiddenSites` 是 `["media.ottertap.test"]`。
7. 设置页 `#floating` 名单里有这个 host。截图。点 `Show the floating button on media.ottertap.test again`。名单变空，夹具页入口不刷新就回来。截图。
8. `#backup` 导入刚才的文件并 `Replace settings`。名单回来，夹具页入口隐藏。
9. 打开工具栏弹出面板，再点眼睛按钮，它抬起。截图。名单为空，入口回来。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/floating-hidden-sites/`：`settings-empty.png`、`pill-hide-button.png`、`fixture-hidden.png`、`popup-hidden.png`、`other-site.png`、`export.json`、`settings-listed.png`、`fixture-restored.png`、`popup-restored.png`、`state.json`、`transcript.txt`。

归一化、子域名匹配、撤销父域名、导入导出和三个界面入口由 `tests/floating-hidden-sites.test.ts` 覆盖。

## Gotchas

- 隐藏是整块 `aside` 不渲染，不是半透明。断言要看 shadow root 里有没有 `aside`，不要只看透明度。
- 名单按域名匹配子域名：名单里有 `example.com` 时，`www.example.com` 也隐藏。弹出面板关掉开关会把覆盖当前 host 的条目全部去掉；设置页的 × 只去掉那一条。
- 官网演示和 `pnpm preview` 不传 `hideOnSite`，药丸里没有这个按钮，避免演示入口被藏掉后找不回来。
- 全局浮动关掉时，弹出面板不显示眼睛按钮；设置页名单仍可查看和撤销。
- 弹出面板高度有 600px 上限（`e2e/smoke.spec.ts` 单媒体那条会量）。这里不要再加整行开关。
