# 只听当前

弹出面板在「其他正在播放的标签页」标题旁，保留原来的 `Mute others`，另加 `Only this tab`。可访问名是 `Hear only this tab`。一点做两件事：把列表里仍在发声的其他标签交给浏览器静音；若当前标签自己被浏览器静音，则取消。已经静音的其他标签不动。不改任何页面里的媒体音量或静音，也不改其他标签的音量数字。

列表为空、但当前标签被浏览器静音时，按钮仍可点，和空列表说明排在同一行，只取消当前标签的静音。列表为空且当前没有被静音时，按钮不出现，避免把单媒体面板撑过 600px。列表还在、但里面没有仍在发声的标签、当前也没有被静音时，按钮不可用，并说明 `No other tab is playing, and this tab is already audible.`

它复用撤销静音其他的批次 `chrome.storage.session` / `ottertap-mute-batch-v1`，不新开存储键。实际把有声改成静音的其他标签照旧记下。若这次取消了当前标签的浏览器静音，同一批次再记下当前标签的静音前态（原来是静音，写成未静音）。点 `Undo mute others` 时，在归属仍可靠的范围内恢复点之前的格局，包括把当前标签设回静音。静音其他自己的批次仍然不含当前标签，也不会因为撤销去打开它。

归属看浏览器返回的 `mutedInfo`：必须仍是这次写下去的静音值，原因是 `extension`，并且 `extensionId` 是本扩展。用户、其他扩展或后来的行内切换改过之后，这一条跳过，不猜。关掉的标签跳过。有的标签写失败时，面板说明 `Couldn't leave only this tab audible.`，不把没写成的标签记进批次，也不把整次说成成功。一次都没写成功时，不覆盖上一条有效记录。

成功后（至少改写了一个标签且没有失败），页面上出现一条短提示 `Hearing only this tab`，见 [quiet-feedback.md](quiet-feedback.md)；失败仍只在面板里说明。

## Sub-features

- 当前已可听。效果与只静音列表里仍在发声的标签相同。当前标签不进批次。
- 当前被浏览器静音。其他发声标签静音，当前标签的喇叭打开。媒体音量不变。
- 空列表。只有当前被静音时，按钮和空列表说明在同一行，可以点。点完可以撤销回静音。当前未静音时按钮不出现。
- 原先已静音。列表里已经静音的标签不改写。
- 撤销。恢复这次实际改过、且仍能证明是这次操作的标签，包括当前标签原来的静音。
- 后来改过。行里取消静音，或当前标签又被静音之后，撤销跳过那一条。
- 失败。有的标签没写成时给出失败说明。整批都失败时保留上一条记录。单元测试覆盖。
- 不进备份。设置原文不变，权限仍只有 `storage`。不新开存储键。

## How to get to it (user POV)

1. 打开正在出声的页面。若没有其他发声标签，而且这一页的喇叭开着，看不到 `Only this tab`。
2. 若这一页的喇叭被关掉，即使没有其他标签，也可以点 `Only this tab`，这一页恢复出声。
3. 另外有标签在出声时，点一下：那些标签的喇叭关掉，这一页的喇叭开着。
4. 误触时点 `Undo mute others`。刚才被这次改过的标签回到点之前，包括这一页原来的静音。后来又改过的不跟着动。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive listen-current
```

它不改 profile。夹具是 `/tone-current`、`/tone-held`、`/tone-music`、`/tone-meeting`。

1. 只有正在出声的 `/tone-current`。没有 `Only this tab`，也没有 `Mute others`。截 `popup-idle.png`。单媒体视频面板的高度由 `pnpm e2e` 里「单媒体弹出面板」确认不超过 600px。
2. 把当前标签交给浏览器静音。按钮可点。截 `popup-empty-muted.png`。点 `Hear only this tab`。当前标签恢复出声，媒体音量仍约 40%。批次只有当前标签，前态是静音。截 `popup-empty-heard.png`。
3. 关掉弹出面板再打开，撤销还在。点撤销。当前标签回到浏览器静音。截 `popup-empty-undone.png`。
4. 取消当前标签的浏览器静音，打开音乐和会议并等它们出声，再把 `Held tab` 静音。两个按钮都可点。截 `popup-ready.png`。
5. 点 `Hear only this tab`。音乐和会议被静音，Held 和当前标签的喇叭不变。批次只有音乐和会议，不含当前标签。三页媒体音量不变。截 `popup-heard.png`。
6. 撤销后音乐和会议恢复，Held 仍静音，当前标签仍未静音。
7. 再把当前标签静音，点 `Hear only this tab`。当前、音乐、会议都按这次改写，Held 不在批次里。
8. 音乐那一行取消静音，再把当前标签静音。点撤销。只恢复会议。音乐保持有声，当前标签保持静音，Held 不动。截 `popup-later.png`。

有的标签写失败、归属字段缺失、以及失败不覆盖旧批次，由 `tests/listen-current-background.test.ts` 覆盖。按钮文案和部分失败的面板表现由 `tests/listen-current.test.ts` 覆盖。

## Evidence

- `popup-idle.png` — 空列表且当前可听，按钮不出现
- `popup-empty-muted.png` — 空列表但当前被静音，按钮可点
- `popup-empty-heard.png` — 只取消了当前标签的静音
- `popup-empty-undone.png` — 撤销后当前标签回到静音
- `popup-ready.png` — 其他标签在出声，当前可听
- `popup-heard.png` — 只静音了仍在发声的其他标签
- `popup-later.png` — 后来改过的标签没有被撤销打开
- `state.json` — 成功时 `ok: true`
- `transcript.txt`
