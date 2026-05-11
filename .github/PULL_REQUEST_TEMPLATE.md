<!--
PR title must follow Conventional Commits:  <type>(<scope>): <subject>
  e.g.  feat(toolbar): list toggle for multi-line selection
Allowed scopes — see CONTRIBUTING.md §2

PR 标题请遵循 Conventional Commits 规范，合法 scope 见 CONTRIBUTING.md §2
-->

## Summary / 摘要

<!-- One sentence summary of the change. / 一句话说明改了什么。 -->

## Motivation / 背景与动机

<!-- Why is this change needed? Link issue / roadmap entry / OpenSpec change. -->
<!-- 解决什么问题？关联 issue / roadmap 条目 / OpenSpec change id。 -->

- Issue:
- Roadmap (docs/ROADMAP.md):
- OpenSpec change:

## Changes / 变更内容

<!-- List key changes per package. / 按包分节，列出关键改动点。 -->

- `packages/core`:
- `packages/plugin-*`:
- `apps/electron-demo`:
- `openspec/`:

## Testing / 测试

<!-- How was this verified? Commands and scenarios covered. -->
<!-- 描述如何验证，附上命令与覆盖的场景。 -->

- [ ] `pnpm test` passes / 全绿
- [ ] Affected packages build (`pnpm build`) / 受影响包构建通过
- [ ] New / updated vitest cases / 新增或更新的 vitest 用例：
- [ ] Manual UI check in electron-demo / electron-demo 手动验证：

## Checklist / 自检清单

- [ ] Title follows Conventional Commits / 标题遵循 Conventional Commits
- [ ] Public API changes update package README / types — 改了公共 API 已同步 README 与类型
- [ ] Touched `live-preview-table.ts` → walked through the 12 Table Widget rules in CLAUDE.md / 已核对 12 条表格规则
- [ ] New capability / breaking change → OpenSpec proposal linked / 新 capability 或破坏性变更已附 OpenSpec
- [ ] No secrets / personal vault data committed / 无敏感信息被提交

## Screenshots / Recordings · 截图或录屏 (UI changes)

<!-- Attach screenshots or gifs for visible UI changes. / 改动可见 UI 时请附上截图或 gif。 -->
