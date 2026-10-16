# 小獭 OtterTap

小獭 OtterTap 是一个面向 Chrome / Edge 的浏览器媒体控制扩展，让你在弹出面板或网页内调节视频与音频的播放、进度、音量和倍速，把常用控制留在手边。

支持中文和英文界面，以及浅色、深色和跟随系统主题。设置保存在浏览器本地，无需账号，不上传页面信息。

## 安装与使用

1. 从 [GitHub Releases](https://github.com/Yukiniro/ottertap/releases) 下载 Chrome 扩展 zip 包，解压到一个固定目录。
2. Chrome 打开 `chrome://extensions/`，Edge 打开 `edge://extensions/`。
3. 开启开发者模式，点击“加载已解压的扩展程序”，选择包含 `manifest.json` 的解压目录。
4. 刷新媒体网页，点击工具栏中的“小獭 OtterTap”打开控制面板，或点击网页侧边的浮动入口调节音量。

点击控制面板右上角的齿轮打开设置，可调整主题、浮动控制器和网站启用范围。

更新时，将新包覆盖原来的解压目录，再点击扩展卡片的“重新加载”，保留原目录以沿用本地设置。

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

开发地址为 [http://localhost:4187/](http://localhost:4187/)，提供 `/zh/` 和 `/en/` 页面，静态构建输出到 `site/out/`。

## 参与开发

问题与建议请提交到 [GitHub Issues](https://github.com/Yukiniro/ottertap/issues)。参与开发前请阅读 [工程约定](AGENTS.md) 和 [领域术语](CONTEXT.md)。

用户可见的变更需附带 changeset；仅文档等不需要发版的改动使用 `pnpm changeset add --empty`。版本发布由 GitHub Actions 和 Changesets 管理，更新记录见 [CHANGELOG.md](CHANGELOG.md)。

## 致谢与许可

感谢 WXT、React、Tailwind CSS、shadcn/ui、Base UI、Lucide 和 Next.js 等项目。第三方库与组件遵循各自的开源许可。

水獭标志由 imagegen 生成，设计说明见 [品牌生成记录](docs/design/brand-generation.md)。仓库目前未提供项目级 `LICENSE` 文件。
