# 隐藏浮动站点名单过滤

设置 → 浮动控制器 → `Sites without the floating button`。名单上方有一个本地过滤框，按主机名子串筛选。清空回到整张名单。过滤只影响这一页上看到的行，不写入存储，也不改变「域名包含其子域名」的隐藏匹配。

网站规则的 `Filter site list` 和已记住站点的 `Filter by hostname` 是另外两个输入。三处互不影响。切换全部网站、仅指定网站或排除指定网站时，只清空网站规则的过滤，不清这里。

## Sub-features

- 输入片段。只留下主机名包含这段文字的站点，大小写不敏感，前后空白忽略，顺序仍是名单里的顺序。
- 清空。过滤框空了以后，整张隐藏名单重新出现。
- 恢复一条。过滤状态下点某一行的 `Show the floating button on {site} again`，只从原来的 `floatingHiddenSites` 去掉这一条。仍匹配的站点从结果里消失，没显示出来的站点还在。
- 导出导入。过滤状态下导出的 JSON 仍带完整 `settings.floatingHiddenSites`。导入写回完整名单，当前过滤词留着，结果只显示仍匹配的站点。
- 无匹配。一句 `No hidden sites match.`，不留空的列表壳。名单本来就是空的时候，仍是原来的 `No sites yet.`，不出现过滤框。
- 与另外两处分开。这边输入不会改网站规则或记住站点的展示；那边输入、以及切换启用范围，也不会改这边的过滤词。

## How to get to it (user POV)

1. 打开 `chrome-extension://<extensionId>/options.html#floating`。
2. 隐藏名单里已经有站点时，说明下面有 `searchbox`，无障碍名和占位符都是 `Filter hidden sites`。
3. 输入主机名片段，再点某一行的 `Show the floating button on {site} again`。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-floating-hidden-filter
```

旅程会先写入 `alpha.test`、`beta.example`、`gamma.example`，并把网站规则设成允许 `rules.example` 与 `listed.test`，记住 `kept.example` 和 `noted.test`。打开设置页后输入 `example`，隐藏名单只剩 `beta.example` 和 `gamma.example`。网站规则过滤填 `rules`、记住站点过滤填 `kept` 时，隐藏名单的过滤词和结果不变。恢复 `beta.example` 后结果只剩 `gamma.example`，存储里还有 `alpha.test`。同一页导出的 `export.json` 带上这两条。再导入一份把 `beta.example` 和 `delta.test` 加回去的备份，过滤词仍是 `example`，结果里出现 `beta.example` 和 `gamma.example`，`alpha.test` 与 `delta.test` 只在存储里。输入 `zzzz` 时出现 `No hidden sites match.`，`#floating` 里没有 `role="list"`。

它会改写 profile，同一会话只能跑一次。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/settings-floating-hidden-filter/`：`list-all.png`、`filtered.png`、`independent.png`、`restored.png`、`export.json`、`imported.png`、`no-match.png`、`state.json`、`transcript.txt`。

子串与父子域匹配的差别、空名单不出现过滤框，以及导出导入带着被滤掉的站点，由 `tests/settings-floating-hidden-filter.test.ts` 覆盖。
