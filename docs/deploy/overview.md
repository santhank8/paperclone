---
title: 部署概览
summary: 部署模式一览
---

Paperclip 支持三种部署配置，从零摩擦的本地到面向互联网的生产环境。

## 部署模式

| 模式 | 认证 | 适用场景 |
|------|------|----------|
| `local_trusted` | 无需登录 | 单操作员本地机器 |
| `authenticated` + `private` | 需要登录 | 私有网络（Tailscale、VPN、LAN） |
| `authenticated` + `public` | 需要登录 | 面向互联网的云部署 |

## 快速比较

### 本地信任模式（默认）

- 仅回环绑定（localhost）
- 无人类登录流程
- 最快的本地启动
- 适用于：个人开发和实验

### 认证 + 私有

- 通过 Better Auth 要求登录
- 绑定所有接口以进行网络访问
- 自动基础 URL 模式（更低摩擦）
- 适用于：通过 Tailscale 或局域网的团队访问

### 认证 + 公开

- 需要登录
- 需要显式公开 URL
- 更严格的安全检查
- 适用于：云托管、面向互联网的部署

## 选择模式

- **只是试用 Paperclip？** 使用 `local_trusted`（默认）
- **与私有网络上的团队共享？** 使用 `authenticated` + `private`
- **部署到云端？** 使用 `authenticated` + `public`

在引导过程中设置模式：

```sh
pnpm paperclipai onboard
```

或稍后更新：

```sh
pnpm paperclipai configure --section server
```
