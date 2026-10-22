# 全局默认倍速

设置页「Playback」的 `Default speed` 决定还没有记住倍速的网站上，新媒体第一次出现时用哪一档。可选 `Follow the page`（默认，`defaultRate: null`）或内置倍速档 0.75×、1×、1.25×、1.5×、2×、2.5×、3×、4×。存进 `ottertap-settings-v1.defaultRate`。不是有限数字的值回到跟随网页；其他数字先夹到 0.25×–4×，再吸到 0.25 网格。

`Follow the page` 时，扩展不改网页自己的 `playbackRate`。设成例如 1.5× 之后，下次打开还没有 `sitePrefs.rate` 的网站，新媒体会被写成 1.5×，每个媒体只写一次。这个标签里已经看过的媒体不会因为后来才改设置而补上。站点记住的倍速优先，音量和声道仍按站点记忆一起写。锁定倍速是旁边的另一个开关，默认关着，关着时站点再改倍速不会被写回去。

在没有这一项的版本里，设置页没有 `Default speed`，陌生网站上的新媒体保持网页自带倍速。

## Sub-features

- 设置控件。在设置页「Playback」（`#playback`），紧挨 `Lock playback speed`。组名 `Default speed`（`h3#default-rate-label` 给 `role="group"` 命名）。第一个按钮是 `Follow the page`，其余是 `0.75×` 到 `4×`。选中的那个 `aria-pressed="true"`，默认是 `Follow the page`。说明文案是 `On sites that have not remembered a speed, new media uses this speed once. A speed remembered for the site comes first.`
- 跟随网页。打开夹具视频，把 `#media.playbackRate` 改成 1.75，等浮动入口再读一轮，倍速仍是 1.75。
- 应用到新媒体。改成 `1.5×` 后新开夹具页，等浮动入口出现，`#media.playbackRate` 约为 1.5。同一页再把倍速改成 1，锁定关着，不会被写回 1.5。
- 站点记忆优先。弹出面板点 `2× speed`，打开 `Remember this site`，再加载这一页。倍速约为 2，存储里该主机的 `sitePrefs.rate` 是 2，`defaultRate` 仍是 1.5。

## How to get to it (user POV)

1. 打开 `chrome-extension://<extensionId>/options.html#playback`。
2. 在 `Default speed` 里点 `1.5×`，或留在 `Follow the page`。
3. 打开一个还没记住倍速的网页。新媒体出现后使用所选倍速；跟随网页时保持网页原来的倍速。
4. 若要让某个站用别的倍速，在弹出面板调好后打开 `Remember this site`。下次这个站用记住的倍速。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive default-rate
```

会话已经 `launch` 且 `doctor` 通过之后跑。它会改写 profile，同一会话只能跑一次。旅程用夹具 `/video`：

1. 打开设置页 `#playback`。`Default speed` 的按钮依次是 `Follow the page,0.75×,1×,1.25×,1.5×,2×,2.5×,3×,4×`，只有 `Follow the page` 按下。`Lock playback speed` 关着。截图。
2. 打开 `/video`，等浮动入口，把 `#media.playbackRate` 设成 1.75，再等一轮读取。倍速仍约为 1.75。截图后关掉这个标签。
3. 设置页点 `1.5×`。存储里 `defaultRate === 1.5`，锁定仍关。截图。
4. 新开 `/video`。等浮动入口后 `#media.playbackRate` 约为 1.5。截图。再把倍速设成 1，等待后仍约为 1。
5. 从夹具页 `openPopup()`，点 `2× speed`，再点 `Remember this site`。存储里 `media.ottertap.test` 的 `rate` 是 2。重新加载夹具，倍速约为 2。截图。

成功时 `state.json` 的 `ok` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/default-rate/`：`settings-follow.png`、`fixture-follow.png`、`settings-1.5.png`、`fixture-1.5.png`、`fixture-site.png`、`state.json`、`transcript.txt`。

归一化、优先级和设置页由 `tests/default-rate.test.ts` 覆盖，后台下发由 `tests/default-rate-background.test.ts` 覆盖。弹出面板改倍速的快捷键路径仍由 [playback-rate.md](playback-rate.md) 锁住。

## Gotchas

- 默认倍速和站点记忆一样，只在这个媒体第一次被读取时写一次。页面已经开着再去改设置，当前这一个视频不会变，要新开标签或重新加载。
- 重新加载会清掉这个标签的会话。同一文档里后出现的另一段媒体用自己的 id，再读到它时才写一次。
- 锁定倍速关着时，步骤 4 把 1.5 改成 1 后必须停在 1。若被写回 1.5，就是多做了回写。
- 这一程会记住 `media.ottertap.test`。用完 `cleanup` 再 `launch`。不要把它接在需要空白站点记忆的旅程前面。
