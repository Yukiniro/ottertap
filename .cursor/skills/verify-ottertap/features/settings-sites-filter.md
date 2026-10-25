# 网站规则名单过滤

设置 → 网站规则。当前模式下列表上方有一个本地过滤框，按主机名子串筛选。清空回到整张名单。过滤只影响这一页上看到的行，不写入存储，也不改变「域名包含其子域名」的匹配。

切换「全部网站 / 仅指定网站 / 排除指定网站」时，这个过滤框清空。已记住站点的过滤框是另一份输入，两边互不影响。

## Sub-features

- 输入片段。只留下主机名包含这段文字的站点，大小写不敏感，前后空白忽略，顺序仍是名单里的顺序。
- 清空。过滤框空了以后，整张网站名单重新出现。
- 添加。过滤状态下添加域名，写进原来的 `sites`。不匹配的新站点留在名单里，清空过滤后才出现；匹配的会出现在当前结果里。
- 移除。过滤状态下点某一行的 `Remove {site}`，只从原来的 `sites` 去掉这一条，没显示出来的站点还在。
- 切换模式。改成另一种启用范围后，过滤词清空，当前名单整表出现。`sites` 本身不因切换而改写。
- 无匹配。一句 `No sites match.`，不留空的列表壳。名单本来就是空的时候，仍是原来的空表说明，不出现过滤框。
- 与记住站点分开。这边输入不会改记住站点列表，记住站点的 `Filter by hostname` 也不会改这边的结果，切换模式也不会清掉记住站点的过滤词。

## How to get to it (user POV)

1. 打开 `chrome-extension://<extensionId>/options.html#sites`。
2. 网站名单里已经有站点时，添加框下面有 `searchbox`，无障碍名和占位符都是 `Filter site list`。
3. 输入主机名片段，再添加或移除站点；换一种启用范围时，过滤框回到空白。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-sites-filter
```

旅程会先把 `siteMode` 设成 `allow`，写入 `alpha.test`、`beta.example`、`gamma.example`，并记住 `kept.example` 和 `other.test`。打开设置页后输入 `example`，网站名单只剩 `beta.example` 和 `gamma.example`。添加 `delta.test` 后它只进存储、不出现在结果里；再添加 `delta.example` 会出现。移除 `gamma.example` 只少这一条。记住站点过滤填 `kept` 时只剩 `kept.example`，网站名单的过滤结果不变。切到 `Exclude listed sites` 后网站规则过滤清空、整表出现，记住站点的过滤词还在。输入 `zzzz` 时出现 `No sites match.`，`#sites` 里没有 `role="list"`。再切回 `All sites`，过滤再次清空。

它会改写 profile，同一会话只能跑一次。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/settings-sites-filter/`：`list-all.png`、`filtered.png`、`added.png`、`removed.png`、`independent.png`、`mode-reset.png`、`no-match.png`、`state.json`、`transcript.txt`。

子串与父子域匹配的差别、空名单不出现过滤框，以及两边过滤互不影响，由 `tests/settings-sites-filter.test.ts` 覆盖。
