# ClipHub — 公司注册表

**下载一家公司。**

ClipHub 是一个公共注册表，人们在这里分享、发现和下载 Paperclip 公司配置。公司模板是一个可移植的制品，包含整个组织 — 智能体、汇报结构、适配器配置、角色定义、种子任务 — 一条命令即可启动。

---

## 它是什么

ClipHub 之于 Paperclip 就像包注册表之于编程语言。Paperclip 已经支持可导出的组织配置（见 [SPEC.md](./SPEC.md) 第2节）。ClipHub 是这些导出的公共目录。

用户在 Paperclip 中构建一个运转良好的公司 — 开发工作室、营销代理、研究实验室、内容工作室 — 导出模板，发布到 ClipHub。任何人都可以浏览、搜索、下载，并在自己的 Paperclip 实例上启动该公司。

标语：**你真的可以下载一家公司。**

---

## 发布内容

ClipHub 包是一个**公司模板导出** — Paperclip 规范中定义的可移植制品格式。它包含：

| 组件 | 描述 |
|---|---|
| **公司元数据** | 名称、描述、预期用途、类别 |
| **组织架构图** | 完整的汇报层级 — 谁向谁汇报 |
| **智能体定义** | 每个智能体：名称、角色、职称、能力描述 |
| **适配器配置** | 每个智能体的适配器类型和配置（SOUL.md、HEARTBEAT.md、CLAUDE.md、进程命令、webhook URL — 适配器需要的一切） |
| **种子任务** | 可选的启动任务和举措，用于引导公司的首次运行 |
| **预算默认值** | 建议的每个智能体和每个公司的 token/成本预算 |

模板是**结构，不是状态。**没有进行中的任务，没有历史成本数据，没有运行时制品。只有蓝图。

### 子包

不是每个用例都需要一整家公司。ClipHub 还支持发布单个组件：

- **智能体模板** — 单个智能体配置（例如"高级 TypeScript 工程师"、"SEO 内容写手"、"DevOps 智能体"）
- **团队模板** — 组织架构图的子树（例如"营销团队：CMO + 3 名下属"、"工程小组：技术负责人 + 4 名工程师"）
- **适配器配置** — 独立于任何特定智能体角色的可复用适配器配置

这些可以混入现有公司。下载一个智能体，插入你的组织，分配一个管理者，开始工作。

---

## 核心功能

### 浏览与发现

主页从多个维度展示公司：

- **精选** — 编辑精选的高质量模板
- **热门** — 按下载量、星标和 fork 排名
- **最新** — 最近发布或更新的
- **分类** — 按用途浏览（见下方分类）

每个列表显示：名称、简短描述、组织规模（智能体数量）、类别、使用的适配器类型、星标数、下载数和迷你组织架构图预览。

### 搜索

搜索是**语义化的，不仅仅是关键词。**由向量嵌入驱动，你可以按意图搜索：

- "marketing agency that runs facebook ads" → 即使这些确切词不在标题中也能找到相关的公司模板
- "small dev team for building APIs" → 找到精简的工程组织
- "content pipeline with writers and editors" → 找到内容工作室模板

还支持按以下条件过滤：类别、智能体数量范围、适配器类型、星标数、近期性。

### 公司详情页

点击进入公司模板后显示：

- **完整描述** — 这家公司做什么、如何运作、可以期待什么
- **交互式组织架构图** — 每个智能体的角色、职称和能力的可视化树
- **智能体列表** — 每个智能体的可展开详情（适配器类型、配置摘要、角色描述）
- **种子任务** — 包含的启动举措和任务
- **预算概览** — 建议的成本结构
- **安装命令** — 一行 CLI 命令即可下载和创建
- **版本历史** — 变更日志、语义化版本、可用的以前版本
- **社区** — 星标、评论、fork 数量

### 安装与 Fork

两种使用模板的方式：

**安装（全新开始）：**
```
paperclip install cliphub:<publisher>/<company-slug>
```
下载模板并在你的本地 Paperclip 实例中创建新公司。你添加自己的 API 密钥、设置预算、自定义智能体，然后开始。

**Fork：**
Fork 会在你自己的 ClipHub 账户下创建模板副本。你可以修改它、作为你自己的变体重新发布，fork 谱系会被追踪。这实现了进化式改进 — 有人发布一个营销代理公司，你 fork 它，添加社交媒体团队，重新发布。

### 星标与评论

- **星标** — 书签并表示质量。星标数是主要排名信号。
- **评论** — 每个列表上的线程讨论。提问、分享结果、建议改进。

### 下载数与信号

每次安装都会被计数。注册表追踪：

- 总下载量（所有时间）
- 每个版本的下载量
- Fork 数
- 星标数

这些信号反馈到搜索排名和发现中。

---

## 发布

### 谁可以发布

任何拥有 GitHub 账户的人都可以发布到 ClipHub。认证通过 GitHub OAuth。

### 如何发布

在 Paperclip 内，将你的公司导出为模板，然后发布：

```
paperclip export --template my-company
paperclip publish cliphub my-company
```

或使用 Web UI 直接上传模板导出。

### 你需要提供什么

发布时，你需要指定：

| 字段 | 必填 | 描述 |
|---|---|---|
| `slug` | 是 | URL 安全标识符（例如 `lean-dev-shop`） |
| `name` | 是 | 显示名称 |
| `description` | 是 | 这家公司做什么以及面向谁 |
| `category` | 是 | 主要类别（见下方） |
| `tags` | 否 | 用于发现的额外标签 |
| `version` | 是 | 语义化版本（例如 `1.0.0`） |
| `changelog` | 否 | 此版本的变更内容 |
| `readme` | 否 | 扩展文档（markdown） |
| `license` | 否 | 使用条款 |

### 版本控制

模板使用语义化版本控制。每次发布创建一个不可变版本。用户可以安装任何版本或默认使用 `latest`。版本历史和变更日志在详情页可见。

### `sync` 命令

对于维护多个模板的高级用户：

```
paperclip cliphub sync
```

扫描你本地导出的模板，发布任何新的或更新的。适用于从单个仓库维护一组公司模板。

---

## 分类

公司模板按用途组织：

| 类别 | 示例 |
|---|---|
| **软件开发** | 全栈开发工作室、API 开发团队、移动应用工作室 |
| **营销与增长** | 效果营销代理、内容营销团队、SEO 工作室 |
| **内容与媒体** | 内容工作室、播客制作、新闻通讯运营 |
| **研究与分析** | 市场研究公司、竞争情报、数据分析团队 |
| **运营** | 客户支持组织、内部运营团队、QA/测试工作室 |
| **销售** | 外呼销售团队、潜在客户生成、客户管理 |
| **财务与法务** | 簿记服务、合规监控、财务分析 |
| **创意** | 设计代理、文案写作工作室、品牌开发 |
| **通用** | 入门模板、最小化组织、单智能体设置 |

类别不是排他的 — 一个模板可以有一个主要类别加上用于交叉关注的标签。

---

## 审核与信任

### 已验证发布者

达到特定阈值（账户年龄、已发布的模板有良好信号）的发布者获得已验证徽章。已验证的模板在搜索中排名更高。

### 安全审查

公司模板包含适配器配置，可能包括可执行命令（进程适配器）或 webhook URL（HTTP 适配器）。审核系统：

1. **自动扫描** — 检查适配器配置中的可疑模式（任意代码执行、数据外泄 URL、凭据收集）
2. **社区举报** — 任何已登录用户都可以标记模板。多次举报后自动隐藏等待审查。
3. **人工审核** — 审核员可以批准、拒绝或要求修改

### 账户门控

新账户在可以发布前有等待期。这防止了匆忙的垃圾信息。

---

## 架构

ClipHub 是一个**独立服务**，与 Paperclip 本身分开。Paperclip 是自托管的；ClipHub 是 Paperclip 实例与之通信的托管注册表。

### 集成点

| 层 | 角色 |
|---|---|
| **ClipHub 网站** | 浏览、搜索、发现、评论、星标 — 网站 |
| **ClipHub API** | 用于编程方式发布、下载、搜索的注册表 API |
| **Paperclip CLI** | `paperclipai install`、`paperclipai publish`、`paperclipai cliphub sync` — 内置于 Paperclip 中 |
| **Paperclip UI** | Paperclip Web UI 中的"浏览 ClipHub"面板，无需离开应用即可发现模板 |

### 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React + Vite（与 Paperclip 一致） |
| 后端 | TypeScript + Hono（与 Paperclip 一致） |
| 数据库 | PostgreSQL |
| 搜索 | 向量嵌入用于语义搜索 |
| 认证 | GitHub OAuth |
| 存储 | 模板 zip 存储在对象存储中（S3 或同等） |

### 数据模型（草案）

```
Publisher
  id, github_id, username, display_name, verified, created_at

Template
  id, publisher_id, slug, name, description, category,
  tags[], readme, license, created_at, updated_at,
  star_count, download_count, fork_count,
  forked_from_id (nullable)

Version
  id, template_id, version (semver), changelog,
  artifact_url (zip), agent_count, adapter_types[],
  created_at

Star
  id, publisher_id, template_id, created_at

Comment
  id, publisher_id, template_id, body, parent_id (nullable),
  created_at, updated_at

Report
  id, reporter_id, template_id, reason, created_at
```

---

## 用户流程

### "我想创建一家公司"

1. 打开 ClipHub，按类别浏览或搜索 "dev shop for building SaaS"
2. 找到一个合适的模板 — "Lean SaaS Dev Shop (CEO + CTO + 3 Engineers)"
3. 阅读描述，检查组织架构图，查看评论
4. 运行 `paperclipai install cliphub:acme/lean-saas-shop`
5. Paperclip 在本地创建公司，所有智能体已预配置
6. 设置你的 API 密钥、调整预算、添加初始任务
7. 开始运行

### "我做了很棒的东西想分享"

1. 在 Paperclip 中构建并迭代一家公司直到运转良好
2. 导出：`paperclipai export --template my-agency`
3. 发布：`paperclipai publish cliphub my-agency`
4. 在 Web UI 上填写描述、类别、标签
5. 模板上线 — 其他人可以找到并安装它

### "我想改进别人的公司"

1. 在 ClipHub 上找到一个接近你需求的模板
2. Fork 到你的账户
3. 在本地安装你的 fork，修改组织（添加智能体、更改配置、重组团队）
4. 导出并作为你自己的变体重新发布
5. Fork 谱系在原版和你的版本上都可见

### "我只需要一个优秀的智能体，不需要整家公司"

1. 在 ClipHub 搜索智能体模板："senior python engineer"
2. 找到一个高星标的智能体配置
3. 只安装那个智能体：`paperclipai install cliphub:acme/senior-python-eng --agent`
4. 将它分配给你现有公司中的一个管理者
5. 完成

---

## 与 Paperclip 的关系

使用 Paperclip **不需要** ClipHub。你可以完全从零构建公司而不触碰 ClipHub。但 ClipHub 大幅降低了入门门槛：

- **新用户** 几分钟而非几小时就能获得一家运转的公司
- **有经验的用户** 与社区分享经过验证的配置
- **生态系统** 复利增长 — 每个好的模板都让下一家公司更容易构建

ClipHub 之于 Paperclip 就像包注册表之于语言运行时：可选，但变革性的。

---

## V1 范围

### 必须有

- [ ] 模板发布（通过 CLI 或 Web 上传）
- [ ] 模板浏览（列表、按类别过滤）
- [ ] 模板详情页（描述、组织架构图、智能体列表、安装命令）
- [ ] 语义搜索（向量嵌入）
- [ ] `paperclipai install cliphub:<publisher>/<slug>` CLI 命令
- [ ] GitHub OAuth 认证
- [ ] 星标
- [ ] 下载计数
- [ ] 版本控制（语义化版本、版本历史）
- [ ] 基本审核（社区举报、自动隐藏）

### V2

- [ ] 评论/线程讨论
- [ ] Fork 及谱系追踪
- [ ] 智能体和团队子包
- [ ] 已验证发布者徽章
- [ ] 适配器配置的自动安全扫描
- [ ] Paperclip Web UI 中的"浏览 ClipHub"面板
- [ ] `paperclipai cliphub sync` 用于批量发布
- [ ] 发布者个人资料和作品集

### 不在范围内

- 付费/高级模板（至少初期一切免费公开）
- 私有注册表（可能是未来的企业功能）
- 在 ClipHub 上运行公司（它是注册表，不是运行时 — 与 Paperclip 自身的理念一致）
