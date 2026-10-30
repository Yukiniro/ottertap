# 接着看：保存进度

当前选中、可 seek、时长约 2 分钟及以上的媒体，播放时每约 10 秒把进度写进本机扩展存储，暂停时立刻写一次。关掉标签、隔天再打开同一页，存储里还有这条进度。看到接近片尾时删掉这一条，不再记。短片、直播和不能 seek 的媒体不写。

这是「接着看」的存储核心。自动跳回、提示、按站点排除、列表与清空、面板入口都不在这一程里，此时打开同一页不会自己跳过去。它与弹出面板的进度标记分开：进度标记仍只留在页面里，不写存储。

## 存储

`chrome.storage.local` 里每条媒体一个键，不进 `ottertap-settings-v1`，也不进设置导出：

- 键：`ottertap-resume-v1:<page> <media>`。
- `page`：放媒体的那个文档的地址，去掉 `#` 片段。iframe 里的媒体用 iframe 自己的地址。
- `media`：http(s) 来源写成 `src:` 加来源和路径，不带查询串（签名参数每次会变）。blob、data 或没有地址时写成 `dur:` 加四舍五入的整秒时长，同一页上靠时长区分。
- 值：`{ page, media, time, duration, savedAt }`，秒和毫秒时间戳。
- 最多 200 条。超出时按 `savedAt` 删最旧的；前缀下格式不对的值一并删掉。

## Sub-features

- 周期保存。开始播放后先等一个间隔，之后每约 10 秒写一次。随便点开看几秒不写。
- 暂停保存。暂停立刻写当前进度，再播放时重新计时。
- 只记选中的那一条。同一标签已有选中媒体时，另一条在播也不写。还没有选中时，播放中的那一条照写。
- 不记。时长不足 120 秒、`duration` 为无限（直播）、没有可 seek 范围、隐身窗口、站点被停用时都不写。
- 看完删掉。距片尾不到 30 秒或最后 5%（取大者）时删掉这一条。
- 与设置无关。没有开关；后续的自动跳回开关只管跳不跳，不管存不存。权限仍只有 `storage`。

## How to get to it (user POV)

1. 打开一个可以拖动进度、长于约两分钟的视频，播放一会儿，或者播放后暂停。
2. 关掉这个标签，再打开同一页。扩展存储里还有刚才的进度（这一程还没有界面，用开发者工具看 `chrome.storage.local`）。
3. 打开一个几秒钟的短片、直播或还不能拖动进度的媒体，播放后存储里没有它。
4. 拖到片尾附近再播放或暂停，这一条从存储里消失。

## Driving it with Playwright

```bash
node .cursor/skills/verify-ottertap/scripts/session.mjs drive resume-save
```

会话已经 `launch` 且 `doctor` 通过之后跑。它只动 `ottertap-resume-v1:` 前缀的键，不改设置。旅程临时拦截 `https://lecture.ottertap.test`：`/watch` 是一页带 300 秒静音 wav 的视频 `Lecture`，`/media/lecture.wav` 按 Range 返回，所以媒体有稳定的 https 地址。

1. 权限仍只有 `storage`。清掉账本键，记下设置原文。
2. 打开 `/watch?v=1#t=5`，停在 40 秒。弹出面板点 `Play`。3 秒时账本还是空的。约 10 秒后出现一条：`page` 是去掉片段的 `https://lecture.ottertap.test/watch?v=1`，`media` 是 `src:https://lecture.ottertap.test/media/lecture.wav`，`time` 约 50。截 `lecture-playing.png`。
3. 点 `Pause`，这条立刻变成暂停处的时间。截 `popup-paused.png`。
4. 关掉标签，新开同一页。这条还在，`time` 和 `savedAt` 不变。账本写到 `ledger.json`，截 `reopened.png`。
5. 同时播放 `/video`（1 秒短片）和 `/long`（data 地址、120 秒，从 12 秒起）约 11 秒后暂停。`/long` 记成 `dur:120`，`/video` 没有。截 `long-saved.png`。
6. `/unseekable` 尝试播放再暂停，没有记录。
7. 讲座拖到 285 秒播放再暂停，这一条被删掉。
8. 清掉账本键后重新打开 `/long` 且不播放，账本仍是空的。设置原文与开始时相同，里面没有 `resume`。

成功时 `state.json` 的 `ok` 为 `true`。证据在 `/opt/cursor/artifacts/verify-ottertap/resume-save/`：`lecture-playing.png`、`popup-paused.png`、`reopened.png`、`long-saved.png`、`ledger.json`、`state.json`、`transcript.txt`。

身份、判定、节拍、shadow root 里的媒体、淘汰、隐身窗口、停用站点、选中过滤和 iframe 地址，由 `tests/resume-save.test.ts` 覆盖。

## Gotchas

- 第一次写要等约 10 秒播放，旅程会因此多等十几秒。
- `/unseekable` 没有地址，`play()` 的 promise 不会结束，不要 `await` 它。
- `/long` 正好 120 秒，算「约 2 分钟」，其他会播放 `/long` 的旅程也会留下 `dur:120` 这一条；它们不比对整份存储，`progress-mark` 不播放，所以不受影响。
- 关标签时不另写一次，播放中关掉最多少记约 10 秒。「关标签再开」看的是暂停时写下的那一条。
