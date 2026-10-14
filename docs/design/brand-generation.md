# 小獭 OtterTap 品牌资产

使用内置 imagegen 生成，非 CLI / API 回退。用户选择方案 1：小獭 / OtterTap，水獭小爪子托着播放键。

- 原始生成文件：`brand-reference.png`（本目录），1280 × 1280，RGBA，透明背景。
- 页面标志：`assets/otter-mark.png`，128 × 128；`assets/otter-mark.ts` 是同一 PNG 的 data URI，避免浮动组件在宿主网页中依赖相对资源地址。
- 扩展图标：`public/icon/16.png`、`32.png`、`48.png`、`128.png`。
- 后处理仅用 Lanczos 缩小并保留透明通道，没有重绘标志或添加图形。
- 原始结果：exec-55060e92-b19c-4438-aae7-634fc024873f。

## 最终提示词

Use case: logo-brand. Asset type: one transparent-background app icon / logo mark for a lightweight browser media-control extension named 小獭 OtterTap. Generate a single clean, distinctive small otter brand mark, no text. Front-facing round otter head with tiny rounded ears and two simple paws gently holding a clear right-pointing play triangle below its muzzle. Art direction: minimal flat vector-like geometric silhouette, friendly but restrained, strong compact outline readable at 16px and 24px. Main solid violet #655DE9; sparse warm ivory #FAF9F6 negative details for eyes/muzzle/play symbol. Use very few bold shapes, no fine fur/whisker detail, no tiny accessories, no gradients, no shadows, no texture, no 3D. Square composition, centered, mark fills roughly 85 percent of canvas with balanced 7 percent clear padding. Genuine transparent alpha background, no background plate, no letters, no wordmark, no mockup, no multiple variants. Maintain crisp simple contours appropriate for a 48px circular floating trigger as well as toolbar icons. Produce only the isolated logo asset.
