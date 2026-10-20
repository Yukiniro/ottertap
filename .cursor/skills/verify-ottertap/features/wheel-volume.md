# 滚轮与 Alt 快捷键音量

在网页上改当前媒体的音量：光标停在视频上时直接滚轮（默认开启），或按住 Alt 再滚轮。浮动入口展开后的音量药丸用竖向滑块做同一件事。超过 100% 时元素音量停在 1，多出来的部分走 Web Audio 增益，工具栏角标显示百分数。

## Sub-features

- 悬停滚轮。设置项文案是 `Scroll over a video to change volume`，开关 id 是 `settings-hover-wheel`。默认开启。光标在视频上时，裸滚轮改音量且页面不滚动；光标不在视频上时只滚动页面。
- Alt + 滚轮。纵向或横向滚轮都能改音量。向上（`deltaY` 为负）加音量，向下减音量。一格在本仓库的 Chromium 里是像素模式 `delta` 100，对应 10 个百分点。
- 音量药丸。浮动入口的无障碍名匹配 `/volume pill/i`。展开后滑块名是 `Volume`，`aria-valuenow` 是百分数，`max` 在同源媒体上是 200。静音按钮是 `Mute` / `Unmute`。
- 音量放大。从 95% 再向上先停在 100%，再向上到 110%。媒体元素 `volume` 不超过 1。角标文本变为 `110`，标题是 `Volume is boosted to 110%`。回到 100% 或媒体所在 frame 消失后角标清空。

## How to get to it (user POV)

1. 打开有视频的页面。回归夹具是 `https://media.ottertap.test/`（音频）和 `/keys`（带尺寸的视频，页面下方还有输入框）。
2. 把光标移到视频上滚轮，或按住 Alt 在页面任意位置滚轮。
3. 要点药丸时，先悬停右侧半隐藏的水獭按钮，再点击，直到名叫 `Volume` 的滑块出现。

验证会话目前只拦截 `/video`。要在会话里走这条路径，先把 `e2e/smoke.spec.ts` 的 `/` 与 `/keys` 文档加进 `session.mjs` 的 `route`，再按下面的步骤点。不要为了少写夹具而改掉「不在视频上必须滚动页面」这一条。

## Driving it with Playwright

回归（不写证据目录）：

```bash
pnpm exec playwright test e2e/smoke.spec.ts -g "默认悬停在视频上直接滚轮调音量"
pnpm exec playwright test e2e/smoke.spec.ts -g "Alt\\+滚轮向上从 95%"
```

用户路径上的把手：

1. 打开 `/keys`，等到浮动入口，`#media` 的 `readyState >= 1`。把 `volume` 设成观察起点时只做前置，动作本身必须是滚轮或滑块。
2. 悬停滚轮：`mouse.move` 到 `#media` 的中心，`mouse.wheel(0, -100)`。结束状态是元素音量约 0.6（从 0.5 起），`window.scrollY` 仍是 0。再把光标移到视频下方，`mouse.wheel(0, 100)`，`scrollY > 0`，音量不变。
3. Alt+滚轮：`keyboard.down('Alt')`，`mouse.wheel(0, -100)` 或 `(100, 0)`，再 `keyboard.up('Alt')`。音量按 10 个百分点变化。从 0.95 向上先到 1.0 且滑块显示 100，再向上滑块显示 110、元素音量仍约为 1，角标文本为 `110`。
4. 药丸：点击 `/volume pill/i`，拖 `[data-slot="slider-thumb"]`。拖到 98% 附近应吸附成 100（`e2e/smoke.spec.ts` 第一条）。读 `getByRole('slider', { name: 'Volume' })` 的 `aria-valuenow`。
5. 关掉悬停滚轮：打开 `options.html#shortcuts`，把 `#settings-hover-wheel` 拨到未选中，刷新夹具页。裸滚轮不再改音量，Alt+滚轮仍然改。

证据要同时有动作前和动作后的滑块或角标截图，以及 `#media.volume`。角标用 service worker 里的 `chrome.action.getBadgeText({ tabId })` 读取，这是浏览器自己的工具栏状态。

## Gotchas

- 默认 `hoverWheel: true`。光标在视频上时不按 Alt 也会改音量。测「普通滚动」必须把光标移出视频。
- 输入框不会吃掉 Alt+滚轮。`Alt+M` 这种键在输入框里才失效。见倍速那一条。
- 跨域且没有 CORS 的媒体不能超过 100%。滑块 `max` 停在 100，强行再加会失败。
- 横向滚轮只有在 Alt 按住时才调音量。断言前看页面收到的 `deltaY === 0` 且 `deltaX !== 0`，避免把纵向滚轮误判成横向。
- 会话和 `pnpm e2e` 可以各用各的 profile 同时开，但两边都加载 `.output/chrome-mv3`。跑任何一边时都不要 `pnpm build`。
