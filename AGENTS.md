# AGENTS.md

为在此仓库中工作的人类和 AI 贡献者提供指导。

## 1. 目的

Paperclip 是 AI 智能体公司的控制平面。
当前的实现目标是 V1，定义在 `doc/SPEC-implementation.md` 中。

## 2. 先阅读这些

在进行更改之前，请按以下顺序阅读：

1. `doc/GOAL.md`
2. `doc/PRODUCT.md`
3. `doc/SPEC-implementation.md`
4. `doc/DEVELOPING.md`
5. `doc/DATABASE.md`

`doc/SPEC.md` 是长期产品上下文。
`doc/SPEC-implementation.md` 是具体的 V1 构建契约。

## 3. 仓库结构

- `server/`: Express REST API 和编排服务
- `ui/`: React + Vite 看板 UI
- `packages/db/`: Drizzle schema、迁移、数据库客户端
- `packages/shared/`: 共享类型、常量、验证器、API 路径常量
- `doc/`: 运维和产品文档

## 4. 开发环境设置（自动数据库）

在开发环境中不设置 `DATABASE_URL` 即可使用嵌入式 PGlite。

```sh
pnpm install
pnpm dev
```

启动后：

- API: `http://localhost:3100`
- UI: `http://localhost:3100`（在开发中间件模式下由 API 服务端提供）

快速检查：

```sh
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
```

重置本地开发数据库：

```sh
rm -rf data/pglite
pnpm dev
```

## 5. 核心工程规则

1. 保持更改在公司范围内。
每个领域实体都应该限定在公司范围内，公司边界必须在路由/服务中强制执行。

2. 保持契约同步。
如果更改了 schema/API 行为，请更新所有受影响的层：
- `packages/db` schema 和导出
- `packages/shared` 类型/常量/验证器
- `server` 路由/服务
- `ui` API 客户端和页面

3. 保持控制平面不变量。
- 单负责人任务模型
- 原子化任务签出语义
- 受治理操作的审批门控
- 预算硬停止自动暂停行为
- 变更操作的动态日志记录

4. 除非被要求，不要整体替换战略文档。
优先进行增量更新。保持 `doc/SPEC.md` 和 `doc/SPEC-implementation.md` 对齐。

5. 保持计划文档有日期且集中管理。
新的计划文档放在 `doc/plans/` 中，使用 `YYYY-MM-DD-slug.md` 文件名格式。

## 6. 数据库变更工作流

更改数据模型时：

1. 编辑 `packages/db/src/schema/*.ts`
2. 确保新表从 `packages/db/src/schema/index.ts` 导出
3. 生成迁移：

```sh
pnpm db:generate
```

4. 验证编译：

```sh
pnpm -r typecheck
```

注意：
- `packages/db/drizzle.config.ts` 从 `dist/schema/*.js` 读取编译后的 schema
- `pnpm db:generate` 会先编译 `packages/db`

## 7. 交付前验证

在声称完成之前运行完整检查：

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

如果有任何检查无法运行，请明确报告未运行的内容及原因。

## 8. API 和认证要求

- 基础路径: `/api`
- 董事会访问被视为完全控制的操作员上下文
- 智能体访问使用 Bearer API 密钥（`agent_api_keys`），静态哈希存储
- 智能体密钥不得访问其他公司

添加端点时：

- 应用公司访问检查
- 执行操作者权限（董事会 vs 智能体）
- 为变更操作写入动态日志
- 返回一致的 HTTP 错误（`400/401/403/404/409/422/500`）

## 9. UI 要求

- 保持路由和导航与可用 API 接口对齐
- 使用公司选择上下文用于公司范围的页面
- 清晰地展示失败；不要静默忽略 API 错误

## 10. 完成定义

当以下条件全部满足时，一项更改才算完成：

1. 行为符合 `doc/SPEC-implementation.md`
2. 类型检查、测试和构建通过
3. 契约在 db/shared/server/ui 之间同步
4. 行为或命令变更时文档已更新
