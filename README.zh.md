# Nexus-Editor

基于 [CodeMirror 6](https://codemirror.net/) 和 [unified](https://unifiedjs.com/) 生态构建的 **无头 (Headless) Markdown 编辑器引擎**。框架无关的核心包，附带官方 React 和 Vue 绑定。

[English](./README.md)

## 特性

- **无头设计** — 不内置 UI 组件，完全由宿主框架控制渲染与样式。
- **语法树驱动** — 每次输入实时生成 mdast 抽象语法树。
- **实时预览** — 类 Obsidian 的内联渲染，光标聚焦时展开原始语法。
- **插件系统** — 三层架构：快捷键与斜杠命令、remark 插件与自定义 Widget、原生 CM6 扩展。
- **事件系统** — 订阅 `change`、`focus`、`blur`、`selectionChange`、`slashMenuChange` 事件。
- **Widget API** — 为任意 AST 节点类型（代码块、表格、图表等）渲染自定义组件。
- **本地优先** — 为 Electron/Tauri 场景设计，内置文件 IO 钩子与防抖解析。

## 包结构

| 包名 | 说明 |
|---|---|
| `@floatboat/nexus-core` | 编辑器引擎 — CM6 状态机、AST 管道、实时预览、事件系统、Widget API |
| `@floatboat/nexus-react` | React 绑定 — `useEditor` Hook 和 `<Editor />` 组件 |
| `@floatboat/nexus-vue` | Vue 3 绑定 — `useEditor` 组合式函数 |
| `@floatboat/nexus-preset-gfm` | GitHub Flavored Markdown 预设（表格、删除线、任务列表） |
| `@floatboat/nexus-plugin-history` | 撤销/重做，支持 `Ctrl+Z` / `Ctrl+Shift+Z` |
| `@floatboat/nexus-plugin-search` | 搜索替换辅助函数 |
| `@floatboat/nexus-plugin-slash` | 斜杠命令检测与过滤 |
| `@floatboat/nexus-plugin-toolbar` | 工具栏基础组件与格式化命令 |
| `@floatboat/nexus-plugin-math` | 行内 / 块级数学公式渲染（KaTeX） |
| `@floatboat/nexus-plugin-vim` | Vim 键位（基于 `@replit/codemirror-vim`） |

## 快速开始

### 原生 DOM

```ts
import { createEditor } from "@floatboat/nexus-core";
import { createGfmPreset } from "@floatboat/nexus-preset-gfm";
import { createHistoryPlugin } from "@floatboat/nexus-plugin-history";

const editor = createEditor({
  container: document.getElementById("editor")!,
  initialValue: "# 你好\n\n开始编辑...",
  plugins: [createGfmPreset(), createHistoryPlugin()],
  livePreview: true,
  onChange(doc, ast) {
    console.log("Markdown:", doc);
    console.log("AST:", ast);
  },
});
```

### React

```tsx
import { Editor } from "@floatboat/nexus-react";
import { createGfmPreset } from "@floatboat/nexus-preset-gfm";

function App() {
  return (
    <Editor
      initialValue="# 你好"
      plugins={[createGfmPreset()]}
      livePreview
      onChange={(doc, ast) => console.log(doc)}
    />
  );
}
```

### Vue

```vue
<script setup>
import { Editor } from "@floatboat/nexus-vue";
import { createGfmPreset } from "@floatboat/nexus-preset-gfm";
</script>

<template>
  <Editor
    initial-value="# 你好"
    :plugins="[createGfmPreset()]"
    :live-preview="true"
    @change="(doc) => console.log(doc)"
  />
</template>
```

## 编辑器 API

`createEditor(config)` 返回 `EditorAPI`：

```ts
editor.getDocument()          // 当前 Markdown 文本
editor.getAst()               // 当前 mdast 语法树
editor.setDocument(md)         // 替换整个文档
editor.setSelection(pos)       // 移动光标
editor.focus() / editor.blur()
editor.destroy()

// 事件系统
editor.on("change", (doc, ast) => { ... })
editor.on("selectionChange", ({ anchor, head }) => { ... })
editor.on("slashMenuChange", ({ isOpen, query, commands, coords }) => { ... })
editor.off("change", handler)

// 坐标（用于浮动 UI 定位）
editor.getCoordsAtPos(pos)     // { left, right, top, bottom } | null
```

## 插件系统

插件可以接入三个层级：

```ts
const myPlugin: NexusPlugin = {
  name: "my-plugin",

  // 第一层：快捷键与斜杠命令
  shortcuts: [{ key: "Mod-b", run: (editor) => { /* 切换加粗 */ return true; } }],
  slashCommands: [{ id: "heading", title: "标题", keywords: ["h1"] }],

  // 第二层：AST 与 Widget
  remarkPlugins: [remarkMath],
  widgets: [{
    nodeType: "code",
    match: (node) => node.lang === "mermaid",
    render: (node, source) => renderMermaidChart(source),
    destroy: (el) => el.remove(),
  }],

  // 第三层：原生 CM6 扩展
  cmExtensions: [myCodeMirrorExtension],
};
```

## 开发

```bash
pnpm install
pnpm build          # 构建所有包
pnpm test           # 运行所有测试

# Electron 演示应用
pnpm dev:electron-demo
```

## Roadmap

规划中的功能见 [docs/ROADMAP.zh.md](./docs/ROADMAP.zh.md)，按归属包、优先级、状态、是否需要 OpenSpec 分类。

## 贡献指南

欢迎提交 PR。开始之前请阅读：

- [CONTRIBUTING.zh.md](./CONTRIBUTING.zh.md) — 分支命名、Conventional Commits 的 scope 白名单、何时需要走 OpenSpec、测试矩阵。
- [.github/PULL_REQUEST_TEMPLATE.md](./.github/PULL_REQUEST_TEMPLATE.md) — PR 描述模板（双语）。
- [openspec/AGENTS.md](./openspec/AGENTS.md) — 新 capability 或破坏性 API 变更必读。

## 许可证

MIT
