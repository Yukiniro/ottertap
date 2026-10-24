# 滚轮与 Alt 快捷键音量

在网页上改当前媒体的音量：光标停在主播放器上时直接滚轮（默认开启），或按住 Alt 再滚轮。浮动入口展开后的音量药丸用竖向滑块做同一件事。超过 100% 时元素音量停在 1，多出来的部分走 Web Audio 增益，工具栏角标显示百分数。

## Sub-features

- 连续滚动防误触。相邻滚轮事件间隔小于 300ms 算同一次手势；从视频外开始，或调音量过程中离开原播放器后，剩余事件都留给页面。停止至少 300ms 后在主播放器上重新滚动才调音量。Alt+滚轮不受限制。回归：`pnpm exec playwright test e2e/smoke.spec.ts -g "页面连续滚动经过视频"`，固定鼠标让页面将视频滚到指针下，检查音量不变；停顿后再滚检查音量改变且页面不动。截图保存在该测试的输出目录。

- 悬停滚轮。设置项文案是 `Scroll over the main player to change volume`，开关 id 是 `settings-hover-wheel`。默认开启。光标在**主播放器**上时，裸滚轮改音量且页面不滚动。主播放器是正在有声播放的媒体（未暂停、未静音、音量大于 0）；有多个有声媒体时，已锁定的那个优先。页面上只有一个播放器、且它不是静音播放时，它就是主播放器，暂停着也可以。除此之外，裸滚轮还要求这块区域在宽和高上都至少占当前视口的三分之一（同源 iframe 用顶层视口）。列表里约五分之一视口的小卡片，即使正在有声播放、即使是页面上唯一的视频，也只滚动页面，音量不变。静音预览即使正在播放、即使被自动选中，以及其他视频、光标不在主播放器上时，同样只滚动页面。
- Alt + 滚轮。纵向或横向滚轮都能改音量。向上（`deltaY` 为负）加音量，向下减音量。一格在本仓库的 Chromium 里是像素模式 `delta` 100，对应设置里的音量步长，默认 10 个百分点。改档位见 [volume-step.md](volume-step.md)。本条旅程不改步长。
- 音量药丸。浮动入口的无障碍名匹配 `/volume pill/i`。展开后滑块名是 `Volume`，`aria-valuenow` 是百分数，`max` 在同源媒体上是 200。静音按钮是 `Mute` / `Unmute`。
- 音量放大。从 95% 再向上先停在 100%，再向上到 110%。媒体元素 `volume` 不超过 1。角标文本变为 `110`，标题是 `Volume is boosted to 110%`。回到 100% 或媒体所在 frame 消失后角标清空。

## How to get to it (user POV)

1. 打开有视频的页面。回归夹具是 `https://media.ottertap.test/`（音频）、`/keys`（640×360 的视频，页面下方还有输入框）、`/feed`（上面是静音预览，下面是主播放器，页面可以滚动）和 `/cards`（240×135 的有声小卡片，页面可以滚动）。
2. 把光标移到主播放器上滚轮，或按住 Alt 在页面任意位置滚轮。静音预览和小卡片上的裸滚轮应该滚动页面。
3. 要点药丸时，先悬停右侧半隐藏的水獭按钮，再点击，直到名叫 `Volume` 的滑块出现。

验证会话拦截 `/video`、`/keys`、`/feed` 和 `/cards`。`node .cursor/skills/verify-ottertap/scripts/session.mjs drive wheel-volume` 会走静音预览、主播放器、有声小卡片和关闭悬停后的 Alt+滚轮。`/` 仍不在会话路由里。不要为了少写夹具而改掉「不在主播放器上必须滚动页面」这一条。

## Driving it with Playwright

回归（不写证据目录）：

```bash
pnpm exec playwright test e2e/smoke.spec.ts -g "默认悬停在视频上直接滚轮调音量"
pnpm exec playwright test e2e/smoke.spec.ts -g "悬停滚轮只作用在有声主播放器"
pnpm exec playwright test e2e/smoke.spec.ts -g "列表小视频即使有声播放也不拦截"
pnpm exec playwright test e2e/smoke.spec.ts -g "Alt\\+滚轮向上从 95%"
```

用户路径上的把手：

1. 打开 `/keys`，等到浮动入口，`#media` 的 `readyState >= 1`。把 `volume` 设成观察起点时只做前置，动作本身必须是滚轮或滑块。
2. 悬停滚轮：`mouse.move` 到 `#media` 的中心，`mouse.wheel(0, -100)`。结束状态是元素音量约 0.6（从 0.5 起），`window.scrollY` 仍是 0。再把光标移到视频下方，`mouse.wheel(0, 100)`，`scrollY > 0`，音量不变。`/keys` 上只有这一个未静音的播放器，暂停时也算主播放器；它是 640×360，在 1280×720 的视口里超过三分之一。
3. 静音预览：打开 `/feed`。`#preview` 保持 `muted` 并 `play()`，`#media` 取消静音、`volume = 0.5` 并 `play()`。光标在 `#preview` 中心时 `mouse.wheel(0, 120)`，`scrollY > 0`，两个元素的音量都不变。滚回顶部后，光标在 `#media` 中心时 `mouse.wheel(0, -100)`，`#media.volume` 约 0.6，`scrollY` 仍是 0。
4. 有声小卡片：打开 `/cards`。`#card` 是 240×135，取消静音、`volume = 0.5` 并 `play()`。光标在卡片中心时 `mouse.wheel(0, 120)`，`scrollY > 0`，音量仍是 0.5。滚回顶部后按住 Alt 再 `mouse.wheel(0, -100)`，音量约 0.6，`scrollY` 仍是 0。
5. Alt+滚轮：`keyboard.down('Alt')`，`mouse.wheel(0, -100)` 或 `(100, 0)`，再 `keyboard.up('Alt')`。音量按当前步长变化，默认 10 个百分点。从 0.95 向上先到 1.0 且滑块显示 100，再向上滑块显示 110、元素音量仍约为 1，角标文本为 `110`。关着悬停滚轮时，这一步仍然成立，包括光标在静音预览上。`drive wheel-volume` 要在默认 10% 的新 profile 上跑；先跑过 `drive volume-step` 会把步长改掉。
6. 药丸：点击 `/volume pill/i`，拖 `[data-slot="slider-thumb"]`。拖到 98% 附近应吸附成 100（`e2e/smoke.spec.ts` 第一条）。读 `getByRole('slider', { name: 'Volume' })` 的 `aria-valuenow`。
7. 关掉悬停滚轮：打开 `options.html#shortcuts`，把 `#settings-hover-wheel` 拨到未选中，刷新夹具页。裸滚轮不再改音量，Alt+滚轮仍然改。

证据要同时有动作前和动作后的滑块或角标截图，以及 `#media.volume`。角标用 service worker 里的 `chrome.action.getBadgeText({ tabId })` 读取，这是浏览器自己的工具栏状态。`drive wheel-volume` 另写 `cards-before.png`（光标在有声小卡片上）和 `cards-scrolled.png`（裸滚轮之后页面已滚动、音量仍是 50%）。

## Gotchas

- 默认 `hoverWheel: true`。光标在够大的主播放器上时不按 Alt 也会改音量。测「普通滚动」要把光标移出主播放器，放在静音预览上，或放在不到视口三分之一的小卡片上。多个静音播放都不算主播放器。单独一个正在静音播放的媒体（包括 iframe 里只有它一个）也不拦截；单独一个暂停着、没静音、并且宽高都至少占视口三分之一的播放器仍拦截。小卡片上的 Alt+滚轮仍然调音量。跨域 iframe 读不到顶层视口时，用这个 frame 自己的视口。
- 输入框不会吃掉 Alt+滚轮。`Alt+M` 这种键在输入框里才失效。见倍速那一条。
- 跨域且没有 CORS 的媒体不能超过 100%。滑块 `max` 停在 100，强行再加会失败。
- 横向滚轮只有在 Alt 按住时才调音量。断言前看页面收到的 `deltaY === 0` 且 `deltaX !== 0`，避免把纵向滚轮误判成横向。
- 音量低于 25% 时，默认的更细步长会把一格收成 1%。本条旅程从 50% 或 95% 起步，仍按 10%。见 [fine-wheel.md](fine-wheel.md)。
- 会话和 `pnpm e2e` 可以各用各的 profile 同时开，但两边都加载 `.output/chrome-mv3`。跑任何一边时都不要 `pnpm build`。

## 滚轮方向

上面说的「向上加音量」是默认。设置页可以把方向改成向下增大，同一手势立刻反过来。只影响悬停滚轮和 Alt+滚轮，页面自己怎么滚不变。见 [wheel-direction.md](wheel-direction.md)。

## Shift 粗调

按住 Shift 在主播放器上滚动，或 Alt+Shift 在任意位置滚动，用「Coarse step」而不是默认的 10%。不在主播放器上、也没有按 Alt 时，Shift+滚轮仍留给页面。见 [coarse-step.md](coarse-step.md)。
