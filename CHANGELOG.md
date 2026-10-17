# ottertap-extension

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
