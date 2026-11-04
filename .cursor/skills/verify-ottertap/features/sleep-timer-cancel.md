# 睡眠定时：取消与再续 15 分钟

定时已经在走的时候，弹出面板里看得到还剩多久，并可以取消，或把剩下的截止时间加上 15 分钟。取消只清掉倒计时，不改播放。换了当前选中，只改到点要停谁，不立刻停原来那一条。

续时固定是 15 分钟，加在页面里那一个截止时间上，不是从现在重新算 15 分钟，也没有一列可配置的续时档位。不做淡出。倒计时仍留在这个标签的顶层页面里，不写扩展存储，权限仍只有 `storage`。页内「已取消」那一句短暂提示不在这一项里。

## Sub-features

- 进行中。月亮按钮旁仍是剩余时间。点开后，剩余时间写在弹层里，下面是 `Cancel sleep` 和 `Add 15 minutes`。档位和自定义分钟还在，再选一档会用新的时长重新开始。
- 续时。点 `Add 15 minutes` 后，按钮上的剩余时间增加 15 分钟。弹层里出现 `Added 15 minutes.`，`#sleep-timer-status` 里同一句跟着剩余时间。播放不变。
- 取消。点 `Cancel sleep` 后倒计时消失，弹层留下 `Sleep cancelled. Playback is unchanged.`，播放不变。档位还在，可以马上再设。关掉弹层再打开，定时不再出现。原来的截止时间过去之后，媒体仍在播。
- 跟随选中。同一页有两条时，开定时后换到另一条，两条都继续播，倒计时还在。取消之后两条仍在播。

## How to get to it (user POV)

1. 打开一个正在播放的视频，点工具栏图标。
2. 点月亮，选一个时长。月亮旁出现倒计时。
3. 再点开，点 `Add 15 minutes`。倒计时变长，并写着已加上 15 分钟。
4. 点 `Cancel sleep`。倒计时没了，写着已取消、播放没有变化。视频还在播。
5. 如果是误触，再选一个时长，倒计时又出现。
6. 页面上有两条媒体时，换一条不会马上停掉刚才那条。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive sleep-timer-cancel
```

会话已经 `launch` 且 `doctor` 通过之后跑。它不改设置。到期是否还会暂停，用自定义 1 分钟，取消后再等原来的那一分钟，整程大约 70 秒：

1. `/long` 从弹出面板播放。点开 `Sleep timer`，此时没有 `Cancel sleep` 和 `Add 15 minutes`。自定义填 `1` 并开始，倒计时约 `01:00`。
2. 再点开。两个按钮都在，四个档位也在。截 `popup-running.png`。点 `Add 15 minutes`，剩余大约增加 900 秒，`#sleep-timer-feedback` 是 `Added 15 minutes.`。截 `popup-extended.png`。媒体仍在播。
3. 点 `Cancel sleep`。按钮回到只有图标，反馈是 `Sleep cancelled. Playback is unchanged.`，档位还在。截 `popup-cancelled.png`。关掉面板再打开，倒计时不在。截 `popup-reopened.png`。
4. 再设 1 分钟。截 `popup-rearmed.png`。立刻取消，再打开确认倒计时不在。
5. `/feed` 两条都在播。选 `Feed preview`，开 1 分钟，再换到 `Main player`。等一会儿两条都还在播，倒计时还在。截 `feed-switched.png`。取消后两条仍在播。截 `feed-cancelled.png`。
6. 回到 `/long`，把进度放到 5 秒附近，等到第 4 步那次开定时之后至少 65 秒。视频仍在播，进度比等待前至少往前 20 秒，标签还开着。截 `fixture-still-playing.png`。
7. `ottertap-settings-v1` 与开始前一致。`chrome.storage.local` 和 `chrome.storage.session` 里都没有 `sleep`。权限仍是 `["storage"]`。

成功时 `state.json` 的 `ok` 为 `true`，`addedSeconds` 约为 900，`stillPlaying` 为 `true`。证据写到 `/opt/cursor/artifacts/verify-ottertap/sleep-timer-cancel/`：`popup-running.png`、`popup-extended.png`、`popup-cancelled.png`、`popup-reopened.png`、`popup-rearmed.png`、`feed-switched.png`、`feed-cancelled.png`、`fixture-still-playing.png`、`state.json`、`transcript.txt`。

取消后不再触发、续时精确加 15 分钟、再续一次再加 15 分钟，由 `tests/sleep-timer-cancel.test.ts` 覆盖。后台把取消和续时交给顶层框架、续时不理调用方传来的分钟数、换目标和取消都不发暂停、到期仍只停当时的当前选中、没有定时时拒绝、不写存储，由 `tests/sleep-timer-cancel-background.test.ts` 覆盖。面板在未定时时不给出这两个按钮、续时后的剩余和可见说明、取消后可再设、失败时倒计时还在，由 `tests/sleep-timer-cancel-panel.test.ts` 覆盖。

## Gotchas

- 反馈写在弹出面板的弹层里。开始、取消、到期的页内短提示是另一项，这里不要做。
- 续时改的是页面里那个截止时间。后台不自己用 `Date.now()` 重算，也不收下拉菜单式的分钟数。
- 到点会不会暂停，要等被取消的那一次真的过点。只看界面上的字消失，证明不了定时器已被清掉之后又不会响；关掉再打开能证明页面里已经没有截止时间，干等过点能证明不会暂停。
- 档位弹层有淡入动画，截图前要等动画结束。
- 不要把取消和续时挪到弹层外面。多一行会让单媒体面板超过 600px。
- `/long` 大约 120 秒。等过点之前把进度放回靠前的位置，免得片子自己播完被当成定时暂停。
- 这一程不改 profile。暂停本身会写接着看，但取消后不应暂停，所以不应为这次取消新写一条。
