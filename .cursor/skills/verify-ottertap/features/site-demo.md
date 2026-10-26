# 官网演示加载状态

官网复用真实媒体控制器。媒体元数据加载前，面板不可交互、演示按钮禁用、浮动入口不显示；加载成功后，面板和浮动控制同一个媒体。加载失败时显示 `demoLoadError`，控制保持不可用。

## 验证

```bash
pnpm site:build
pnpm exec playwright test e2e/site-demo.spec.ts
```

测试用本地 HTTP 服务加载静态产物，不使用扩展验证会话。第一条拦住 `demo.wav`，检查加载状态，再放行并从面板和浮动药丸分别修改倍速，断言同一个 video 的实际值。第二条令媒体请求失败，检查错误说明和不可用的控制。

## Gotchas

- `site/out` 必须来自本次代码的构建；CI 在 e2e 前构建官网。
- 浮动入口的按钮名以 `Open the volume pill` 开头。控制器使用 `getByRole('complementary', { name: 'Floating controller' })`，避免匹配同名设置开关。
