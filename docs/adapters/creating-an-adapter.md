---
title: 创建适配器
summary: 构建自定义适配器指南
---

构建自定义适配器，将 Paperclip 连接到任何智能体运行时。

<Tip>
如果你使用 Claude Code，`.agents/skills/create-agent-adapter` 技能可以交互式地引导你完成整个适配器创建过程。只需让 Claude 创建一个新适配器，它会逐步指导你完成每一步。
</Tip>

## 包结构

```
packages/adapters/<name>/
  package.json
  tsconfig.json
  src/
    index.ts            # 共享元数据
    server/
      index.ts          # 服务端导出
      execute.ts        # 核心执行逻辑
      parse.ts          # 输出解析
      test.ts           # 环境诊断
    ui/
      index.ts          # UI 导出
      parse-stdout.ts   # 转录解析器
      build-config.ts   # 配置构建器
    cli/
      index.ts          # CLI 导出
      format-event.ts   # 终端格式化器
```

## 步骤 1：根元数据

`src/index.ts` 被所有三个消费者导入。保持它无依赖。

```ts
export const type = "my_agent";        // snake_case，全局唯一
export const label = "My Agent (local)";
export const models = [
  { id: "model-a", label: "Model A" },
];
export const agentConfigurationDoc = `# my_agent configuration
Use when: ...
Don't use when: ...
Core fields: ...
`;
```

## 步骤 2：服务端执行

`src/server/execute.ts` 是核心。它接收 `AdapterExecutionContext` 并返回 `AdapterExecutionResult`。

关键职责：

1. 使用安全辅助函数（`asString`、`asNumber` 等）读取配置
2. 用 `buildPaperclipEnv(agent)` 构建环境加上下文变量
3. 从 `runtime.sessionParams` 解析会话状态
4. 用 `renderTemplate(template, data)` 渲染提示词
5. 用 `runChildProcess()` 启动进程或通过 `fetch()` 调用
6. 解析输出中的用量、成本、会话状态、错误
7. 处理未知会话错误（用全新会话重试，设置 `clearSession: true`）

## 步骤 3：环境测试

`src/server/test.ts` 在运行前验证适配器配置。

返回结构化诊断：

- `error` 表示无效/不可用的设置
- `warn` 表示非阻塞问题
- `info` 表示检查成功

## 步骤 4：UI 模块

- `parse-stdout.ts` — 将 stdout 行转换为运行查看器的 `TranscriptEntry[]`
- `build-config.ts` — 将表单值转换为 `adapterConfig` JSON
- 配置字段 React 组件在 `ui/src/adapters/<name>/config-fields.tsx`

## 步骤 5：CLI 模块

`format-event.ts` — 使用 `picocolors` 为 `paperclipai run --watch` 美化打印 stdout。

## 步骤 6：注册

将适配器添加到所有三个注册表：

1. `server/src/adapters/registry.ts`
2. `ui/src/adapters/registry.ts`
3. `cli/src/adapters/registry.ts`

## 技能注入

让 Paperclip 技能对你的智能体运行时可发现，同时不写入智能体的工作目录：

1. **最佳：tmpdir + 标志** — 创建 tmpdir，符号链接技能，通过 CLI 标志传入，之后清理
2. **可接受：全局配置目录** — 符号链接到运行时的全局插件目录
3. **可接受：环境变量** — 将技能路径环境变量指向仓库的 `skills/` 目录
4. **最后手段：提示词注入** — 在提示词模板中包含技能内容

## 安全

- 将智能体输出视为不可信（防御性解析，永不执行）
- 通过环境变量注入密钥，而不是提示词
- 如果运行时支持，配置网络访问控制
- 始终强制执行超时和宽限期
