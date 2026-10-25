# 清空全部已记住的站点

设置 → 已记住的站点。名单有条目时，标题旁有「清空全部」。点一次只打开确认，再点确认才删除全部 `sitePrefs`。取消则一张表都不改。确认文案写明：除非自己已经有备份，否则无法撤销；网站规则、不显示浮动按钮的站点和其他设置保持不变。筛选只影响看到的行，清空仍然删掉没显示出来的站点。

## Sub-features

- 清空全部。只出现在记住站点区。表是空的时候不出现。
- 二次确认。第一下只展开确认。确认按钮是破坏性操作，取消关掉确认。
- 不可撤销。文案写明除非已有自己的备份，否则无法恢复；并写明规则、隐藏浮动名单和其他设置不动。
- 全部删除。包括主机名筛选藏起来的行。删除后记住表为空，弹出面板不再把这些站点当成已记住，新打开的页面不再套用旧的音量和倍速。默认倍速仍会套用。
- 导出。清空后导出的备份里记住站点数是 0，规则和隐藏名单还在。

## How to get to it (user POV)

1. 打开 `chrome-extension://<extensionId>/options.html#memory`。
2. 记住表里已经有站点时，标题旁有按钮 `Clear all`。
3. 点它，出现标题 `Clear every remembered site?` 的确认区。取消是 `Cancel`，确认是 `Clear all remembered sites`。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-clear-remembered
```

旅程先写入 `alpha.test`、`beta.example`、`media.ottertap.test`（音量 40%、倍速 2×），网站规则排除 `rules.example`，隐藏浮动名单有 `hidden.example`，默认倍速是 `1.25×`。夹具页先套用记住的 40% 和 2×，弹出面板的 `Remember this site` 为开、音量约 40%。点 `Clear all` 后取消，存储和列表不变。再把主机名过滤成 `example`，只看见 `beta.example`，然后确认清空。记住表变空，`sitePrefs` 为 `{}`，规则、隐藏名单和默认倍速仍在。导出的 JSON 里记住站点数是 0。重新打开夹具后音量回到约 100%，倍速是默认的 1.25×，面板不再显示已记住。

它会改写 profile，同一会话只能跑一次。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/settings-clear-remembered/`：`fixture-before.png`、`popup-before.png`、`list-before.png`、`confirm.png`、`cancelled.png`、`filtered.png`、`cleared.png`、`export.json`、`fixture-after.png`、`popup-after.png`、`state.json`、`transcript.txt`。

取消不写存储、筛选藏起来的行也会被删掉、导出 0 条，以及面板开关，由 `tests/settings-clear-remembered.test.ts` 覆盖。
