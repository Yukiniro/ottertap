# 从音量药丸打开弹出面板

展开页面边缘的音量药丸后，倍速预设下面有 `Open panel`。点一下会打开工具栏上的完整弹出面板，标题是药丸正在控制的那一条媒体。工具栏按钮还在，弹出页地址仍是 `popup.html`。

浏览器拒绝代开时（窗口不在前台、弹层已经开着、或这版浏览器没有 `action.openPopup`），按钮下面出现 `Click the toolbar icon`。中文是「请点工具栏图标」。不再改工具栏弹出页，也不去抢焦点。

## Sub-features

- 打开面板。展开后的对话框里有按钮 `Open panel`。点一下走后台的 `browser.action.openPopup`，并带上当前媒体 id。弹出面板的 `h1` 与浮动入口 `title` 里的媒体名一致。
- 降级。打不开时，同一张卡片里出现 `role="status"`，文案是 `Click the toolbar icon`。按钮还在。
- 工具栏按钮还在。`chrome.action.getPopup({})` 仍以 `/popup.html` 结尾。这一项不调用 `setPopup`。

## How to get to it (user POV)

1. 打开有视频的页面，点页面边缘的小獭。
2. 点 `Open panel`。弹出面板出现，标题是页面上正在控制的那条媒体。
3. 如果浏览器不让扩展自己打开弹出面板，卡片上会写 `Click the toolbar icon`。这时点工具栏图标仍然能打开原来的面板。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-open-panel
```

会话已经 `launch` 且 `doctor` 通过之后跑。旅程用夹具 `/feed`（`Feed preview` 和 `Main player`）。不改 profile。

1. 确认工具栏弹出页仍是 `popup.html`。
2. 打开 `/feed`，等浮动入口的 `title` 以 `Feed preview` 或 `Main player` 开头。展开药丸。`Open panel` 可见，还没有 `Click the toolbar icon`。
3. 点 `Open panel`。弹出面板的 `h1` 等于第 2 步的媒体名，或者卡片上出现 `Click the toolbar icon`。两条里必须有一条。打开之后工具栏弹出页仍是 `popup.html`。

成功时 `state.json` 的 `ok` 为 `true`，`mode` 是 `opened` 或 `hint`。证据写到 `/opt/cursor/artifacts/verify-ottertap/floating-open-panel/`：`pill-button.png`、`fixture.png`，打开时还有 `popup-selected.png`，降级时还有 `pill-hint.png`，以及 `state.json`、`transcript.txt`。

假浏览器里的代开、失败、非内容脚本拒绝，以及打开前锁住当前媒体，由 `tests/open-popup-background.test.ts` 覆盖。按钮和「请点工具栏图标」由 `tests/floating-open-panel.test.ts` 覆盖。

## Gotchas

- 内容脚本不能直接调用 `action.openPopup`。点击经后台转发。Chrome 127 起才能由扩展自己打开弹出面板；再早的版本、以及窗口不在前台或弹层已经开着时，调用会拒绝。
- 拒绝时不调用 `windows.update` 去抢焦点，也不调用 `setPopup` 把面板改成标签页。地址栏打开 `popup.html` 会让弹出面板变成活动标签，读不到网页上的媒体。
- `/feed` 上两条媒体都暂停时，药丸绑定的是快照里的第一条。弹出面板要对上入口 `title` 里的名字，而不是另一条。
- 第二次 `openPopup` 常常失败。这一程只点一次。
