# 快进 / 快退步长

设置页的「Skip step」决定弹出面板的进退按钮、展开后的浮动药丸、页内快捷键 `J` `L` `←` `→` 和扩展命令 `skip-back` / `skip-forward` 一次跳多少秒。档位是 5、10、15、30 秒，默认 10 秒。存储里不是这四个值时按 10 秒处理。

## Sub-features

- 设置控件。在设置页「Playback」一节（`#playback`，与「Lock playback speed」同节）。组名 `Skip step`（`h3#skip-seconds-label` 给 `role="group"` 命名），里面四个按钮 `5s`、`10s`、`15s`、`30s`，选中的那个 `aria-pressed="true"`，默认是 `10s`。控件没有自己的 id。说明文案是 `Popup buttons, the on-page floater, page shortcuts, and browser shortcuts all jump by this step.`，存进 `ottertap-settings-v1.skipSeconds`。
- 弹出面板。后退 / 前进按钮的无障碍名是 `Back {n} seconds` / `Forward {n} seconds`，按钮上的小数字就是 `{n}`。点一下 `currentTime` 变化 `{n}` 秒，到头尾时夹在可 seek 的范围内（`lib/media.ts`）。
- 页内快捷键。`J` 和 `←` 后退，`L` 和 `→` 前进，每次 `{n}` 秒。这四个键只在「Single-key mode」打开后才生效（设置页「Shortcuts」，开关 id 是 `settings-single-key`，默认关）。设置页「Single-key mode keys」那张表里 `J / ←`、`L / →` 的说明也带 `{n}`。
- 扩展命令。`skip-back`（建议键 `Ctrl+Shift+Comma`）和 `skip-forward`（建议键 `Ctrl+Shift+Period`），名字是 `Skip back` / `Skip forward`。后台每次触发时读当前设置的步长，不需要单键模式。

## How to get to it (user POV)

1. 打开扩展设置：弹出面板右上角 `Open settings`，或 `chrome-extension://<extensionId>/options.html#playback`。扩展 id 在 `doctor` 的输出里。
2. 在 `Skip step` 里点一个非默认档位，例如 `30s`。
3. 打开一个有视频的页面，再打开弹出面板：进退按钮变成 `Back 30 seconds` / `Forward 30 seconds`，点一下 `currentTime` 动 30 秒。
4. 要用键盘跳，先在设置页「Shortcuts」打开 `Single-key mode`，再回到页面按 `L` 或 `→`。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive skip-step
```

会话已经 `launch` 且 `doctor` 通过之后跑它。旅程用夹具 `/long`（无 `loop`、约 120 秒的静音视频，`#media`，名字 `Long video`）。`/video` 只有约 1 秒，跳 10 秒会被夹在可 seek 范围里，量不出步长，所以不能用它。每一步都从用户路径走，只有起点 `currentTime = 60` 是前置：

1. 默认设置下打开 `/long`，把 `currentTime` 设成 60，`openPopup()`。进退按钮是 `Back 10 seconds` / `Forward 10 seconds`，小数字是 `10`，都可用。点 `Forward 10 seconds`，`currentTime` 到 70；点 `Back 10 seconds` 回到 60。
2. 同一页点空白处取得焦点，按 `l`。单键模式还关着，`currentTime` 保持 60。
3. 新开设置页 `#playback`。`Skip step` 组里按钮依次是 `5s,10s,15s,30s`，只有 `10s` 按下。截图后点 `30s`，它变成按下，`chrome.storage.local` 里 `ottertap-settings-v1.skipSeconds === 30`。
4. 打开设置页 `#shortcuts`，`Single-key mode`（`role="switch"`）从 `aria-checked="false"` 点成 `true`，存储里 `singleKey === true`。`J / ←` 那一行的说明已经是 `Back 30 seconds`。
5. 再打开一个 `/long`，`currentTime` 设成 60，`openPopup()`。按钮是 `Back 30 seconds` / `Forward 30 seconds`，小数字 `30`。点 `Forward 30 seconds` 到 90，点 `Back 30 seconds` 回到 60。截 `popup-30.png`。
6. 点空白处，依次按 `l`、`j`、`ArrowRight`、`ArrowLeft`，`currentTime` 依次是 90、60、90、60。

成功时 `state.json` 的 `ok` 为 `true`，记下 `defaultButtons`、`popupButtons` 和 `keys`。证据写到 `/opt/cursor/artifacts/verify-ottertap/skip-step/`：`settings-default.png`、`settings-30.png`、`popup-10.png`、`popup-30.png`、`fixture-start.png`、`state.json`、`transcript.txt`。

没有 e2e。步长的保存、非法值回落、热键、扩展命令、弹出面板按钮名由 `tests/skip-*.test.ts` 在 fake browser 里锁住，不代替上面这条用户路径。

## Gotchas

- 扩展命令没有走通用户路径。Playwright 在无头 Chromium 里按 `Control+Shift+Period`，页面的 `currentTime` 不动，浏览器没有把它当成扩展命令。命令这一条只有 `tests/skip-command.test.ts` 的证据；真浏览器里要在 `chrome://extensions/shortcuts` 看到快捷键并按下去才算数。
- `J` `L` `←` `→` 不开单键模式就没有效果，这是设计，不是步长设置失效。步骤 2 记下的就是这件事；不要为了让快捷键「通」而省掉步骤 4。
- 在 `/video`（约 1 秒、带 `loop`）上点进退，`currentTime` 会被夹在 0 和约 1 之间，看起来像「步长不对」。换 `/long`。
- 设置页的按钮名是 `5s` 这样的短文案（`skipSecondsOption`），别用 `getByText('5')` 之类宽松匹配；弹出面板里的小数字 `30` 只是徽标，按钮名以 `aria-label` 为准。
- 步长和单键模式都写进 profile。用完 `cleanup` 丢掉 profile，下次 `launch` 回到 10 秒和单键关闭；同一会话里再跑一次这条旅程时，第 1、2 步的前提（默认 10 秒、单键关闭）不再成立，`drive skip-step` 会在第 1 步失败，先 `cleanup` 再 `launch`。
