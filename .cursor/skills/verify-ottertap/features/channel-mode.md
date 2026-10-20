# 单声道与左右声道

弹出面板可以把当前媒体改成立体声、单声道、只听左声道或只听右声道。默认是立体声，这时不接入 Web Audio。只有选了非立体声（或音量超过 100%）才接入同一条链路。跨域且没有 CORS 的媒体不能改声道。

## Sub-features

- 声道菜单。触发按钮的无障碍名是 `Channels: Stereo`、`Channels: Mono`、`Channels: Left channel only` 或 `Channels: Right channel only`。菜单项是 `menuitemradio`，文案与这四个名字去掉 `Channels: ` 前缀后相同。
- 单声道。左右输出都是两侧输入的混合。
- 只听左声道 / 只听右声道。两侧喇叭都播放那一侧的输入。
- 切回立体声。菜单回到 `Channels: Stereo`。若音量没有超过 100%，媒体不再被 `createMediaElementSource` 占住。
- 记住的声道。打开「Remember this site」之后，下次打开同一主机应恢复非立体声。设置页 `#memory` 的摘要里会出现 `Left channel only` 这类字样。
- 跨域媒体。按钮禁用，`#channel-hint` 为 `This media is from another site, so its channels cannot be changed.` 强行下发命令也返回这句错误，输出链路不建立。

## How to get to it (user POV)

1. 打开带有同源或 `data:` 音频的页面。回归夹具 `/stereo` 是一段左右声道不同的循环音色；`/cross` 指向另一个源且不带 CORS。
2. 打开弹出面板，点音量标题旁的耳机按钮（名以 `Channels: ` 开头）。
3. 选 `Mono` 或某一侧。按钮名字跟着变。

验证会话的 `route` 目前只有 `/video`。声道旅程需要 `/stereo` 和 `/cross` 的文档，以及 `e2e/smoke.spec.ts` 里那份左右不同的 wav。不要改用静音单声道夹具来假装电平对了。

## Driving it with Playwright

回归：

```bash
pnpm exec playwright test e2e/smoke.spec.ts -g "切换声道后两侧电平符合模式"
pnpm exec playwright test e2e/smoke.spec.ts -g "默认立体声"
pnpm exec playwright test e2e/smoke.spec.ts -g "跨域且无 CORS"
```

弹出面板路径：

1. 打开 `/stereo`，等浮动入口。用弹出面板的 `Play`（和播放控制同一条路径）或夹具视频自己的原生控件开始播放。电平断言必须发生在播放中；不要在测试脚本里直接 `element.play()` 来代替这次点击。
2. `openPopup()`。按钮是 `Channels: Stereo`，且未禁用。此时扩展还没有创建输出链路：页面里对 `#media` 再 `createMediaElementSource` 应成功（还没被占住），测完关掉这个临时 `AudioContext`。
3. 点击声道按钮，再点 `menuitemradio` 文案 `Mono`。结束状态是按钮 `Channels: Mono`。截图。内容脚本的输出电平两侧接近，并且高于静音。`e2e/smoke.spec.ts` 里的 `toneLevels.mono` 是数值依据。
4. 再选 `Left channel only`、`Right channel only`，然后 `Stereo`。每一选都要看到按钮名字变化。切回立体声且音量仍是 100% 时，媒体不再处于已连接的 Web Audio 源（若同一次旅程里已经放大到 200%，立体声仍会留在链路上，这是音量放大的结果，不是声道没切回去）。
5. 打开 `/cross`。按钮禁用，提示句与 `channelCrossOrigin` 一致，媒体仍未被 `createMediaElementSource` 占住。

副作用是音频图，不只是按钮文案。只改按钮名字、电平仍是立体声，算失败。

## Gotchas

- `data:` 和 blob URL 可以改声道。另一个源且没有 `crossorigin`、响应也没有 CORS 时不行。`/cross` 就是这个前置；夹具没配好就应失败。
- 默认立体声不要为了「好截图」预先把媒体接进 Web Audio。那会改变被测的链路。
- 电平要在播放开始之后读。暂停时的 analyser 接近静音，不能用来证明声道。
- 菜单项在 shadow 外的弹出面板里，角色是 `menuitemradio`，不是 `option`。
- 记住声道依赖 `sitePrefs.<host>.channel`。空 profile 没有这项。要证明恢复，必须走「Remember this site」开关（无障碍名 `Remember this site`），或承认这条子路径还缺前置并记在这里，不要直接写存储冒充用户保存。
