# 记住站点列表过滤

设置 → 已记住的站点。列表上方有一个本地过滤框，按主机名子串筛选。清空回到整张表。过滤只影响这一页上看到的行，不写入存储，也不改变「域名包含其子域名」的匹配。

## Sub-features

- 输入片段。只留下主机名包含这段文字的站点，大小写不敏感，前后空白忽略。
- 清空。过滤框空了以后，整张记住表重新出现。
- 删除。过滤状态下点某一行的 `Forget {site}`，只从原来的 `sitePrefs` 去掉这一条，没显示出来的站点还在。
- 记住此站点。弹出面板打开「记住此站点」时，新主机名写进同一张表。当前过滤词不会把它或别的站点丢掉；不匹配的新站点留在表里，清空过滤后才出现。
- 无匹配。一句 `No remembered sites match.`，不留空的列表壳。还没有任何记住站点时，仍是原来的空表说明，不出现过滤框。

## How to get to it (user POV)

1. 打开 `chrome-extension://<extensionId>/options.html#memory`。
2. 记住表里已经有站点时，标题下有 `textbox`，无障碍名和占位符都是 `Filter by hostname`。
3. 输入主机名片段，再点某行的 `Forget {site}`，或回到网页用弹出面板的 `Remember this site`。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-memory-filter
```

旅程会先写入 `alpha.test`、`beta.example`、`gamma.example`，再打开设置页。输入 `example` 后只剩 `beta.example` 和 `gamma.example`。然后在 `/video` 的弹出面板打开 `Remember this site`，存储里多出 `media.ottertap.test`，`alpha.test` 仍在，过滤结果不变。清空后四条都在。再滤回 `example` 并忘记 `beta.example`，存储只少这一条。输入 `zzzz` 时出现 `No remembered sites match.`，`#memory` 里没有 `role="list"`。

它会改写 profile，同一会话只能跑一次。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/settings-memory-filter/`：`list-all.png`、`filtered.png`、`remembered.png`、`forgotten.png`、`no-match.png`、`state.json`、`transcript.txt`。

子串与父子域匹配的差别，以及空表不出现过滤框，由 `tests/settings-memory-filter.test.ts` 覆盖。
