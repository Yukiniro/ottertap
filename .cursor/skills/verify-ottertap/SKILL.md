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

`launch` 会拉起一个脱离终端的会话进程。它用 Playwright 的 `chromium.launchPersistentContext` 打开全新的 `/tmp/ottertap-verify/current/profile`，加载 `.output/chrome-mv3`，参数与 `e2e/smoke.spec.ts` 相同：`channel: 'chromium'`、`headless: true`、`locale: 'en-US'`、`--lang=en-US`，并去掉默认的 `--disable-extensions`。夹具页由这个上下文的 `route` 拦截，不访问外网，也没有单独的网站端口。

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

脚本化旅程有弹出面板播放、滚轮音量（见 `features/wheel-volume.md`）、快进快退步长（见 `features/skip-step.md`）、音量调节步长（见 `features/volume-step.md`）、倍速增减步长（见 `features/rate-step.md`）和扩展命令画中画（见 `features/extension-pip.md`）。其余功能按 `features/` 里的选择器操作；断言失败就记下来，不要放宽期望。

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive popup-playback
node .cursor/skills/verify-ottertap/scripts/session.mjs drive skip-step
node .cursor/skills/verify-ottertap/scripts/session.mjs drive volume-step
node .cursor/skills/verify-ottertap/scripts/session.mjs drive rate-step
node .cursor/skills/verify-ottertap/scripts/session.mjs drive extension-pip
node .cursor/skills/verify-ottertap/scripts/session.mjs drive default-rate
```

`skip-step` 在设置页把 `Skip step` 改成 `30s` 并打开 `Single-key mode`，再看弹出面板进退按钮名和页内 `L` / `J` / `→` / `←` 让 `/long` 夹具的 `currentTime` 跟着步长变；它会改写 profile，同一会话只能跑一次。步骤见 `features/skip-step.md`。

`volume-step` 在设置页把 `Volume step` 改成 `5%` 和 `20%`，再看同一夹具页上的悬停滚轮、Alt+滚轮和单键 ↑ ↓ 跟着步长变，并确认跨过 100% 仍先停住。它会改写 profile，同一会话只能跑一次，而且不能接在 `drive wheel-volume` 前面。步骤见 `features/volume-step.md`。

`rate-step` 在设置页把 `Speed step` 改成 `0.1×` 和 `0.5×`，再看同一夹具页上的 Alt+.、弹出面板加快 / 减慢和单键 `>` 跟着步长变，并确认到 4× 和 0.25× 仍停住。它会改写 profile，同一会话只能跑一次。步骤见 `features/rate-step.md`。

`default-rate` 在设置页确认 `Default speed` 默认是 `Follow the page`，再改成 `1.5×`，看新开的夹具视频被写成 1.5×；记住此站点为 2× 后重新加载，用记住的 2×。它会改写 profile，同一会话只能跑一次。步骤见 `features/default-rate.md`。

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
| 倍速 | `button` `1.25× speed` 这种，乘号是 `×` |
| 打开设置 | `Open settings` |
| 浮动入口 | `/volume pill/i` |
| 设置页备份 | `chrome-extension://<extensionId>/options.html#backup`，按钮 `Export settings`、`Import settings`、确认 `Replace settings` |
| 设置页步长 | `chrome-extension://<extensionId>/options.html#playback`，`group` `Skip step` 里的 `button` `5s` / `10s` / `15s` / `30s`，默认 `10s` 按下 |
| 设置页音量步长 | 同一节的 `group` `Volume step`，`button` `5%` / `10%` / `20%`，默认 `10%` 按下 |
| 设置页倍速步长 | 同一节的 `group` `Speed step`，`button` `0.1×` / `0.25×` / `0.5×`，默认 `0.25×` 按下。弹出面板加快 / 减慢的无障碍名是 `Increase speed by 0.25×` / `Decrease speed by 0.25×`，数字来自这个步长 |

`pnpm e2e` 覆盖滚轮、倍速快捷键、声道和设置页文案，测试名写在对应功能文件里。设置导出导入没有 e2e，只有 `tests/settings-backup.test.ts` 覆盖文件格式；快进快退步长没有 e2e，只有 `tests/skip-*.test.ts` 在 fake browser 里覆盖；音量步长没有 e2e，只有 `tests/volume-step.test.ts`、`tests/volume-hotkey.test.ts` 和 `tests/volume-command.test.ts` 覆盖；倍速增减步长没有 e2e，只有 `tests/rate-step.test.ts` 和 `tests/rate-step-command.test.ts` 覆盖。用户路径以功能文件为准。

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

`drive volume-step` 写入 `volume-step/`：`settings-default.png`、`settings-5.png`、`settings-20.png`、`fixture-10.png`、`fixture-5.png`、`fixture-20.png`、`fixture-snap-100.png`、`fixture-snap-120.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

`drive rate-step` 写入 `rate-step/`：`settings-default.png`、`settings-0.1.png`、`settings-0.5.png`、`fixture-default.png`、`fixture-0.1.png`、`fixture-0.5.png`、`popup-0.1.png`、`popup-limit.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

`drive default-rate` 写入 `default-rate/`：`settings-follow.png`、`fixture-follow.png`、`settings-1.5.png`、`fixture-1.5.png`、`fixture-site.png`、`state.json`（成功时 `ok: true`）、`transcript.txt`。

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
node .cursor/skills/verify-ottertap/scripts/session.mjs drive volume-step
node .cursor/skills/verify-ottertap/scripts/session.mjs drive rate-step
node .cursor/skills/verify-ottertap/scripts/session.mjs drive extension-pip
node .cursor/skills/verify-ottertap/scripts/session.mjs drive default-rate
node .cursor/skills/verify-ottertap/scripts/session.mjs cleanup
```

`launch` 内部会再拉起同一个文件的 `serve` 子进程来托住浏览器。不要单独依赖 `serve`，也不要把 `session.json` 里的令牌打到日志以外的地方。控制接口只绑在 `127.0.0.1`，请求要带这个令牌；doctor 和 drive 会自己读会话文件。

功能索引在 `features/README.md`。
