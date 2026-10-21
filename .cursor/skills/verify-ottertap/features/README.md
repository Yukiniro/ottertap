# OtterTap 功能地图

验证主界面是扩展本身。索引里的每一条都要能从用户路径走到可观察的结束状态。`scripts/session.mjs` 目前只脚本化了弹出面板播放；其余条目的选择器和断言已经写在各自文件里，用同一次 `launch` 的 Chromium（或 `pnpm e2e` 里点名的那条测试）来驱动。一条失败就报告失败原因，写进该文件的 Gotchas，不要把旅程改容易。

| 功能 | 文件 | 用户从哪里进入 | 现成回归 |
| --- | --- | --- | --- |
| 弹出面板播放控制 | [popup-playback.md](popup-playback.md) | 工具栏弹出面板 | `drive popup-playback` |
| 滚轮与 Alt 快捷键音量 | [wheel-volume.md](wheel-volume.md) | 网页里的主播放器、静音预览或浮动音量药丸 | `e2e/smoke.spec.ts` 中悬停滚轮、静音预览、Alt+滚轮 |
| 倍速 | [playback-rate.md](playback-rate.md) | 弹出面板倍速按钮，或网页上的 Alt+, / Alt+. / Alt+0 | `e2e/smoke.spec.ts` 中 Alt + , . 0 那条 |
| 1× 与之前倍速来回切换 | [rate-recall.md](rate-recall.md) | 页内 Alt+0，或扩展命令 rate-reset | `e2e/smoke.spec.ts` 中「1× 与之前的倍速」 |
| 设置导出导入 | [settings-backup.md](settings-backup.md) | 设置页「Backup and restore」 | 无 e2e；格式见 `tests/settings-backup.test.ts` |
| 单声道与左右声道 | [channel-mode.md](channel-mode.md) | 弹出面板音量区的声道菜单 | `e2e/smoke.spec.ts` 中声道三条 |
