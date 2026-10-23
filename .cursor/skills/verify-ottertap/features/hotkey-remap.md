# 页内快捷键改键

设置页「Keyboard shortcuts」（`#shortcuts`）里，可改键的页内动作把按键显示成按钮，旁边带铅笔图标：播放暂停 `K`、后退 `J`、前进 `L`、静音 `M`、加快 `>`、减慢 `<`、按住临时加速 `S`（单键模式那一组），以及逐帧 `,` / `.`（「On-page shortcuts」那一组，不需要单键模式）。默认键位和改键前一致。

点按钮进入录键，按钮名变成 `Press a key`，再按新键即保存到 `ottertap-settings-v1` 的 `keybinds`。只按修饰键时继续等。`Esc`、`Tab` 或离开按钮取消。字母大小写跟 Shift 走，`Shift + K` 和 `K` 是两个键；空格记作 `Space`。Alt、Ctrl、⌘ 组合，Tab、Esc 和功能键不收，提示 `That key can't be used. ...`。

已打开的网页通过 `storage.onChanged` 立刻换成新键，不用刷新。旧键随即留给网站。固定不变的是 Alt 组合（`Alt + .` `Alt + ,` `Alt + 0` `Alt + M`、`Alt + Shift + .`）、滚轮和单键模式的方向键。

## Sub-features

- 冲突提示。新键已被另一个动作或固定方向键占用时，在该组列表下出现 `#keybind-error`（`role="alert"`），例如 `J is already used for “Back 10 seconds”. Press another key, or change that one first.` 原键不变，按钮继续等新键，不用关单键模式。
- 恢复默认。列表下方的 `Restore default keys`，默认键位时禁用。
- 说明跟着键位。`Frame step uses {back} and {forward} ...`、`Hold for a temporary speed` 和 `Short press skips, hold speeds up` 的说明里的键名随设置变化。
- 导出导入。`Export settings` 的文件带 `settings.keybinds`。导入时单项非法回到该项默认；整组撞键或占用方向键时整组回到默认。
- 同键加速。打开 `Short press skips, hold speeds up` 后，长按改过的前进 / 后退键同样进入临时档，短按跳步长。

## How to get to it (user POV)

1. 打开 `chrome-extension://<extensionId>/options.html#shortcuts`。
2. 点 `Single-key mode keys` 里 `K` 那个按钮，按 `P`。
3. 回到已经打开的视频页，不刷新，按 `P` 播放或暂停；`K` 交给网站。
4. 想换回来，点 `Restore default keys`。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive hotkey-remap
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile（打开单键模式、导入一份自定义键位），同一会话只能跑一次。旅程：

1. 设置页确认九个按钮的默认键和 `Restore default keys` 禁用，打开 `Single-key mode`。截图。
2. 打开 `/video`，`K` 播放再暂停。
3. 回设置页，`Play or pause` 录 `J`，断言提示文案、存储仍是 `k`、按钮仍在录键。截图。接着按 `P` 保存；`Pause, then next frame` 录 `E`。断言说明变成 `Frame step uses , and E ...`。截图。
4. 不刷新夹具页：`K` 不动，`P` 播放再暂停，`.` 不动，`E` 前进约一帧。截图。
5. `#backup` 导出，文件里 `keybinds.toggle === 'p'`、`frameForward === 'e'`。
6. 回 `#shortcuts`，`Mute or unmute` 录键时按 `Esc` 取消。点 `Restore default keys`，存储回到 `k` / `.`，夹具页 `K` 又能播放，`P` 不动。截图。
7. 导入第 5 步的文件并 `Replace settings`，存储回到 `p` / `e`，夹具页 `P` 能播放。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/hotkey-remap/`：`settings-default.png`、`settings-conflict.png`、`settings-remapped.png`、`fixture-remapped.png`、`settings-restored.png`、`export.json`、`state.json`、`transcript.txt`。

键位归一化、录键、按键识别和导入导出由 `tests/keybinds.test.ts` 覆盖。改键后的匹配、按住键、同键加速和设置页录键由 `tests/hotkey-remap.test.ts` 覆盖。

## Gotchas

- 按键识别先认打出的字：某个绑定用到它就按它算，所以 AZERTY 仍按印在键上的字。打出的字没被绑定时，按美式布局的物理键位兜底，俄文布局按 `KeyK` 位置仍是 `K`。
- 带 Shift 的命名键（`Shift + Space`、`Shift + ←`）不匹配任何绑定，留给网页。
