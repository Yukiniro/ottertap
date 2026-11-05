# ottertap-extension

## 1.9.0

### Minor Changes

- [#189](https://github.com/Yukiniro/ottertap/pull/189) [`f318eee`](https://github.com/Yukiniro/ottertap/commit/f318eeeb3edefdecb71e02c5969db7fbf9e6785e) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 弹出面板在可以跳转且知道时长时，显示按当前倍速折算的本集剩余。倍速变化时数字跟着变。直播、未知时长或不能跳转时不显示。睡眠倒计时改为「睡眠还剩」，以免和本集剩余混在一起。

- [#161](https://github.com/Yukiniro/ottertap/pull/161) [`6f7a65d`](https://github.com/Yukiniro/ottertap/commit/6f7a65d8d11e8baa1f89c5dc61705a006acec2dd) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 展开音量药丸后，可以在播放控制旁进入或退出画中画。音频、网站禁用、浏览器不支持或视频尚未就绪时，按钮禁用并沿用面板里的短说明。

- [#155](https://github.com/Yukiniro/ottertap/pull/155) [`c73cdfb`](https://github.com/Yukiniro/ottertap/commit/c73cdfb66200c69dc1ee95665d76b89396a553f6) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 展开音量药丸后，本页有多条媒体时可以切到上一条或下一条。只有一条时不显示。切换后仍用这一枚药丸，并短暂标出新目标。

- [#197](https://github.com/Yukiniro/ottertap/pull/197) [`07909c6`](https://github.com/Yukiniro/ottertap/commit/07909c6ee3e974fe81a8d67e3043531baf18576d) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 浮动入口可以在睡眠定时进行时改显示剩余时间，例如「睡 12:04」。这个选项默认关闭，没有定时时仍按原来的音量或倍速旁注。导出和导入会带上它。贴边、半隐藏、位置记忆和工具栏超过 100% 的角标都不改。

- [#151](https://github.com/Yukiniro/ottertap/pull/151) [`13f757d`](https://github.com/Yukiniro/ottertap/commit/13f757d7930535e0257c798cde3f48bb7726940e) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 另一条媒体开始播放时，面板、浮动控制和页内快捷键会跟着切过去。设置里可以关掉，默认开着。刚在面板里点选的媒体会再保持几秒。

- [#141](https://github.com/Yukiniro/ottertap/pull/141) [`1e57ec5`](https://github.com/Yukiniro/ottertap/commit/1e57ec5f528fb56d56377fd6fc3879dfc96c6151) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 弹出面板可以水平镜像当前选中的视频画面。只翻转这一条视频，不改声音，也不写入记住此站点。换到另一条媒体时，那一条默认不镜像。

- [#149](https://github.com/Yukiniro/ottertap/pull/149) [`630dc69`](https://github.com/Yukiniro/ottertap/commit/630dc69f442b1f22eb8190f7ce7f081f0bdd7f25) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 页内快捷键和扩展命令可以绑定水平镜像、设标记和跳到标记。默认不占键，输入框聚焦时不触发。

- [#150](https://github.com/Yukiniro/ottertap/pull/150) [`394ad7e`](https://github.com/Yukiniro/ottertap/commit/394ad7ee42f95da1d9e7c17d58bfd266acde29ca) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 切换镜像、设下进度标记或跳回标记时，页面上短暂显示与倍速提示相同的字样。不能跳转、没有画面或没有标记时，沿用原来的短说明。没有单独的提示开关，和倍速提示一样默认出现。

- [#148](https://github.com/Yukiniro/ottertap/pull/148) [`15e738e`](https://github.com/Yukiniro/ottertap/commit/15e738e38d437951f3c8580f24a5af7e3264a5cd) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 弹出面板可以一键静音其他正在发声的标签页。当前标签页的音量保持不变。

- [#162](https://github.com/Yukiniro/ottertap/pull/162) [`a17aca9`](https://github.com/Yukiniro/ottertap/commit/a17aca90e73511bc2404af0b0e3289164cd603bf) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 页内快捷键可以绑定进入或退出画中画。默认不占键，输入框聚焦时不触发。扩展命令仍保留。

- [#154](https://github.com/Yukiniro/ottertap/pull/154) [`79bc9f6`](https://github.com/Yukiniro/ottertap/commit/79bc9f6cf049eca26cf993127a1e661458680d46) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 弹出面板在一页有多条媒体时，用短名称、播放或暂停，以及当前选中标出每一条。满五条时可以按名称过滤，只影响列表里能看见的行。

- [#164](https://github.com/Yukiniro/ottertap/pull/164) [`c8abeff`](https://github.com/Yukiniro/ottertap/commit/c8abeff69837f5db18b68a0e2074106f2110148e) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 当前视频在画中画里时，弹出面板和展开的音量药丸改成退出，并显示短状态。媒体列表里那一条带短标记。换到另一条或退出后，状态跟着新目标。音频不会显示这条状态。

- [#195](https://github.com/Yukiniro/ottertap/pull/195) [`6fb830b`](https://github.com/Yukiniro/ottertap/commit/6fb830b34609efebc107f9e87c5544378d6c370e) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 设置「Playback」新增「不自动画中画的站点」名单，默认空。名单里的站点不会因为切走、滚出或回来而自动进入或退出画中画，你自己打开、关掉画中画照常可用。打开任一自动进入开关后，工具栏面板的站点行会出现「本站不自动画中画」按钮，一键把当前主机名加入或移出；设置页可按主机名筛选、逐个删除。名单与「网站规则」「隐藏浮动入口的站点」分开，域名包含其子域名，导出导入带上。

- [#194](https://github.com/Yukiniro/ottertap/pull/194) [`6055b43`](https://github.com/Yukiniro/ottertap/commit/6055b43beaa3fc548040c87f2a3fdbf9c33b58f3) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 设置「Playback」新增「回到原标签或视频回到视口时自动退出画中画」，默认关，与两个自动进入开关互不绑定。开启后，只有切走或滚出时自动打开的画中画，会在你回到标签、并且视频至少一半回到视口时自己关掉；自己手动打开的画中画不受影响。快速路过标签或在播放器附近小幅滚动不会让它关掉，关掉后约 10 秒内也不会马上又自动进入。导出导入带上这个开关。

- [#196](https://github.com/Yukiniro/ottertap/pull/196) [`fe5845c`](https://github.com/Yukiniro/ottertap/commit/fe5845cde55844b3c352325630f805a3e6cdf8e4) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 自动进入或自动退出画中画成功时，页面上短暂显示和手动相同的「画中画开」或「画中画关」。浏览器拒绝、音频或网站关掉画中画时，显示原来的短说明，大约 10 秒内不再试，边界抖动也不会让提示和进出连闪。设置「Playback」用一段说明写清这三项默认都关、只动正在播放的选中视频，并且和手动进出并存。

- [#190](https://github.com/Yukiniro/ottertap/pull/190) [`29e5c86`](https://github.com/Yukiniro/ottertap/commit/29e5c86fee7a1a57ab6eb391a2871a40024e4e69) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 设置里新增「切到其他标签时自动进入画中画」，默认关闭。开启后，离开标签页时正在播放的选中视频会进入画中画；音频、已暂停、已停用的网站、网站关闭画中画或浏览器拒绝时不进，也不弹提示。刚关掉画中画后的 10 秒内再切走不会马上重新进入。手动进出画中画和扩展命令不变。

- [#193](https://github.com/Yukiniro/ottertap/pull/193) [`4eef67a`](https://github.com/Yukiniro/ottertap/commit/4eef67ac1017b91970504280b8a4619fe98a1188) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 设置里新增「主视频滚出视口时自动进入画中画」，默认关闭，与「切到其他标签时自动进入画中画」互不影响。开启后，选中的主视频正在播放、并被滚到几乎看不见时进入画中画；在播放器下方稍微滚动不会触发，一次滚出最多进一次。信息流小卡片、未选中的媒体、音频、开局就在视口外的视频和全屏（含能可靠识别的网页全屏）时不进，退出全屏后再按规则判断。浏览器拒绝时不弹提示，下一次在页面上点击或按键时再试。视频还在视口外时关掉画中画，要等滚回视频后才会再进；刚关掉画中画后的 10 秒内也不会马上重新进入。

- [#165](https://github.com/Yukiniro/ottertap/pull/165) [`2843f1d`](https://github.com/Yukiniro/ottertap/commit/2843f1d96d62740d26eb770dff4d91a52e5a6cb2) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 某一标签的选中媒体正在画中画时，扩展命令仍控制那一条，即使焦点在别的标签。页内快捷键仍只在媒体页生效。

- [#163](https://github.com/Yukiniro/ottertap/pull/163) [`92fd30b`](https://github.com/Yukiniro/ottertap/commit/92fd30be4e12e3ca6924de9a40921beb60e64e21) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 进入或退出画中画成功时，页面上短暂显示和倍速提示同一块字样。失败仍用原来的短说明。

- [#153](https://github.com/Yukiniro/ottertap/pull/153) [`9325609`](https://github.com/Yukiniro/ottertap/commit/932560956fffe1d1593c08001358011b94798170) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 页内快捷键和扩展命令可以绑定上一条和下一条媒体。默认不占键。只有一条媒体时不切换，并给出短说明。

- [#142](https://github.com/Yukiniro/ottertap/pull/142) [`70e723a`](https://github.com/Yukiniro/ottertap/commit/70e723abce643faa2f86dd95d9c3b5ae33cda307) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 弹出面板可以为当前媒体设一个进度标记，再跳回去或清掉。标记只留在这一页的这条媒体上，不写入扩展存储。直播和不能跳转时入口禁用。

- [#179](https://github.com/Yukiniro/ottertap/pull/179) [`81da8eb`](https://github.com/Yukiniro/ottertap/commit/81da8eb93a5f20fe194f6ddfdff4b4454e3ab36c) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 接着看补上使用入口：重新打开有进度的页面时自动跳回上次位置减三秒（设置里可关），跳回和面板手动跳转成功时页内短暂提示「从 xx:xx 继续」；设置新增「接着看」页，可开关自动跳回、按域名排除站点（不记也不跳）、查看进度列表并删单条或二次确认清空；弹出面板在有进度时出现「跳到接着看」和「清除接着看」。

- [#172](https://github.com/Yukiniro/ottertap/pull/172) [`150575a`](https://github.com/Yukiniro/ottertap/commit/150575a7ef6c5b579e5420c9970c11e8340a0a19) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 可以跳转、约两分钟以上的视频和音频，播放时会定期把进度记在本机扩展存储里，暂停时也记一次，关掉标签再打开仍在。短片、直播、不能跳转的媒体和隐身窗口不记，看到片尾附近就删掉，最多保留 200 条。不上传，不新增权限。

- [#152](https://github.com/Yukiniro/ottertap/pull/152) [`0fbdc1c`](https://github.com/Yukiniro/ottertap/commit/0fbdc1cc2247efd3350f628f53c1fd78bffd3ba4) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 当前选中换到另一条视频时，画面外沿短暂出现一圈轻轮廓，大约一秒后淡出。音频没有画面时，用和倍速提示相同的页内短提示写明已选中音频。

- [#181](https://github.com/Yukiniro/ottertap/pull/181) [`a4348e3`](https://github.com/Yukiniro/ottertap/commit/a4348e3b175097b0be220633d361563094943349) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 睡眠定时进行中可以取消，也可以再续 15 分钟。取消后到点不再暂停，播放保持原样；续时加在剩下的截止时间上。倒计时仍跟着当前选中的媒体，换一条只改到点要停谁。

- [#182](https://github.com/Yukiniro/ottertap/pull/182) [`90b37c8`](https://github.com/Yukiniro/ottertap/commit/90b37c86c6a78c87aabe66db5825d7fba2b7d792) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 睡眠定时在开始、取消，以及到期暂停成功时，用和倍速相同的短暂页内提示。到期前大约 1 分钟会再提示一次；这个临近提示可以在设置里关闭，默认开启，并会随设置导出和导入。媒体已经卸掉或暂停失败时，不显示成功提示。

- [#191](https://github.com/Yukiniro/ottertap/pull/191) [`e684a3c`](https://github.com/Yukiniro/ottertap/commit/e684a3c7968fed7b6b174e1b05cabfc5ec5d3ba5) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 睡眠定时可以用页内快捷键和扩展命令开始或取消。开始按设置里的默认时长（出厂 30 分钟，可选 15、30、45、60 分钟），进行中再按一次从现在起重新计时；没有定时时取消会提示现在没有。两个动作默认不占键，可在设置页和浏览器的扩展快捷键页自行绑定，输入框聚焦时不触发。

- [#180](https://github.com/Yukiniro/ottertap/pull/180) [`a5ff766`](https://github.com/Yukiniro/ottertap/commit/a5ff7663e2b8c4d911d299ecd55d37de5825fd58) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 弹出面板新增睡眠定时：可选 15 / 30 / 45 / 60 分钟或自定义 1–180 分钟，到点暂停这个标签里小獭正在控制的那一条媒体，进度保留、不关标签、不改站点记忆。关掉面板不会取消定时；没有媒体时入口不可用并有一句说明。

### Patch Changes

- [#135](https://github.com/Yukiniro/ottertap/pull/135) [`82a39fe`](https://github.com/Yukiniro/ottertap/commit/82a39fe62b0b8450edbfdbf0b6bef20b0ea72a26) Thanks [@Yukiniro](https://github.com/Yukiniro)! - 修复多页面并发保存设置时互相覆盖、Shadow DOM 视频画中画状态错误，以及临时加速被记为上一档倍速的问题。清空站点记忆直接清空表，官网演示在媒体加载前禁用控制并显示加载失败说明，移除空的备份迁移框架。
  
  备份确认导入仍整份替换设置，并正确恢复仅声道不同的站点偏好。

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
