---
name: verify-ottertap
description: 启动小獭 OtterTap（WXT + React MV3 扩展）的隔离 Chromium，用 Playwright 按真实用户路径驱动弹出面板、页内快捷键和设置页，并把截图与状态写到 /opt/cursor/artifacts/verify-ottertap/。修改扩展交互、弹出面板、内容脚本、设置页或 e2e 夹具后，需要证明行为时使用。
---

# 验证小獭 OtterTap

主界面是浏览器扩展：工具栏弹出面板（`popup.html`）、设置页（`options.html`，在新标签打开），以及注入到网页开放 shadow root 里的浮动控制器。设置在 `chrome.storage.local` 的 `ottertap-settings-v1`，没有账号，也没有数据库。空的用户目录会落到代码里的默认设置（浮动控制器开、全部网站启用、悬停滚轮开、单键模式关）。

旁边还有两个表面，本技能不驱动它们：`pnpm preview` 在 `http://127.0.0.1:4186/` 用本地演示媒体渲染同一套组件；`pnpm site:dev` 在 `http://localhost:4187/` 跑官网。预览页控制的不是网页里的真实媒体。

回归套件是 `pnpm e2e`（`e2e/smoke.spec.ts`）。它和本技能使用同一份构建产物、同一个夹具主机 `https://media.ottertap.test`，以及同一套英语无障碍名。它不往证据目录写截图。功能地图里的选择器以那份测试和当前 UI 为准。

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

## Doctor

任何异常先跑这一条。它只读：进程还在、命令行是本技能的 `session.mjs`、控制端口由该 pid 监听、service worker 属于启动时的扩展 id、`chrome.runtime.getManifest().version` 等于 `package.json`、UI 语言仍是英语、`background.js` 的 mtime 与 launch 时相同。

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs doctor
```

通过时打印 `ottertap-verify doctor ok ...`。mtime 变了就先 `cleanup`，再 `pnpm build` 和 `pnpm verify-build`，然后重新 `launch`。不要在 doctor 里改存储或点击页面。

## Drive

脚本化旅程有弹出面板播放、滚轮音量（见 `features/wheel-volume.md`）、快进快退步长（见 `features/skip-step.md`）、快进快退随倍速放大（见 `features/skip-with-rate.md`）、音量调节步长（见 `features/volume-step.md`）、低音量滚轮细步长（见 `features/fine-wheel.md`）、Shift 粗调步长（见 `features/coarse-step.md`）、倍速增减步长（见 `features/rate-step.md`）、扩展命令画中画（见 `features/extension-pip.md`）、按住临时加速（见 `features/hold-boost.md`）、同键短按跳长按加速（见 `features/hold-skip-combo.md`）、逐帧（见 `features/frame-step.md`）、页内快捷键改键（见 `features/hotkey-remap.md`）、浮动药丸倍速（见 `features/floating-speed.md`）、浮动药丸播放跳转（见 `features/floating-playback.md`）、浮动入口旁注（见 `features/floating-entry-note.md`）、从音量药丸打开弹出面板（见 `features/floating-open-panel.md`）、仅在播放时显示浮动入口（见 `features/floating-while-playing.md`）和滚轮方向（见 `features/wheel-direction.md`）。仅全屏时悬停滚轮见 `features/fullscreen-wheel.md`。侧栏聊天和文档大纲忽略见 `features/sidebar-ignore.md`。设置页三处名单的「当前站」见 `features/settings-current-site.md`。记住站点的「清空全部」见 `features/settings-clear-remembered.md`。其余功能按 `features/` 里的选择器操作；断言失败就记下来，不要放宽期望。

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
node .cursor/skills/verify-ottertap/scripts/session.mjs cleanup
```

`launch` 内部会再拉起同一个文件的 `serve` 子进程来托住浏览器。不要单独依赖 `serve`，也不要把 `session.json` 里的令牌打到日志以外的地方。控制接口只绑在 `127.0.0.1`，请求要带这个令牌；doctor 和 drive 会自己读会话文件。

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
