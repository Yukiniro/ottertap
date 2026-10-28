# 面板与浮动标出画中画中

当前选中的视频处于画中画时，弹出面板的画中画按钮改成 `Exit picture-in-picture` 并按下，标题行旁边出现短状态 `In picture-in-picture`。展开的音量药丸里同一个入口同步为退出，下面写同一句。本页不止一条媒体时，列表里正在画中画的那一条带短标记 `PiP`。退出、或改选另一条还没进画中画的媒体后，退出态和短状态都消失。正在画中画的那一条仍可在列表里看到 `PiP`。

音频不会出现 `In picture-in-picture`，按钮仍是进入，并沿用原来的 `Audio can't use picture-in-picture.`。动作仍是 `{ type: 'pip' }`。不写 `sitePrefs`，不改权限，也不另做贴在画面上的控制器。

## Sub-features

- 进入。视频进入画中画后，面板和药丸都能看出：按钮是退出并按下，短状态是 `In picture-in-picture`。播放或暂停那一行仍只写 `Video · Playing` 或 `Video · Paused`。
- 退出。再点一次，按钮回到 `Picture-in-picture`，短状态消失，页面不再有画中画元素。
- 换目标。两条视频里只有一条在画中画。改选另一条后，面板和药丸的按钮回到进入，短状态消失。列表里原来那一条仍标 `PiP`。
- 音频。`/audio` 的面板和药丸都没有 `In picture-in-picture`，也没有 `PiP` 标记。

## How to get to it (user POV)

1. 打开有视频的网页，从音量药丸进入画中画。回到页面后，药丸和弹出面板都写成可以退出，并写着正在画中画。
2. 再点一次退出。两边都恢复成进入，短状态消失。
3. 页面上有两条视频时，只让其中一条进入画中画，再改选另一条。控制跟着新的那一条，列表仍标出还在画中画的一条。
4. 打开音频页。看不到「画中画中」。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive pip-active
```

会话已经 `launch` 且 `doctor` 通过之后跑。它不改 profile。夹具视频本身没有画面，旅程会先补一帧再点画中画。

1. 打开 `/video`，补一帧后展开药丸。进入前按钮是 `Picture-in-picture`，没有 `#floating-pip-status`。截 `pill-before.png` 和 `popup-before.png`。
2. 点药丸里的画中画。进入后药丸按钮是 `Exit picture-in-picture` 并按下，`#floating-pip-status` 为 `In picture-in-picture`。弹出面板同一句写在 `#pip-status`，播放或暂停那一行不被改写。截 `pill-entered.png` 和 `popup-entered.png`。
3. 从面板退出。两边都回到 `Picture-in-picture`，短状态消失，`#media` 不再是画中画元素。截 `pill-exited.png` 和 `popup-exited.png`。
4. 打开 `/feed`，只给当前选中的那一条补画面并进入画中画。打开列表：那一条带 `PiP`，另一条没有。改选另一条后，按钮回到进入，`#pip-status` 消失，列表里原来那一条仍有 `PiP`。截 `popup-switched.png`。再选回那一条并退出，标记消失。
5. 打开 `/audio`。面板和药丸都没有 `In picture-in-picture`。按钮不是退出。截 `pill-audio.png` 和 `popup-audio.png`。
6. `sitePrefs` 仍是空的。清单权限仍只有 `storage`。

成功时 `state.json` 的 `ok` 为 `true`。证据在 `/opt/cursor/artifacts/verify-ottertap/pip-active/`：`pill-before.png`、`popup-before.png`、`pill-entered.png`、`popup-entered.png`、`pill-exited.png`、`popup-exited.png`、`popup-switched.png`、`pill-audio.png`、`popup-audio.png`、`state.json`、`transcript.txt`。

退出态、短状态、换选中、列表短标记，以及音频不出现「画中画中」，由 `tests/pip-active.test.ts` 覆盖。点击仍发送 `{ type: 'pip' }`。

## Gotchas

- 短状态是单独的 `#pip-status` / `#floating-pip-status`，不写进 `Video · Playing` 那一行，免得别的旅程对不上这句。
- 列表短标记是 `PiP`，和短状态 `In picture-in-picture` 不是同一句。过滤仍只看短名称。
- 无头 Chromium 里没有画面的 wav 进不了画中画。旅程先给选中的视频补一帧。
- 音频页的禁用说明里有 picture-in-picture 这几个词，但没有 `In picture-in-picture` 这一句。
