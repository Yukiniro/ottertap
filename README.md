# 小獭 OtterTap

![小獭 OtterTap — Chrome / Edge 网页媒体控制扩展](site/assets/og.jpg)

小獭 OtterTap 是一个面向 Chrome / Edge 的浏览器媒体控制扩展，让你在弹出面板或网页内调节视频与音频的播放、进度、音量和倍速，把常用控制留在手边。

界面跟随浏览器语言，支持简体中文、繁体中文、英语、日语、韩语、西班牙语、法语和德语，以及浅色、深色和跟随系统主题。设置保存在浏览器本地，无需账号，不上传页面信息。

## 安装与使用

推荐从商店安装，一键添加，之后由浏览器自动更新：

1. Chrome 打开 [小獭 OtterTap 的 Chrome 网上应用店页面](https://chromewebstore.google.com/detail/%E5%B0%8F%E7%8D%AD-ottertap-%C2%B7-%E7%BD%91%E9%A1%B5%E5%AA%92%E4%BD%93%E6%8E%A7%E5%88%B6/ipcjiedocfmjiamcjnpmmjckpegannmn)，添加到 Chrome。
2. 刷新媒体网页，点击工具栏中的“小獭 OtterTap”打开控制面板，或点击网页侧边的浮动入口调节音量。

Edge 商店暂未上架。按照 [微软官方说明](https://support.microsoft.com/en-us/edge/add-turn-off-or-remove-extensions-in-microsoft-edge)，Edge 可以在 Chrome 网上应用店的商品页安装扩展，需要先允许“来自其他应用商店的扩展”；也可以使用下方的手动安装。

商店页的详细描述由维护者手动粘贴更新，文案见 [Chrome 网上应用店商店文案](docs/chrome-web-store-listing.md)。

点击控制面板右上角的齿轮打开设置，可调整主题、浮动控制器和网站启用范围。

### 备选：手动安装（侧载）

开发调试，或商店暂不可用时，可以下载发布包手动安装：

1. 从 [GitHub Releases](https://github.com/Yukiniro/ottertap/releases) 下载 Chrome 扩展 zip 包，解压到一个固定目录。
2. Chrome 打开 `chrome://extensions/`，Edge 打开 `edge://extensions/`。
3. 开启开发者模式，点击“加载已解压的扩展程序”，选择包含 `manifest.json` 的解压目录。
4. 刷新媒体网页，点击工具栏中的“小獭 OtterTap”打开控制面板，或点击网页侧边的浮动入口调节音量。

更新时，将新包覆盖原来的解压目录，再点击扩展卡片的“重新加载”，保留原目录以沿用本地设置。

手动安装的版本与商店版是两个独立的扩展，设置互不相通。从一种安装方式换到另一种时，需要在新装的扩展里重新设置。

## 本地开发

扩展使用 WXT、React、TypeScript 和 Tailwind CSS，UI 基于 shadcn/ui 与 Base UI，图标来自 Lucide；官网使用 Next.js。

使用 Node.js 24（与 CI 一致），pnpm 版本以根目录 `package.json` 的 `packageManager` 为准。以下命令均在仓库根目录运行：

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

在浏览器扩展页加载 `.output/chrome-mv3-dev`，即可调试开发版本。

检查与打包：

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm verify-build
pnpm zip
```

构建目录为 `.output/chrome-mv3`，压缩包输出到 `.output/`。`pnpm verify-build` 需要先执行构建。

端到端冒烟会用 Playwright 自带的 Chromium 加载这份构建产物。测试页由请求拦截伪装成 https 站点，不访问外网：

```powershell
pnpm build
pnpm e2e
```

`pnpm e2e` 会先安装 Chromium（已经安装时不会重新下载），再运行 `e2e/` 里的冒烟测试。

交互预览：

```powershell
pnpm preview
```

打开 [本地预览](http://127.0.0.1:4186/)，可体验弹出面板、浮动控制器和设置页。预览使用本地演示媒体，真实网页控制需安装扩展后体验。

官网开发与静态构建：

```powershell
pnpm site:dev
pnpm site:build
```

开发地址为 [http://localhost:4187/](http://localhost:4187/)，根路径 `/` 为英语首页，`/zh/` 为中文首页，静态构建输出到 `site/out/`。

## 官网访问统计

官网在 `site` 包中，使用 `@vercel/analytics` 统计页面访问，不包含自定义交互事件。浏览器扩展不接入统计。

在对应 Vercel 项目的 Web Analytics 页面点击 Enable，然后重新部署官网。部署后访问官网，在浏览器网络面板确认统计脚本和上报请求成功，并在 Vercel Analytics 面板确认收到访问数据。详见 [Vercel 接入说明](https://vercel.com/docs/analytics/quickstart)。

## 参与开发

问题与建议请提交到 [GitHub Issues](https://github.com/Yukiniro/ottertap/issues)。参与开发前请阅读 [工程约定](AGENTS.md) 和 [领域术语](CONTEXT.md)。

用户可见的变更需附带 changeset；仅文档等不需要发版的改动使用 `pnpm changeset add --empty`。更新记录见 [CHANGELOG.md](CHANGELOG.md)。

发版由维护者主动启动：在 GitHub Actions 中选择 Release，使用 main 分支点击 Run workflow，Changesets 会汇总已合入的变更并创建或更新 `chore: 发布版本` PR。检查版本号和更新记录后合并该 PR，工作流自动构建、校验并上传 Chrome ZIP，创建 `v版本号` 标签和 GitHub Release。普通提交不会自动创建版本 PR 或发布；没有待发布的 changeset 时，手动运行也不会发布。版本 PR 打开后新增的 changeset，需要再次手动运行才能纳入该 PR。发布失败后重跑对应的合并事件工作流；本流程不提交浏览器扩展商店。

## 致谢与许可

感谢 WXT、React、Tailwind CSS、shadcn/ui、Base UI、Lucide 和 Next.js 等项目。第三方库与组件遵循各自的开源许可。

水獭标志由 imagegen 生成，设计说明见 [品牌生成记录](docs/design/brand-generation.md)。

## 许可证

本项目以 GPL-3.0 授权，见 [LICENSE](LICENSE)。
