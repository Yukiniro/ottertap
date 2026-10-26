# ottertap-extension

## 1.8.0

### Minor Changes

- [#133](https://github.com/Yukiniro/ottertap/pull/133) [`82fe6c4`](https://github.com/Yukiniro/ottertap/commit/82fe6c4b1f0a750756558326f4d54782a4cbd75f) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 设置里的「已记住的站点」可以一次清空。点「清空全部」后要再确认一次；确认文案写明除非自己已有备份，否则无法撤销。只删除记住的站点，网站规则、不显示浮动按钮的站点和其他设置保持不变。

- [#121](https://github.com/Yukiniro/ottertap/pull/121) [`00fc30e`](https://github.com/Yukiniro/ottertap/commit/00fc30e656a0c91214627960c68fad2fea207ae5) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 按住 Shift 滚动时用另一档粗调步长，默认 20%。松开后仍用原来的音量步长。低音量自动细调开着时，Shift 优先。输入框聚焦时不拦截；Alt+滚轮仍可在任意位置调音。

- [#78](https://github.com/Yukiniro/ottertap/pull/78) [`37d1013`](https://github.com/Yukiniro/ottertap/commit/37d101399bfa7a978bab4efb1b5f64ad7927ae32) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 设置里可以选一个全局默认倍速。还没有记住倍速的网站上，新出现的媒体会应用一次这个倍速；站点记住的倍速仍然优先。默认是跟随网页，和现在一样。

- [#68](https://github.com/Yukiniro/ottertap/pull/68) [`f9177cb`](https://github.com/Yukiniro/ottertap/commit/f9177cb12db766c371fac619c084e97209baeaf4) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 扩展命令新增「进入或退出画中画」。没有默认快捷键，可在浏览器的扩展快捷键页自行绑定。设置页的快捷键列表会显示它；当前媒体不能进画中画时，页面上会出现和弹出面板相同的说明。

- [#117](https://github.com/Yukiniro/ottertap/pull/117) [`7887a06`](https://github.com/Yukiniro/ottertap/commit/7887a06d65c096eecff9f24af812085396d38cb5) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 音量低于 25% 时，悬停滚轮和 Alt+滚轮自动改用 1% 步长，设置里默认开启。达到 25% 后仍用原来的音量步长；方向键、扩展命令和音量滑块不变。

- [#108](https://github.com/Yukiniro/ottertap/pull/108) [`7f2ad72`](https://github.com/Yukiniro/ottertap/commit/7f2ad7283d55e5b7d84c1db52b340d81f5460b19) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 浮动入口在收起和半隐藏时，旁边显示当前音量百分比。音量为 100% 且倍速不是 1× 时改为显示倍速。设置里可以改为优先倍速，或关闭旁注。超过 100% 的音量沿用音量药丸的强调色。这和工具栏上超过 100% 才出现的角标不是一回事。

- [#116](https://github.com/Yukiniro/ottertap/pull/116) [`f017d74`](https://github.com/Yukiniro/ottertap/commit/f017d746c2a8f3c67faeefdd4957ad0028506bc1) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 可以只在某个网站隐藏浮动入口：展开音量药丸点「本站隐藏浮动」，或在弹出面板「浮动控制器」那一行点眼睛按钮。这些站点上工具栏面板和页内快捷键照常可用，其他站点不受影响。设置页「浮动控制器」里能看到名单并逐个恢复，导出导入设置时一并带上。它和「网站规则」分开，不会停用扩展。

- [#109](https://github.com/Yukiniro/ottertap/pull/109) [`ef30fee`](https://github.com/Yukiniro/ottertap/commit/ef30fee85170bfe8586acde728dda559a9d1d44f) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 展开音量药丸后可以打开完整弹出面板，并沿用当前选中的媒体。浏览器无法代开时，提示点工具栏图标。

- [#107](https://github.com/Yukiniro/ottertap/pull/107) [`ddc8049`](https://github.com/Yukiniro/ottertap/commit/ddc8049a5ea8fefe03cf76b643af59e730c1b769) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 展开浮动药丸后可以播放、暂停，并按设置里的快进快退步长前后跳转。打开「步长随倍速」时与弹出面板同一规则。直播和无法跳转时，跳转按钮停用并说明原因。

- [#106](https://github.com/Yukiniro/ottertap/pull/106) [`93856ae`](https://github.com/Yukiniro/ottertap/commit/93856ae5b455fba464e05ada4529a1e2417b0c8f) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 展开浮动药丸后，可以按设置里的倍速步长加减，或点选同一组倍速预设。改完会出现原来的页内倍速提示，并且不会因此记住当前网站。

- [#110](https://github.com/Yukiniro/ottertap/pull/110) [`81248e1`](https://github.com/Yukiniro/ottertap/commit/81248e119f3935633d37f3953eb318620494a91c) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 设置里可以打开「仅在选中媒体播放时显示」。默认关闭。打开后，浮动入口只在当前选中的媒体播放时出现；暂停一小会儿后隐藏，没有选中则马上隐藏。快速暂停再播放不会把入口闪掉。悬停在主播放区用滚轮调音量不受影响。

- [#96](https://github.com/Yukiniro/ottertap/pull/96) [`6268b58`](https://github.com/Yukiniro/ottertap/commit/6268b5856252dc74e1cf749e5aac875737493486) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 页内 `,` 和 `.` 可以逐帧后退和前进。播放中会先暂停再移动一帧。直播和无法跳转的媒体会停用，并说明原因。弹出面板也有对应按钮。

- [#122](https://github.com/Yukiniro/ottertap/pull/122) [`a09059b`](https://github.com/Yukiniro/ottertap/commit/a09059b20e2a04217605a4489c975dcb805fce30) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 设置里可以让悬停滚轮只在全屏时调音量，默认关闭。开启后，非全屏的裸滚轮仍滚动页面；Alt+滚轮在非全屏也可以调音量。网页全屏只要能可靠认出来，同样算全屏。

- [#94](https://github.com/Yukiniro/ottertap/pull/94) [`08d3b03`](https://github.com/Yukiniro/ottertap/commit/08d3b0314d965f539c5c16ddbe55bc5d5a75bab3) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 可以打开「按住临时加速」。在媒体页按住 Alt+Shift+.（单键模式还可按住 S）立刻用临时倍速，松开后恢复按住前的倍速。默认关闭，不改站点记住的倍速，也不改全局默认倍速。

- [#95](https://github.com/Yukiniro/ottertap/pull/95) [`8a0c09f`](https://github.com/Yukiniro/ottertap/commit/8a0c09f2cfcb3b323d54bedd496cf771a1a2960d) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 可以让快进和快退键短按仍按当前步长跳转，按住则临时加速，松开后恢复倍速且不再多跳一段。默认关闭，需要先打开按住临时加速，并与 Alt+Shift+. 和 S 的独立按住并存。已经在临时加速时，另一路按住不会再开一段，松开它也不会提前恢复倍速。

- [#97](https://github.com/Yukiniro/ottertap/pull/97) [`ea529b9`](https://github.com/Yukiniro/ottertap/commit/ea529b98823707aa44c6397a6750eca60bf5fcfe) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 设置页「快捷键」里可以给页内动作改键：播放暂停、快进快退、倍速增减、静音、按住临时加速和逐帧前进后退。点一下按键再按新键即可，改动立即在已打开的网页上生效，不用关掉单键模式。新键已被别的动作或固定方向键占用时会说明被谁占用，并保持原键；可一键恢复默认按键。导出和导入设置会带上自定义键位。默认键位不变，Alt 组合键、方向键和滚轮仍是固定的。

- [#92](https://github.com/Yukiniro/ottertap/pull/92) [`1a1494c`](https://github.com/Yukiniro/ottertap/commit/1a1494c115715d4ded4a62e491956e56015cc39d) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 播放设置可以选择倍速增减步长，档位是 0.1×、0.25× 和 0.5×，默认仍是 0.25×。页内快捷键、弹出面板的加快和减慢，以及扩展命令共用这一步长，并停在 0.25× 和 4×。

- [#132](https://github.com/Yukiniro/ottertap/pull/132) [`3ba17b0`](https://github.com/Yukiniro/ottertap/commit/3ba17b0c9f0dc3c0efbd1d2bd0a05350fa828540) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 设置里记住站点、网站规则和隐藏浮动入口这三处名单，各自有一颗「当前站」。点一下只把这一处的主机名筛选设成当前标签页的主机名，并把列表滚进视野。读不到主机名时按钮不可用，也不会填进筛选。另外两处的筛选保持原样。

- [#131](https://github.com/Yukiniro/ottertap/pull/131) [`60775f6`](https://github.com/Yukiniro/ottertap/commit/60775f63b698a414b07988615268a9508c3c4fb6) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 设置里的「隐藏浮动入口的站点」可以按主机名筛选。输入一段主机名只显示匹配的站点，清空后回到完整名单；没有匹配时会说明一句。恢复某一站仍只从原来的名单里去掉那一条，导出和导入仍带上完整名单。这次筛选和网站规则、已记住站点的筛选互不影响。

- [#129](https://github.com/Yukiniro/ottertap/pull/129) [`beebd80`](https://github.com/Yukiniro/ottertap/commit/beebd80c7b31c2bb6b5629808b61a1deae3815e0) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 设置里的「已记住的站点」可以按主机名筛选。输入一段主机名只显示匹配的站点，清空后回到完整列表；没有匹配时会说明一句。删掉一条仍只从原来的记住表里去掉那一条。

- [#130](https://github.com/Yukiniro/ottertap/pull/130) [`d391fab`](https://github.com/Yukiniro/ottertap/commit/d391fab8bae79c6f6ced3dd1ac8de2b301b9b293) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 设置里的「网站规则」名单可以按主机名筛选。输入一段主机名只显示当前名单里匹配的站点，清空后回到完整列表；切换全部网站、仅指定网站或排除指定网站时，这次筛选会清空。没有匹配时会说明一句。添加和移除仍写回原来的网站名单，也不影响已记住站点的筛选。

- [#123](https://github.com/Yukiniro/ottertap/pull/123) [`ff27a85`](https://github.com/Yukiniro/ottertap/commit/ff27a85d0782d7b5805b015f82f113ed87be7956) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 悬停滚轮不再接管常见直播聊天和文档大纲。指针在这些侧栏上时列表照常滚动，主画面上仍可调音量；Alt+滚轮和 Shift 粗调不受影响。

- [#93](https://github.com/Yukiniro/ottertap/pull/93) [`bcdfe68`](https://github.com/Yukiniro/ottertap/commit/bcdfe68de0bb1cca4df2dbd343b31d30b15ef47b) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 播放设置可以让快进和快退按当前倍速放大，默认关闭。打开后，弹出面板、页内快捷键和扩展命令都跳「步长 × 倍速」，提示显示实际秒数；过慢或过快的倍速停在 0.5× 和 3×。

- [#75](https://github.com/Yukiniro/ottertap/pull/75) [`1c810e2`](https://github.com/Yukiniro/ottertap/commit/1c810e2cf1217aa558c63b333a1ed4f191625629) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 离散的音量手势可以在设置里选择 5%、10% 或 20% 的步长，默认仍是 10%。滚轮、单键方向键和扩展命令共用这一步长，音量滑块保持连续。

- [#118](https://github.com/Yukiniro/ottertap/pull/118) [`e4addf2`](https://github.com/Yukiniro/ottertap/commit/e4addf2ef48c3fccb1d359157af355fff77a25db) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 设置里可以选择滚轮方向：向上增大或向下增大。默认仍是向上增大。悬停滚轮和 Alt+滚轮会立刻按新方向调音量，页面本身的滚动方向不变。

### Patch Changes

- [#76](https://github.com/Yukiniro/ottertap/pull/76) [`c153c87`](https://github.com/Yukiniro/ottertap/commit/c153c8770d07794d80ea5ed6d67441f09ee4706e) Thanks [@Yukiniro](https://github.com/Yukiniro)! - Simplify the popup with neutral surfaces, clearer playback controls and balanced spacing. Preserve media controls, settings and status messages while reducing unnecessary height; show the site-memory explanation on demand.
  
  Align the settings page, floating volume controller and website with neutral surfaces, brand-colored actions and volume controls, and readable spacing, preserving existing interactions.

- [#73](https://github.com/Yukiniro/ottertap/pull/73) [`18e249f`](https://github.com/Yukiniro/ottertap/commit/18e249f0cd62529b7d5af043c94b705ed5087baf) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 修复页面连续滚动经过视频区域时误触音量控制，停止滚动至少 300ms 后可在主播放器上重新滚轮调音量。

- [#105](https://github.com/Yukiniro/ottertap/pull/105) [`9d903f2`](https://github.com/Yukiniro/ottertap/commit/9d903f2dbea8c4945a185c46ae732886ecc1a4d2) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 悬停滚轮不再接管列表里的小视频卡片，页面可以正常滚动；够大的主播放器仍可用滚轮调音量。

## 1.7.0

### Minor Changes

- [#60](https://github.com/Yukiniro/ottertap/pull/60) [`8961f57`](https://github.com/Yukiniro/ottertap/commit/8961f575cdbd974013edd8d2ce2179d7c3e393f5) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 悬停滚轮只作用在主播放区。信息流里的静音预览即使正在播放，也不再拦住页面滚动；正在有声播放的主播放器仍可用裸滚轮调音量。关闭悬停后，Alt + 滚轮保持可用。

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
