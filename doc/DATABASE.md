# 数据库

Paperclip 通过 [Drizzle ORM](https://orm.drizzle.team/) 使用 PostgreSQL。有三种运行数据库的方式，从最简单到最适合生产环境。

## 1. 嵌入式 PostgreSQL — 零配置

如果你不设置 `DATABASE_URL`，服务器会自动启动嵌入式 PostgreSQL 实例并管理本地数据目录。

```sh
pnpm dev
```

就这样。首次启动时服务器会：

1. 创建 `~/.paperclip/instances/default/db/` 目录用于存储
2. 确保 `paperclip` 数据库存在
3. 对空数据库自动运行迁移
4. 开始处理请求

数据在重启后保留在 `~/.paperclip/instances/default/db/` 中。要重置本地开发数据，删除该目录即可。

如果需要手动应用待处理的迁移，运行：

```sh
pnpm db:migrate
```

当 `DATABASE_URL` 未设置时，此命令针对当前活动 Paperclip 配置/实例的嵌入式 PostgreSQL 实例。

此模式适用于本地开发和一键安装。

Docker 说明：Docker 快速启动镜像默认也使用嵌入式 PostgreSQL。挂载 `/paperclip` 以在容器重启之间保持数据库状态（参见 `doc/DOCKER.md`）。

## 2. 本地 PostgreSQL（Docker）

要在本地使用完整的 PostgreSQL 服务器，使用自带的 Docker Compose 配置：

```sh
docker compose up -d
```

这会在 `localhost:5432` 启动 PostgreSQL 17。然后设置连接字符串：

```sh
cp .env.example .env
# .env 已包含：
# DATABASE_URL=postgres://paperclip:paperclip@localhost:5432/paperclip
```

运行迁移（待迁移生成问题修复后）或使用 `drizzle-kit push`：

```sh
DATABASE_URL=postgres://paperclip:paperclip@localhost:5432/paperclip \
  npx drizzle-kit push
```

启动服务器：

```sh
pnpm dev
```

## 3. 托管 PostgreSQL（Supabase）

生产环境可使用托管 PostgreSQL 服务商。[Supabase](https://supabase.com/) 提供免费层，是一个不错的选择。

### 设置

1. 在 [database.new](https://database.new) 创建项目
2. 进入 **Project Settings > Database > Connection string**
3. 复制 URI 并将密码占位符替换为你的数据库密码

### 连接字符串

Supabase 提供两种连接模式：

**直接连接**（端口 5432）— 用于迁移和一次性脚本：

```
postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

**通过 Supavisor 连接池**（端口 6543）— 用于应用程序：

```
postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

### 配置

在 `.env` 中设置 `DATABASE_URL`：

```sh
DATABASE_URL=postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

如果使用连接池（端口 6543），`postgres` 客户端必须禁用预处理语句。更新 `packages/db/src/client.ts`：

```ts
export function createDb(url: string) {
  const sql = postgres(url, { prepare: false });
  return drizzlePg(sql, { schema });
}
```

### 推送模式

```sh
# 使用直接连接（端口 5432）进行模式变更
DATABASE_URL=postgres://postgres.[PROJECT-REF]:[PASSWORD]@...5432/postgres \
  npx drizzle-kit push
```

### 免费层限制

- 500 MB 数据库存储
- 200 个并发连接
- 项目在 1 周不活跃后暂停

详见 [Supabase 定价](https://supabase.com/pricing)。

## 模式切换

数据库模式由 `DATABASE_URL` 控制：

| `DATABASE_URL` | 模式 |
|---|---|
| 未设置 | 嵌入式 PostgreSQL（`~/.paperclip/instances/default/db/`） |
| `postgres://...localhost...` | 本地 Docker PostgreSQL |
| `postgres://...supabase.com...` | 托管 Supabase |

无论使用哪种模式，你的 Drizzle 模式（`packages/db/src/schema/`）保持不变。

## 密钥存储

Paperclip 将密钥元数据和版本存储在：

- `company_secrets`
- `company_secret_versions`

对于本地/默认安装，活动提供者为 `local_encrypted`：

- 密钥材料在本地使用主密钥进行静态加密。
- 默认密钥文件：`~/.paperclip/instances/default/secrets/master.key`（如缺失则自动创建）。
- CLI 配置位置：`~/.paperclip/instances/default/config.json` 中的 `secrets.localEncrypted.keyFilePath`。

可选覆盖：

- `PAPERCLIP_SECRETS_MASTER_KEY`（32 字节密钥，base64、hex 或原始 32 字符字符串）
- `PAPERCLIP_SECRETS_MASTER_KEY_FILE`（自定义密钥文件路径）

严格模式，阻止新的内联敏感环境变量值：

```sh
PAPERCLIP_SECRETS_STRICT_MODE=true
```

你可以通过以下方式设置严格模式和提供者默认值：

```sh
pnpm paperclipai configure --section secrets
```

内联密钥迁移命令：

```sh
pnpm secrets:migrate-inline-env --apply
```
