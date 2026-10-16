# 官网分享资产

- `site/assets/og.jpg`：1200 × 630，内置 imagegen 生成，以 `brand-reference.png` 为品牌参考。生成后仅缩放到分享尺寸并编码为 JPEG。
- `site/assets/apple-touch-icon.png`：180 × 180，由现有 `brand-reference.png` 缩小并铺暖白底。
- favicon 复用 `public/icon/32.png`。
- `site/scripts/copy-assets.mjs` 在开发和生产构建时复制资产到 `site/public/`；源文件保存在 Git 跟踪目录中。
- 中英文共用品牌图，页面分享标题、描述和图片替代文字复用各语言现有文案。没有增加运行时图像生成或客户端依赖。

## 最终生成提示词

Use case: ads-marketing. Asset type: production Open Graph social share card for OtterTap browser media control extension. Generate a single polished landscape card, exact 1200x630 if supported, otherwise same 1.905:1 aspect ratio. Input image is brand reference: preserve the violet otter holding a play triangle, its identity and simple silhouette. Warm ivory #FAF9F6 background, restrained soft lavender ambient shapes, generous whitespace, violet #655DE9. Left aligned typography on left half, large friendly otter mark on right half with subtle floating playback/volume shapes around it; no fake detailed app UI. Exact text only: "OtterTap" as large strong dark headline; "Web Media Control" as smaller subtitle; "Chrome / Edge" as small label. Keep text crisp and perfectly spelled. No extra slogans, watermark, border, website address or invented product claims. Keep all essential content inside a 70px safe margin. Modern minimal editorial composition, premium clean flat illustration, quiet visual hierarchy. Opaque background.
