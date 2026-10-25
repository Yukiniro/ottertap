# OtterTap 功能地图

验证主界面是扩展本身。索引里的每一条都要能从用户路径走到可观察的结束状态。`scripts/session.mjs` 目前脚本化了弹出面板播放、滚轮音量、快进快退步长、快进快退随倍速放大、音量调节步长、低音量滚轮细步长、Shift 粗调步长、倍速增减步长、扩展命令画中画、全局默认倍速、按住临时加速、同键短按跳长按加速、逐帧、页内快捷键改键、浮动药丸倍速、浮动药丸播放跳转、浮动入口旁注、从音量药丸打开弹出面板、仅在播放时显示浮动入口和滚轮方向。仅全屏时悬停滚轮、侧栏聊天和文档大纲忽略，以及记住站点列表的本地过滤也已脚本化。其余条目的选择器和断言已经写在各自文件里，用同一次 `launch` 的 Chromium（或 `pnpm e2e` 里点名的那条测试）来驱动。一条失败就报告失败原因，写进该文件的 Gotchas，不要把旅程改容易。

| 功能 | 文件 | 用户从哪里进入 | 现成回归 |
| --- | --- | --- | --- |
| 弹出面板播放控制 | [popup-playback.md](popup-playback.md) | 工具栏弹出面板 | `drive popup-playback` |
| 全局默认倍速 | [default-rate.md](default-rate.md) | 设置页「Playback」的 `Default speed`；陌生网站的新媒体应用一次，站点记住的倍速优先 | `drive default-rate`；`tests/default-rate.test.ts`、`tests/default-rate-background.test.ts` |
| 滚轮与 Alt 快捷键音量 | [wheel-volume.md](wheel-volume.md) | 网页里的主播放器、静音预览、列表小卡片或浮动音量药丸 | `drive wheel-volume`；`e2e/smoke.spec.ts` 中悬停滚轮、静音预览、小卡片、Alt+滚轮 |
| 倍速 | [playback-rate.md](playback-rate.md) | 弹出面板倍速按钮，或网页上的 Alt+, / Alt+. / Alt+0 | `e2e/smoke.spec.ts` 中 Alt + , . 0 那条 |
| 倍速增减步长 | [rate-step.md](rate-step.md) | 设置页「Playback」的 `Speed step`，影响页内 Alt+, / Alt+.、单键 > <、弹出面板加快 / 减慢、浮动药丸的加快 / 减慢、扩展命令 `rate-faster` / `rate-slower` | `drive rate-step`；`tests/rate-step.test.ts`、`tests/rate-step-command.test.ts` |
| 浮动药丸倍速 | [floating-speed.md](floating-speed.md) | 展开页面边缘的浮动药丸，音量条旁边的加快 / 减慢和倍速预设。步长和预设与设置、弹出面板相同。不打开工具栏，也不因此记住当前网站 | `drive floating-speed`；`tests/floating-speed.test.ts` |
| 浮动药丸播放和跳转 | [floating-playback.md](floating-playback.md) | 展开页面边缘的浮动药丸，倍速上方的播放 / 暂停和按步长后退 / 前进。步长与「步长随倍速」和弹出面板相同。直播或不可跳转时禁用并说明 | `drive floating-playback`；`tests/floating-playback.test.ts` |
| 按住临时加速 | [hold-boost.md](hold-boost.md) | 设置页「Playback」的 `Hold for a temporary speed`，默认关；打开后按住 Alt+Shift+.（单键模式还可按住 S）用临时档，松开还原。不写站点记忆，不改默认倍速 | `drive hold-boost`；`tests/hold-boost.test.ts`、`tests/hold-boost-background.test.ts` |
| 逐帧前进 / 后退 | [frame-step.md](frame-step.md) | 页内 `,` / `.`（不需要单键模式）；弹出面板 `Previous frame` / `Next frame`。播放中先暂停再移动一帧。直播和不可 seek 时禁用并说明 | `drive frame-step`；`tests/frame-step.test.ts`、`tests/frame-step-panel.test.ts`、`tests/frame-step-command.test.ts` |
| 同键短按跳、长按加速 | [hold-skip-combo.md](hold-skip-combo.md) | 设置页「Playback」的 `Short press skips, hold speeds up`，默认关，且要先打开按住临时加速。单键模式的 J / L / ← / → 短按仍按步长跳，按住满一会儿用临时档，松开还原且不再跳。Alt+Shift+. 和 S 仍可单独按住；已经在临时加速时另一路按住不会再开一段 | `drive hold-skip-combo`；`tests/hold-skip-combo.test.ts`、`tests/hold-overlap.test.ts` |
| 快进 / 快退步长 | [skip-step.md](skip-step.md) | 设置页「Playback」的 `Skip step`，影响弹出面板进退按钮、浮动药丸、页内 J / L / ← / →、扩展命令 | `drive skip-step` |
| 快进 / 快退随倍速放大 | [skip-with-rate.md](skip-with-rate.md) | 设置页「Playback」的 `Scale skip with speed`，默认关；打开后弹出面板、浮动药丸、页内 J / L / ← / →、扩展命令按步长 × 当前倍速跳，提示显示实际秒数 | `drive skip-with-rate`；`tests/skip-with-rate.test.ts` |
| 音量调节步长 | [volume-step.md](volume-step.md) | 设置页「Playback」的 `Volume step`，影响悬停滚轮、Alt+滚轮、单键 ↑ ↓、扩展命令 `volume-up` / `volume-down` | `drive volume-step` |
| 低音量滚轮细步长 | [fine-wheel.md](fine-wheel.md) | 设置页「Playback」的 `Finer wheel steps below 25%`，默认开。低于 25% 时悬停滚轮和 Alt+滚轮用 1%，以上用音量步长。方向键、扩展命令和滑块不变 | `drive fine-wheel`；`tests/fine-wheel.test.ts`、`tests/fine-wheel-background.test.ts` |
| Shift 粗调步长 | [coarse-step.md](coarse-step.md) | 设置页「Playback」的 `Coarse step`，默认 20%。按住 Shift 滚动用这一档，并优先于低于 25% 的自动细调。松开回到音量步长。输入框聚焦时不拦截。Alt+滚轮仍可在任意位置调音 | `drive coarse-step`；`tests/coarse-step.test.ts`、`tests/coarse-step-background.test.ts` |
| 1× 与之前倍速来回切换 | [rate-recall.md](rate-recall.md) | 页内 Alt+0，或扩展命令 rate-reset | `e2e/smoke.spec.ts` 中「1× 与之前的倍速」 |
| 设置导出导入 | [settings-backup.md](settings-backup.md) | 设置页「Backup and restore」 | 无 e2e；格式见 `tests/settings-backup.test.ts` |
| 单声道与左右声道 | [channel-mode.md](channel-mode.md) | 弹出面板音量区的声道菜单 | `e2e/smoke.spec.ts` 中声道三条 |
| 扩展命令 → 画中画 | [extension-pip.md](extension-pip.md) | 设置页「Keyboard shortcuts」的扩展命令列表；绑定后对活动标签页里当前媒体切换画中画 | `drive extension-pip`；命令分发见 `tests/pip-command.test.ts`；面板按钮见 `e2e/smoke.spec.ts` 中画中画那条 |
| 页内快捷键改键 | [hotkey-remap.md](hotkey-remap.md) | 设置页「Keyboard shortcuts」里带铅笔图标的按键按钮：播放暂停、快进快退、倍速增减、静音、按住临时加速、逐帧。点一下再按新键，已打开的网页立即生效；撞键时提示被谁占用；`Restore default keys` 恢复默认 | `drive hotkey-remap`；`tests/keybinds.test.ts`、`tests/hotkey-remap.test.ts` |
| 浮动入口旁注 | [floating-entry-note.md](floating-entry-note.md) | 收起或半隐藏的浮动入口旁边。默认显示页内音量百分比；100% 且倍速不是 1× 时改显倍速。设置页「Floating controller」的 `Entry note` 可选优先音量、优先倍速或关闭 | `drive floating-entry-note`；`tests/floating-note.test.ts` |
| 从音量药丸打开弹出面板 | [floating-open-panel.md](floating-open-panel.md) | 展开页面边缘的音量药丸，倍速下面的 `Open panel`。打开工具栏弹出面板并沿用当前媒体；浏览器拒绝时显示 `Click the toolbar icon`。不替换工具栏按钮 | `drive floating-open-panel`；`tests/floating-open-panel.test.ts`、`tests/open-popup-background.test.ts` |
| 仅在播放时显示浮动入口 | [floating-while-playing.md](floating-while-playing.md) | 设置页「Floating controller」的 `Show only while the selected media is playing`，默认关。打开后，入口只在当前选中媒体播放时出现；暂停稍后再隐藏，没有选中马上隐藏。悬停滚轮仍按自己的开关工作 | `drive floating-while-playing`；`tests/floating-while-playing.test.ts` |
| 按站点隐藏浮动入口 | [floating-hidden-sites.md](floating-hidden-sites.md) | 展开音量药丸，`Open panel` 旁的 `Hide floating on this site`；或工具栏弹出面板 `Floating controller` 行里的同名眼睛按钮。名单在设置页「Floating controller」的 `Sites without the floating button`，可逐条恢复，导出导入一并带上。与「Site rules」整站启停分开，面板与页内快捷键照常可用 | `drive floating-hidden-sites`；`tests/floating-hidden-sites.test.ts` |
| 滚轮方向 | [wheel-direction.md](wheel-direction.md) | 设置页「Playback」的 `Wheel direction`。默认 `Up increases`。改成 `Down increases` 后，悬停滚轮和 Alt+滚轮立刻反过来。页面滚动、方向键、扩展命令和滑块不变 | `drive wheel-direction`；`tests/wheel-direction.test.ts`、`tests/wheel-direction-background.test.ts` |
| 仅全屏时悬停滚轮 | [fullscreen-wheel.md](fullscreen-wheel.md) | 设置页「Keyboard shortcuts」的 `Only use the hover wheel in fullscreen`，默认关。打开后，只有页面或视频处于全屏（含可靠的网页全屏）时，悬停裸滚轮才调音量；非全屏裸滚轮滚动页面。Alt+滚轮在非全屏仍可用 | `drive fullscreen-wheel`；`tests/fullscreen-wheel.test.ts`、`tests/fullscreen-wheel-background.test.ts` |
| 侧栏聊天和文档大纲 | [sidebar-ignore.md](sidebar-ignore.md) | 盖住主画面的常见直播聊天或文档大纲。指针在这些容器上时，裸滚轮滚动列表、不调音量；主画面和认不出的叠层仍调音。Alt+滚轮和 Shift 粗调不受影响 | `drive sidebar-ignore`；`tests/sidebar-wheel.test.ts`；`e2e/smoke.spec.ts` 中侧栏聊天那条 |
| 记住站点列表过滤 | [settings-memory-filter.md](settings-memory-filter.md) | 设置页「Remembered sites」。列表上方的 `Filter by hostname` 按主机名子串筛选，清空回到整张表。删除和「记住此站点」仍写原来的记住表。没有匹配时显示一句说明 | `drive settings-memory-filter`；`tests/settings-memory-filter.test.ts` |
