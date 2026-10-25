# 设置名单定位当前站

设置页三处名单各自有一颗 `Current site`。能读到当前窗口里网站标签的主机名时，点某一颗只把这一处的过滤设成该主机名，并把这一处的列表滚进视野。另外两处的过滤不动。读不到主机名时按钮不可用，点击也不会改过滤，也不会编一个主机名。

三处是：已记住的站点、网站规则的当前名单、不显示浮动按钮的站点。过滤仍是本地的主机名子串，不写入存储。

## Sub-features

- 有主机名。点这一处的 `Current site`，过滤框变成当前标签页的主机名，列表只留下包含这段主机名的行。
- 各管各的。只点一处时，另外两处已经输入的过滤词和结果保持不变。
- 滚进视野。点下去之后，这一处的列表出现在视口里。
- 读不到。没有网页标签，或标签不是网站时，三颗按钮都不可用。已有的过滤词留着。
- 不写存储。点按钮不改 `sitePrefs`、`sites`、`floatingHiddenSites`。

## How to get to it (user POV)

1. 先打开一个网站标签，再打开 `chrome-extension://<extensionId>/options.html`。
2. 名单里已经有站点时，过滤框旁边是按钮 `Current site`。三处各一颗。
3. 点其中一颗。这一处的过滤框变成该网站的主机名。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive settings-current-site
```

旅程会先在三处名单写入包含 `media.ottertap.test` 的站点，并让网站规则处于仅指定网站。先打开 `https://elsewhere.test/`，再打开 `/video`，最后打开设置页。记住站点点 `Current site` 后，过滤变成 `media.ottertap.test`，网站规则仍是事先填的 `beta`，隐藏名单仍是 `gamma`。再分别点另外两处，各自变成当前主机名。关掉网页标签后三颗按钮不可用；把记住站点过滤改成 `alpha` 再点，过滤仍是 `alpha`。

它会改写 profile，同一会话只能跑一次。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/settings-current-site/`：`memory-located.png`、`sites-held.png`、`hidden-located.png`、`unavailable.png`、`state.json`、`transcript.txt`。

读不到主机名时不猜测、本窗口优先于别的窗口，由 `tests/settings-current-site-locate.test.ts` 覆盖。
