---
title: 密钥管理
summary: 密钥 CRUD
---

管理智能体在环境配置中引用的加密密钥。

## 列出密钥

```
GET /api/companies/{companyId}/secrets
```

返回密钥元数据（不包含解密后的值）。

## 创建密钥

```
POST /api/companies/{companyId}/secrets
{
  "name": "anthropic-api-key",
  "value": "sk-ant-..."
}
```

值在静态存储时加密。只返回密钥 ID 和元数据。

## 更新密钥

```
PATCH /api/secrets/{secretId}
{
  "value": "sk-ant-new-value..."
}
```

创建密钥的新版本。引用 `"version": "latest"` 的智能体在下次心跳时自动获取新值。

## 在智能体配置中使用密钥

在智能体适配器配置中引用密钥而不是内联值：

```json
{
  "env": {
    "ANTHROPIC_API_KEY": {
      "type": "secret_ref",
      "secretId": "{secretId}",
      "version": "latest"
    }
  }
}
```

服务器在运行时解析和解密密钥引用，将真实值注入智能体进程环境。
