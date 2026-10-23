# 倍速

把当前媒体的 `playbackRate` 调到 0.25–4。弹出面板给出一排预设；展开后的浮动药丸用同一份预设和设置里的倍速步长，见 [floating-speed.md](floating-speed.md)。网页上按住 Alt 再按 `,` `.` `0` 按设置里的倍速步长增减（默认 0.25），或在 1× 与本页上一次非 1× 倍速之间来回切。步长见 [rate-step.md](rate-step.md)。来回切的细节见 [rate-recall.md](rate-recall.md)。

## Sub-features

- 预设按钮。弹出面板里由 `#speed-label`（文案 `Speed`）标出的那一组。每个按钮的无障碍名是 `locales/en.yml` 的 `speedOption`，例如 `1× speed`、`1.25× speed`。乘号是 `×`（U+00D7），不是字母 x。选中时 `aria-pressed` 为真。
- 不在预设上的倍速。没有任何按钮按下，面板显示 `Now 1.1×` 这种 `currentSpeed` 文案。
- Alt 快捷键。`Alt+.` 或 `Alt+>` 加速，`Alt+,` 或 `Alt+<` 减速，`Alt+0` 在 1× 和本页上一次非 1× 倍速之间来回切。物理键是 `Period`、`Comma`、`Digit0`。
- 单键模式默认关闭。打开后 `>` 和 `<` 才单独调倍速。设置开关的无障碍名是 `Single-key mode`，id 是 `settings-single-key`。
- 锁定倍速。设置页 `Lock playback speed`（`#settings-lock-rate`）。页面把倍速改回去时扩展会再写上。这条不在脚本化旅程里；失败时看媒体的 `playbackRate` 是否被改回，不要只看开关的颜色。

## How to get to it (user POV)

1. 打开有媒体的页面，再打开弹出面板，或把焦点放在页面空白处而不是输入框。
2. 点 `1.25× speed`，或按 Alt+.。
3. 听到或看到播放变快。验证时读 `#media.playbackRate`，并看弹出面板上对应按钮是否按下。

夹具 `/keys` 在 `e2e/smoke.spec.ts` 里：一个视频加一个靠下的输入框，`aria-label="Field"`。验证会话的 `route` 目前只有 `/video`。把 `/keys` 加进路由后再走快捷键，否则输入框那条前置条件不存在，旅程应失败并在这里说明，而不是改成不测输入框。

## Driving it with Playwright

回归：

```bash
pnpm exec playwright test e2e/smoke.spec.ts -g "Alt \\+ , \\. 0"
```

弹出面板路径（与播放控制同一套 `openPopup()`）：

1. 打开夹具，`openPopup()`，等到 `Media controls`。
2. 默认倍速是 1。`getByRole('button', { name: '1× speed', exact: true })` 的 `aria-pressed` 为真，`#media.playbackRate === 1`。截图。
3. 点击 `1.25× speed`。结束状态：该按钮按下，`playbackRate` 约为 1.25，`1× speed` 不再按下。再截图。
4. 网页快捷键：夹具页 `mouse.click` 到视频外的空白处取得焦点，`keyboard.press('Alt+Period')`。`playbackRate` 从 1 变为 1.25。再按一次变为 1.5。`Alt+Comma` 回到 1.25。`Alt+Digit0` 回到 1。再按一次 `Alt+Digit0` 回到 1.25。一直是 1× 且没有记过别的倍速时，`Alt+Digit0` 不改变 `playbackRate`。
5. 聚焦 `#field`（无障碍名 `Field`），再按 `Alt+Period`。`playbackRate` 保持不变。

证据同时留下按钮的 `aria-pressed` 和元素的 `playbackRate`。

## Gotchas

- 快捷键在 `input`、`textarea` 和 `contenteditable` 里不触发。输入框那一步失败时，先确认焦点真的在 `Field` 上。
- 单键模式默认关。只按 `.` 不应该改倍速。
- 步进对齐当前倍速步长的格子，默认 0.25。已经是 4 时再加速保持 4；已经是 0.25 时再减速保持 0.25。改步长后的路径见 [rate-step.md](rate-step.md)。
- macOS 上 Alt 是 Option，并且 Option 会改写出的字符。回归环境是 Linux Chromium，用 `Alt+Period` 这种物理键。
- 预设列表可以被设置页改掉。默认八个值是 0.75、1、1.25、1.5、2、2.5、3、4。空的用户目录用这一列。
