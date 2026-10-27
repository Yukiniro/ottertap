# 上一条 / 下一条媒体

页内快捷键和扩展命令都能切到页面里的上一条或下一条媒体。顺序就是当前页面里还连着的媒体，走到末尾回到第一条。默认都不占键。输入框或可编辑区域聚焦时不触发。只有一条媒体时不切换，页面顶部用和倍速提示同一块字样写 `This page only has one media.`。已经从文档上拿掉的节点不在这个顺序里。不写入记住此站点。

## Sub-features

- 改键。设置页「Keyboard shortcuts」的页内快捷键里有 `Previous media`、`Next media`。没绑定时按钮写 `Not set`。点一下再按新键，已打开的网页立即生效，不必打开单键模式。
- 冲突和恢复。录到已经被占用的键时，提示和现有改键一样，写明被谁占用，并且不保存。空着的键不算占用。`Restore default keys` 把这两项收回 `Not set`，其它默认键不动。
- 扩展命令。`media-prev`、`media-next` 出现在同一节的扩展快捷键列表和 `chrome.commands.getAll()` 里。说明分别是 `Select the previous media`、`Select the next media`。没有 `suggested_key`，未绑定时是 `Not set`。建议键仍是原来四个。`Edit shortcuts` 仍打开浏览器的快捷键页。
- 页内循环。绑了键之后，不打开单键模式。`/feed` 上从当前这条走到 DOM 顺序的下一条，再按一次回到第一条。上一条从第一条回到最后一条。轮廓只出现在刚选中的那一条上。
- 幽灵节点。插进又卸下的视频，以及从未放进文档的视频，都不会被选中。循环只停在还在页面上的那两条。
- 输入框。焦点在文本框里时，这两个键不改选中。
- 只有一条。`/video` 上按下一条不换目标，顶部出现 `This page only has one media.`。
- 不进站点记忆。`sitePrefs` 不因为这两项而多出字段。

## How to get to it (user POV)

1. 打开 `chrome-extension://<extensionId>/options.html#shortcuts`。扩展快捷键里两项都是 `Not set`。页内快捷键里两个动作也是 `Not set`。`Restore default keys` 是灰的。
2. 给下一条录一个键。如果录到已经用于逐帧的 `,`，出现占用提示，键不变。换一个没人用的键，例如 `]`。上一条同样改成 `[`。再把下一条录成 `[`，会提示已被上一条占用。
3. 打开有不止一条视频的网页。不打开单键模式。按 `]` 选中下一条，再按回到第一条。按 `[` 回到最后一条。
4. 点进页面上的文本框再按这两个键，选中不动。
5. 打开只有一条视频的网页，按 `]`。顶部出现一句说明，选中仍是这一条。
6. 点 `Restore default keys`。两个动作回到 `Not set`，`]` 不再切换。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive prev-next-media
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile，成功时把键位恢复成默认。同一会话只能跑一次，不要接在改过键位的旅程后面。

1. 从 service worker 读清单和 `chrome.commands.getAll()`。`media-prev`、`media-next` 没有 `suggested_key`，快捷键为空，说明与上面两句一致。建议键仍是 `play-pause`、`skip-back`、`skip-forward`、`mute`。权限仍只有 `storage`。
2. 打开设置页 `#shortcuts`。扩展列表这两行是 `Not set`，页内两个按钮也是 `Not set`，`Restore default keys` 禁用。截 `settings-unbound.png`。
3. 给 `Next media` 录 `,`，冲突文案与现网改键一致，不保存。截 `settings-conflict.png`。再录 `]`。`Previous media` 录 `[`。`Next media` 先录 `[` 看到占用提示，再确认仍是 `]`。单键模式仍关。截 `settings-bound.png`。
4. `/feed` 上两条视频都暂停。面板先选中 `Feed preview`。在两条之间插入 `Ghost video`，确认列表里能看见它，再把它从文档卸下，并留下一个从未插入的视频。按 `]`。面板标题变成 `Main player`，轮廓只在主视频上。截 `fixture-next.png`。再按 `]` 回到 `Feed preview`。截 `fixture-wrap.png`。按 `[` 回到 `Main player`。截 `fixture-prev.png`。
5. 焦点放进文本框，输入几个字，再按 `]` 和 `[`。标题仍是 `Main player`。截 `fixture-typing.png`。
6. `/video` 上按 `]`。状态字样为 `This page only has one media.`，标题仍是 `Fixture video`。截 `fixture-only.png`。
7. 回到设置页点 `Restore default keys`。两个按钮回到 `Not set`，按钮再次禁用。截 `settings-restored.png`。`/feed` 上 `]` 不再切换。全程 `sitePrefs` 仍是空对象。

成功时 `state.json` 的 `ok` 为 `true`。证据在 `/opt/cursor/artifacts/verify-ottertap/prev-next-media/`：`settings-unbound.png`、`settings-conflict.png`、`settings-bound.png`、`fixture-next.png`、`fixture-wrap.png`、`fixture-prev.png`、`fixture-typing.png`、`fixture-only.png`、`settings-restored.png`、`state.json`、`transcript.txt`。

无头 Chromium 的按键不会派发扩展命令。命令分发、循环、输入框聚焦时不执行、只有一条时的短说明、站点停用时不执行，由 `tests/prev-next-media-command.test.ts` 对 `commands.onCommand` 覆盖。默认不占键、冲突回默认、按页面顺序跳过已卸下的节点、按住不连发，由 `tests/prev-next-media-keybinds.test.ts` 覆盖。

## Gotchas

- 不要给这两项加 `suggested_key`。四个名额已经占满。
- 空字符串表示未绑定。冲突检测要跳过它，否则两项都未绑定时会被当成互相占用，整组键位被打回默认。
- 这两项不要求单键模式。没绑定的键不会拦截页面。
- 顺序用当前收集到的媒体列表，不按 id 数字重排。已经不在文档里的元素不进这个列表。
- 只有一条时键已经被页面吃掉，短说明是这次动作的结果。没有媒体时不提示。
- 设置页地址是 `chrome-extension://<extensionId>/options.html#shortcuts`，不是 `https://`。
