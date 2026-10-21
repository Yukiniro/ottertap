# 弹出面板播放控制

工具栏上的小獭 OtterTap 打开 400px 宽的弹出面板，控制当前标签里的视频或音频：播放、暂停、按设置里的步长进退（默认 10 秒）、拖动进度，以及画中画。

## Sub-features

- 播放 / 暂停。按钮无障碍名在 `Play` 和 `Pause` 之间切换，面板状态在 `Video · Paused` 与 `Video · Playing` 之间切换。
- 后退、前进。按钮名带上当前步长，默认是 `Back 10 seconds` 和 `Forward 10 seconds`。媒体不可 seek 时这两个按钮禁用。
- 进度条。滑块名是 `Seek`，松手后把 `currentTime` 设到提交的位置。
- 画中画。视频上按钮名是 `Picture-in-picture`；音频上禁用，并出现 `Audio can't use picture-in-picture.`

脚本化证据只覆盖播放 / 暂停。进退、拖动进度和画中画用上面的名字在同一个弹出面板里点。默认步长下，结束状态分别是 `currentTime` 变化约 10 秒、滑块 `aria-valuenow` 接近目标秒数、以及按钮变为 `Exit picture-in-picture`。步长改成别的档位时，进度变化和按钮名里的秒数跟着变。站点禁用画中画时按钮保持禁用，提示是 `This site has turned off picture-in-picture.`（`e2e/smoke.spec.ts` 的画中画测试已经覆盖禁用原因）。

## How to get to it (user POV)

1. 安装构建产物 `.output/chrome-mv3`。
2. 打开一个有视频的网页。验证夹具是 `https://media.ottertap.test/video`：循环静音视频，名字 `Fixture video`。
3. 点击工具栏里的小獭 OtterTap。面板标题是媒体名，副标题形如 `Video · Paused`。

## Driving it with Playwright

会话已经 `launch` 并且 `doctor` 通过之后：

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive popup-playback
```

助手在同一个持久化上下文里。夹具页用 Playwright；弹出面板用 CDP，因为 `launchPersistentContext` 不会把 `chrome.action.openPopup()` 打开的窗口收成 `Page`（`e2e/smoke.spec.ts` 的 `readActionPopup` 同样如此）。

1. `page.goto('https://media.ottertap.test/video')`，等到 `getByRole('button', { name: /volume pill/i })` 可见，并且 `#media.readyState >= 1`。
2. `fixture.bringToFront()`，再在 service worker 里 `chrome.action.openPopup()`。
3. 在夹具页的 CDP 会话里 `Target.getTargets`，找到 `type === 'page'` 且 URL 以 `/popup.html` 结尾的 target，`Target.attachToTarget` 且 `flatten: false`。
4. 截 `fixture-ready.png`（Playwright）和 `popup-paused.png`（`Page.captureScreenshot`）。此时存在 `[aria-label="Media controls"]`，`h1` 是 `Fixture video`，播放按钮的 `aria-label` 精确为 `Play`，状态文案精确为 `Video · Paused`，`#media.paused === true`。
5. 在弹出面板文档里对 `aria-label="Play"` 的按钮调用 `click()`。按钮变为 `Pause`，文案变为 `Video · Playing`，没有 `[role="alert"]`，`#media.paused === false`，并且 `currentTime` 至少再前进 0.05 秒。截 `popup-playing.png` 和 `fixture-playing.png`。
6. 对 `aria-label="Pause"` 调用 `click()`。回到 `Play` / `Video · Paused` / `paused === true`。再等 400ms，`currentTime` 增加不超过 0.25 秒。

成功时 `state.json` 的 `ok` 为 `true`。

## Gotchas

- 用地址栏打开 `chrome-extension://<id>/popup.html` 会让弹出面板变成活动标签，面板读不到夹具页上的视频。必须 `openPopup()`，并且夹具页在前台。
- 选择器是英语。`doctor` 若报告语言不是 `en` 开头，先停掉会话再按 `SKILL.md` 的 launch 参数重开。
- 不循环的短媒体播完会自己变成暂停。夹具视频带 `loop`，长度约 1 秒。
- 播放被拒绝时面板上会出现 `alert`，视频保持暂停。这是失败，不要改断言。
- 弹出面板点外面或按 Escape 会关掉。`click()` 要打在面板文档里的按钮上。
- 浮动入口在网页的开放 shadow root 里，Playwright `getByRole` 能穿透。弹出面板不是 Playwright `Page`，也不在 shadow root 里；按上面的 aria-label 在 CDP 里点，不要对弹出面板调用 `getByRole`。
