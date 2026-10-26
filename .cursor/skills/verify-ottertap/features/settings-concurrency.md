# 设置并发保存

两个设置页同时保存时，不同字段、站点条目和名单增删都应保留。后台站点记忆更新也使用同一个写入队列。相同字段的冲突以队列中后执行的变更为准。

## 验证

构建扩展后运行：

```bash
pnpm exec playwright test e2e/smoke.spec.ts -g "两个设置页"
pnpm exec tsx --import ./tests/register-i18n.ts --test tests/settings-background.test.ts tests/settings-change.test.ts
```

浏览器旅程同时打开两个 `options.html`：一页关闭 `Floating controller`，另一页选择 `Dark`。存储应同时包含 `floating: false` 和 `theme: dark`，刷新后仍保持。

后台回归会暂停第一笔存储写入，同时发起两个页面的保存和两个标签的站点记忆更新。第一笔结束前只能有一次实际写入，随后各项均保留；保存失败后，下一笔仍可成功。差异合并测试覆盖删除声道偏好、保留并发倍速、名单顺序及输入不被修改。

导入确认使用同一队列中的整份替换；即使 UI 尚未收到另一页面的更新，备份仍须完整覆盖存储。`tests/settings-atoms.test.ts` 覆盖这条路径和仅声道不同的恢复。

## Gotchas

- `#settings-floating` 指向隐藏的表单 input。点击可见的 `getByRole('switch', { name: 'Floating controller', exact: true })`。
- 单个 `createSettingsAtoms` 的队列只能覆盖同页写入；并发回归必须创建两个实例，并经过真实后台处理器。
