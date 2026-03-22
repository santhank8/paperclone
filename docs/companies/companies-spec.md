# 智能体公司规范

智能体技能规范的扩展

版本：`agentcompanies/v1-draft`

## 1. 目的

智能体公司包是一种文件系统和 GitHub 原生格式，用于使用带有 YAML 前置元数据的 markdown 文件来描述公司、团队、智能体、项目、任务及其关联技能。

本规范是智能体技能规范的扩展，而非替代。

它定义了公司级、团队级和智能体级包结构如何围绕现有 `SKILL.md` 模型进行组合。

本规范是供应商中立的。它旨在可被任何智能体公司运行时使用，而不仅限于 Paperclip。

该格式设计为：

- 人类可读可写
- 可直接从本地文件夹或 GitHub 仓库使用
- 不需要中央注册表
- 支持归属和对上游文件的固定引用
- 扩展现有智能体技能生态系统而不重新定义它
- 在 Paperclip 之外也有用

## 2. 核心原则

1. Markdown 是权威格式。
2. Git 仓库是有效的包容器。
3. 注册表是可选的发现层，而非权威机构。
4. `SKILL.md` 仍由智能体技能规范所有。
5. 外部引用必须可固定到不可变的 Git 提交。
6. 归属和许可元数据必须在导入/导出中保留。
7. Slug 和相对路径是可移植的身份层，而非数据库 ID。
8. 约定的文件夹结构无需冗长配置即可工作。
9. 供应商特定的保真度属于可选扩展，而非基础包。

## 3. 包类型

包根目录由一个主 markdown 文件标识：

- `COMPANY.md` 用于公司包
- `TEAM.md` 用于团队包
- `AGENTS.md` 用于智能体包
- `PROJECT.md` 用于项目包
- `TASK.md` 用于任务包
- `SKILL.md` 用于智能体技能规范定义的技能包

一个 GitHub 仓库可以在根目录包含一个包或在子目录中包含多个包。

## 4. 保留的文件和目录

通用约定：

```text
COMPANY.md
TEAM.md
AGENTS.md
PROJECT.md
TASK.md
SKILL.md

agents/<slug>/AGENTS.md
teams/<slug>/TEAM.md
projects/<slug>/PROJECT.md
projects/<slug>/tasks/<slug>/TASK.md
tasks/<slug>/TASK.md
skills/<slug>/SKILL.md
.paperclip.yaml

HEARTBEAT.md
SOUL.md
TOOLS.md
README.md
assets/
scripts/
references/
```

规则：

- 只有 markdown 文件是权威内容文档
- 允许非 markdown 目录如 `assets/`、`scripts/` 和 `references/`
- 包工具可以生成可选的锁文件，但锁文件不是编写所必需的

## 5. 通用前置元数据

包文档可以支持这些字段：

```yaml
schema: agentcompanies/v1
kind: company | team | agent | project | task
slug: my-slug
name: Human Readable Name
description: Short description
version: 0.1.0
license: MIT
authors:
  - name: Jane Doe
homepage: https://example.com
tags:
  - startup
  - engineering
metadata: {}
sources: []
```

说明：

- `schema` 是可选的，通常只应出现在包根目录
- `kind` 在文件路径和文件名已明确类型时是可选的
- `slug` 应为 URL 安全且稳定的
- `sources` 用于来源和外部引用
- `metadata` 用于工具特定的扩展
- 导出器应省略空或默认值字段

## 6. COMPANY.md

`COMPANY.md` 是整个公司包的根入口点。

### 必需字段

```yaml
name: Lean Dev Shop
description: Small engineering-focused AI company
slug: lean-dev-shop
schema: agentcompanies/v1
```

### 推荐字段

```yaml
version: 1.0.0
license: MIT
authors:
  - name: Example Org
goals:
  - Build and ship software products
includes:
  - https://github.com/example/shared-company-parts/blob/0123456789abcdef0123456789abcdef01234567/teams/engineering/TEAM.md
requirements:
  secrets:
    - OPENAI_API_KEY
```

### 语义

- `includes` 定义包图
- 本地包内容应通过文件夹约定隐式发现
- `includes` 是可选的，主要用于外部引用或非标准位置
- 被包含的项可以是本地或外部引用
- `COMPANY.md` 可以直接包含智能体、团队、项目、任务或技能
- 公司导入器可以将 `includes` 渲染为树形/复选框导入 UI

## 7. TEAM.md

`TEAM.md` 定义一个组织子树。

### 示例

```yaml
name: Engineering
description: Product and platform engineering team
schema: agentcompanies/v1
slug: engineering
manager: ../cto/AGENTS.md
includes:
  - ../platform-lead/AGENTS.md
  - ../frontend-lead/AGENTS.md
  - ../../skills/review/SKILL.md
tags:
  - team
  - engineering
```

### 语义

- 团队包是一个可复用的子树，不一定是运行时数据库表
- `manager` 标识子树的根智能体
- `includes` 可以包含子智能体、子团队或共享技能
- 团队包可以被导入到现有公司中，附加到目标管理者下

## 8. AGENTS.md

`AGENTS.md` 定义一个智能体。

### 示例

```yaml
name: CEO
title: Chief Executive Officer
reportsTo: null
skills:
  - plan-ceo-review
  - review
```

### 语义

- 正文内容是智能体的权威默认指令内容
- `docs` 在存在时指向同级 markdown 文档
- `skills` 通过技能简称或 slug 引用可复用的 `SKILL.md` 包
- 像 `review` 这样的简单技能条目应按约定解析为 `skills/review/SKILL.md`
- 如果包引用外部技能，智能体仍应通过简称引用技能；技能包本身拥有任何来源引用、固定或归属详情
- 工具可以允许路径或 URL 条目作为应急方案，但导出器应在 `AGENTS.md` 中优先使用基于简称的技能引用
- 供应商特定的适配器/运行时配置不应存在于基础包中
- 本地绝对路径、机器特定的 cwd 值和密钥值不得作为权威包数据导出

### 技能解析

智能体和技能之间的首选关联标准是技能简称。

建议的智能体技能条目解析顺序：

1. `skills/<shortname>/SKILL.md` 的本地包技能
2. 声明的 slug 或简称匹配的引用或包含的技能包
3. 同名简称的工具管理的公司技能库条目

规则：

- 导出器应尽可能在 `AGENTS.md` 中输出简称
- 导入器不应要求普通技能引用的完整文件路径
- 技能包本身应承载有关外部引用、vendoring、镜像或固定上游内容的任何复杂性
- 这使 `AGENTS.md` 保持可读性，并与 `skills.sh` 风格的共享一致

## 9. PROJECT.md

`PROJECT.md` 定义一个轻量级项目包。

### 示例

```yaml
name: Q2 Launch
description: Ship the Q2 launch plan and supporting assets
owner: cto
```

### 语义

- 项目包将相关的初始任务和支持 markdown 分组
- 当有明确的项目负责人时，`owner` 应引用智能体 slug
- 约定的 `tasks/` 子文件夹应被隐式发现
- 当需要显式关联时，`includes` 可以包含 `TASK.md`、`SKILL.md` 或支持文档
- 项目包旨在播种计划工作，而非表示运行时任务状态

## 10. TASK.md

`TASK.md` 定义一个轻量级初始任务。

### 示例

```yaml
name: Monday Review
assignee: ceo
project: q2-launch
schedule:
  timezone: America/Chicago
  startsAt: 2026-03-16T09:00:00-05:00
  recurrence:
    frequency: weekly
    interval: 1
    weekdays:
      - monday
    time:
      hour: 9
      minute: 0
```

### 语义

- 正文内容是权威的 markdown 任务描述
- `assignee` 应引用包内的智能体 slug
- 当任务属于 `PROJECT.md` 时，`project` 应引用项目 slug
- 任务是有意的基础种子工作：标题、markdown 正文、指派人和可选的循环
- 工具也可以支持如 `priority`、`labels` 或 `metadata` 等可选字段，但不应在基础包中要求它们

### 调度

调度模型有意保持轻量级。它应该覆盖常见的循环模式，例如：

- 每 6 小时
- 每个工作日上午 9:00
- 每周一上午
- 每月 1 日
- 每月第一个周一
- 每年 1 月 1 日

建议的格式：

```yaml
schedule:
  timezone: America/Chicago
  startsAt: 2026-03-14T09:00:00-05:00
  recurrence:
    frequency: hourly | daily | weekly | monthly | yearly
    interval: 1
    weekdays:
      - monday
      - wednesday
    monthDays:
      - 1
      - 15
    ordinalWeekdays:
      - weekday: monday
        ordinal: 1
    months:
      - 1
      - 6
    time:
      hour: 9
      minute: 0
    until: 2026-12-31T23:59:59-06:00
    count: 10
```

规则：

- `timezone` 应使用 IANA 时区如 `America/Chicago`
- `startsAt` 锚定第一次出现
- `frequency` 和 `interval` 是唯一必需的循环字段
- `weekdays`、`monthDays`、`ordinalWeekdays` 和 `months` 是可选的缩窄规则
- `ordinalWeekdays` 使用 `ordinal` 值如 `1`、`2`、`3`、`4` 或 `-1` 表示"最后"
- `time.hour` 和 `time.minute` 使常见的"上午 / 9:00 / 当天结束"调度保持人类可读
- `until` 和 `count` 是可选的循环结束边界
- 工具可以接受更丰富的日历语法如 RFC5545 `RRULE`，但导出器应优先使用上述结构化形式

## 11. SKILL.md 兼容性

技能包必须保持为有效的智能体技能包。

规则：

- `SKILL.md` 应遵循智能体技能规范
- Paperclip 不得要求额外的顶级字段来验证技能有效性
- Paperclip 特定的扩展必须位于 `metadata.paperclip` 或 `metadata.sources` 下
- 技能目录可以包含 `scripts/`、`references/` 和 `assets/`，与智能体技能生态系统的预期完全一致
- 实现此规范的工具应将 `skills.sh` 兼容性视为首要目标，而非发明并行的技能格式

换句话说，本规范将智能体技能向上扩展到公司/团队/智能体组合。它不重新定义技能包语义。

### 兼容扩展示例

```yaml
---
name: review
description: Paranoid code review skill
allowed-tools:
  - Read
  - Grep
metadata:
  paperclip:
    tags:
      - engineering
      - review
  sources:
    - kind: github-file
      repo: vercel-labs/skills
      path: review/SKILL.md
      commit: 0123456789abcdef0123456789abcdef01234567
      sha256: 3b7e...9a
      attribution: Vercel Labs
      usage: referenced
---
```

## 12. 来源引用

包可以指向上游内容而不是将其打包进来。

### 来源对象

```yaml
sources:
  - kind: github-file
    repo: owner/repo
    path: path/to/file.md
    commit: 0123456789abcdef0123456789abcdef01234567
    blob: abcdef0123456789abcdef0123456789abcdef01
    sha256: 3b7e...9a
    url: https://github.com/owner/repo/blob/0123456789abcdef0123456789abcdef01234567/path/to/file.md
    rawUrl: https://raw.githubusercontent.com/owner/repo/0123456789abcdef0123456789abcdef01234567/path/to/file.md
    attribution: Owner Name
    license: MIT
    usage: referenced
```

### 支持的类型

- `local-file`
- `local-dir`
- `github-file`
- `github-dir`
- `url`

### 使用模式

- `vendored`：字节包含在包中
- `referenced`：包指向上游不可变内容
- `mirrored`：字节在本地缓存，但上游归属仍为权威

### 规则

- 严格模式下 `github-file` 和 `github-dir` 需要 `commit`
- 强烈推荐 `sha256` 并应在获取时验证
- 开发模式下可以允许仅分支引用但必须发出警告
- 导出器对于第三方内容应默认使用 `referenced`，除非重新分发被明确允许

## 13. 解析规则

给定一个包根目录，导入器按此顺序解析：

1. 本地相对路径
2. 如果导入工具明确允许，本地绝对路径
3. 固定的 GitHub 引用
4. 通用 URL

对于固定的 GitHub 引用：

1. 解析 `repo + commit + path`
2. 获取内容
3. 如果存在则验证 `sha256`
4. 如果存在则验证 `blob`
5. 不匹配时严格失败

导入器必须提示：

- 缺失文件
- 哈希不匹配
- 缺失许可
- 需要网络获取的引用上游内容
- 技能或脚本中的可执行内容

## 14. 导入图

包导入器应从以下构建图：

- `COMPANY.md`
- `TEAM.md`
- `AGENTS.md`
- `PROJECT.md`
- `TASK.md`
- `SKILL.md`
- 本地和外部引用

建议的导入 UI 行为：

- 将图渲染为树
- 在实体级别使用复选框，而非原始文件级别
- 选择智能体自动选择所需文档和引用的技能
- 选择团队自动选择其子树
- 选择项目自动选择其包含的任务
- 选择循环任务应在导入前显示其调度
- 选择引用的第三方内容显示归属、许可和获取策略

## 15. 供应商扩展

供应商特定数据应存在于基础包形状之外。

对于 Paperclip，首选的保真度扩展是：

```text
.paperclip.yaml
```

示例用途：

- 适配器类型和适配器配置
- 适配器环境输入和默认值
- 运行时设置
- 权限
- 预算
- 审批策略
- 项目执行工作区策略
- 任务的 Paperclip 专有元数据

规则：

- 基础包必须在没有扩展的情况下仍可读
- 不理解供应商扩展的工具应忽略它
- Paperclip 工具可以默认将供应商扩展作为附属文件输出，同时保持基础 markdown 整洁

建议的 Paperclip 格式：

```yaml
schema: paperclip/v1
agents:
  claudecoder:
    adapter:
      type: claude_local
      config:
        model: claude-opus-4-6
    inputs:
      env:
        ANTHROPIC_API_KEY:
          kind: secret
          requirement: optional
          default: ""
        GH_TOKEN:
          kind: secret
          requirement: optional
        CLAUDE_BIN:
          kind: plain
          requirement: optional
          default: claude
```

Paperclip 导出器的额外规则：

- 当 `AGENTS.md` 已包含智能体指令时，不要重复 `promptTemplate`
- 不要导出提供商特定的密钥绑定，如 `secretId`、`version` 或 `type: secret_ref`
- 将环境输入导出为带有 `required` 或 `optional` 语义和可选默认值的可移植声明
- 对系统依赖的值（如绝对命令和绝对 `PATH` 覆盖）发出警告
- 尽可能省略空和默认值的 Paperclip 字段

## 16. 导出规则

合规的导出器应：

- 输出 markdown 根文件和相对文件夹布局
- 省略机器本地 ID 和时间戳
- 省略密钥值
- 省略机器特定路径
- 导出任务时保留任务描述和循环定义
- 省略空/默认字段
- 默认使用供应商中立的基础包
- Paperclip 导出器应默认将 `.paperclip.yaml` 作为附属文件输出
- 保留归属和来源引用
- 对于第三方内容优先使用 `referenced` 而非静默打包
- 导出兼容技能时保持 `SKILL.md` 原样

## 17. 许可和归属

合规工具必须：

- 在导入和导出时保留 `license` 和 `attribution` 元数据
- 区分打包和引用的内容
- 导出时不静默内联引用的第三方内容
- 将缺失的许可元数据作为警告提示
- 在内容被打包或镜像时，安装/导入前提示限制性或未知许可

## 18. 可选锁文件

编写不需要锁文件。

工具可以生成可选的锁文件，例如：

```text
company-package.lock.json
```

用途：

- 缓存已解析的引用
- 记录最终哈希
- 支持可复现安装

规则：

- 锁文件是可选的
- 锁文件是生成的产物，不是权威的编写输入
- markdown 包仍是真实来源

## 19. Paperclip 映射

Paperclip 可以这样将本规范映射到其运行时模型：

- 基础包：
  - `COMPANY.md` -> 公司元数据
  - `TEAM.md` -> 可导入的组织子树
  - `AGENTS.md` -> 智能体身份和指令
  - `PROJECT.md` -> 初始项目定义
  - `TASK.md` -> 初始任务定义，或当存在循环时的自动化模板
  - `SKILL.md` -> 导入的技能包
  - `sources[]` -> 来源和固定的上游引用
- Paperclip 扩展：
  - `.paperclip.yaml` -> 适配器配置、运行时配置、环境输入声明、权限、预算和其他 Paperclip 特定保真度

必须存在于共享 markdown 文件中的内联 Paperclip 专有元数据应使用：

- `metadata.paperclip`

这使基础格式比 Paperclip 更广泛。

本规范本身保持供应商中立，旨在适用于任何智能体公司运行时，而不仅限于 Paperclip。

## 20. 切换

Paperclip 应切换到此 markdown 优先的包模型作为主要的可移植性格式。

`paperclip.manifest.json` 不需要作为未来包系统的兼容性要求保留。

对于 Paperclip，这应被视为产品方向的硬切换，而非长期的双格式策略。

## 21. 最小示例

```text
lean-dev-shop/
├── COMPANY.md
├── agents/
│   ├── ceo/AGENTS.md
│   └── cto/AGENTS.md
├── projects/
│   └── q2-launch/
│       ├── PROJECT.md
│       └── tasks/
│           └── monday-review/
│               └── TASK.md
├── teams/
│   └── engineering/TEAM.md
├── tasks/
│   └── weekly-review/TASK.md
└── skills/
    └── review/SKILL.md

可选：

```text
.paperclip.yaml
```
```

**建议**
这是我将采取的方向：

- 将其作为面向用户的规范
- 将 `SKILL.md` 兼容性定义为不可妥协的
- 将本规范视为智能体技能的扩展，而非并行格式
- 使 `companies.sh` 成为实现本规范的仓库的发现层，而非发布权威
