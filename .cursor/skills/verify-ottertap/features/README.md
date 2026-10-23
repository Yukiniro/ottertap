# OtterTap 功能地图

验证主界面是扩展本身。索引里的每一条都要能从用户路径走到可观察的结束状态。`scripts/session.mjs` 目前脚本化了弹出面板播放、滚轮音量、快进快退步长、快进快退随倍速放大、音量调节步长、倍速增减步长、扩展命令画中画、全局默认倍速、按住临时加速和同键短按跳长按加速；其余条目的选择器和断言已经写在各自文件里，用同一次 `launch` 的 Chromium（或 `pnpm e2e` 里点名的那条测试）来驱动。一条失败就报告失败原因，写进该文件的 Gotchas，不要把旅程改容易。

| 功能 | 文件 | 用户从哪里进入 | 现成回归 |
| --- | --- | --- | --- |
| 弹出面板播放控制 | [popup-playback.md](popup-playback.md) | 工具栏弹出面板 | `drive popup-playback` |
| 全局默认倍速 | [default-rate.md](default-rate.md) | 设置页「Playback」的 `Default speed`；陌生网站的新媒体应用一次，站点记住的倍速优先 | `drive default-rate`；`tests/default-rate.test.ts`、`tests/default-rate-background.test.ts` |
| 滚轮与 Alt 快捷键音量 | [wheel-volume.md](wheel-volume.md) | 网页里的主播放器、静音预览或浮动音量药丸 | `drive wheel-volume`；`e2e/smoke.spec.ts` 中悬停滚轮、静音预览、Alt+滚轮 |
| 倍速 | [playback-rate.md](playback-rate.md) | 弹出面板倍速按钮，或网页上的 Alt+, / Alt+. / Alt+0 | `e2e/smoke.spec.ts` 中 Alt + , . 0 那条 |
| 倍速增减步长 | [rate-step.md](rate-step.md) | 设置页「Playback」的 `Speed step`，影响页内 Alt+, / Alt+.、单键 > <、弹出面板加快 / 减慢、扩展命令 `rate-faster` / `rate-slower` | `drive rate-step`；`tests/rate-step.test.ts`、`tests/rate-step-command.test.ts` |
| 按住临时加速 | [hold-boost.md](hold-boost.md) | 设置页「Playback」的 `Hold for a temporary speed`，默认关；打开后按住 Alt+Shift+.（单键模式还可按住 S）用临时档，松开还原。不写站点记忆，不改默认倍速 | `drive hold-boost`；`tests/hold-boost.test.ts`、`tests/hold-boost-background.test.ts` |
| 同键短按跳、长按加速 | [hold-skip-combo.md](hold-skip-combo.md) | 设置页「Playback」的 `Short press skips, hold speeds up`，默认关，且要先打开按住临时加速。单键模式的 J / L / ← / → 短按仍按步长跳，按住满一会儿用临时档，松开还原且不再跳。Alt+Shift+. 和 S 仍可单独按住 | `drive hold-skip-combo`；`tests/hold-skip-combo.test.ts` |
| 快进 / 快退步长 | [skip-step.md](skip-step.md) | 设置页「Playback」的 `Skip step`，影响弹出面板进退按钮、页内 J / L / ← / →、扩展命令 | `drive skip-step` |
| 快进 / 快退随倍速放大 | [skip-with-rate.md](skip-with-rate.md) | 设置页「Playback」的 `Scale skip with speed`，默认关；打开后弹出面板、页内 J / L / ← / →、扩展命令按步长 × 当前倍速跳，提示显示实际秒数 | `drive skip-with-rate`；`tests/skip-with-rate.test.ts` |
| 音量调节步长 | [volume-step.md](volume-step.md) | 设置页「Playback」的 `Volume step`，影响悬停滚轮、Alt+滚轮、单键 ↑ ↓、扩展命令 `volume-up` / `volume-down` | `drive volume-step` |
| 1× 与之前倍速来回切换 | [rate-recall.md](rate-recall.md) | 页内 Alt+0，或扩展命令 rate-reset | `e2e/smoke.spec.ts` 中「1× 与之前的倍速」 |
| 设置导出导入 | [settings-backup.md](settings-backup.md) | 设置页「Backup and restore」 | 无 e2e；格式见 `tests/settings-backup.test.ts` |
| 单声道与左右声道 | [channel-mode.md](channel-mode.md) | 弹出面板音量区的声道菜单 | `e2e/smoke.spec.ts` 中声道三条 |
| 扩展命令 → 画中画 | [extension-pip.md](extension-pip.md) | 设置页「Keyboard shortcuts」的扩展命令列表；绑定后对活动标签页里当前媒体切换画中画 | `drive extension-pip`；命令分发见 `tests/pip-command.test.ts`；面板按钮见 `e2e/smoke.spec.ts` 中画中画那条 |
