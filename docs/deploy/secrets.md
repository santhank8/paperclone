---
title: 密钥管理
summary: 主密钥、加密和严格模式
---

Paperclip 使用本地主密钥对密钥进行静态加密。包含敏感值（API 密钥、令牌）的智能体环境变量以加密密钥引用的形式存储。

## 默认提供者：`local_encrypted`

密钥使用存储在以下位置的本地主密钥加密：

```
~/.paperclip/instances/default/secrets/master.key
```

此密钥在引导过程中自动创建。密钥永不离开你的机器。

## 配置

### CLI 设置

引导过程写入默认密钥配置：

```sh
pnpm paperclipai onboard
```

更新密钥设置：

```sh
pnpm paperclipai configure --section secrets
```

验证密钥配置：

```sh
pnpm paperclipai doctor
```

### 环境变量覆盖

| 变量 | 描述 |
|----------|-------------|
| `PAPERCLIP_SECRETS_MASTER_KEY` | 32 字节密钥（base64、hex 或原始字符串） |
| `PAPERCLIP_SECRETS_MASTER_KEY_FILE` | 自定义密钥文件路径 |
| `PAPERCLIP_SECRETS_STRICT_MODE` | 设为 `true` 以强制使用密钥引用 |

## 严格模式

启用严格模式后，敏感环境变量键名（匹配 `*_API_KEY`、`*_TOKEN`、`*_SECRET`）必须使用密钥引用而非内联明文值。

```sh
PAPERCLIP_SECRETS_STRICT_MODE=true
```

推荐用于本地信任模式以外的任何部署。

## 迁移内联密钥

如果你有现存智能体在配置中包含内联 API 密钥，将其迁移为加密密钥引用：

```sh
pnpm secrets:migrate-inline-env         # 试运行
pnpm secrets:migrate-inline-env --apply # 执行迁移
```

## 智能体配置中的密钥引用

智能体环境变量使用密钥引用：

```json
{
  "env": {
    "ANTHROPIC_API_KEY": {
      "type": "secret_ref",
      "secretId": "8f884973-c29b-44e4-8ea3-6413437f8081",
      "version": "latest"
    }
  }
}
```

服务器在运行时解析和解密这些引用，将真实值注入智能体进程环境。
