## Agent skills

### Issue tracker

Issues and specs for this repo live as GitHub issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## 工程设计原则

- 不要维护向后兼容性。应移除废弃路径，而不是增加兼容层、回退方案或迁移逻辑。
- 选择能够完全满足当前需求的最简单实现。避免臆测性的抽象、配置和间接层。
- 分层构建系统。从能够端到端运行的最小版本开始，在已有可用产品的基础上逐步增加新能力。不要为了尚未完成的复杂性牺牲一个正常工作的产品。
- 保持组件模块化，并明确分离各项关注点。
- 当成熟且维护良好的库能够降低整体复杂度或提高可靠性时，应优先使用它们。没有明确理由时，不要重新实现常见功能。
- 在自行实现或新增软件包之前，优先利用项目中已有的依赖。没有检查库的文档和类型定义之前，不要假设它不具备某项能力。
- 从长期角度做架构决策。不要接受只解决眼前问题、以后还计划替换的临时方案。

### `git commit` 提交规范

- feat: 新增/修改功能 (feature)。
- fix: 修補 bug (bug fix)。
- docs: 文件 (documentation)。
- style: 格式 (不影響程式碼運行的變動 white-space, formatting, missing semi colons, etc)。
- refactor: 重構 (既不是新增功能，也不是修補 bug 的程式碼變動)。
- perf: 改善效能 (A code change that improves performance)。
- test: 增加測試 (when adding missing tests)。
- chore: 建構程序或輔助工具的變動 (maintain)。
- revert: 撤銷回覆先前的 commit 例如：revert: type(scope): subject (回覆版本：xxxx)。
- conflict: 处理冲突。
