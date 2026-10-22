# Chrome Web Store 商店文案

**仅供人工粘贴到 Chrome Web Store Developer Dashboard，不自动上架。** 本仓库不调用任何 Chrome Web Store API；粘贴、保存和提交审核都由维护者在后台手动完成。

文案对齐 `main` 上已合入的行为（见 [CHANGELOG.md](../CHANGELOG.md) 1.6.0 / 1.7.0 和 `.changeset/` 中待发布的变更）。功能变化后，先改这里，再手动粘贴到商店。

## 粘贴位置

Developer Dashboard → 商品详情（Store listing）→ 英语 → Detailed description（商店页的 Overview）。简短描述（Summary）来自 `locales/en.yml` 的 `extDescription`，随扩展包更新，不在此处维护。

## English: Detailed description

适用于当前已发布版本（1.7.0）。直接复制下面代码块的全部内容。

```text
OtterTap puts the controls for web video and audio where you need them: in the toolbar popup, on the page, and on your keyboard. No account, no tracking, and settings stay in your browser.

PLAYBACK AND SEEKING
• Play or pause, and skip back or forward, from the popup, the on-page hotkeys, or browser extension commands.
• Pick the skip step in Settings, from short hops to longer jumps.
• Picture-in-picture from the popup.

VOLUME
• Hold Alt (Option on Mac) and scroll the mouse wheel to change volume.
• Hover over the main player and scroll to change its volume without holding any key. Muted feed previews and other videos keep scrolling the page. Turn this off in Settings to use Alt + wheel only.
• Boost volume up to 200%, with a limiter that keeps loud parts from distorting.
• Channel modes: stereo, mono, left only, or right only. They combine with the volume boost. Media from other origins without CORS can't be boosted or remapped; the popup says so.
• The toolbar icon shows a badge when the current tab is boosted above 100%.

SPEED
• Alt + , and Alt + . slow down and speed up; the page briefly shows the speed in effect.
• Alt + 0 switches between 1x and the speed you were just using on that page.
• Speed presets in the popup, up to 4x. Add, remove, and reorder them in Settings.
• Optional speed lock: when a site resets the playback speed, OtterTap puts yours back. Off by default, and it gives up after a limited number of tug-of-war rounds.

PER SITE AND PER TAB
• Remember this site: volume and speed are applied once the next time you open it.
• Turn OtterTap on or off for specific sites.
• The popup also lists other tabs that are playing or muted, so you can jump to them or mute them.

KEYS AND COMMANDS
• Alt + wheel for volume, Alt + , . 0 for speed, Alt + M to mute. Hotkeys don't fire while you type in text fields.
• Optional single-key mode (off by default): K to play or pause, J / L or the arrow keys to skip, Up / Down for volume, M to mute, < > for speed.
• Browser extension commands for play/pause, skip, mute, volume, and speed. Set your own shortcuts at chrome://extensions/shortcuts.
• Export and import all settings to carry them to a new browser.

The interface follows your browser language: English, Simplified and Traditional Chinese, Japanese, Korean, Spanish, French, and German. Light, dark, and system themes.

Works with media on http and https pages. OtterTap needs access to the pages you play media on to find and control the media element. It does not collect, send, or sell page content.
```

## 1.8.0 发布后追加

`main` 已合入「扩展命令：进入或退出画中画」（PR #68，changeset 待随 1.8.0 发布）。**在 1.8.0 上架之前不要粘贴这一条**，否则商店文案会领先于已发布版本。

1.8.0 发布后，把上面代码块里 KEYS AND COMMANDS 的命令一行替换为：

```text
• Browser extension commands for play/pause, skip, mute, volume, speed, and picture-in-picture. Set your own shortcuts at chrome://extensions/shortcuts. Picture-in-picture has no default shortcut.
```

## 可选：简体中文 Overview

商店若新增中文语言版本时使用。英文版是必需项，中文版不是。

```text
小獭 OtterTap 把网页视频和音频的控制放在你顺手的地方：工具栏弹出面板、页面内、键盘。无需账号，设置只保存在浏览器本地。

播放与进度
• 在弹出面板、页内快捷键或浏览器扩展命令里播放、暂停、快进、快退。
• 在设置里选择快进 / 快退步长。
• 弹出面板可一键进入或退出画中画。

音量
• 按住 Alt（Mac 为 Option）滚动滚轮调音量。
• 鼠标停在主播放器上直接滚动滚轮即可调音量；信息流里的静音预览和其他视频照常滚动页面。可在设置中关闭，关闭后需按住 Alt。
• 音量最高放大到 200%，带限幅器，避免响段破音。
• 声道模式：立体声、单声道、只听左声道、只听右声道，可与音量放大叠加。跨域且无 CORS 的媒体不支持，弹出面板会说明原因。
• 当前标签页音量超过 100% 时，工具栏图标显示角标。

倍速
• Alt + , 和 Alt + . 减速、加速，页面上会短暂显示实际倍速。
• Alt + 0 在 1× 与本页刚才的倍速之间来回切换。
• 弹出面板的倍速预设覆盖到 4×，可在设置中增删和排序。
• 可选锁定倍速：站点把速度改回去时写回你设定的倍速，默认关闭，反复拉锯有限次数后停止。

按站点与标签页
• 记住此站点：下次打开时应用一次音量和倍速。
• 按网站开关 OtterTap。
• 弹出面板还会列出其他正在发声或已静音的标签页，可切换过去或静音。

快捷键与命令
• Alt + 滚轮调音量，Alt + , . 0 调倍速，Alt + M 静音；在输入框中输入时不会触发。
• 可选单键模式（默认关闭）：K 播放暂停，J / L 或方向键跳转，↑ / ↓ 调音量，M 静音，< > 调倍速。
• 浏览器扩展命令覆盖播放暂停、快进快退、静音、音量和倍速，可在 chrome://extensions/shortcuts 自行设置。
• 可导出和导入全部设置。

界面跟随浏览器语言，支持简体中文、繁体中文、英语、日语、韩语、西班牙语、法语和德语，以及浅色、深色和跟随系统主题。

适用于 http 和 https 网页上的媒体。扩展需要访问你播放媒体的页面才能找到并控制媒体元素，不会收集、发送或出售页面内容。
```

## 粘贴前核对清单

- [ ] 英文 Overview 里没有写 Alt 加 Shift 的组合键；页内快捷键只有 Alt（Mac 为 Option）。
- [ ] 没有写死快进 / 快退的秒数；步长在设置里可选。
- [ ] 音量放大上限写 200%，与 `lib/amplifier.ts` 的 `maxGain` 一致。
- [ ] 悬停滚轮只写「主播放器」，并说明静音预览照常滚动页面。
- [ ] 画中画扩展命令（#68）只在 1.8.0 上架后才粘贴。
- [ ] 没有承诺未发布的功能，也没有写 Edge 商店上架。
- [ ] 粘贴后在商店页刷新，确认文案已更新；这一步仍需人工完成。

自动检查（在仓库根目录运行，没有任何输出表示通过）：

```bash
rg -i "alt\s*\+\s*shift|\d+\s*(seconds?|秒)" docs/chrome-web-store-listing.md
```
