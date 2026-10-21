# ottertap-extension

## 1.6.0

### Minor Changes

- [#45](https://github.com/Yukiniro/ottertap/pull/45) [`60aace3`](https://github.com/Yukiniro/ottertap/commit/60aace3a04be1d9c34147ebc84bb32be4d2db3de) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 弹出面板的音量区新增声道模式：立体声（默认）、单声道、只听左声道、只听右声道，可与音量放大叠加，并随「记住此站点」保存。只有选了非立体声才会接入 Web Audio；跨域且无 CORS 的媒体不支持，入口置灰并说明原因。

- [#56](https://github.com/Yukiniro/ottertap/pull/56) [`fbd6e71`](https://github.com/Yukiniro/ottertap/commit/fbd6e7162732353b9b8db110407e4b2dd5d054b7) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 页内 Alt+0（单键模式开启时同样）和扩展命令会在 1× 与本页刚才的倍速之间来回切换。已经是 1× 且本页还没记过倍速时保持不变。记住的倍速只留在当前页面的内容脚本里，不写入存储。

- [#44](https://github.com/Yukiniro/ottertap/pull/44) [`024aa2f`](https://github.com/Yukiniro/ottertap/commit/024aa2fa13481083c857b256660c3244dd08c9ce) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 设置页可以导出和导入全部设置，方便在重装或更换浏览器时带走网站规则、已记住的站点和倍速预设。

- [#52](https://github.com/Yukiniro/ottertap/pull/52) [`f1c8ab8`](https://github.com/Yukiniro/ottertap/commit/f1c8ab88af4891c53b7c258b3d09c39f6d07bd05) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 设置里可以选择快进 / 快退步长（5、10、15 或 30 秒，默认 10）。弹出面板按钮、页内快捷键 J / L / ← / →，以及扩展命令「后退 / 前进」都按这个步长跳转。

- [#48](https://github.com/Yukiniro/ottertap/pull/48) [`071e8b3`](https://github.com/Yukiniro/ottertap/commit/071e8b36ee66e9a3afc41e1cb874f1927dec55cf) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 页内快捷键与滚轮调音量去掉 Alt+Shift，改为两键：按住 Alt（Mac 为 Option）滚动滚轮调音量，Alt + , . 0 调倍速，Alt + M 静音；原来的 Alt+Shift 组合不再生效，Alt+方向键留给浏览器。鼠标停在视频上时直接滚动滚轮即可调音量，不在视频上照常滚动页面，此项默认开启，可在设置中关闭，关闭后需按住 Alt 滚动。设置页另有默认关闭的「单键模式」（K 播放暂停、J/L 或 ←/→ 跳 10 秒、悬停或聚焦视频时 ↑/↓ 调音量、M 静音、< > 调倍速）。在输入框和可编辑区域中输入时，页内快捷键不会触发。在 Windows 上用 Alt+滚轮或 Alt 快捷键后松开 Alt，不会再聚焦浏览器菜单；单独按松 Alt 不受影响。扩展命令的快捷键不变。

### Patch Changes

- [#45](https://github.com/Yukiniro/ottertap/pull/45) [`60aace3`](https://github.com/Yukiniro/ottertap/commit/60aace3a04be1d9c34147ebc84bb32be4d2db3de) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 只记住了声道的站点切回立体声后，不再留下空的站点偏好，父域名上记住的音量和倍速可以重新生效。

- [#44](https://github.com/Yukiniro/ottertap/pull/44) [`024aa2f`](https://github.com/Yukiniro/ottertap/commit/024aa2fa13481083c857b256660c3244dd08c9ce) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 导入设置时，缺少设置内容或内容不是对象的备份会被拒绝，避免确认后把当前设置重置成默认值。

## 1.5.0

### Minor Changes

- [#23](https://github.com/Yukiniro/ottertap/pull/23) [`5bf37b0`](https://github.com/Yukiniro/ottertap/commit/5bf37b0c91768bb631330c8e7b456acfbf6491bb) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 当前标签页的媒体音量超过 100% 时，在工具栏图标上显示角标和悬停提示。

- [#37](https://github.com/Yukiniro/ottertap/pull/37) [`aed85fa`](https://github.com/Yukiniro/ottertap/commit/aed85fa95ae98bdc1d6e0289c0a432953b6f3d11) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 用浏览器扩展命令补齐播放、快进快退和静音，并在设置页显示当前快捷键。

- [#35](https://github.com/Yukiniro/ottertap/pull/35) [`bc76da3`](https://github.com/Yukiniro/ottertap/commit/bc76da3e67ea3aa4bd6e88744eac4b9c15c95fb7) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 可选锁定倍速：站点把播放速度改回去时写回你设定的倍速，默认关闭。反复拉锯会在有限次数后停止。

- [#28](https://github.com/Yukiniro/ottertap/pull/28) [`cb1c46d`](https://github.com/Yukiniro/ottertap/commit/cb1c46dd11157ba3d2ac49274b168d1feabeb687) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 弹出面板底部列出其他正在发声或已静音的标签页，可以切换过去，也可以与浏览器标签喇叭一致地静音或取消静音。

- [#36](https://github.com/Yukiniro/ottertap/pull/36) [`035e2d6`](https://github.com/Yukiniro/ottertap/commit/035e2d6153986a1ce356adb3239a488d16f75e6d) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 弹出面板可以一键让选中的视频进入或退出画中画。

- [#34](https://github.com/Yukiniro/ottertap/pull/34) [`1714e51`](https://github.com/Yukiniro/ottertap/commit/1714e51f933a8918cfc9fd70ae6f469e832bddbc) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 弹出面板的倍速预设默认覆盖到 4×，并可在设置中增删和排序。

- [#24](https://github.com/Yukiniro/ottertap/pull/24) [`4900607`](https://github.com/Yukiniro/ottertap/commit/49006072a0fbc81b2dda79da5012dcf0ab2fd496) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 用 Alt+Shift 搭配 , . 0 调节倍速，并在页面上短暂显示实际生效的倍速。

### Patch Changes

- [#27](https://github.com/Yukiniro/ottertap/pull/27) [`b97bdbb`](https://github.com/Yukiniro/ottertap/commit/b97bdbbe4aec916e1e62fa0f323ee9c2ea210f3a) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 没有媒体的网页不再持续向后台报告状态。音量变化、音量放大和网站开关仍然会立刻同步。

- [#26](https://github.com/Yukiniro/ottertap/pull/26) [`a15ba20`](https://github.com/Yukiniro/ottertap/commit/a15ba207ca9f5efc751befbf2ae5d9dd4b3035fd) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 音量放大超过 100% 时用限幅器压住响段，避免硬削波破音。

## 1.4.0

### Minor Changes

- [#20](https://github.com/Yukiniro/ottertap/pull/20) [`a22b438`](https://github.com/Yukiniro/ottertap/commit/a22b4386080076342905c347c01a236caad5ab0f) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 在设置页新增独立的快捷键说明分区，介绍方向键和滚轮调节音量的操作、适用条件及 Mac 按键名称。

- [#21](https://github.com/Yukiniro/ottertap/pull/21) [`a203471`](https://github.com/Yukiniro/ottertap/commit/a2034710c51b8ee691811f64f3f21c294c8f74b3) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 音量拖动在 97%–103% 范围内吸附到 100%；方向键、音量快捷键及修饰键滚轮跨过 100% 时先停准，继续操作即可越过。

### Patch Changes

- [#19](https://github.com/Yukiniro/ottertap/pull/19) [`1b41ca6`](https://github.com/Yukiniro/ottertap/commit/1b41ca60cd29e4ed6efb828a01f90ed231bb3462) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 修复 macOS 按住 Option+Shift 滚动鼠标滚轮时，横向滚动事件被忽略、音量无法调节的问题。

- [#18](https://github.com/Yukiniro/ottertap/pull/18) [`fe558fd`](https://github.com/Yukiniro/ottertap/commit/fe558fd1d8cb5ec7461588c76c888d8258ce5a2b) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 修复 B 站等媒体元素没有名称属性时，弹出面板忽略已获取的页面标题并显示“未命名媒体”的问题。

## 1.3.0

### Minor Changes

- [#15](https://github.com/Yukiniro/ottertap/pull/15) [`985bd81`](https://github.com/Yukiniro/ottertap/commit/985bd81fc5c08b9c9da697c9f7dd9567842790c9) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 界面跟随浏览器语言，新增繁体中文、日语、韩语、西班牙语、法语和德语。

## 1.2.0

### Minor Changes

- [#12](https://github.com/Yukiniro/ottertap/pull/12) [`30d0faa`](https://github.com/Yukiniro/ottertap/commit/30d0faa9c40e65faf0d303bf6f064f00e0df06ba) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 按站点记住音量和倍速，下次打开该站点时应用一次。

### Patch Changes

- [#9](https://github.com/Yukiniro/ottertap/pull/9) [`0d5eaed`](https://github.com/Yukiniro/ottertap/commit/0d5eaed15712577ff040b357edc041af9a01c152) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 修复官网多语言 canonical 与 hreflang，补充 sitemap 和 robots.txt，让 FAQ 答案可被静态读取，并将根页改为带产品说明的语言选择页。

- [#9](https://github.com/Yukiniro/ottertap/pull/9) [`0d5eaed`](https://github.com/Yukiniro/ottertap/commit/0d5eaed15712577ff040b357edc041af9a01c152) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 为官网添加 OG 分享图、中英文 Open Graph / Twitter Card 元数据、favicon 和 Apple Touch Icon。

- [#11](https://github.com/Yukiniro/ottertap/pull/11) [`36636c4`](https://github.com/Yukiniro/ottertap/commit/36636c48d29405decfc4f78e2aa521af371d35d9) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 将页内音量放大上限从 150% 提高到 200%。

## 1.1.0

### Minor Changes

- [`ef17d93`](https://github.com/Yukiniro/ottertap/commit/ef17d9354fe3ff726924808b8cac7e1df2f8d609) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 支持中文和英文界面，扩展名称跟随浏览器语言。

### Patch Changes

- [`35cda3a`](https://github.com/Yukiniro/ottertap/commit/35cda3a51b6ce7feba82f1047217d91636cec65b) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 重做弹出面板和设置页的层级：播放信息单独成卡，设置页用侧栏跟随当前分组。
