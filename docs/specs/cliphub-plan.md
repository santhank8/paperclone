# ClipHub：Paperclip 团队配置市场

> 替代说明：此市场计划早于 markdown 优先的公司包方向。有关当前包格式和导入/导出推出计划，请参见 `doc/plans/2026-03-13-company-import-export-v2.md` 和 `docs/companies/companies-spec.md`。

> AI 团队的"应用商店" — 预构建的 Paperclip 配置、智能体蓝图、技能和治理模板，从第一天就能交付实际工作。

## 1. 愿景与定位

**ClipHub** 销售**完整的团队配置** — 组织架构图、智能体角色、智能体间工作流、治理规则和项目模板 — 用于 Paperclip 管理的公司。

| 维度 | ClipHub |
|---|---|
| 销售单元 | 团队蓝图（多智能体组织） |
| 买家 | 创始人/团队负责人，正在启动 AI 公司 |
| 安装目标 | Paperclip 公司（智能体、项目、治理） |
| 价值主张 | "跳过组织设计 — 几分钟内获得一个能交付的团队" |
| 价格范围 | 每个蓝图 $0-$499（+ 单独附加） |

---

## 2. 产品分类

### 2.1 团队蓝图（主要产品）

完整的 Paperclip 公司配置：

- **组织架构图**：带角色、职称、汇报链、能力的智能体
- **智能体配置**：适配器类型、模型、提示词模板、指令路径
- **治理规则**：审批流程、预算限额、升级链
- **项目模板**：带工作区设置的预配置项目
- **技能和指令**：每个智能体捆绑的 AGENTS.md / 技能文件

**示例：**
- "SaaS 创业团队" — CEO、CTO、工程师、CMO、设计师（$199）
- "内容代理机构" — 主编、3 名作者、SEO 分析师、社交媒体经理（$149）
- "开发工作室" — CTO、2 名工程师、QA、DevOps（$99）
- "独立创始人 + 团队" — CEO 智能体 + 跨工程/营销/运营的 3 个 IC（$79）

### 2.2 智能体蓝图（团队上下文中的单个智能体）

设计为可插入 Paperclip 组织的单智能体配置：

- 角色定义、提示词模板、适配器配置
- 汇报链预期（向谁汇报）
- 包含的技能捆绑
- 治理默认值（预算、权限）

**示例：**
- "高级工程师" — 交付生产代码、管理 PR（$29）
- "增长营销" — 内容管线、SEO、社交（$39）
- "DevOps 智能体" — CI/CD、部署、监控（$29）

### 2.3 技能（模块化能力）

任何 Paperclip 智能体都可以使用的可移植技能文件：

- 带指令的 Markdown 技能文件
- 工具配置和 shell 脚本
- 兼容 Paperclip 的技能加载系统

**示例：**
- "Git PR 工作流" — 标准化的 PR 创建和审查（免费）
- "部署管线" — Cloudflare/Vercel 部署技能（$9）
- "客户支持分流" — 工单分类和路由（$19）

### 2.4 治理模板

预构建的审批流程和策略：

- 预算阈值和审批链
- 跨团队委派规则
- 升级流程
- 计费代码结构

**示例：**
- "创业治理" — 轻量级，CEO 审批 > $50（免费）
- "企业治理" — 多层审批，审计追踪（$49）

---

## 3. 数据模式

### 3.1 列表

```typescript
interface Listing {
  id: string;
  slug: string;                    // URL 友好标识符
  type: 'team_blueprint' | 'agent_blueprint' | 'skill' | 'governance_template';
  title: string;
  tagline: string;                 // 简短卖点（<=120 字符）
  description: string;             // Markdown，完整详情

  // 定价
  price: number;                   // 分（0 = 免费）
  currency: 'usd';

  // 创作者
  creatorId: string;
  creatorName: string;
  creatorAvatar: string | null;

  // 分类
  categories: string[];            // 例如 ['saas', 'engineering', 'marketing']
  tags: string[];                  // 例如 ['claude', 'startup', '5-agent']
  agentCount: number | null;       // 用于团队蓝图

  // 内容
  previewImages: string[];         // 截图/组织架构图视觉
  readmeMarkdown: string;          // 详情页显示的完整 README
  includedFiles: string[];         // 捆绑中的文件列表

  // 兼容性
  compatibleAdapters: string[];    // ['claude_local', 'codex_local', ...]
  requiredModels: string[];        // ['claude-opus-4-6', 'claude-sonnet-4-6']
  paperclipVersionMin: string;     // 最低 Paperclip 版本

  // 社会证明
  installCount: number;
  rating: number | null;           // 1.0-5.0
  reviewCount: number;

  // 元数据
  version: string;                 // 语义化版本
  publishedAt: string;
  updatedAt: string;
  status: 'draft' | 'published' | 'archived';
}
```

### 3.2 团队蓝图捆绑

```typescript
interface TeamBlueprint {
  listingId: string;

  // 组织架构
  agents: AgentBlueprint[];
  reportingChain: { agentSlug: string; reportsTo: string | null }[];

  // 治理
  governance: {
    approvalRules: ApprovalRule[];
    budgetDefaults: { role: string; monthlyCents: number }[];
    escalationChain: string[];     // 升级顺序中的智能体 slug
  };

  // 项目
  projects: ProjectTemplate[];

  // 公司级配置
  companyDefaults: {
    name: string;
    defaultModel: string;
    defaultAdapter: string;
  };
}

interface AgentBlueprint {
  slug: string;                     // 例如 'cto', 'engineer-1'
  name: string;
  role: string;
  title: string;
  icon: string;
  capabilities: string;
  promptTemplate: string;
  adapterType: string;
  adapterConfig: Record<string, any>;
  instructionsPath: string | null;  // AGENTS.md 或类似文件的路径
  skills: SkillBundle[];
  budgetMonthlyCents: number;
  permissions: {
    canCreateAgents: boolean;
    canApproveHires: boolean;
  };
}

interface ProjectTemplate {
  name: string;
  description: string;
  workspace: {
    cwd: string | null;
    repoUrl: string | null;
  } | null;
}

interface ApprovalRule {
  trigger: string;                  // 例如 'hire_agent', 'budget_exceed'
  threshold: number | null;
  approverRole: string;
}
```

### 3.3 创作者/卖家

```typescript
interface Creator {
  id: string;
  userId: string;                   // 认证提供者 ID
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  website: string | null;
  listings: string[];               // 列表 ID
  totalInstalls: number;
  totalRevenue: number;             // 赚取的分
  joinedAt: string;
  verified: boolean;
  payoutMethod: 'stripe_connect';
  stripeAccountId: string | null;
}
```

### 3.4 购买/安装

```typescript
interface Purchase {
  id: string;
  listingId: string;
  buyerUserId: string;
  buyerCompanyId: string | null;    // 目标 Paperclip 公司
  pricePaidCents: number;
  paymentIntentId: string | null;   // Stripe
  installedAt: string | null;       // 部署到公司的时间
  status: 'pending' | 'completed' | 'refunded';
  createdAt: string;
}
```

### 3.5 评价

```typescript
interface Review {
  id: string;
  listingId: string;
  authorUserId: string;
  authorDisplayName: string;
  rating: number;                   // 1-5
  title: string;
  body: string;                     // Markdown
  verifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## 4. 页面与路由

### 4.1 公开页面

| 路由 | 页面 | 描述 |
|---|---|---|
| `/` | 首页 | 主视觉、精选蓝图、热门技能、使用说明 |
| `/browse` | 市场浏览 | 可筛选的所有列表网格 |
| `/browse?type=team_blueprint` | 团队蓝图 | 筛选为团队配置 |
| `/browse?type=agent_blueprint` | 智能体蓝图 | 单智能体配置 |
| `/browse?type=skill` | 技能 | 技能列表 |
| `/browse?type=governance_template` | 治理 | 策略模板 |
| `/listings/:slug` | 列表详情 | 完整产品页 |
| `/creators/:slug` | 创作者主页 | 简介、所有列表、统计 |
| `/about` | 关于 ClipHub | 使命、使用说明 |
| `/pricing` | 定价与费用 | 创作者收入分成、买家信息 |

### 4.2 需认证页面

| 路由 | 页面 | 描述 |
|---|---|---|
| `/dashboard` | 买家仪表盘 | 已购项目、已安装蓝图 |
| `/dashboard/purchases` | 购买历史 | 所有交易 |
| `/dashboard/installs` | 安装记录 | 已部署的蓝图及状态 |
| `/creator` | 创作者仪表盘 | 列表管理、分析 |
| `/creator/listings/new` | 创建列表 | 多步列表向导 |
| `/creator/listings/:id/edit` | 编辑列表 | 修改现有列表 |
| `/creator/analytics` | 分析 | 收入、安装量、浏览量 |
| `/creator/payouts` | 提现 | Stripe Connect 提现历史 |

### 4.3 API 路由

| 方法 | 端点 | 描述 |
|---|---|---|
| `GET` | `/api/listings` | 浏览列表（筛选：类型、分类、价格范围、排序） |
| `GET` | `/api/listings/:slug` | 获取列表详情 |
| `POST` | `/api/listings` | 创建列表（创作者认证） |
| `PATCH` | `/api/listings/:id` | 更新列表 |
| `DELETE` | `/api/listings/:id` | 归档列表 |
| `POST` | `/api/listings/:id/purchase` | 购买列表（Stripe 结算） |
| `POST` | `/api/listings/:id/install` | 安装到 Paperclip 公司 |
| `GET` | `/api/listings/:id/reviews` | 获取评价 |
| `POST` | `/api/listings/:id/reviews` | 提交评价 |
| `GET` | `/api/creators/:slug` | 创作者主页 |
| `GET` | `/api/creators/me` | 当前创作者主页 |
| `POST` | `/api/creators` | 注册为创作者 |
| `GET` | `/api/purchases` | 买家购买历史 |
| `GET` | `/api/analytics` | 创作者分析 |

---

## 5. 用户流程

### 5.1 买家：浏览 -> 购买 -> 安装

```
首页 -> 浏览市场 -> 按类型/分类筛选
  -> 点击列表 -> 查看详情、评价、预览组织架构图
  -> 点击"购买" -> Stripe 结算（或免费安装）
  -> 购买后："安装到公司"按钮
  -> 选择目标 Paperclip 公司（或新建）
  -> ClipHub API 调用 Paperclip API：
      1. 从蓝图配置创建智能体
      2. 建立汇报链
      3. 创建带工作区配置的项目
      4. 应用治理规则
      5. 将技能文件部署到智能体指令路径
  -> 重定向到 Paperclip 仪表盘，新团队已运行
```

### 5.2 创作者：构建 -> 发布 -> 赚取

```
注册为创作者 -> 连接 Stripe
  -> "新建列表"向导：
      步骤 1：类型（团队/智能体/技能/治理）
      步骤 2：基本信息（标题、标语、描述、分类）
      步骤 3：上传捆绑包（JSON 配置 + 技能文件 + README）
      步骤 4：预览和组织架构图可视化
      步骤 5：定价（$0-$499）
      步骤 6：发布
  -> 立即在市场上线
  -> 在创作者仪表盘追踪安装量、收入、评价
```

### 5.3 创作者：从 Paperclip 导出 -> 发布

```
运行中的 Paperclip 公司 -> "导出为蓝图"（CLI 或 UI）
  -> Paperclip 导出：
      - 智能体配置（已脱敏 — 无密钥）
      - 组织架构图/汇报链
      - 治理规则
      - 项目模板
      - 技能文件
  -> 作为新列表上传到 ClipHub
  -> 编辑详情、设置价格、发布
```

---

## 6. UI 设计方向

### 6.1 视觉语言

- **色彩**：深墨色主色、暖沙色背景、CTA 强调色（Paperclip 品牌蓝/紫）
- **排版**：干净的无衬线体、强层级、技术细节用等宽字体
- **卡片**：圆角、微妙阴影、清晰的价格徽章
- **组织架构图视觉**：交互式树/图显示团队蓝图中的智能体关系

### 6.2 关键设计元素

| 元素 | ClipHub |
|---|---|
| 产品卡片 | 组织架构图迷你预览 + 智能体数量徽章 |
| 详情页 | 交互式组织架构图 + 逐智能体分解 |
| 安装流程 | 一键部署到 Paperclip 公司 |
| 社会证明 | "X 家公司正在运行此蓝图" |
| 预览 | 实时演示沙箱（扩展目标） |

### 6.3 列表卡片设计

```
┌─────────────────────────────────────┐
│  [组织架构图迷你预览]                │
│  ┌─CEO─┐                            │
│  ├─CTO─┤                            │
│  └─ENG──┘                           │
│                                     │
│  SaaS 创业团队                      │
│  "用 5 个智能体的工程 + 营销        │
│   团队交付你的 MVP"                 │
│                                     │
│  5 个智能体  234 次安装              │
│  4.7 分（12 条评价）                │
│                                     │
│  By @masinov          $199  [购买]  │
└─────────────────────────────────────┘
```

### 6.4 详情页区域

1. **主视觉**：标题、标语、价格、安装按钮、创作者信息
2. **组织架构图**：智能体层级的交互式可视化
3. **智能体分解**：每个智能体的可展开卡片 — 角色、能力、模型、技能
4. **治理**：审批流程、预算结构、升级链
5. **包含的项目**：带工作区配置的项目模板
6. **README**：完整的 markdown 文档
7. **评价**：星级评分 + 文字评价
8. **相关蓝图**：交叉销售类似的团队配置
9. **创作者主页**：迷你简介、其他列表

---

## 7. 安装机制

### 7.1 安装 API 流程

当买家点击"安装到公司"时：

```
POST /api/listings/:id/install
{
  "targetCompanyId": "uuid",         // 现有 Paperclip 公司
  "overrides": {                      // 可选自定义
    "agentModel": "claude-sonnet-4-6", // 覆盖默认模型
    "budgetScale": 0.5,               // 缩放预算
    "skipProjects": false
  }
}
```

安装处理器：

1. 验证买家拥有购买记录
2. 验证目标公司访问权限
3. 对蓝图中的每个智能体：
   - `POST /api/companies/:id/agents`（如果 `paperclip-create-agent` 支持，或通过审批流程）
   - 设置适配器配置、提示词模板、指令路径
4. 设置汇报链
5. 创建项目和工作区
6. 应用治理规则
7. 将技能文件部署到配置的路径
8. 返回已创建资源的摘要

### 7.2 冲突解决

- **智能体名称冲突**：追加 `-2`、`-3` 后缀
- **项目名称冲突**：提示买家重命名或跳过
- **适配器不匹配**：如果蓝图需要的适配器本地不可用则警告
- **模型可用性**：如果所需模型未配置则警告

---

## 8. 收入模型

| 费用 | 金额 | 备注 |
|---|---|---|
| 创作者收入分成 | 售价的 90% | 减去 Stripe 处理费（~2.9% + $0.30） |
| 平台费 | 售价的 10% | ClipHub 的分成 |
| 免费列表 | $0 | 免费列表无费用 |
| Stripe Connect | 标准费率 | 由 Stripe 处理 |

---

## 9. 技术架构

### 9.1 技术栈

- **前端**：Next.js（React）、Tailwind CSS、与 Paperclip 相同的 UI 框架
- **后端**：Node.js API（或扩展 Paperclip 服务器）
- **数据库**：Postgres（可与 Paperclip 共享数据库或独立）
- **支付**：Stripe Connect（市场模式）
- **存储**：S3/R2 用于列表捆绑包和图片
- **认证**：与 Paperclip 认证共享（或 OAuth2）

### 9.2 与 Paperclip 的集成

ClipHub 可以是：
- **选项 A**：一个独立应用，调用 Paperclip 的 API 来安装蓝图
- **选项 B**：Paperclip UI 的内置部分（`/marketplace` 路由）

选项 B 对 MVP 更简单 — 在现有 Paperclip UI 和 API 中添加路由。

### 9.3 捆绑包格式

列表捆绑包是包含以下内容的 ZIP/tar 归档：

```
blueprint/
├── manifest.json          # 列表元数据 + 智能体配置
├── README.md              # 文档
├── org-chart.json         # 智能体层级
├── governance.json        # 审批规则、预算
├── agents/
│   ├── ceo/
│   │   ├── prompt.md      # 提示词模板
│   │   ├── AGENTS.md      # 指令
│   │   └── skills/        # 技能文件
│   ├── cto/
│   │   ├── prompt.md
│   │   ├── AGENTS.md
│   │   └── skills/
│   └── engineer/
│       ├── prompt.md
│       ├── AGENTS.md
│       └── skills/
└── projects/
    └── default/
        └── workspace.json  # 项目工作区配置
```

---

## 10. MVP 范围

### 第一阶段：基础

- [ ] 列表模式和 CRUD API
- [ ] 带筛选的浏览页（类型、分类、价格）
- [ ] 带组织架构图可视化的列表详情页
- [ ] 创作者注册和列表创建向导
- [ ] 仅免费安装（暂无支付）
- [ ] 安装流程：蓝图 -> Paperclip 公司

### 第二阶段：支付和社交

- [ ] Stripe Connect 集成
- [ ] 购买流程
- [ ] 评价系统
- [ ] 创作者分析仪表盘
- [ ] "从 Paperclip 导出" CLI 命令

### 第三阶段：增长

- [ ] 带相关性排名的搜索
- [ ] 精选/热门列表
- [ ] 创作者验证计划
- [ ] 蓝图版本控制和更新通知
- [ ] 实时演示沙箱
- [ ] 程序化发布的 API
