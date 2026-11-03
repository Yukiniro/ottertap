# 接着看：进度列表与清空

设置页「接着看」底部的「接着看进度」列表，把账本里的每一条列成一行：名称（http(s) 来源取文件名，时长标识的用域名）、域名、时刻、多久前更新。可以删单条，也可以二次确认后清空全部。弹出面板里对当前媒体有「清除接着看」。上限 200 条、满了删最旧由保存那一程负责（[resume-save.md](resume-save.md)）。

## Sub-features

- 列表。直接读 `chrome.storage.local` 的 `ottertap-resume-v1:` 键，按更新时间新到旧排列，存储一变就刷新。
- 名称。`src:` 标识取文件名（解码、去扩展名，最长 48 字符）；`dur:` 标识没有名称，用域名代替。
- 更新时间量级。刚刚、N 分钟前、N 小时前、N 天前。
- 删单条。每行一个删除按钮，只删这一条，不需要确认。
- 清空全部。先点「清空全部」出现确认区（标题「清空全部接着看进度？」），再点「清空全部进度」才执行；取消不动任何数据。清空只动账本前缀，设置和其他键不动。
- 面板清除。弹出面板进度行里的「清除接着看」只删当前媒体那一条，见 [resume-panel-jump.md](resume-panel-jump.md)。

## How to get to it (user POV)

1. 存下至少一条进度后打开设置，点左侧「接着看」。
2. 列表里看到刚才那条的名称、域名、时刻和「刚刚」。点行尾删除按钮，这一行消失。
3. 点「清空全部」，出现确认区；点「取消」列表不变，再点一次「清空全部」后点「清空全部进度」，列表清空。

## Driving it with Playwright

复用 `drive resume-save` 的夹具。存进度后 `goto('chrome-extension://<id>/options.html#resume')`，`getByRole('heading', { name: '接着看进度' })` 下断言行文本包含名称与 `mm:ss`；删除按钮的 `aria-label` 是「删除「<名称>」的接着看进度」。清空确认区的标题 id 是 `clear-resume-title`。

列表渲染、删单条、二次确认与取消、坏键忽略由 `tests/resume-settings.test.ts` 的渲染测试锁住；清空只动账本前缀由 `tests/resume-jump.test.ts` 锁住。

## Gotchas

- 列表展示与删除走同一条存储通道，扩展页和内容脚本共享 `chrome.storage.local`，onChanged 驱动刷新。
- 没有搜索或分页；200 条上限下全量渲染够用。
- 二次确认区在列表清空后自动收起。
