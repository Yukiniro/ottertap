---
name: verify-ottertap
description: 启动小獭 OtterTap（WXT + React MV3 扩展）的隔离 Chromium，用 Playwright 按真实用户路径驱动弹出面板、页内快捷键和设置页，并把截图与状态写到 /opt/cursor/artifacts/verify-ottertap/。修改扩展交互、弹出面板、内容脚本、设置页或 e2e 夹具后，需要证明行为时使用。
---

# 验证小獭 OtterTap

主界面是浏览器扩展：工具栏弹出面板（`popup.html`）、设置页（`options.html`，在新标签打开），以及注入到网页开放 shadow root 里的浮动控制器。设置在 `chrome.storage.local` 的 `ottertap-settings-v1`，没有账号，也没有数据库。空的用户目录会落到代码里的默认设置（浮动控制器开、全部网站启用、悬停滚轮开、单键模式关）。

旁边还有两个表面，本技能不驱动它们：`pnpm preview` 在 `http://127.0.0.1:4186/` 用本地演示媒体渲染同一套组件；`pnpm site:dev` 在 `http://localhost:4187/` 跑官网。预览页控制的不是网页里的真实媒体。

回归套件是 `pnpm e2e`（`e2e/smoke.spec.ts` 和 `e2e/site-demo.spec.ts`）。扩展冒烟和本技能使用同一份构建产物、同一个夹具主机 `https://media.ottertap.test`，以及同一套英语无障碍名。它不往证据目录写截图。功能地图里的选择器以那份测试和当前 UI 为准。官网演示读 `site/out/`。跑 `pnpm e2e` 之前总是先 `pnpm site:build`，与 CI 相同，不要假设 `site/out` 已在。见「跑 e2e」。

一次只驱动一个验证会话。默认会话 id 是 `current`。要并排再开一个，换 `OTTERTAP_VERIFY_ID`（小写字母、数字、连字符）；不要去连用户自己的 Chrome。

## Launch

在仓库根目录，用 Node.js 24（与 CI 一致）和 `package.json` 里的 pnpm：

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install --no-shell chromium
pnpm build
pnpm verify-build
node .cursor/skills/verify-ottertap/scripts/session.mjs launch
```

若 Chromium 因缺少系统库起不来，再跑与 CI 相同的 `pnpm exec playwright install-deps chromium`。已经能打开浏览器时不要跑它。

`launch` 会拉起一个脱离终端的会话进程。它用 Playwright 的 `chromium.launchPersistentContext` 打开全新的 `/tmp/ottertap-verify/current/profile`，加载 `.output/chrome-mv3`，参数与 `e2e/smoke.spec.ts` 相同：`channel: 'chromium'`、`headless: true`、`locale: 'en-US'`、`--lang=en-US`，并去掉默认的 `--disable-extensions` 和 `--mute-audio`。去掉静音是为了让正在出声的标签能被标成 audible。夹具页由这个上下文的 `route` 拦截，不访问外网，也没有单独的网站端口。

就绪的标准是扩展已经能用，而不是端口通了：service worker 已出现，UI 语言以 `en` 开头，版本与 `package.json` 一致，并且 `https://media.ottertap.test/video` 上能看见浮动入口。成功时进程打印一行后退出，浏览器继续留在会话进程里：

```text
ottertap-verify ready id=current pid=<pid> control=127.0.0.1:<port> extension=<id> version=1.5.0 profile=/tmp/ottertap-verify/current/profile
```

会话记在 `/tmp/ottertap-verify/current/session.json`（含控制端口和令牌）。日志在同目录的 `launch.log`。90 秒内没有这行就是失败，先看日志，再 `cleanup`。

`current` 的 pid 还活着时，再次 `launch` 会拒绝，避免两个驱动共用一个配置。上次崩溃留下的目录，只有在对应 pid 已经不在、且没有进程的命令行带上这个 profile 路径时，才会被收走。

扩展源码改过之后要重新 `pnpm build`。会话开着时不要构建，否则正在加载的文件会被换掉。

改了 `scripts/session.mjs`（或任何在 `serve` / 会话启动时加载的脚本）之后，必须先 `cleanup`，再 `launch`，然后才能 `drive` 或做验证。旅程跑在 `serve` 进程里，已经在跑的会话不会自动重载这些文件，热改不生效；只改磁盘文件就继续 `drive`，跑的仍是旧逻辑。即使扩展包没有重新构建，也要这样做。

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs cleanup
node .cursor/skills/verify-ottertap/scripts/session.mjs launch
node .cursor/skills/verify-ottertap/scripts/session.mjs drive <journey>
```

## 跑 e2e

`pnpm e2e` 会先安装 Chromium（已经安装时不会重新下载），再跑 `e2e/` 里的扩展冒烟和官网演示。官网测试在本地 HTTP 上读 `site/out/` 的静态文件；目录不在时页面是 404，断言对不上。CI（`.github/workflows/ci.yml`）在 e2e 之前固定执行 `pnpm build`、`pnpm verify-build`、`pnpm site:build`。本地按同一顺序，不要跳过 `pnpm site:build`，也不要假设 `site/out` 已经留在工作区里：

```bash
pnpm build
pnpm verify-build
pnpm site:build
pnpm e2e
```

若 Chromium 因缺少系统库起不来，再跑与 CI 相同的 `pnpm exec playwright install-deps chromium`。已经能打开浏览器时不要跑它。

扩展验证会话（`session.mjs launch`）不读 `site/out`，只要上面的 `pnpm build` 和 `pnpm verify-build`。只要接着跑 `pnpm e2e`，或只跑 `e2e/site-demo.spec.ts`，就要先 `pnpm site:build`。

## Doctor

任何异常先跑这一条。它只读：进程还在、命令行是本技能的 `session.mjs`、控制端口由该 pid 监听、service worker 属于启动时的扩展 id、`chrome.runtime.getManifest().version` 等于 `package.json`、UI 语言仍是英语、`background.js` 的 mtime 与 launch 时相同。

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs doctor
```

通过时打印 `ottertap-verify doctor ok ...`。mtime 变了就先 `cleanup`，再 `pnpm build` 和 `pnpm verify-build`，然后重新 `launch`。这条只针对扩展包变了；`session.mjs` 等驱动脚本自己被改，doctor 看不出来，见 Launch 里的 `cleanup` → `launch` 规则。不要在 doctor 里改存储或点击页面。

## 写旅程前的四条硬规则

新增或修改旅程、功能文件、happy-dom 测试之前先过一遍这四条。它们不是建议，违反就不算验证过。

### 1. 页面可见性、切走标签、切走自动进画中画

只要旅程要断言 **页面可见性**（`document.visibilityState`、`visibilitychange`）、**切走标签 / 标签隐藏** 的行为，或 **切走时自动进画中画** 之类依赖「页面变 hidden」的功能：

- 必须为这一项检查 **另起一个独立的 Chromium**，不要复用会话里的那个。
- 用 `chromium.connectOverCDP(url, { noDefaults: true })`（或等价的、关掉 Playwright 默认焦点模拟的连法）去连它。
- **禁止** 用会话里默认的 Playwright 上下文（`launchPersistentContext`）断言可见性或切走标签的行为。

原因：Playwright 默认给每个页面开焦点模拟，页面永远是 `visible`，切到别的标签也不会变 `hidden`。在这种上下文里「切走后没触发」或「切走后触发了」都不能说明真实浏览器的行为，断言要么永远测不到，要么测到的是假象。

做法要点：

- 独立浏览器用同一份构建和同一个 Chromium 可执行文件，profile 放在 `/tmp/ottertap-verify/<id>/` 下单独的目录；结束时只结束自己 spawn 的进程（命令行带这个 profile 路径）并删掉目录，不按进程名杀 Chrome。
- 读页面状态用不带用户手势的 CDP `Runtime.evaluate`。Playwright 的 `evaluate` 自带手势，会改变「浏览器是否放行」的结果。
- 现成写法：`features/pip-auto-hide.md`（对应 `drive pip-auto-hide`）。该旅程随 #190 合入；合入前以那个分支为准，不要在别处另造一套。
- 滚出视口自动进画中画同样按这一条走：`features/pip-auto-scroll.md`（对应 `drive pip-auto-scroll`）与上面共用 `launchPlainBrowser`，滚动也用不带手势的 CDP，免得 Playwright 的手势盖住浏览器的拒绝。
- 回来自动退出画中画同样按这一条走：`features/pip-auto-exit.md`（对应 `drive pip-auto-exit`）。切回标签、快速路过标签都靠独立浏览器里真实的 `visibilitychange`。
- 不自动画中画的站点同样按这一条走：`features/pip-auto-excluded-sites.md`（对应 `drive pip-auto-excluded-sites`）。名单里的站点「没有自动进入」必须在没有 Playwright 手势的浏览器里看，否则分不清是名单挡住还是浏览器拒绝。
- 自动进出的页内提示也按这一条走：`features/pip-auto-feedback.md`（对应 `drive pip-auto-feedback`）。成功字样和拒绝短句都要在切走或滚走之后读到，拒绝那一步不能带 Playwright 手势。

### 2. 新增相邻设置键或改名存储键

只要改动新增了 **与现有键相邻的设置键**（例如已有 `sleepSoonHint` 又加睡眠快捷键相关键），或 **重命名** 了扩展存储键：

- 先在相关旅程（`scripts/session.mjs`）和 `e2e/` 里 **扫一遍宽泛的存储正则断言**，例如 `/sleep/i.test(storage)`、`toMatch(/pip/i)`。
- 把它们收窄成 **精确键名**（`Object.keys(settings)` 里逐个比较），或维护一份 **允许名单**（allowlist）。
- **禁止** 只加新键、不更新这些断言。新键的名字一旦被宽泛正则命中，旧旅程会误报「存储里出现了某功能」（#177 的睡眠快捷键就撞上了旧的睡眠定时旅程）。
- 不要用 `replaceAll` 先抹掉已知键名再去匹配的写法。`sleep-timer` 和 `sleep-timer-cancel` 旅程原来的这种遗留已改成允许名单：`scripts/session.mjs` 的 `knownStorageKeys` 列出扩展会写的全部存储键，`unknownStorageKeys(worker)` 返回名单外的键。要断言「存储里没写某东西」时复用它；新增或改名存储键时同步改这份名单。

自查办法：

```bash
rg -n "/[A-Za-z|]+/i?\.test\(|toMatch\(/" .cursor/skills/verify-ottertap/scripts/session.mjs e2e
```

命中里凡是对存储文本、设置 JSON 做匹配的，都要对照这次新增或改名的键名想一遍会不会误伤。

### 3. happy-dom 测 DOM 只用标量

单元测试在 happy-dom 里看 DOM 时，用 `assert.ok(node === other)`，或对字符串、数字、布尔用 `assert.strictEqual`。

**禁止**对节点使用 `assert.equal`，也禁止 `assert.deepEqual` / `deepStrictEqual`（包括把节点放进数组再 deep equal）。失败时断言会把整棵节点序列化进错误信息，happy-dom 的节点图会把进程内存打满。

节点在不在，写成 `assert.ok(node == null)` 或 `assert.strictEqual(node == null, true)`。要比对的是文本、属性、数量，先取出标量再比较。

### 4. 名单空态要挂在容器上

设置页有多份名单，空态都用 `No sites yet.` 开头：浮动隐藏在 `#floating`，不自动画中画在 `#playback`。断言必须 scope 到容器：

```js
await settings.locator('#floating').getByText('No sites yet.', { exact: false }).waitFor({ state: 'visible' });
```

**禁止**裸 `getByText('No sites yet.')`（在页面或整份 `options.html` 上直接找）。它会命中另一份名单：strict mode 下直接失败，不严格时还会把别的空表当成这一份。无匹配句（`No sites match.`、`No hidden sites match.`、`No remembered sites match.`、`No sites remembered yet.`）同样挂在对应的 `#sites`、`#floating`、`#memory` 上。`session.mjs` 里现有旅程已经挂在这些容器上，新旅程照抄，不要改回页面级查找。

## Drive

脚本化旅程有弹出面板播放、滚轮音量（见 `features/wheel-volume.md`）、快进快退步长（见 `features/skip-step.md`）、快进快退随倍速放大（见 `features/skip-with-rate.md`）、音量调节步长（见 `features/volume-step.md`）、低音量滚轮细步长（见 `features/fine-wheel.md`）、Shift 粗调步长（见 `features/coarse-step.md`）、倍速增减步长（见 `features/rate-step.md`）、扩展命令画中画（见 `features/extension-pip.md`）、按住临时加速（见 `features/hold-boost.md`）、同键短按跳长按加速（见 `features/hold-skip-combo.md`）、逐帧（见 `features/frame-step.md`）、页内快捷键改键（见 `features/hotkey-remap.md`）、浮动药丸倍速（见 `features/floating-speed.md`）、浮动药丸播放跳转（见 `features/floating-playback.md`）、浮动入口旁注（见 `features/floating-entry-note.md`）、从音量药丸打开弹出面板（见 `features/floating-open-panel.md`）、仅在播放时显示浮动入口（见 `features/floating-while-playing.md`）和滚轮方向（见 `features/wheel-direction.md`）。仅全屏时悬停滚轮见 `features/fullscreen-wheel.md`。侧栏聊天和文档大纲忽略见 `features/sidebar-ignore.md`。设置页三处名单的「当前站」见 `features/settings-current-site.md`。记住站点的「清空全部」见 `features/settings-clear-remembered.md`。镜像与标记的页内提示见 `features/mirror-mark-feedback.md`。进出画中画的页内提示见 `features/pip-feedback.md`。选中视频处于画中画时，面板与浮动标出退出态见 `features/pip-active.md`。切走标签后扩展命令仍控画中画媒体见 `features/pip-away-tab.md`。自动进入的画中画在回到标签或视频回到视口时自动退出见 `features/pip-auto-exit.md`。按站点关掉自动画中画见 `features/pip-auto-excluded-sites.md`。自动进出画中画的页内提示和失败冷却见 `features/pip-auto-feedback.md`。接着看的进度保存见 `features/resume-save.md`。弹出面板的睡眠定时见 `features/sleep-timer.md`。睡眠定时的页内提示见 `features/sleep-timer-hints.md`。睡眠定时的快捷键与扩展命令见 `features/sleep-hotkeys.md`。选中变化时的短暂轮廓见 `features/selection-highlight.md`。上一条和下一条媒体见 `features/prev-next-media.md`。弹出面板媒体列表见 `features/panel-media-list.md`。音量药丸里的画中画见 `features/float-pip.md`。页内画中画快捷键见 `features/page-pip.md`。睡眠进行中的入口旁注倒计时见 `features/floating-sleep-note.md`。其余功能按 `features/` 里的选择器操作；断言失败就记下来，不要放宽期望。

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive popup-playback
node .cursor/skills/verify-ottertap/scripts/session.mjs drive skip-step
node .cursor/skills/verify-ottertap/scripts/session.mjs drive skip-with-rate
node .cursor/skills/verify-ottertap/scripts/session.mjs drive volume-step
node .cursor/skills/verify-ottertap/scripts/session.mjs drive fine-wheel
node .cursor/skills/verify-ottertap/scripts/session.mjs drive coarse-step
node .cursor/skills/verify-ottertap/scripts/session.mjs drive rate-step
node .cursor/skills/verify-ottertap/scripts/session.mjs drive extension-pip
node .cursor/skills/verify-ottertap/scripts/session.mjs drive default-rate
node .cursor/skills/verify-ottertap/scripts/session.mjs drive hold-boost
node .cursor/skills/verify-ottertap/scripts/session.mjs drive hold-skip-combo
node .cursor/skills/verify-ottertap/scripts/session.mjs drive frame-step
node .cursor/skills/verify-ottertap/scripts/session.mjs drive hotkey-remap
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-speed
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-playback
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-entry-note
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-open-panel
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-while-playing
node .cursor/skills/verify-ottertap/scripts/session.mjs drive wheel-direction
node .cursor/skills/verify-ottertap/scripts/session.mjs drive fullscreen-wheel
node .cursor/skills/verify-ottertap/scripts/session.mjs drive sidebar-ignore
node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-memory-filter
node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-sites-filter
node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-floating-hidden-filter
node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-current-site
node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-clear-remembered
node .cursor/skills/verify-ottertap/scripts/session.mjs drive horizontal-mirror
node .cursor/skills/verify-ottertap/scripts/session.mjs drive progress-mark
node .cursor/skills/verify-ottertap/scripts/session.mjs drive mute-other-tabs
node .cursor/skills/verify-ottertap/scripts/session.mjs drive mute-others-undo
node .cursor/skills/verify-ottertap/scripts/session.mjs drive listen-current
node .cursor/skills/verify-ottertap/scripts/session.mjs drive quiet-hotkeys
node .cursor/skills/verify-ottertap/scripts/session.mjs drive auto-mute-others
node .cursor/skills/verify-ottertap/scripts/session.mjs drive mirror-mark-commands
node .cursor/skills/verify-ottertap/scripts/session.mjs drive mirror-mark-feedback
node .cursor/skills/verify-ottertap/scripts/session.mjs drive auto-follow-playing
node .cursor/skills/verify-ottertap/scripts/session.mjs drive selection-highlight
node .cursor/skills/verify-ottertap/scripts/session.mjs drive prev-next-media
node .cursor/skills/verify-ottertap/scripts/session.mjs drive panel-media-list
node .cursor/skills/verify-ottertap/scripts/session.mjs drive float-prev-next
node .cursor/skills/verify-ottertap/scripts/session.mjs drive float-pip
node .cursor/skills/verify-ottertap/scripts/session.mjs drive page-pip
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-feedback
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-active
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-away-tab
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-hide
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-scroll
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-exit
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-excluded-sites
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-feedback
node .cursor/skills/verify-ottertap/scripts/session.mjs drive resume-save
node .cursor/skills/verify-ottertap/scripts/session.mjs drive sleep-timer
node .cursor/skills/verify-ottertap/scripts/session.mjs drive sleep-timer-cancel
node .cursor/skills/verify-ottertap/scripts/session.mjs drive sleep-timer-hints
node .cursor/skills/verify-ottertap/scripts/session.mjs drive remaining-at-rate
node .cursor/skills/verify-ottertap/scripts/session.mjs drive sleep-hotkeys
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-sleep-note
```

`skip-step` 在设置页把 `Skip step` 改成 `30s` 并打开 `Single-key mode`，再看弹出面板进退按钮名和页内 `L` / `J` / `→` / `←` 让 `/long` 夹具的 `currentTime` 跟着步长变；它会改写 profile，同一会话只能跑一次。步骤见 `features/skip-step.md`。

`skip-with-rate` 先在 2× 下确认开关关闭时仍跳 10 秒，再打开 `Scale skip with speed`，看弹出面板和页内 `L` / `J` 跳 20 秒且提示写 20 秒，并确认 4× 被限制成 30 秒、0.25× 按 0.5× 跳 5 秒。它会改写 profile，同一会话只能跑一次，不能接在 `drive skip-step` 后面。步骤见 `features/skip-with-rate.md`。

`volume-step` 在设置页把 `Volume step` 改成 `5%` 和 `20%`，再看同一夹具页上的悬停滚轮、Alt+滚轮和单键 ↑ ↓ 跟着步长变，并确认跨过 100% 仍先停住。它会改写 profile，同一会话只能跑一次，而且不能接在 `drive wheel-volume` 前面。步骤见 `features/volume-step.md`。

`fine-wheel` 确认 `Finer wheel steps below 25%` 默认开启，10% 上的悬停滚轮和 Alt+滚轮按 1% 变化且药丸和弹出面板都显示这个百分数，40% 上仍按音量步长，单键 ↑ 和滑块方向键不走细档，关掉开关后滚轮回到常规步长。它会改写 profile，同一会话只能跑一次，不能接在 `drive volume-step` 后面。步骤见 `features/fine-wheel.md`。

`coarse-step` 确认 `Coarse step` 默认是 `20%`，不按 Shift 的悬停滚轮仍按音量步长，按住 Shift 的幅度更大，低音量时 Shift 优先于 1% 细档，播放器外的 Shift+滚轮仍滚动页面，输入框聚焦时 Shift+滚轮不拦截，Alt+Shift 仍能调音。它会改写 profile，同一会话只能跑一次，不能接在 `drive volume-step` 或 `drive fine-wheel` 后面。步骤见 `features/coarse-step.md`。

`rate-step` 在设置页把 `Speed step` 改成 `0.1×` 和 `0.5×`，再看同一夹具页上的 Alt+.、弹出面板加快 / 减慢和单键 `>` 跟着步长变，并确认到 4× 和 0.25× 仍停住。它会改写 profile，同一会话只能跑一次。步骤见 `features/rate-step.md`。

`default-rate` 在设置页确认 `Default speed` 默认是 `Follow the page`，再改成 `1.5×`，看新开的夹具视频被写成 1.5×；记住此站点为 2× 后重新加载，用记住的 2×。它会改写 profile，同一会话只能跑一次。步骤见 `features/default-rate.md`。

`hold-boost` 确认开关默认关闭时 `Alt+Shift+.` 仍只步进，打开后按住用 `Temporary speed`、松开还原，并且不改默认倍速和站点记忆。它会改写 profile，同一会话只能跑一次。步骤见 `features/hold-boost.md`。

`frame-step` 在暂停的夹具上用 `,` / `.` 和弹出面板的 `Previous frame` / `Next frame` 移动约 1/30 秒，播放中先暂停，并确认 `Alt+.` 仍加快。不可 seek 的夹具上按钮禁用，页内按键弹出说明。它不改 profile。步骤见 `features/frame-step.md`。

`hotkey-remap` 在设置页把 `Play or pause` 改成 `P`、`Pause, then next frame` 改成 `E`，先确认录 `J` 时提示被 `Back 10 seconds` 占用，再看不刷新的夹具页上新键立即生效、旧键交给网站，并走一遍导出、恢复默认和导入。它会改写 profile，同一会话只能跑一次。步骤见 `features/hotkey-remap.md`。

`floating-speed` 展开夹具页上的音量药丸，确认音量滑块从 100% 按下方向键仍能调低、静音仍可用，再用加快按钮和 `2× speed` 预设改倍速，看页内 `Speed {rate}×` 提示，并确认没有写入站点记忆。输入框聚焦时仍能打字，`Alt+.` 不改倍速。接着把倍速步长改成 `0.5×`、去掉 `4×` 预设，看同一页上的药丸跟着变，最后把步长和预设恢复。中途失败要 `cleanup`。步骤见 `features/floating-speed.md`。

`floating-open-panel` 在 `/feed` 展开药丸，点 `Open panel`。弹出面板的标题应与浮动入口正在控制的媒体一致；浏览器拒绝代开时，卡片上出现 `Click the toolbar icon`。两种结果都算通过，但工具栏弹出页必须仍是 `popup.html`。它不改 profile。步骤见 `features/floating-open-panel.md`。

`floating-while-playing` 确认开关默认关闭时，暂停的 `/video` 仍有浮动入口。打开后，播放时入口在，暂停一小会儿后隐藏，再播放又出现。连续短暂停再播放时入口不闪掉。入口隐藏时，主播放区滚轮仍能调音量。它会改写 profile，同一会话只能跑一次。步骤见 `features/floating-while-playing.md`。

`wheel-direction` 确认设置页 `Wheel direction` 默认是 `Up increases`，悬停向上滚轮加大音量，播放器外向下滚轮仍让页面往下走。改成 `Down increases` 后不刷新页面，同一向上手势改为减小音量，Alt+向上滚轮同样减小，向下滚轮改为加大；播放器外的向下滚轮仍让页面往下走。再改回 `Up increases`，同一向上手势重新加大。它会改写 profile，同一会话只能跑一次。步骤见 `features/wheel-direction.md`。

`fullscreen-wheel` 确认 `Only use the hover wheel in fullscreen` 默认关闭时，主播放区裸滚轮仍调音量。打开后，非全屏的裸滚轮滚动页面且不改音量，Alt+滚轮仍调音量；网页全屏和 Fullscreen API 里悬停可调，退出后下一格立刻交还页面。成功时把开关关回去。它会改写 profile，同一会话不要接在改过悬停滚轮或音量步长的旅程后面。步骤见 `features/fullscreen-wheel.md`。

`sidebar-ignore` 在 `/chat` 上确认盖住主画面的聊天和大纲能滚动、音量不变，画面中心和认不出的叠层仍能调音，聊天上的 Alt+滚轮和 Shift 粗调仍调音且列表不动。它不改 profile。步骤见 `features/sidebar-ignore.md`。

`floating-playback` 展开 `/long` 上的药丸，确认音量方向键和加快按钮仍可用，再点播放和暂停，并按 `Skip step` 前进后退。把步长改成 `30s` 后跳 30 秒；打开 `Scale skip with speed` 后，2× 时药丸和弹出面板都是 20 秒。`/unseekable` 上跳转按钮禁用并有说明。它会改写 profile，成功时恢复，同一会话只能跑一次，不能接在 `drive skip-step` 或 `drive skip-with-rate` 后面。步骤见 `features/floating-playback.md`。

`floating-entry-note` 在不展开药丸时读浮动入口旁边的音量或倍速。默认是 `On-page volume 100%`；100% 且倍速不是 1× 时改成 `On-page speed …`。半隐藏和悬停时旁注都在视口内。设置页 `Entry note` 可改成优先倍速或关闭，成功时改回优先音量。它会改写 profile，同一会话只能跑一次。步骤见 `features/floating-entry-note.md`。

`popup-playback` 在已启动的会话里做这些事：

1. 打开 `https://media.ottertap.test/video`。页面里是一个循环播放的静音视频，`aria-label="Fixture video"`，并带原生 `controls`。
2. 等到浮动入口可见。无障碍名匹配 `/volume pill/i`，也就是 `Open the volume pill. Arrow keys move the floater.`
3. 把夹具页带到前台，在 service worker 里调用 `chrome.action.openPopup()`。Playwright 不会把这个弹出面板收成 `Page`。用夹具页上的 CDP `Target.getTargets` 找到 `type === 'page'` 且 URL 以 `/popup.html` 结尾的 target，再 `Target.attachToTarget`（`flatten: false`）。这和 `e2e/smoke.spec.ts` 的 `readActionPopup` 是同一条路。
4. 在弹出面板文档里按无障碍名读取：`[aria-label="Media controls"]`、`h1` 文本 `Fixture video`、状态文案 `Video · Paused`、按钮 `aria-label="Play"`。视频 `#media` 的 `paused === true`。用 `Page.captureScreenshot` 截弹出面板。
5. 对 `aria-label="Play"` 的按钮调用 `click()`。断言按钮变成 `Pause`，状态变成 `Video · Playing`，没有 `[role="alert"]`，并且 `currentTime` 前进。再截图。
6. 对 `Pause` 调用 `click()`。断言回到 `Play` / `Video · Paused`，等待 400ms 后进度不再前进。

不要用地址栏打开 `popup.html`。弹出面板用 `tabs.query({ active: true, currentWindow: true })` 决定控制哪个标签；把 `popup.html` 打开成标签后，活动标签就变成扩展页自己。夹具页上的浮动入口仍用 Playwright `getByRole`。

页内控件在开放 shadow root 里，Playwright 的 `getByRole` 能穿透。弹出面板不在 shadow root 里。英语文案来自 `locales/en.yml`。稳定把手是这些无障碍名，不要用坐标或 Tab 顺序：

| 把手 | 名字 |
| --- | --- |
| 弹出面板 | `region` `Media controls` |
| 播放 / 暂停 | `button` `Play` 或 `Pause`（精确匹配） |
| 后退 / 前进 | 默认 `Back 10 seconds` / `Forward 10 seconds`。数字来自设置里的步长，默认 10 秒 |
| 进度 | `slider` `Seek` |
| 音量 | `slider` `Volume`，静音按钮 `Mute` / `Unmute` |
| 声道 | `button` 名以 `Channels: ` 开头；菜单项是 `menuitemradio`：`Stereo`、`Mono`、`Left channel only`、`Right channel only` |
| 水平镜像 | `switch` `Mirror horizontally`。视频默认为关。音频上禁用，说明是 `Audio has no picture, so it cannot be mirrored.` |
| 倍速 | `button` `1.25× speed` 这种，乘号是 `×` |
| 打开设置 | `Open settings` |
| 浮动入口 | `/volume pill/i` |
| 浮动倍速 | 展开后的 `group` `Speed`。加快 / 减慢与弹出面板同名，预设是 `1.25× speed` 这种 |
| 浮动播放 | 展开后的 `group` `Playback`。`Play` / `Pause`，以及与弹出面板同名的 `Back {n} seconds` / `Forward {n} seconds`。不可跳转时说明是 `Live streams and media that can't be seeked can't jump.` |
| 浮动画中画 | 展开后的 `group` `Playback` 里的 `Picture-in-picture` / `Exit picture-in-picture`。不可用时禁用，说明与弹出面板 `#pip-hint` 相同 |
| 设置页备份 | `chrome-extension://<extensionId>/options.html#backup`，按钮 `Export settings`、`Import settings`、确认 `Replace settings` |
| 设置页步长 | `chrome-extension://<extensionId>/options.html#playback`，`group` `Skip step` 里的 `button` `5s` / `10s` / `15s` / `30s`，默认 `10s` 按下 |
| 设置页音量步长 | 同一节的 `group` `Volume step`，`button` `5%` / `10%` / `20%`，默认 `10%` 按下 |
| 设置页粗调步长 | 同一节的 `group` `Coarse step`，`button` `5%` / `10%` / `20%`，默认 `20%` 按下。按住 Shift 滚动时用这一档 |
| 设置页倍速步长 | 同一节的 `group` `Speed step`，`button` `0.1×` / `0.25×` / `0.5×`，默认 `0.25×` 按下。弹出面板加快 / 减慢的无障碍名是 `Increase speed by 0.25×` / `Decrease speed by 0.25×`，数字来自这个步长 |

`pnpm e2e` 覆盖滚轮、倍速快捷键、声道和设置页文案，测试名写在对应功能文件里。设置导出导入没有 e2e，只有 `tests/settings-backup.test.ts` 覆盖文件格式；快进快退步长没有 e2e，只有 `tests/skip-*.test.ts` 在 fake browser 里覆盖；音量步长没有 e2e，只有 `tests/volume-step.test.ts`、`tests/volume-hotkey.test.ts` 和 `tests/volume-command.test.ts` 覆盖；Shift 粗调步长没有 e2e，只有 `tests/coarse-step.test.ts` 和 `tests/coarse-step-background.test.ts` 覆盖；倍速增减步长没有 e2e，只有 `tests/rate-step.test.ts` 和 `tests/rate-step-command.test.ts` 覆盖。用户路径以功能文件为准。

## Evidence

证明要走用户能点到的路径。读取 `element.paused`、`currentTime`、下载到的 JSON、或 `chrome.storage.local` 里的 `ottertap-settings-v1`，用来核对副作用；不要用测试专用消息代替点击。

证据目录是 `/opt/cursor/artifacts/verify-ottertap/`。`drive popup-playback` 写入：

- `popup-playback/fixture-ready.png` — 夹具页和浮动入口
- `popup-playback/popup-paused.png` — 点击播放之前
- `popup-playback/popup-playing.png` — 点击播放之后
- `popup-playback/fixture-playing.png` — 同一时刻的网页
- `popup-playback/state.json` — `before`、`playing`、`afterPause`，成功时 `ok: true`
- `popup-playback/transcript.txt` — 动作顺序

`drive skip-step` 写入 `skip-step/`：`settings-default.png`、`settings-30.png`、`popup-10.png`、`popup-30.png`、`fixture-start.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

`drive skip-with-rate` 写入 `skip-with-rate/`：`popup-off.png`、`settings-off.png`、`settings-on.png`、`popup-on.png`、`toast-20.png`、`popup-clamped.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

`drive volume-step` 写入 `volume-step/`：`settings-default.png`、`settings-5.png`、`settings-20.png`、`fixture-10.png`、`fixture-5.png`、`fixture-20.png`、`fixture-snap-100.png`、`fixture-snap-120.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

`drive fine-wheel` 写入 `fine-wheel/`：`settings-on.png`、`pill-11.png`、`popup-11.png`、`fixture-15.png`、`fixture-50.png`、`settings-off.png`、`fixture-off.png`、`slider-51.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

`drive coarse-step` 写入 `coarse-step/`：`settings-default.png`、`fixture-10.png`、`fixture-shift.png`、`fixture-fine.png`、`fixture-typing.png`、`settings-5.png`、`fixture-5.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

`drive rate-step` 写入 `rate-step/`：`settings-default.png`、`settings-0.1.png`、`settings-0.5.png`、`fixture-default.png`、`fixture-0.1.png`、`fixture-0.5.png`、`popup-0.1.png`、`popup-limit.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

`drive default-rate` 写入 `default-rate/`：`settings-follow.png`、`fixture-follow.png`、`settings-1.5.png`、`fixture-1.5.png`、`fixture-site.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

`drive hold-boost` 写入 `hold-boost/`：`settings-off.png`、`fixture-off.png`、`settings-on.png`、`fixture-hold.png`、`fixture-release.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

`drive frame-step` 写入 `frame-step/`：`fixture-step.png`、`popup-frame.png`、`settings-shortcuts.png`、`unseekable-popup.png`、`toast-unavailable.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

`drive hold-skip-combo` 写入 `hold-skip-combo/`：`settings-before.png`、`settings-after.png`、`fixture-tap.png`、`fixture-hold.png`、`fixture-release.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。它会改写 profile，同一会话只能跑一次。步骤见 `features/hold-skip-combo.md`。

`drive hotkey-remap` 写入 `hotkey-remap/`：`settings-default.png`、`settings-conflict.png`、`settings-remapped.png`、`fixture-remapped.png`、`settings-restored.png`、`export.json`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

`drive floating-speed` 写入 `floating-speed/`：`fixture-step.png`、`pill-step.png`、`pill-preset.png`、`settings-step.png`、`pill-presets.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

`drive floating-playback` 写入 `floating-playback/`：`pill-playing.png`、`fixture-playing.png`、`pill-30.png`、`pill-20.png`、`popup-20.png`、`pill-unseekable.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

`drive floating-entry-note` 写入 `floating-entry-note/`：`half-hidden.png`、`hover.png`、`speed.png`、`volume.png`、`boost.png`、`settings-volume.png`、`settings-rate.png`、`prefer-speed.png`、`settings-off.png`、`hidden.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

`drive floating-open-panel` 写入 `floating-open-panel/`：`pill-button.png`、`fixture.png`，打开时还有 `popup-selected.png`，降级时还有 `pill-hint.png`，以及 `state.json`（成功时 `ok: true`，`mode` 为 `opened` 或 `hint`）、`transcript.txt`。

`drive floating-while-playing` 写入 `floating-while-playing/`：`settings-off.png`、`fixture-paused-off.png`、`settings-on.png`、`fixture-playing.png`、`fixture-paused.png`、`fixture-playing-again.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

`drive wheel-direction` 写入 `wheel-direction/`：`settings-up.png`、`fixture-up.png`、`page-scroll-up.png`、`settings-down.png`、`fixture-down.png`、`page-scroll-down.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

`drive fullscreen-wheel` 写入 `fullscreen-wheel/`：`settings-default.png`、`fixture-default.png`、`settings-on.png`、`fixture-scroll.png`、`fixture-alt.png`、`fixture-pseudo.png`、`fixture-exit.png`、`fixture-api.png`、`fixture-api-exit.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

`drive sidebar-ignore` 写入 `sidebar-ignore/`：`chat-before.png`、`chat-scrolled.png`、`outline-scrolled.png`、`player-after.png`、`overlay-after.png`、`chat-alt.png`、`chat-shift.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。它不改 profile。步骤见 `features/sidebar-ignore.md`。

`drive float-pip` 写入 `float-pip/`：`pill-video.png`、`pill-audio.png`、`pill-off.png`、`pill-waiting.png`、`pill-feed.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。进入画中画时还有 `pill-entered.png` 和 `pill-exited.png`；浏览器拒绝时还有 `pill-failed.png` 和 `popup-failed.png`。

`drive page-pip` 写入 `page-pip/`：`settings-unbound.png`、`settings-conflict.png`、`settings-bound.png`、`fixture-typing.png`、`fixture-audio.png`、`fixture-off.png`、`fixture-waiting.png`、`settings-restored.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。进入时还有 `fixture-entered.png` 与 `fixture-exited.png`；拒绝时还有 `fixture-failed.png` 与 `popup-failed.png`。它会改写 profile，成功时恢复默认，同一会话只能跑一次。步骤见 `features/page-pip.md`。

`drive pip-feedback` 写入 `pip-feedback/`：`fixture-before.png`、`toast-float-on.png`、`toast-float-off.png`、`toast-panel-on.png`、`toast-panel-off.png`、`toast-key-on.png`、`toast-key-off.png`、`toast-fullscreen.png`、`toast-fullscreen-off.png`、`fixture-typing.png`、`toast-audio.png`、`toast-off.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。它会改写 profile，成功时恢复默认，同一会话只能跑一次。步骤见 `features/pip-feedback.md`。

`drive pip-active` 写入 `pip-active/`：`pill-before.png`、`popup-before.png`、`pill-entered.png`、`popup-entered.png`、`pill-exited.png`、`popup-exited.png`、`popup-switched.png`、`pill-audio.png`、`popup-audio.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。它不改 profile。步骤见 `features/pip-active.md`。

`drive pip-away-tab` 写入 `pip-away-tab/`：`settings-note.png`、`away-tab.png`、`typing.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。它不改 profile。步骤见 `features/pip-away-tab.md`。

`launch` 成功后还会留下 `launch-probe.png`（浮动入口已经出现）。失败时同目录可能有 `error.txt`，那不算通过。

换了 `OTTERTAP_VERIFY_ID` 时，文件名变成 `<id>-popup-playback/`。不要把这些截图提交进仓库。

## Cleanup

停掉这次 launch 启动的会话进程，并删掉 `/tmp/ottertap-verify/<id>/`（profile、日志、session.json）。先对会话 pid 发 `POST /shutdown`，再按需 SIGTERM / SIGKILL。浏览器进程只在其命令行包含这次的 profile 路径时才结束。不要按进程名杀 Chrome。

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs cleanup
```

通过时打印 `ottertap-verify cleaned id=current`。证据目录不动。清理之后确认 `/opt/cursor/artifacts/verify-ottertap/popup-playback/state.json` 还在。失败的那一轮也要 cleanup，避免留下端口和 profile。

## Helpers

可执行文件是 `.cursor/skills/verify-ottertap/scripts/session.mjs`。在仓库根目录：

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs launch
node .cursor/skills/verify-ottertap/scripts/session.mjs doctor
node .cursor/skills/verify-ottertap/scripts/session.mjs drive popup-playback
node .cursor/skills/verify-ottertap/scripts/session.mjs drive skip-step
node .cursor/skills/verify-ottertap/scripts/session.mjs drive skip-with-rate
node .cursor/skills/verify-ottertap/scripts/session.mjs drive volume-step
node .cursor/skills/verify-ottertap/scripts/session.mjs drive fine-wheel
node .cursor/skills/verify-ottertap/scripts/session.mjs drive coarse-step
node .cursor/skills/verify-ottertap/scripts/session.mjs drive rate-step
node .cursor/skills/verify-ottertap/scripts/session.mjs drive extension-pip
node .cursor/skills/verify-ottertap/scripts/session.mjs drive default-rate
node .cursor/skills/verify-ottertap/scripts/session.mjs drive hold-boost
node .cursor/skills/verify-ottertap/scripts/session.mjs drive hold-skip-combo
node .cursor/skills/verify-ottertap/scripts/session.mjs drive frame-step
node .cursor/skills/verify-ottertap/scripts/session.mjs drive hotkey-remap
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-speed
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-playback
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-entry-note
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-open-panel
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-while-playing
node .cursor/skills/verify-ottertap/scripts/session.mjs drive wheel-direction
node .cursor/skills/verify-ottertap/scripts/session.mjs drive fullscreen-wheel
node .cursor/skills/verify-ottertap/scripts/session.mjs drive sidebar-ignore
node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-memory-filter
node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-sites-filter
node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-floating-hidden-filter
node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-current-site
node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-clear-remembered
node .cursor/skills/verify-ottertap/scripts/session.mjs drive horizontal-mirror
node .cursor/skills/verify-ottertap/scripts/session.mjs drive progress-mark
node .cursor/skills/verify-ottertap/scripts/session.mjs drive mute-other-tabs
node .cursor/skills/verify-ottertap/scripts/session.mjs drive mute-others-undo
node .cursor/skills/verify-ottertap/scripts/session.mjs drive listen-current
node .cursor/skills/verify-ottertap/scripts/session.mjs drive quiet-hotkeys
node .cursor/skills/verify-ottertap/scripts/session.mjs drive auto-mute-others
node .cursor/skills/verify-ottertap/scripts/session.mjs drive mirror-mark-commands
node .cursor/skills/verify-ottertap/scripts/session.mjs drive mirror-mark-feedback
node .cursor/skills/verify-ottertap/scripts/session.mjs drive auto-follow-playing
node .cursor/skills/verify-ottertap/scripts/session.mjs drive selection-highlight
node .cursor/skills/verify-ottertap/scripts/session.mjs drive prev-next-media
node .cursor/skills/verify-ottertap/scripts/session.mjs drive panel-media-list
node .cursor/skills/verify-ottertap/scripts/session.mjs drive float-prev-next
node .cursor/skills/verify-ottertap/scripts/session.mjs drive float-pip
node .cursor/skills/verify-ottertap/scripts/session.mjs drive page-pip
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-feedback
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-active
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-away-tab
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-hide
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-scroll
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-exit
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-excluded-sites
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-feedback
node .cursor/skills/verify-ottertap/scripts/session.mjs drive resume-save
node .cursor/skills/verify-ottertap/scripts/session.mjs drive sleep-timer
node .cursor/skills/verify-ottertap/scripts/session.mjs drive sleep-timer-cancel
node .cursor/skills/verify-ottertap/scripts/session.mjs drive sleep-timer-hints
node .cursor/skills/verify-ottertap/scripts/session.mjs drive remaining-at-rate
node .cursor/skills/verify-ottertap/scripts/session.mjs drive sleep-hotkeys
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-sleep-note
node .cursor/skills/verify-ottertap/scripts/session.mjs cleanup
```

`launch` 内部会再拉起同一个文件的 `serve` 子进程来托住浏览器。不要单独依赖 `serve`，也不要把 `session.json` 里的令牌打到日志以外的地方。控制接口只绑在 `127.0.0.1`，请求要带这个令牌；doctor 和 drive 会自己读会话文件。旅程在 `serve` 进程里跑，改了这个脚本要先 `cleanup` 再 `launch`，否则 drive 还是旧代码。

功能索引在 `features/README.md`。

## 按站点隐藏浮动入口

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-hidden-sites
```

`floating-hidden-sites` 在 `/video` 上展开药丸，点 `Open panel` 旁的 `Hide floating on this site`。入口消失，存储里 `floatingHiddenSites` 只多出 `media.ottertap.test`，`floating`、`siteMode`、`sites` 不变。隐藏后和刷新后 `Alt+.` 仍生效，弹出面板仍能播放暂停，面板 `Floating controller` 行里的同名眼睛按钮为按下。临时拦截的 `https://elsewhere.test/video` 上入口照常出现。再走一遍导出、设置页撤销、导入、弹出面板撤销。它会改写 profile，成功时名单清空。步骤见 `features/floating-hidden-sites.md`。

写入 `floating-hidden-sites/`：`settings-empty.png`、`pill-hide-button.png`、`fixture-hidden.png`、`popup-hidden.png`、`other-site.png`、`export.json`、`settings-listed.png`、`fixture-restored.png`、`popup-restored.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 记住站点列表过滤

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-memory-filter
```

`settings-memory-filter` 先在存储里放上 `alpha.test`、`beta.example`、`gamma.example`，打开 `options.html#memory`。过滤框无障碍名是 `Filter by hostname`。输入 `example` 后只剩两条 `example` 主机名，`alpha.test` 仍在 `sitePrefs`。再到 `/video` 的弹出面板打开 `Remember this site`，存储追加 `media.ottertap.test` 且不丢掉未显示的站点；过滤结果不变。清空后四条都在。再滤回 `example` 并点 `Forget beta.example`，存储只少这一条。输入 `zzzz` 时出现 `No remembered sites match.`，`#memory` 里没有列表。它会改写 profile，同一会话只能跑一次。步骤见 `features/settings-memory-filter.md`。

写入 `settings-memory-filter/`：`list-all.png`、`filtered.png`、`remembered.png`、`forgotten.png`、`no-match.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 网站规则名单过滤

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-sites-filter
```

`settings-sites-filter` 先把 `siteMode` 设成 `allow`，写入 `alpha.test`、`beta.example`、`gamma.example`，并记住 `kept.example` 与 `other.test`。网站规则过滤框无障碍名是 `Filter site list`，和记住站点的 `Filter by hostname` 不是同一个框。输入 `example` 后网站名单只剩两条，存储里的 `alpha.test` 还在。添加 `delta.test` 只进 `sites`、不出现在过滤结果里；再添加 `delta.example` 会出现。移除 `gamma.example` 只少这一条。记住站点过滤填 `kept` 时只剩 `kept.example`，网站名单不变。切到 `Exclude listed sites` 后网站规则过滤清空、整表出现，记住站点的过滤词还在。输入 `zzzz` 时出现 `No sites match.`，`#sites` 里没有列表。再切到 `All sites`，过滤再次清空。它会改写 profile，同一会话只能跑一次。步骤见 `features/settings-sites-filter.md`。

写入 `settings-sites-filter/`：`list-all.png`、`filtered.png`、`added.png`、`removed.png`、`independent.png`、`mode-reset.png`、`no-match.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 隐藏浮动站点名单过滤

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-floating-hidden-filter
```

`settings-floating-hidden-filter` 先写入 `alpha.test`、`beta.example`、`gamma.example`，网站规则允许 `rules.example` 与 `listed.test`，并记住 `kept.example` 与 `noted.test`。隐藏名单过滤框无障碍名是 `Filter hidden sites`，和 `Filter site list`、`Filter by hostname` 不是同一个框。输入 `example` 后只剩两条，存储里的 `alpha.test` 还在。另外两处过滤分别填 `rules` 和 `kept` 时，这边的过滤词和结果不变。点 `Show the floating button on beta.example again` 后结果只剩 `gamma.example`，`alpha.test` 仍在 `floatingHiddenSites`。同一页导出的 JSON 带上这两条。导入一份加回 `beta.example` 和 `delta.test` 的备份后，过滤词仍是 `example`，结果里是 `beta.example` 和 `gamma.example`。输入 `zzzz` 时出现 `No hidden sites match.`，`#floating` 里没有列表。它会改写 profile，同一会话只能跑一次。步骤见 `features/settings-floating-hidden-filter.md`。

写入 `settings-floating-hidden-filter/`：`list-all.png`、`filtered.png`、`independent.png`、`restored.png`、`export.json`、`imported.png`、`no-match.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 设置名单定位当前站

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-current-site
```

`settings-current-site` 先在记住站点、网站规则和隐藏浮动名单里放上包含 `media.ottertap.test` 的条目，网站规则为仅指定网站。先打开 `https://elsewhere.test/`，再打开 `/video`，然后打开设置页。三处按钮的无障碍名都是 `Current site`。记住站点点下去后，过滤变成 `media.ottertap.test`，列表滚进视口；网站规则仍是事先填的 `beta`，隐藏名单仍是 `gamma`。再点另外两处，各自变成当前主机名，不改旁边那一处。关掉这两个网页标签后三颗按钮不可用。把记住站点过滤改成 `alpha` 再点，过滤仍是 `alpha`。存储里的三张表都不因点击而改。它会改写 profile，同一会话只能跑一次。步骤见 `features/settings-current-site.md`。

写入 `settings-current-site/`：`memory-located.png`、`sites-held.png`、`hidden-located.png`、`unavailable.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 清空全部已记住的站点

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-clear-remembered
```

`settings-clear-remembered` 先写入 `alpha.test`、`beta.example`、`media.ottertap.test`（40% 与 2×），网站规则排除 `rules.example`，隐藏浮动名单留下 `hidden.example`，默认倍速为 `1.25×`。夹具先套用记住的 40% 和 2×，弹出面板 `Remember this site` 为开。设置页 `Clear all` 只在记住站点区。点开确认后取消，列表和存储不变。再滤到 `example` 并确认 `Clear all remembered sites`。记住表为空，导出 JSON 的 `sitePrefs` 为 0 条，规则、隐藏名单和默认倍速仍在。重新打开夹具后音量约 100%，倍速是 1.25×，面板不再显示已记住。确认文案写明除非已有自己的备份否则无法撤销。它会改写 profile，同一会话只能跑一次。步骤见 `features/settings-clear-remembered.md`。

写入 `settings-clear-remembered/`：`fixture-before.png`、`popup-before.png`、`list-before.png`、`confirm.png`、`cancelled.png`、`filtered.png`、`cleared.png`、`export.json`、`fixture-after.png`、`popup-after.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 水平镜像

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive horizontal-mirror
```

`horizontal-mirror` 在 `/video` 上确认弹出面板的 `Mirror horizontally` 默认关。点开后只翻转当前视频画面，音量、倍速、进度和布局盒子不变；再点关闭即恢复。重新加载后默认不镜像。`/feed` 上只翻转当前选中的那一条，换到另一条时开关为关。`/audio` 上开关禁用。打开「Remember this site」后再镜像，`sitePrefs` 不出现镜像字段；重新加载后画面仍不镜像。成功时关掉记住并忘掉该站。它会改写 profile，同一会话只能跑一次。步骤见 `features/horizontal-mirror.md`。

写入 `horizontal-mirror/`：`popup-off.png`、`popup-on.png`、`fixture-on.png`、`popup-restored.png`、`feed-other.png`、`audio-disabled.png`、`remembered.png`、`reloaded.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 进度标记

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive progress-mark
```

`progress-mark` 在 `/long` 上给当前视频设一个 12 秒的标记，进度条附近能看见它。前进 10 秒和下一帧之后标记还在原来的时间，再跳回去。关掉弹出面板再打开，标记仍在；清除后不能跳。关掉标签后新开的页面没有标记。`/feed` 上换到另一条媒体时标记不跟着过去。`/unseekable` 上三个按钮禁用并有短说明。全程不写扩展存储。它不改 profile。步骤见 `features/progress-mark.md`。

写入 `progress-mark/`：`popup-set.png`、`popup-away.png`、`popup-reopened.png`、`popup-cleared.png`、`feed-other.png`、`unseekable-popup.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 静音其他发声标签

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive mute-other-tabs
```

`mute-other-tabs` 先只开着正在出声的 `/tone-current`。弹出面板没有 `Mute others`。再打开 `/tone-music` 和 `/tone-meeting`，等浏览器把它们标成 audible 后，点 `Mute others`。这两个标签的喇叭变成静音，当前页音量仍约 40%，另外两页自己的音量数字不变，`sitePrefs` 也不变。接着用音乐那一行单独取消静音，只恢复那一条。关掉这两个标签后按钮消失。它不改 profile。步骤见 `features/mute-other-tabs.md`。

写入 `mute-other-tabs/`：`popup-empty.png`、`popup-ready.png`、`popup-muted.png`、`popup-empty-again.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 撤销静音其他

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive mute-others-undo
```

`mute-others-undo` 先把 `Held tab` 静音，再点 `Mute others`。只有这次从有声改成静音的标签进入撤销。再点一次不覆盖记录。关掉弹出面板再打开，撤销还在。音乐那一行取消静音再静音后，撤销不再打开它。关掉会议标签后点撤销，只恢复 `Restored tab`。再静音一条新标签、关掉它、点撤销，出现不能安全恢复的说明，其他静音标签不动。设置原文不变，权限仍只有 `storage`。同值再静音一次的 `mutedInfo` 记在 `state.json` 的 `probe`。它不改 profile。步骤见 `features/mute-others-undo.md`。

写入 `mute-others-undo/`：`popup-ready.png`、`popup-muted.png`、`popup-reopened.png`、`popup-later.png`、`popup-undone.png`、`popup-unavailable.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 镜像与标记的快捷键

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive mirror-mark-commands
```

`mirror-mark-commands` 在设置页确认水平镜像、设标记、跳到标记以及同名扩展命令默认都是 `Not set`，不占建议键，空键也不报占用。录到已有键时提示与现网改键一致。绑上 `H` / `B` / `N` 后，不打开单键模式，`/long` 上能翻转画面、设下标记再跳回去。文本框聚焦时这三个键不动。音频不会被镜像。`Restore default keys` 收回这三项。`sitePrefs` 一直是空的。它会改写 profile，成功时恢复默认，同一会话只能跑一次。步骤见 `features/mirror-mark-commands.md`。

写入 `mirror-mark-commands/`：`settings-unbound.png`、`settings-conflict.png`、`settings-bound.png`、`fixture-mirrored.png`、`fixture-jumped.png`、`fixture-typing.png`、`audio-plain.png`、`settings-restored.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 镜像与标记的页内提示

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive mirror-mark-feedback
```

`mirror-mark-feedback` 把水平镜像、设标记、跳到标记绑成 `H` / `B` / `N`。成功时页面顶部出现和倍速提示同一块字样：`Mirror on`、`Mirror off`、`Marked`、`Back to mark`。弹出面板的开关和按钮也让页面出现同样的字样。清除标记成功时没有新字样。不能 seek、没有标记、音频镜像用原来的短说明。字样不接收点击，不盖住播放器底部控件，出现后会自己消失。铺满窗口时仍能看见。没有提示总开关，默认显示。它会改写 profile，成功时恢复默认键，同一会话只能跑一次。步骤见 `features/mirror-mark-feedback.md`。

写入 `mirror-mark-feedback/`：`toast-mirror-on.png`、`toast-mirror-off.png`、`toast-marked.png`、`toast-jump.png`、`toast-fullscreen.png`、`toast-panel-mirror.png`、`toast-unseekable.png`、`toast-audio.png`、`toast-missing.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 播放中自动跟随

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive auto-follow-playing
```

`auto-follow-playing` 确认设置页「Playback」的 `Follow the media that starts playing` 默认开。`/feed` 上点播另一条后，弹出面板标题、浮动入口和页内 `Alt+.` 都改到新目标，药丸里的暂停也停的是这一条。关掉开关后再点播另一条，面板和 `Alt+.` 留在原来的那条。重新打开后，在面板里点选一条，紧接着播放另一条，短时间内选中不被抢走；过了这个窗口再播放，又会跟上。`/video` 只有一条媒体，播放后面板标题仍是这条，页内倍速和面板暂停都作用在它身上。成功时开关回到开启。它会改写 profile，同一会话只能跑一次。步骤见 `features/auto-follow-playing.md`。

写入 `auto-follow-playing/`：`settings-on.png`、`popup-followed.png`、`pill-followed.png`、`settings-off.png`、`popup-held.png`、`popup-single.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 选中变化的短暂反馈

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive selection-highlight
```

`selection-highlight` 在 `/feed` 上先等面板选中一条，再播放另一条。只有新的那一条带约一秒的外沿轮廓，画面中心仍点在视频上。轮廓还在时 `Alt+.` 出现 `Speed 1.25×`。轮廓随后消失。面板点回原来那一条时，轮廓只留在点中的那一条。打开单键模式，指针放在另一条上按 `↑`，轮廓改到这一条，成功后关掉单键模式。`/mixed` 上播放音频时，顶部出现 `Audio selected`，视频和音频都没有轮廓；再点回视频，轮廓只在视频上。`sitePrefs` 保持为空。它会暂时改写 profile，同一会话只能跑一次。步骤见 `features/selection-highlight.md`。

写入 `selection-highlight/`：`ring-followed.png`、`ring-with-speed.png`、`ring-panel.png`、`ring-key.png`、`toast-audio.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 上一条 / 下一条媒体

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive prev-next-media
```

`prev-next-media` 在设置页确认 `Previous media`、`Next media` 和同名扩展命令默认都是 `Not set`，不占建议键，空键也不报占用。录到已有键时提示与现网改键一致。绑上 `[` / `]` 后，不打开单键模式，`/feed` 上按页面顺序循环，卸下的视频和从未插入的视频都不会被选中。文本框聚焦时这两个键不动。只有一条媒体时顶部出现 `This page only has one media.`。`Restore default keys` 收回这两项。`sitePrefs` 一直是空的。它会改写 profile，成功时恢复默认，同一会话只能跑一次。步骤见 `features/prev-next-media.md`。

写入 `prev-next-media/`：`settings-unbound.png`、`settings-conflict.png`、`settings-bound.png`、`fixture-next.png`、`fixture-wrap.png`、`fixture-prev.png`、`fixture-typing.png`、`fixture-only.png`、`settings-restored.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 弹出面板媒体列表

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive panel-media-list
```

`panel-media-list` 在 `/video` 上确认只有一条时没有媒体列表，也没有过滤框。`/feed` 上一条在播、另一条暂停时，列表能看出谁在播、谁被选中；点另一条后，播放和暂停作用在点中的那一条。`/playlist` 有五条，名称来自标题、文件名或 `Video 5`。`Filter media` 输入 `beta` 后只显示匹配行，标题和页面上的视频数量不变；`zzzz` 时出现 `No media match.`。它不改 profile。步骤见 `features/panel-media-list.md`。

写入 `panel-media-list/`：`popup-single.png`、`popup-rows.png`、`popup-filtered.png`、`popup-nomatch.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 音量药丸里的上一条 / 下一条

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive float-prev-next
```

`float-prev-next` 在 `/video` 上展开药丸，确认没有 `Previous media` 和 `Next media`，`Open panel` 仍在。`/feed` 上这两个按钮出现在播放控制旁，和 `Open panel` 的盒子不相交。点下一条后，药丸、弹出面板和 `Alt+.` 都对准 `Main player`，轮廓只在这一条上；再点上一条回到 `Feed preview`。浮动入口的位置、`floatingPosition` 和 `sitePrefs` 不变。它不改 profile。步骤见 `features/float-prev-next.md`。

写入 `float-prev-next/`：`pill-one.png`、`pill-two.png`、`ring-next.png`、`popup-next.png`、`ring-prev.png`、`popup-prev.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 音量药丸里的画中画

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive float-pip
```

`float-pip` 在 `/video` 上给夹具补一帧画面后展开药丸，点 `Picture-in-picture` 进入，再点 `Exit picture-in-picture` 退出。浏览器拒绝时，警告须与弹出面板点击同一按钮的警告相同。`/audio`、`/pip-off`、`/unseekable` 上按钮禁用，说明与弹出面板 `#pip-hint` 相同。`/feed` 上画中画与上一条、下一条同在 `Playback`，且不与 `Open panel` 相交。浮动入口位置、`floatingPosition` 和 `sitePrefs` 不变。它不改 profile。步骤见 `features/float-pip.md`。

写入 `float-pip/`：`pill-video.png`、`pill-audio.png`、`pill-off.png`、`pill-waiting.png`、`pill-feed.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。进入时还有 `pill-entered.png` 与 `pill-exited.png`；拒绝时还有 `pill-failed.png` 与 `popup-failed.png`。

## 页内快捷键 → 画中画

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive page-pip
```

`page-pip` 在设置页确认 `Enter or exit picture-in-picture` 和同名扩展命令默认都是 `Not set`，不占建议键，空键也不报占用。录到已有键时提示与现网改键一致。绑上 `P` 后，不打开单键模式。`/video` 补一帧画面后按 `P` 进入画中画再退出；浏览器拒绝时，页面短句是面板已有的失败说明。文本框聚焦时 `P` 留给输入框。`/audio`、`/pip-off`、`/unseekable` 上的短句与弹出面板 `#pip-hint` 相同。`Restore default keys` 收回这一项。扩展命令的快捷键一直是空的。`sitePrefs` 一直是空的。它会改写 profile，成功时恢复默认，同一会话只能跑一次。步骤见 `features/page-pip.md`。

写入 `page-pip/`：`settings-unbound.png`、`settings-conflict.png`、`settings-bound.png`、`fixture-typing.png`、`fixture-audio.png`、`fixture-off.png`、`fixture-waiting.png`、`settings-restored.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。进入时还有 `fixture-entered.png` 与 `fixture-exited.png`；拒绝时还有 `fixture-failed.png` 与 `popup-failed.png`。

## 进出画中画的页内提示

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-feedback
```

`pip-feedback` 把页内画中画绑成 `P`。成功进入时页面顶部出现和倍速提示同一块字样 `Picture-in-picture on`，成功退出时是 `Picture-in-picture off`。音量药丸、弹出面板和页内键都会让页面出现这两句。字样不接收点击，不盖住播放器底部控件，出现后会自己消失。铺满窗口时仍在顶部。输入框聚焦时不切换，也不出现字样。音频和网站关掉画中画时，字样是原来的短说明。没有提示总开关。`sitePrefs` 保持为空，权限仍只有 `storage`。扩展命令的成功字样由 `tests/pip-feedback.test.ts` 覆盖，无头 Chromium 按键不会派发扩展命令。它会改写 profile，成功时恢复默认，同一会话只能跑一次。步骤见 `features/pip-feedback.md`。

写入 `pip-feedback/`：`fixture-before.png`、`toast-float-on.png`、`toast-float-off.png`、`toast-panel-on.png`、`toast-panel-off.png`、`toast-key-on.png`、`toast-key-off.png`、`toast-fullscreen.png`、`toast-fullscreen-off.png`、`fixture-typing.png`、`toast-audio.png`、`toast-off.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 面板与浮动标出画中画中

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-active
```

`pip-active` 在 `/video` 上补一帧画面后，从音量药丸进入画中画。药丸和弹出面板的按钮都变成 `Exit picture-in-picture` 并按下，短状态是 `In picture-in-picture`。再从面板退出，两边恢复，短状态消失。`/feed` 上只让当前选中的一条进入画中画，列表给它标 `PiP`；改选另一条后按钮回到进入，标记留在原来那一条。`/audio` 不出现 `In picture-in-picture`。不写 `sitePrefs`，权限仍只有 `storage`。它不改 profile。步骤见 `features/pip-active.md`。

写入 `pip-active/`：`pill-before.png`、`popup-before.png`、`pill-entered.png`、`popup-entered.png`、`pill-exited.png`、`popup-exited.png`、`popup-switched.png`、`pill-audio.png`、`popup-audio.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 切走标签后扩展命令仍控画中画

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-away-tab
```

`pip-away-tab` 打开设置页，快捷键说明里有一句：离开标签后，画中画里的媒体用扩展快捷键。`/video` 补一帧后从音量药丸进入画中画，再打开 `/audio`。`Alt+M` 静音的是音频，画中画里的视频仍静音、仍在播放、仍在画中画。回到视频页，`Alt+M` 能取消这条视频的静音。焦点在文本框里时再按，视频保持有声。不写 `sitePrefs`，权限仍只有 `storage`。扩展命令改投到画中画标签由 `tests/pip-away-tab.test.ts` 覆盖，无头 Chromium 按键不会派发扩展命令。它不改 profile。步骤见 `features/pip-away-tab.md`。

写入 `pip-away-tab/`：`settings-note.png`、`away-tab.png`、`typing.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 切走标签时自动进入画中画

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-hide
```

`pip-auto-hide` 先确认设置页「Playback」的 `Picture-in-picture when you switch tabs` 默认关，关着时播放中的 `/video` 切走标签不进画中画。打开后，点一下页面再切走，`#media` 进入画中画，回来后药丸是退出态。从药丸退出后马上再切走不进，过了 10 秒冷却又会进。暂停中、`/audio` 循环播放中、网站规则排除本站时都不进。页面激活过期后不点页面直接切走，浏览器拒绝，页面出现原来的手势短句，不出现成功字样，也没有警告；马上再切走仍不进。结束时关掉开关、恢复全部网站，`sitePrefs` 为空，权限仍只有 `storage`。会话的 Playwright 让页面永远 `visible`，所以这一程另起一个不带 Playwright 默认覆盖的同版本 Chromium（profile 在 `/tmp/ottertap-verify/<id>/profile-pip-auto-hide`），结束时只停掉自己 spawn 的进程。整程约 45 秒。它不改会话的 profile。步骤见 `features/pip-auto-hide.md`。

写入 `pip-auto-hide/`：`settings-off.png`、`fixture-off.png`、`settings-on.png`、`pill-entered.png`、`fixture-paused.png`、`fixture-refused.png`、`fixture-audio.png`、`fixture-excluded.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 主视频滚出视口时自动进入画中画

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-scroll
```

`pip-auto-scroll` 先确认设置页「Playback」的 `Picture-in-picture when the video scrolls out of view` 默认关，关着时 `/feed` 上播放中的 `Main player` 被滚走不进画中画。打开后 `autoPipOnHide` 不跟着变。只往下滚到露出约三成不进；点一下页面再滚走，`#media` 进入画中画，滚动抖动不重复进。在视口外关掉画中画后点页面不再进，滚回来再滚走又进。点击激活过期后单纯滚走被浏览器拒绝，出现原来的手势短句且不出现成功字样，马上点页面不进，过了约 10 秒再点才进。暂停中不进，在视口外开始播放就进。选中 `Feed preview` 时小卡片和未选中的主视频都不进。网页全屏标记在时不进，去掉后点一下就进；Fullscreen API 全屏里开始播放不进，退出后按规则进。结束时关掉开关，`sitePrefs` 为空，权限仍只有 `storage`。这一程和 `pip-auto-hide` 一样另起不带 Playwright 默认覆盖的 Chromium（profile 在 `/tmp/ottertap-verify/<id>/profile-pip-auto-scroll`）。整程约 90 秒。它不改会话的 profile。步骤见 `features/pip-auto-scroll.md`。

写入 `pip-auto-scroll/`：`settings-off.png`、`fixture-off.png`、`settings-on.png`、`fixture-partial.png`、`fixture-entered.png`、`fixture-refused.png`、`fixture-retry.png`、`fixture-paused.png`、`fixture-card.png`、`fixture-fullscreen.png`、`fixture-after-fullscreen.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 回到标签或视频回到视口时自动退出画中画

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-exit
```

`pip-auto-exit` 先确认设置页「Playback」的 `Leave picture-in-picture when you return to the tab or the video` 和两个自动进入开关默认都关。只开切走开关时，`/video` 切走自动进入、回来仍留着。打开自动退出后，两个进入开关不被改动；切走自动进入，回到标签约半秒后自己退出，视频继续播放；紧接着再切走不会马上又进。从药丸手动进入的画中画，切走再回来不被关。自动进入后只在标签上停约 150ms 就又切走，不退出；停下来后才退。换成只开滚出开关，`/feed` 上滚走自动进入，只滚回一点（露出约三成）不退，滚回播放器后退出，马上再滚走不又进。滚走自动进入后切走再回来、视频仍在视口外时不退，滚回才退。关掉自动退出后，滚回来画中画留着。成功进出时的短暂字样约 1.2 秒后清掉，这一程后段读到的是空行，没有警告。结束时三个开关都关、`sitePrefs` 为空，权限仍只有 `storage`。和另外两条自动画中画旅程一样另起不带 Playwright 默认覆盖的 Chromium（profile 在 `/tmp/ottertap-verify/<id>/profile-pip-auto-exit`），结束时只停自己 spawn 的进程。整程约 90 秒。它不改会话的 profile。步骤见 `features/pip-auto-exit.md`。

写入 `pip-auto-exit/`：`settings-off.png`、`fixture-off.png`、`settings-on.png`、`fixture-returned.png`、`pill-manual.png`、`fixture-partial.png`、`fixture-scrolled-back.png`、`fixture-away-tab.png`、`fixture-switch-off.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 不自动画中画的站点

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-excluded-sites
```

`pip-auto-excluded-sites` 先确认设置页「Playback」三个自动开关下面的 `Sites without automatic picture-in-picture` 默认为空，说明写着与 Site rules、Sites without the floating button 分开。三个开关都关时，弹出面板站点行没有 `No auto picture-in-picture on this site`。三个开关都开后，`/video` 切走自动进入、回来自动退出，作为对照。弹出面板点一下该按钮，按钮变为按下，存储 `ottertap-settings-v1.autoPipExcludedSites` 只多出 `media.ottertap.test`，`floatingHiddenSites`、`siteMode`、`sites` 不动。之后同站切走不进、`/feed` 滚走主播放器也不进；从药丸手动进出画中画照常。撤销后滚走自动进入，画中画开着时再加入名单，滚回来不再自动退出。`elsewhere.test` 仍会自动进入和退出。设置页名单按主机名筛选、无匹配提示、逐个删除，导出文件带名单，导入后名单回来；弹出面板撤销后本站恢复自动进出。结束时三个开关都关、名单为空、`sitePrefs` 为空，`unknownStorageKeys` 为空，权限仍只有 `storage`。和另外三条自动画中画旅程一样另起不带 Playwright 默认覆盖的 Chromium（profile 在 `/tmp/ottertap-verify/<id>/profile-pip-auto-excluded-sites`）；这种浏览器不给 Playwright 下载事件，导出改由 CDP `Browser.setDownloadBehavior` 存进临时目录再读。整程约 60 秒。它不改会话的 profile。步骤见 `features/pip-auto-excluded-sites.md`。

写入 `pip-auto-excluded-sites/`：`settings-empty.png`、`popup-switches-off.png`、`popup-excluded.png`、`fixture-hide-skipped.png`、`fixture-scroll-skipped.png`、`pill-manual.png`、`popup-included.png`、`popup-excluded-while-open.png`、`fixture-exit-skipped.png`、`fixture-elsewhere.png`、`settings-listed.png`、`export.json`、`popup-restored.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 自动进出画中画的反馈

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-auto-feedback
```

`pip-auto-feedback` 先读设置页「Playback」三个自动开关上方的说明，确认默认全关、只动正在播放的选中视频、手动进出仍可用。打开切走和回来退出后，`/video` 点一下再切走：进入画中画，提示记录里恰好一次 `Picture-in-picture on`。回到标签：出现 `Picture-in-picture off`，这块是 `role="status"` 且不挡点击，画中画空。马上再切走不进，开的次数仍是 1。`/audio` 切走出现一次音频短句，不出现成功字样；马上再切走这句不重复。`/pip-off` 切走出现一次站方关闭短句。关掉切走、打开滚出后，`/feed` 主播放器滚走进入一次；在滚出位置附近抖动再点一下，不重复进出也不再提示。只露出约三成不退。滚回页顶退出，关的字样恰好一次。等退出冷却和点击激活过期后再滚走：出现原来的手势短句，马上点页面不进，约 10 秒后再点才进。结束时三个开关都关，`sitePrefs` 为空，`unknownStorageKeys` 为空，权限仍只有 `storage`。这一程另起不带 Playwright 默认覆盖的 Chromium（profile 在 `/tmp/ottertap-verify/<id>/profile-pip-auto-feedback`）。整程约 40 秒。它不改会话的 profile。步骤见 `features/pip-auto-feedback.md`。

写入 `pip-auto-feedback/`：`settings-intro.png`、`toast-off.png`、`toast-audio.png`、`toast-scroll-off.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 接着看：保存进度

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive resume-save
```

`resume-save` 临时拦截 `https://lecture.ottertap.test`，打开 300 秒、按 Range 返回 https 地址的讲座视频，停在 40 秒后从弹出面板播放。3 秒时 `chrome.storage.local` 里还没有 `ottertap-resume-v1:` 键；约 10 秒后出现一条，`page` 去掉了 `#` 片段，`media` 是 `src:` 加来源和路径。点暂停立刻写成暂停处的时间。关标签再开，这条和写入时间都不变。`/long`（data 地址、120 秒）记成 `dur:120`，`/video` 短片和 `/unseekable` 不写。拖到片尾附近再播放暂停，这一条被删掉。清掉账本键后重开页面不会冒出旧进度。设置原文不变，权限仍只有 `storage`。这一程不自动跳回，那属于后续功能。它只动账本键，不改设置。步骤见 `features/resume-save.md`。

写入 `resume-save/`：`lecture-playing.png`、`popup-paused.png`、`reopened.png`、`long-saved.png`、`ledger.json`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 睡眠定时

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive sleep-timer
```

`sleep-timer` 先在没有媒体的 `/silent` 上确认面板标题栏的 `Sleep timer` 标为不可用，点开只写着 `No media to pause on this page.`。`/long` 上入口默认只有图标、面板高度不超过 600px，点开有 `Pause in 15 minutes` 到 `Pause in 60 minutes` 四档和 `Custom minutes`；选 15 分钟后按钮显示倒计时，再用自定义 1 分钟替换。`/feed` 上对 `Feed preview` 开 1 分钟后换到 `Main player`，两条都不立刻停。关掉面板再开，倒计时还在。约 60 秒后 `/long` 暂停、进度留在原处、标签还开着；`/feed` 只停 `Main player`。设置原文不变，存储里没有定时，权限仍只有 `storage`。为了等到期，整程约 70 秒。它不改 profile。步骤见 `features/sleep-timer.md`。

写入 `sleep-timer/`：`popup-no-media.png`、`popup-off.png`、`popup-presets.png`、`popup-15.png`、`popup-custom.png`、`feed-switched.png`、`popup-reopened.png`、`popup-expired.png`、`fixture-paused.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 睡眠定时：取消与再续 15 分钟

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive sleep-timer-cancel
```

`sleep-timer-cancel` 在正在播放的 `/long` 上用自定义 1 分钟开定时，弹层里出现 `Cancel sleep` 和 `Add 15 minutes`。点续时后剩余大约增加 15 分钟，并出现 `Added 15 minutes.`。点取消后倒计时消失，出现 `Sleep cancelled. Playback is unchanged.`，档位还在，媒体仍在播。关掉面板再打开，定时不再出现。再设 1 分钟证明误触可以设回，然后再次取消。`/feed` 上对 `Feed preview` 开 1 分钟后换到 `Main player`，两条都不立刻停，倒计时还在；取消后两条仍在播。接着等到第一次再设的那 1 分钟过去，`/long` 仍在播、进度往前走、标签还开着。设置原文不变，存储里没有定时，权限仍只有 `storage`。页内短暂提示不在这一程。它不改 profile。为了等到被取消的那 1 分钟，整程大约 70 秒。步骤见 `features/sleep-timer-cancel.md`。

写入 `sleep-timer-cancel/`：`popup-running.png`、`popup-extended.png`、`popup-cancelled.png`、`popup-reopened.png`、`popup-rearmed.png`、`feed-switched.png`、`feed-cancelled.png`、`fixture-still-playing.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 睡眠定时：到期与临近页内提示

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive sleep-timer-hints
```

`sleep-timer-hints` 先确认设置页 `Warn about a minute before` 默认开。`/long` 上用自定义 2 分钟开定时，页面出现 `Sleep 2 min`，随后消失，媒体仍在播。取消后出现 `Sleep cancelled`，播放不变。再设 2 分钟，大约 60 秒后出现 `About 1 minute left`，再到点出现 `Sleep timer ended, paused` 并暂停。关掉开关后再设 2 分钟，开始和取消仍有提示，至少 70 秒内不再出现临近那句。成功时把开关开回去。字样与倍速提示同一块，不挡点击。权限仍只有 `storage`。整程大约 4 分钟。步骤见 `features/sleep-timer-hints.md`。

写入 `sleep-timer-hints/`：`settings-on.png`、`toast-start.png`、`toast-cancel.png`、`toast-start-again.png`、`toast-soon.png`、`toast-due.png`、`fixture-paused.png`、`settings-off.png`、`toast-start-while-off.png`、`toast-cancel-while-off.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 本集剩余

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive remaining-at-rate
```

`remaining-at-rate` 在暂停的 `/long` 上确认进度条还在，并且 `#episode-remaining` 按 1× 写出本集剩余。点 `2× speed` 后秒数约为媒体时钟剩余的一半，再点 `1.5× speed` 数字再变。接着开 15 分钟睡眠，状态是 `Sleep left …`，本集那一句仍在，两句不混。取消后把这条视频换成无限时长的直播，这一行消失、右侧变成 `Live`。`/unseekable` 上也不出现，右侧是 `--:--`。面板高度不超过 600px。设置原文不变，权限仍只有 `storage`。它不改 profile。步骤见 `features/remaining-at-rate.md`。

写入 `remaining-at-rate/`：`popup-1x.png`、`popup-2x.png`、`popup-1.5x.png`、`popup-with-sleep.png`、`popup-live.png`、`unseekable-popup.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 睡眠定时：快捷键与扩展命令

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive sleep-hotkeys
```

`sleep-hotkeys` 先确认 manifest 里 `sleep-start`、`sleep-cancel` 没有建议键、原来的 4 个建议键不变、浏览器命令列表里两条为空，设置页两条扩展命令和两个页内键都是 `Not set`，`Restore default keys` 不可点。录 `,` 时提示被逐帧占用，录 Z 给开始、再给取消录 Z 时提示被开始占用，改录 X。`Shortcut sleep length` 默认 `30 min`。`/long` 上按 Z 出现 `Sleep 30 min`，倒计时约 30 分钟；改成 `15 min` 后不刷新再按 Z，从现在起约 15 分钟。按 X 出现 `Sleep cancelled`，播放不变；再按 X 出现 `No sleep timer is running.`。输入框聚焦时 Z、X 只输入字符。`Restore default keys` 后按 Z 不再开始。权限仍只有 `storage`，`sitePrefs` 仍为空。它会改 profile，退出前恢复默认键，成功时把时长改回 30 分钟。整程约 25 秒。扩展命令的按键分发由单元测试覆盖。步骤见 `features/sleep-hotkeys.md`。

写入 `sleep-hotkeys/`：`settings-unbound.png`、`settings-conflict.png`、`settings-bound.png`、`settings-length-30.png`、`toast-start-30.png`、`popup-30.png`、`settings-length-15.png`、`toast-start-15.png`、`popup-15.png`、`toast-cancel.png`、`popup-cancelled.png`、`toast-idle.png`、`fixture-typing.png`、`settings-restored.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 浮动旁注：睡眠倒计时

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive floating-sleep-note
```

`floating-sleep-note` 在 `/keys` 上确认开关默认关闭时，开着 15 分钟睡眠，旁注仍是 `On-page volume 100%`。打开 `Countdown while sleeping` 后，旁注变成 `Sleep 14:59` 这种，并继续往下走；半隐藏时整段在视口内。取消后回到音量。导出文件带上 `floatingSleepNote: true`，关掉再导入后再次开定时，旁注又是倒计时。结束时关掉开关并取消定时。贴边仍在右侧，`sitePrefs` 为空，工具栏角标在 100% 时仍是空的。权限仍只有 `storage`。它会改 profile，成功时恢复关闭。步骤见 `features/floating-sleep-note.md`。

写入 `floating-sleep-note/`：`note-off.png`、`settings-off.png`、`settings-on.png`、`note-countdown.png`、`note-restored.png`、`export.json`、`note-imported.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 只听当前

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive listen-current
```

`listen-current` 先只开着正在出声的 `/tone-current`。没有 `Only this tab`，也没有 `Mute others`。把当前标签交给浏览器静音后，按钮和空列表说明在同一行；点下去只取消当前标签的静音，媒体音量不变，批次记下静音前态。关掉弹出面板再打开，撤销还在，点撤销后当前标签回到静音。单媒体视频面板不超过 600px 由 `pnpm e2e` 的「单媒体弹出面板」覆盖。

再取消当前标签的静音，打开音乐和会议，并把 `Held tab` 预先静音。点 `Hear only this tab` 只静音仍在发声的音乐和会议，Held 和当前标签不进批次，`Mute others` 仍在。撤销后那两条恢复。接着把当前标签静音再点一次：当前标签的喇叭打开，音乐和会议静音，批次含当前标签的静音前态。音乐那一行取消静音，并把当前标签再次静音后，撤销只恢复会议。设置原文不变，权限仍只有 `storage`。面板高度不超过 600px。它不改 profile。步骤见 `features/listen-current.md`。

写入 `listen-current/`：`popup-idle.png`、`popup-empty-muted.png`、`popup-empty-heard.png`、`popup-empty-undone.png`、`popup-ready.png`、`popup-heard.png`、`popup-later.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

## 只听当前与撤销的快捷键

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive quiet-hotkeys
```

`quiet-hotkeys` 确认 manifest 里 `listen-current`、`undo-mute-others` 没有建议键，原来的 4 个建议键不变，浏览器命令列表里两条为空。设置页两条扩展命令和两个页内键都是 `Not set`，`Restore default keys` 不可点。录 `,` 时提示被逐帧占用，录 Y 给只听当前，再给撤销录 Y 时提示被只听当前占用，改录 U。

只打开正在播放的 `/tone-current`，不打开弹出面板，按 Y 出现 `No other tab is playing, and this tab is already audible.`。加上音乐并把 Held 预先静音后，按 Y 只静音音乐，成功没有新提示。按 U 恢复，再按 U 出现 `Those tabs can't be safely unmuted.`。输入框、文本域、可编辑区域和组合输入不触发。当前标签被浏览器静音时，Y 会取消它并静音音乐，U 再设回去。导出带上这两个键，恢复默认后导入能用回来。结束时恢复默认键。权限仍只有 `storage`，`sitePrefs` 仍为空。它会改 profile，退出前恢复默认键。扩展命令的按键分发由单元测试覆盖。步骤见 `features/quiet-hotkeys.md`。

写入 `quiet-hotkeys/`：`settings-unbound.png`、`settings-conflict.png`、`settings-bound.png`、`toast-idle.png`、`fixture-heard.png`、`toast-undo-idle.png`、`fixture-typing.png`、`export.json`、`state.json`（成功时 `ok: true`）、`transcript.txt`。全屏可用时还有 `fixture-fullscreen.png`。

## 播放时自动静音其他

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive auto-mute-others
```

`auto-mute-others` 确认「Mute other tabs when this starts playing」默认关闭。关闭时，在 `/video` 上对媒体按空格，正在出声的 `/tone-music` 保持有声。打开后，只开面板或切换标签不静音。弹出面板的播放，以及在小獭正在控制的那条媒体上按空格，会像「静音其他」一样静音当时正在出声的其他标签；当前标签的浏览器静音和媒体音量不动，并出现 `Undo mute others`。已经在播、网页自己 `play()`、后台标签、站点自己的播放按钮都不会。成功或撤销之后 5 秒内不再自动静音，到点可以；这 5 秒不挡住手动的 `Mute others` 和撤销。多个 frame 只记一批。导出带上这个开关；删掉该键再导入则保持关闭。结束时关掉开关。权限仍只有 `storage`。站点按钮和 `video.play()` 不算播放意图。步骤见 `features/auto-mute-others.md`。

写入 `auto-mute-others/`：`settings-off.png`、`settings-on.png`、`popup-muted.png`、`export.json`、`import-without-key.json`、`state.json`（成功时 `ok: true`）、`transcript.txt`。
