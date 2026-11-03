# 接着看：自动跳回

重新打开一个有接着看进度的页面时，如果媒体可以跳转，扩展把它跳到上次进度减三秒。没有进度、媒体太短不能跳、站点被排除或总开关关掉时，行为和没有这个功能一样。这是「接着看」的跳转半程，存储本身见 [resume-save.md](resume-save.md)。

## Sub-features

- 默认开。设置页「接着看」里的开关「自动跳回上次进度」（`resumeJump`），关掉后仍照常保存进度，只是重开时不跳。
- 目标是 `time - 3` 秒，回到 0 为止。站方把进度放到比目标还后面（差 5 秒以内算「附近」）时不往回跳，尊重页面自己的进度。
- 每条媒体身份只尝试一次。发现时元数据已就绪（缓存、预载的视频）直接尝试，不等事件；`loadedmetadata`、`durationchange` 和 `progress`（可 seek 范围晚到时）都会触发。设置还没加载完时的尝试不算数，之后的事件会补上。播放器复用同一元素换源后算新身份，再尝试一次；同一条媒体内手动 seek 不触发也不重置。
- 排除站点不跳（见 [resume-excluded-sites.md](resume-excluded-sites.md)），扩展总开关关掉时也不跳。
- 跳回成功走页内短提示，见 [resume-jump-feedback.md](resume-jump-feedback.md)。

## How to get to it (user POV)

1. 播放一个可 seek、约两分钟以上的视频到某个位置，暂停或等约 10 秒。
2. 关掉标签，重新打开同一页。视频自动停在上次进度减三秒附近，页面顶部短暂显示「从 xx:xx 继续」。
3. 设置里关掉「自动跳回上次进度」再试：不跳，但存储里的进度仍在，面板里仍能手动跳。

## Driving it with Playwright

`drive resume-save` 的夹具页可以直接复用：`https://lecture.ottertap.test/watch?v=1` 的 300 秒 Lecture。

1. 播放到约 50 秒暂停，关标签。重开同一页，等 1 秒：`#media` 的 `currentTime` 约 47（减三秒），截图。
2. 同一页再刷新一次：不重复跳，也不因为已经跳过而再动进度。
3. 设置页关掉 `resumeJump`，删掉进度后重存一条再重开：`currentTime` 停在 0 附近。

跳转目标、只跳一次、开关与排除守卫、站点已快进时不回跳，由 `tests/resume-jump.test.ts` 的控制器测试锁住。

## Gotchas

- 跳转只认 `ottertap-resume-v1:` 账本里的同页同媒体条目；换网址（哪怕查询串变了）就是另一页，不跳。
- 站点自己会用 `#t=` 或 cookie 续播的页面，扩展的目标若不比站点已放的进度靠后 5 秒以上就不跳，两个续播不会打架。
- 其他验证旅程如果残留 `dur:120` 条目，重开 `/long` 会自动跳到那条附近；依赖起始 0 秒的旅程要先清账本键（`drive resume-save` 结束时会清）。
