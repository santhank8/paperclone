---
title: 写技能
summary: SKILL.md 格式和最佳实践
---
技能是智能体可以在心跳期间调用的可重用指令。它们是教智能体如何执行特定任务的降价文件。

## 技能结构

技能是一个包含 `SKILL.md` 文件的目录，该文件带有 YAML frontmatter：

```
skills/
└── my-skill/
    ├── SKILL.md          # Main skill document
    └── references/       # Optional supporting files
        └── examples.md
```

## SKILL.md 格式

```markdown
---
name: my-skill
description: >
  Short description of what this skill does and when to use it.
  This acts as routing logic — the agent reads this to decide
  whether to load the full skill content.
---

# My Skill

Detailed instructions for the agent...
```

### Frontmatter 字段

- **名称** — 技能的唯一标识符（kebab-case）
- **描述** — 告诉智能体何时使用此技能的路由描述。将其写为决策逻辑，而不是营销文案。

## 技能在运行时如何发挥作用

1. 智能体在其上下文中查看技能元数据（名称+描述）
2. Agent决定该技能是否与其当前任务相关
3. 如果相关，智能体加载完整的 SKILL.md 内容
4. Agent按照技能中的说明进行操作

这使得基本提示很小——完整的技能内容仅按需加载。

## 最佳实践

- **将描述写入路由逻辑** — 包括“何时使用”和“何时不使用”指导
- **具体且可操作** - 座席应该能够毫不含糊地遵循技能
- **包含代码示例** — 具体的 API 调用和命令示例比散文更可靠
- **保持技能集中** — 每个问题一项技能；不要合并不相关的程序
- **谨慎参考文件** — 将支持细节放在 `references/` 中，而不是让主要的 SKILL.md 变得臃肿

## 技能注入

适配器负责使技能可供智能体运行时发现。 `claude_local` 适配器使用带有符号链接和 `--add-dir` 的临时目录。 `codex_local` 适配器使用全局技能目录。详情请参见【创建适配器】(/cn/adapters/creating-an-adapter)指南。