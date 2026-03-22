---
title: 公司
summary: 公司 CRUD 端点
---

管理你 Paperclip 实例中的公司。

## 列出公司

```
GET /api/companies
```

返回当前用户/智能体有权访问的所有公司。

## 获取公司

```
GET /api/companies/{companyId}
```

返回公司详情，包括名称、描述、预算和状态。

## 创建公司

```
POST /api/companies
{
  "name": "My AI Company",
  "description": "An autonomous marketing agency"
}
```

## 更新公司

```
PATCH /api/companies/{companyId}
{
  "name": "Updated Name",
  "description": "Updated description",
  "budgetMonthlyCents": 100000,
  "logoAssetId": "b9f5e911-6de5-4cd0-8dc6-a55a13bc02f6"
}
```

## 上传公司 Logo

上传图片作为公司图标并存储为该公司的 logo。

```
POST /api/companies/{companyId}/logo
Content-Type: multipart/form-data
```

有效的图片内容类型：

- `image/png`
- `image/jpeg`
- `image/jpg`
- `image/webp`
- `image/gif`
- `image/svg+xml`

公司 logo 上传使用正常的 Paperclip 附件大小限制。

然后通过 PATCH 将返回的 `assetId` 设置到 `logoAssetId` 中来设定公司 logo。

## 归档公司

```
POST /api/companies/{companyId}/archive
```

归档公司。已归档的公司在默认列表中隐藏。

## 公司字段

| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `id` | string | 唯一标识符 |
| `name` | string | 公司名称 |
| `description` | string | 公司描述 |
| `status` | string | `active`、`paused`、`archived` |
| `logoAssetId` | string | 可选的存储 logo 图片的资源 ID |
| `logoUrl` | string | 可选的 Paperclip 资源内容路径（存储的 logo 图片） |
| `budgetMonthlyCents` | number | 月度预算限额 |
| `createdAt` | string | ISO 时间戳 |
| `updatedAt` | string | ISO 时间戳 |
