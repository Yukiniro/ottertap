# 接着看：跳回提示

自动跳回或弹出面板手动「跳到接着看」成功时，页面顶部用倍速提示那一块短暂显示「从 xx:xx 继续」。没有独立的提示开关。失败、被排除或没有进度时不出提示，也不出假成功。

## Sub-features

- 自动跳回成功时显示。内容脚本跳完通过后台发 `actionHint`，文案 `resumeJumpHint`，`{time}` 是实际跳到的时刻（已减三秒）。
- 面板手动跳转成功时同样显示，秒数是控制器返回的落点。
- 手动拖动进度条不触发。只有扩展自己发起的跳转才提示。
- 跳转失败（不可 seek、媒体没了）走原有失败短说明，不提示。

## How to get to it (user POV)

1. 存下一条进度后关标签重开：页面顶部短暂出现「从 xx:xx 继续」，约一秒后消失。
2. 打开弹出面板点「跳到接着看」：同样的字样出现一次。

## Driving it with Playwright

复用 `drive resume-save` 的 Lecture 夹具。重开有进度的 `/watch?v=1` 后，`page.locator('text=从')` 或读取提示节点的文本应为 `从 0:47 继续` 格式（时刻随存的进度）。面板路径在弹出面板里点 `aria-label` 为「跳到接着看」的按钮后断言同一节点。

后台发提示的时机（`resumeJumped` 消息与命令成功两条路径、秒数透传）由 `tests/resume-jump.test.ts` 的后台测试锁住；文案格式由 `lib/hotkey.ts` 的 `actionHintText` 处理，和倍速提示同一渲染（`tests/pip-feedback.test.ts` 的做法相同）。

## Gotchas

- 提示只在顶层框架渲染；iframe 里的媒体跳回时提示出现在 iframe 里，和倍速提示一致。
- 自动跳回和面板跳转共用一个文案键，不要按来源区分措辞。
