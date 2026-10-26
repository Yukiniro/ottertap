# 设置导出导入

设置页可以把全部设置下载成 JSON，或从以前导出的文件恢复。导入会替换当前设置，包括网站规则、记住的站点和倍速预设。扩展没有账号，这个文件就是换浏览器时的全部状态。

## Sub-features

- 导出。按钮 `Export settings`。下载文件名是 `ottertap-settings-YYYY-MM-DD.json`。内容是 `format: "ottertap-settings"`、`version: 1`、`extensionVersion`，以及 `settings`。
- 导入确认。按钮 `Import settings` 打开隐藏的 `input[type=file]`（在 `#backup` 里，`accept` 含 `.json`）。解析成功后出现区域「Replace current settings?」，按钮是 `Replace settings` 和 `Cancel`。
- 拒绝坏文件。非法 JSON、不是 OtterTap 导出、版本过新或过旧时，出现对应错误文案，存储保持原样。文案在 `locales/en.yml` 的 `importInvalidJson`、`importNotOttertap`、`importVersionTooNew`、`importVersionTooOld`。
- 取消。点 `Cancel` 后确认区消失，`ottertap-settings-v1` 不变。

## How to get to it (user POV)

1. 打开扩展设置。弹出面板右上角按钮 `Open settings`，或直接打开 `chrome-extension://<extensionId>/options.html#backup`。扩展 id 来自 service worker 的 URL host，`doctor` 的输出里也有。
2. 在左侧导航点 `Backup and restore`（`nav` 的无障碍名是 `Settings`）。
3. 点 `Export settings` 得到文件，或点 `Import settings` 选择文件后再点 `Replace settings`。

这条路径不需要夹具页。`session.mjs` 还没有名为 `settings-backup` 的 `drive`。在 `serve` 的上下文里按下面的步骤做，才能截到设置页并读到存储。不要用 `chrome.storage.local.set` 代替点击 `Replace settings`。

## Driving it with Playwright

1. `doctor` 拿到 `extension=<id>`。`context.newPage()` 后 `goto('chrome-extension://<id>/options.html#backup')`。
2. `getByRole('heading', { name: 'Backup and restore' })` 可见。截图，记下当前 `#settings-floating` 的 `aria-checked`（默认应为选中，浮动控制器开）。
3. 导出：`page.waitForEvent('download')` 的同时点击 `Export settings`。保存下载体。断言 JSON 的 `format === 'ottertap-settings'`、`version === 1`、`extensionVersion` 等于 `package.json` 的版本，`settings.floating === true`。再读一次 `chrome.storage.local` 的 `ottertap-settings-v1`，导出不应把它改掉。
4. 准备一份只改了 `theme: "dark"` 和 `floating: false` 的合法导出（其余字段用导出文件里的值）。对 `#backup input[type=file]` 执行 `setInputFiles`。这是文件选择框，不是绕过按钮；确认区必须出现。
5. 点击 `Replace settings`。结束状态：`#settings-floating` 未选中，主题那组里 `Dark` 按下，service worker 里 `chrome.storage.local.get('ottertap-settings-v1')` 的 `floating` 为 `false`、`theme` 为 `dark`。截图。
6. 再导入一份 `{ "format": "ottertap-settings" }` 缺 `version` 的文件。错误文案是 `This file is not an OtterTap settings export. Current settings were not changed.`，存储仍是上一步的暗色和关闭浮动。

文件格式的边界（版本过新、过旧、空设置）由 `tests/settings-backup.test.ts` 锁住。用户路径至少要看到成功导出、成功替换，以及一份被拒绝的文件没有改存储。

## Gotchas

- 导入在点 `Replace settings` 之前不写存储。只弹出确认区不算完成。
- `Cancel` 必须留下旧设置。若取消也写入了，这是失败。
- 隐藏的 file input 是 `aria-hidden`。用 `setInputFiles` 选文件；仍然要点可见的 `Replace settings`。
- 导出的 `settings` 会经过 `normalizeSettings`。多余的字段不会原样出现。断言用规范化之后的形状。
- `e2e/smoke.spec.ts` 的「备份导出、确认导入及拒绝旧版本」覆盖真实设置页下载、确认写入与拒绝旧文件，保存 `settings.json` 和 `backup-rejected.png`。
- 替换是整份覆盖。用完要在 cleanup 时丢掉 profile，避免把暗色主题留在验证配置里。空 profile 下次 launch 会回到默认值。
