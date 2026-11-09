# 撤销静音其他

弹出面板在「其他正在播放的标签页」标题旁，除了原来的 `Mute others`，在有可撤销记录时多一颗 `Undo mute others`。它只恢复最近一次实际把有声标签改成静音的那一批，而且只恢复现在仍能证明是这次操作留下的标签。原先已经静音的标签不记入这一批。没有记录时按钮不出现。

记录放在 `chrome.storage.session` 的 `ottertap-mute-batch-v1`。关掉弹出面板再打开，同一次浏览器会话里还能撤销。浏览器重启后没有了。它不进设置，也不进导出的备份。

撤销不会把所有静音标签都打开。静音其他的批次不含当前标签，所以这一次不会静音或恢复它。只听当前若取消了当前标签的静音，那一条记在同一批次里，撤销会把那个静音前态放回去。页面里的音量滑块不动。关掉的标签跳过。点过一次之后记录被消费，不能再撤销。空的或失败的静音不会清掉上一条有效记录。

归属看浏览器返回的 `mutedInfo`：必须仍是静音，原因是 `extension`，并且 `extensionId` 是本扩展。用户、采集或其他扩展改过之后，或者这些字段缺失，这一条就不恢复。静音之后又在行里取消静音、再静音，中间那次变化会让这一条失去资格，即使最后看起来又是本扩展静音的。

同一次扩展把已经静音的标签再写成静音（值没变）时，Chromium 的 `mutedInfo` 往往完全一样，扩展分不清这是不是同值的再点一次。这种看不出来的重复不会扩大恢复范围：字段只要对不上就不恢复；字段仍对得上就仍视为这次操作。旅程把这次同值调用前后的 `mutedInfo` 记在 `state.json` 的 `probe` 里。

`Mute others` 真的静音了至少一个标签、撤销真的恢复了至少一个标签后，页面上出现 `Muted other tabs` 或 `Mute undone`，见 [quiet-feedback.md](quiet-feedback.md)。

## Sub-features

- 记下实际改动。只有从有声变成静音、并且静音结果能证明是本扩展的标签才进入批次。
- 撤销。点 `Undo mute others` 后，这些标签的浏览器喇叭回到点之前。按钮消失。
- 原先已静音。静音其他之前就静音的标签保持静音。
- 后来改过。行里取消静音再静音之后，撤销不再打开那一条。
- 关掉。批次里的标签已经关掉时跳过，不报错；一条都不剩时说明 `Those tabs can't be safely unmuted.`，并消费记录。
- 失败。静音调用失败，或撤销时浏览器没有改回原来的喇叭：不把失败说成成功。整批都失败时保留上一条有效记录。单元测试覆盖。
- 重开。关掉弹出面板再打开，撤销还在。
- 重复点。已经全部静音时再点 `Mute others` 不覆盖记录。撤销消费后按钮没有了。
- 不进备份。设置原文不变，权限仍只有 `storage`。

## How to get to it (user POV)

1. 当前标签在出声，另外至少两个标签也在出声。
2. 打开弹出面板，点 `Mute others`。
3. 标题旁出现 `Undo mute others`。
4. 误触时点它。仍属于这次操作的标签恢复出声；你后来又改过的、本来就静音的、已经关掉的都不动。
5. 再点一次没有这颗按钮。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive mute-others-undo
```

它不改 profile。夹具是 `/tone-current`、`/tone-held`、`/tone-music`、`/tone-restored`、`/tone-meeting`、`/tone-gone`。

1. 五个出声标签里，先把 `Held tab` 用浏览器静音。弹出面板没有 `Undo mute others`。截 `popup-ready.png`。
2. 点 `Mute others`。音乐、恢复、会议三条进入批次，Held 和当前页不在。四条浏览器喇叭都是静音，媒体音量不变。出现撤销。截 `popup-muted.png`。
3. 再点一次 `Mute others`。批次不变。
4. 对会议标签再调用一次同值 `tabs.update({ muted: true })`，记下前后的 `mutedInfo`。
5. 关掉弹出面板再打开。撤销还在。截 `popup-reopened.png`。
6. 音乐那一行取消静音再静音。它退出批次。截 `popup-later.png`。
7. 关掉会议标签，点撤销。只有 `Restored tab` 恢复出声。音乐和 Held 仍静音，当前页不动，会议标签已不在。按钮消失，再点不到。截 `popup-undone.png`。
8. 把恢复的那条再次静音，新开 `Gone tab` 并静音其他。只记下这一条。关掉它再撤销。出现 `Those tabs can't be safely unmuted.`，其他静音标签不被打开。截 `popup-unavailable.png`。

整批静音失败、以及撤销调用失败，由 `tests/mute-undo-background.test.ts` 覆盖。面板文案和重复点击由 `tests/mute-undo.test.ts` 覆盖。

## Evidence

- `popup-ready.png` — 静音前没有撤销
- `popup-muted.png` — 静音后出现撤销
- `popup-reopened.png` — 重开弹出面板
- `popup-later.png` — 后来又静音的那一条
- `popup-undone.png` — 撤销之后
- `popup-unavailable.png` — 关掉后无法安全恢复
- `state.json` — 成功时 `ok: true`，`probe` 是同值静音前后的 `mutedInfo`
- `transcript.txt`
