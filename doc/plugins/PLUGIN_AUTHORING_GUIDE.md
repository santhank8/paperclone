# 插件编写指南

本指南描述了在此仓库中创建 Paperclip 插件的当前已实现方式。

它故意比 [PLUGIN_SPEC.md](./PLUGIN_SPEC.md) 更窄。规范包含未来想法；本指南仅涵盖目前存在的 alpha 界面。

## 当前现状

- 将插件 worker 和插件 UI 视为可信代码。
- 插件 UI 作为同源 JavaScript 在主 Paperclip 应用内运行。
- Worker 端宿主 API 受能力门控。
- 插件 UI 不受清单能力沙箱限制。
- 目前没有宿主提供的共享 React 组件工具包。
- 当前运行时不支持 `ctx.assets`。

## 搭建插件脚手架

使用脚手架包：

```bash
pnpm --filter @paperclipai/create-paperclip-plugin build
node packages/plugins/create-paperclip-plugin/dist/index.js @yourscope/plugin-name --output ./packages/plugins/examples
```

对于存在于 Paperclip 仓库之外的插件：

```bash
pnpm --filter @paperclipai/create-paperclip-plugin build
node packages/plugins/create-paperclip-plugin/dist/index.js @yourscope/plugin-name \
  --output /absolute/path/to/plugin-repos \
  --sdk-path /absolute/path/to/paperclip/packages/plugins/sdk
```

这会创建一个包含以下文件的包：

- `src/manifest.ts`
- `src/worker.ts`
- `src/ui/index.tsx`
- `tests/plugin.spec.ts`
- `esbuild.config.mjs`
- `rollup.config.mjs`

在此 monorepo 内，脚手架使用 `workspace:*` 引用 `@paperclipai/plugin-sdk`。

在此 monorepo 之外，脚手架将 `@paperclipai/plugin-sdk` 从本地 Paperclip 检出快照为 `.paperclip-sdk/` tarball，这样你可以在不先发布到 npm 的情况下构建和测试插件。

## 推荐的本地工作流

从生成的插件文件夹：

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

对于本地开发，通过插件管理器或 API 从绝对本地路径安装到 Paperclip。服务器支持本地文件系统安装，并监视本地路径插件的文件变更，因此 worker 在重建后会自动重启。

示例：

```bash
curl -X POST http://127.0.0.1:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"packageName":"/absolute/path/to/your-plugin","isLocalPath":true}'
```

## 支持的 Alpha 界面

Worker：

- config
- events
- jobs
- launchers
- http
- secrets
- activity
- state
- entities
- projects 和 project workspaces
- companies
- issues 和 comments
- agents 和 agent sessions
- goals
- data/actions
- streams
- tools
- metrics
- logger

UI：

- `usePluginData`
- `usePluginAction`
- `usePluginStream`
- `usePluginToast`
- `useHostContext`
- 来自 `@paperclipai/plugin-sdk/ui` 的类型化插槽属性

当前宿主中已连接的挂载界面包括：

- `page`
- `settingsPage`
- `dashboardWidget`
- `sidebar`
- `sidebarPanel`
- `detailTab`
- `taskDetailView`
- `projectSidebarItem`
- `globalToolbarButton`
- `toolbarButton`
- `contextMenuItem`
- `commentAnnotation`
- `commentContextMenuItem`

## 公司路由

插件可以声明带有 `routePath` 的 `page` 插槽来拥有公司路由如：

```text
/:companyPrefix/<routePath>
```

规则：

- `routePath` 必须是单个小写 slug
- 不能与保留的宿主路由冲突
- 不能与其他已安装插件的页面路由重复

## 发布指导

- 使用 npm 包作为部署制品。
- 将仓库本地示例安装视为仅限开发的工作流。
- 优先保持插件 UI 在包内自包含。
- 不要依赖宿主设计系统组件或未文档化的应用内部。
- GitHub 仓库安装目前不是一等工作流。对于本地开发，使用签出的本地路径。对于生产，发布到 npm 或私有的 npm 兼容注册表。

## 交付前验证

至少：

```bash
pnpm --filter <your-plugin-package> typecheck
pnpm --filter <your-plugin-package> test
pnpm --filter <your-plugin-package> build
```

如果你也更改了宿主集成，还要运行：

```bash
pnpm -r typecheck
pnpm test:run
pnpm build
```
