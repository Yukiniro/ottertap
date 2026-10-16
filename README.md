# 小獭 OtterTap

水獭意象的浏览器媒体控制扩展，品牌为小獭 OtterTap，标志为水獭抱着播放键。WXT + React + TypeScript + Tailwind CSS，使用 shadcn/ui 的 **base-nova / Base UI** 组件，图标来自 Lucide。界面语言跟随浏览器：中文使用中文，其他语言使用英文。

## 安装构建包

1. 解压交付的 `ottertap-chrome.zip` 到一个固定目录。
2. Chrome 打开 `chrome://extensions/`，Edge 打开 `edge://extensions/`。
3. 开启开发者模式，点击“加载已解压的扩展程序”，选择包含 `manifest.json` 的解压目录。
4. 刷新已有的媒体网页。点击工具栏中的“小獭 OtterTap”，或使用页面浮动控制器。

已安装旧版时，将新包覆盖原来的解压目录，再点击扩展卡片的“重新加载”。保留原目录以沿用同一扩展及其本地配置；换一个目录加载会成为另一个开发者扩展。

设置页从面板右上角的齿轮打开，在独立标签页中显示。

## 已实现

- 控制当前标签页中的 HTML audio / video，包含获准访问的 iframe 和开放的 Shadow DOM。
- 播放 / 暂停，前进 / 后退 10 秒，拖动进度条。
- 音量 0–100%，静音 / 取消静音；取消静音保留原音量，调高音量自动解除静音。
- 0.75×、1×、1.25×、1.5×、2× 倍速。网页已有其他倍速时显示当前值。
- 多个媒体时选择目标；默认优先显示正在播放的媒体。
- 浮动工具默认只有圆形入口；点击后在旁边展开填充式竖向药丸音量条，拖动调节 0–100%，底部按钮切换静音。再次点击入口、点击页面其他位置或按 Esc 收起。
- 拖动圆形入口移动，方向键也可移动；靠近左边缘时药丸自动在入口右侧展开，小视口自动缩短。浮动开关仍在 popup 和设置页中。
- 浮动工具默认控制正在播放的媒体或第一个媒体；完整的播放、进度、倍速及媒体目标选择保留在 popup。
- 设置页把外观、浮动控制器和网站规则放在同一页；修改自动保存，保存失败明确提示未保存。
- 浅色 / 深色 / 跟随系统主题；设置页、popup 和浮动组件即时同步。
- 全部网站 / 仅指定网站 / 排除指定网站。添加、删除域名，去重并提示无效输入；自动保存。
- 设置只保存在浏览器本地。没有账号、服务器或页面信息上传。

网站规则匹配域名及其子域名。例如 `bilibili.com` 会匹配 `www.bilibili.com`；不会匹配 `bilibili.com.evil.test`。可以粘贴完整网址，路径不参与匹配。iframe 按所在标签页的顶层网站规则判断。

## 开发

命令和包管理器版本以 `package.json` 为准。

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

检查与构建：

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm verify-build
pnpm zip
```

构建目录：`.output/chrome-mv3`。Chrome MV3 构建可在 Edge 中加载。本次未构建或验证 Firefox / Safari。

交互预览：

```powershell
pnpm preview
```

打开 http://127.0.0.1:4186/ 。该页面复用扩展的实际组件和媒体控制逻辑，使用本地静音媒体验证交互；它不代表已经在真实网站安装扩展。`?panel` 显示独立 popup，`?settings` 显示与扩展 options 相同的设置页面。

## 官网访问统计

官网在 `site` 包中，使用 `@vercel/analytics` 统计页面访问，不包含自定义交互事件。浏览器扩展不接入统计。

在对应 Vercel 项目的 Web Analytics 页面点击 Enable，然后重新部署官网。部署后访问官网，在浏览器网络面板确认统计脚本和上报请求成功，并在 Vercel Analytics 面板确认收到访问数据。详见 [Vercel 接入说明](https://vercel.com/docs/analytics/quickstart)。

## 结构与边界

- `entrypoints/content.tsx`：发现页面媒体，直接读写原始 HTMLMediaElement；在顶层页面通过 WXT Shadow Root UI 隔离浮动组件样式。
- `entrypoints/background.ts`：根据当前标签页规则聚合各 frame 的状态，把指令送往选定的 frame。只保留临时 frame 注册信息。
- `entrypoints/popup` / `entrypoints/options`：控制面板及设置页。
- `lib/media.ts`：媒体发现、稳定标识、快照与指令校验，跳转限制在真实 seekable 范围内。
- `components/ui`：来自 shadcn 官方 base-nova registry 的 Button、Slider、Switch，调整了工具函数导入路径，并为滑杆的可操作元素补充名称；产品样式在 `assets/style.css`。

没有媒体的页面显示空状态，不伪造播放内容。未知时长显示 `--:--`，直播显示“直播”。不可跳转的媒体禁用进度控制；网站停用时停止控制。播放失败或扩展连接失效时显示错误。

扩展需要 `storage`，以及 HTTP / HTTPS 主机权限和内容脚本匹配规则，以支持自动浮动控制器和读取当前标签页 URL。**网站规则控制扩展行为，不会撤销浏览器授予的主机 / 注入权限**。没有申请 microphone、camera、downloads、tabs 或历史记录权限。

界面源图和截图在 `docs/design/`。

## 发布

用户可见的变更在 `.changeset/` 加一条记录。合并到 `main` 后，GitHub Action 汇总记录并打开版本 PR，更新 `package.json` 里的版本和 `CHANGELOG.md`。版本 PR 合并后，先完成构建和校验，再打标签并创建带 zip 的 GitHub Release。不需要发版的改动使用 `pnpm changeset add --empty`。修复用 patch，完整新功能用 minor；major 需要先确认。

## 未验证与限制

- 当前 Chrome 自动化连接不可用，未在浏览器中加载扩展并逐站回归。需要安装后验证目标网站，以及真实 iframe 通信、Shadow DOM 样式隔离、service worker 重启后的恢复。
- 原生 HTML 媒体之外的 Web Audio、封闭 Shadow DOM、浏览器内置页、浏览器禁止注入的页面，以及未获浏览器访问权限的 iframe，不在当前范围内。
- 部分网站可能主动覆盖倍速或音量；当前版本不强制反复覆盖网站行为。
- Shadow Root 在现有宿主上动态创建、且没有后续外层 DOM 变化时，可能暂时无法被发现。
- 浮动入口位置和展开状态不跨页面持久化；当前媒体选择不跨页面持久化。

## 技术来源

- [WXT 内容脚本与 Shadow Root UI](https://wxt.dev/guide/essentials/content-scripts.html)
- [WXT 入口与 Options 配置](https://wxt.dev/guide/essentials/entrypoints.html)
- [Base UI](https://base-ui.com/react/overview/quick-start)
- [shadcn/ui](https://ui.shadcn.com/docs/installation)
- [Lucide](https://lucide.dev/)
- [Chrome Tabs 权限说明](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [Chrome 消息响应说明](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)：接收端使用同步返回 `true` 和 `sendResponse`，兼容尚未启用 Promise listener 的浏览器。

以上第三方库及 shadcn 组件遵循各自开源许可。水獭标志使用内置 imagegen 生成，提示词和处理说明见 `docs/design/brand-generation.md`。`public/icon` 包含其 16 / 32 / 48 / 128px 透明 PNG 导出，页面中的标志使用同一资产。
