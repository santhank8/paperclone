# 发布 Paperclip

跨 npm、GitHub 和面向网站的变更日志的 Paperclip 发布维护者手册。

发布模型现在是提交驱动的：

1. 每次推送到 `master` 自动发布一个 canary。
2. 稳定版从选定的已测试提交或 canary 标签手动提升。
3. 稳定版发布说明位于 `releases/vYYYY.MDD.P.md`。
4. 只有稳定版才有 GitHub Releases。

## 版本模型

Paperclip 使用日历版本，仍符合 semver 语法：

- 稳定版：`YYYY.MDD.P`
- canary：`YYYY.MDD.P-canary.N`

示例：

- 2026 年 3 月 18 日的第一个稳定版：`2026.318.0`
- 2026 年 3 月 18 日的第二个稳定版：`2026.318.1`
- `2026.318.1` 系列的第四个 canary：`2026.318.1-canary.3`

重要约束：

- 中间数字槽是 `MDD`，其中 `M` 是 UTC 月份，`DD` 是零填充的 UTC 日期
- 3 月 3 日使用 `2026.303.0`，而非 `2026.33.0`
- 不要使用前导零如 `2026.0318.0`
- 不要使用四个数字段如 `2026.3.18.1`
- semver 安全的 canary 形式是 `2026.318.0-canary.1`

## 发布界面

每个稳定版有四个独立的界面：

1. **验证** — 精确的 git SHA 通过类型检查、测试和构建
2. **npm** — `paperclipai` 和公共工作区包被发布
3. **GitHub** — 稳定版获得 git 标签和 GitHub Release
4. **网站/公告** — 稳定版变更日志被外部发布和宣布

稳定版只有在所有四个界面都处理完毕后才算完成。

Canary 只覆盖前两个界面加上内部可追溯性标签。

## 核心不变量

- canary 从 `master` 发布
- 稳定版从显式选择的源引用发布
- 标签指向原始源提交，而非生成的发布提交
- 稳定版说明始终是 `releases/vYYYY.MDD.P.md`
- canary 永远不创建 GitHub Releases
- canary 永远不需要变更日志生成

## 简要说明

### Canary

每次推送到 `master` 运行 [`.github/workflows/release.yml`](../.github/workflows/release.yml) 中的 canary 路径。

它：

- 验证推送的提交
- 计算当前 UTC 日期的 canary 版本
- 在 npm dist-tag `canary` 下发布
- 创建 git 标签 `canary/vYYYY.MDD.P-canary.N`

用户安装 canary：

```bash
npx paperclipai@canary onboard
# 或
npx paperclipai@canary onboard --data-dir "$(mktemp -d /tmp/paperclip-canary.XXXXXX)"
```

### 稳定版

从 Actions 标签使用 [`.github/workflows/release.yml`](../.github/workflows/release.yml) 的手动 `workflow_dispatch` 输入。

[在这里运行操作](https://github.com/paperclipai/paperclip/actions/workflows/release.yml)

输入：

- `source_ref`
  - 提交 SHA、分支或标签
- `stable_date`
  - 可选的 UTC 日期覆盖，格式为 `YYYY-MM-DD`
  - 输入日期如 `2026-03-18`，而非版本如 `2026.318.0`
- `dry_run`
  - 为 true 时仅预览

运行稳定版之前：

1. 选择你信任的 canary 提交或标签
2. 使用 `./scripts/release.sh stable --date "$(date +%F)" --print-version` 解析目标稳定版本
3. 在该源引用上创建或更新 `releases/vYYYY.MDD.P.md`
4. 从该源引用运行稳定版工作流

示例：

- `source_ref`：`master`
- `stable_date`：`2026-03-18`
- 结果稳定版本：`2026.318.0`

工作流：

- 重新验证精确的源引用
- 计算选定 UTC 日期的下一个稳定补丁槽
- 在 npm dist-tag `latest` 下发布 `YYYY.MDD.P`
- 创建 git 标签 `vYYYY.MDD.P`
- 从 `releases/vYYYY.MDD.P.md` 创建或更新 GitHub Release

## 本地命令

### 本地预览 canary

```bash
./scripts/release.sh canary --dry-run
```

### 本地预览稳定版

```bash
./scripts/release.sh stable --dry-run
```

### 本地发布稳定版

这主要用于紧急/手动使用。正常路径是 GitHub 工作流。

```bash
./scripts/release.sh stable
git push public-gh refs/tags/vYYYY.MDD.P
PUBLISH_REMOTE=public-gh ./scripts/create-github-release.sh YYYY.MDD.P
```

## 稳定版变更日志工作流

稳定版变更日志文件位于：

- `releases/vYYYY.MDD.P.md`

Canary 不获得变更日志文件。

推荐的本地生成流程：

```bash
VERSION="$(./scripts/release.sh stable --date 2026-03-18 --print-version)"
claude --print --output-format stream-json --verbose --dangerously-skip-permissions --model claude-opus-4-6 "Use the release-changelog skill to draft or update releases/v${VERSION}.md for Paperclip. Read doc/RELEASING.md and .agents/skills/release-changelog/SKILL.md, then generate the stable changelog for v${VERSION} from commits since the last stable tag. Do not create a canary changelog."
```

仓库故意不通过 GitHub Actions 运行此操作，因为：

- canary 太频繁
- 稳定版说明是唯一需要 LLM 帮助的公共叙事界面
- 维护者 LLM token 不应存在于 Actions 中

## 冒烟测试

对于 canary：

```bash
PAPERCLIPAI_VERSION=canary ./scripts/docker-onboard-smoke.sh
```

对于当前稳定版：

```bash
PAPERCLIPAI_VERSION=latest ./scripts/docker-onboard-smoke.sh
```

有用的隔离变体：

```bash
HOST_PORT=3232 DATA_DIR=./data/release-smoke-canary PAPERCLIPAI_VERSION=canary ./scripts/docker-onboard-smoke.sh
HOST_PORT=3233 DATA_DIR=./data/release-smoke-stable PAPERCLIPAI_VERSION=latest ./scripts/docker-onboard-smoke.sh
```

自动化浏览器冒烟测试也可用：

```bash
gh workflow run release-smoke.yml -f paperclip_version=canary
gh workflow run release-smoke.yml -f paperclip_version=latest
```

最低检查项：

- `npx paperclipai@canary onboard` 安装成功
- 入门完成无崩溃
- 认证登录使用冒烟测试凭据正常工作
- 浏览器在全新实例上进入入门界面
- 公司创建成功
- 第一个 CEO 智能体被创建
- 第一次 CEO 心跳运行被触发

## 回滚

回滚不会取消发布版本。

它只将 `latest` dist-tag 移回之前的稳定版：

```bash
./scripts/rollback-latest.sh 2026.318.0 --dry-run
./scripts/rollback-latest.sh 2026.318.0
```

然后通过新的稳定补丁槽或发布日期向前修复。

## 故障手册

### 如果 canary 发布了但冒烟测试失败

不要运行稳定版。

相反：

1. 在 `master` 上修复问题
2. 合并修复
3. 等待下一个自动 canary
4. 重新运行冒烟测试

### 如果稳定版 npm 发布成功但标签推送或 GitHub release 创建失败

这是部分发布。npm 已经上线。

立即执行：

1. 推送缺失的标签
2. 重新运行 `PUBLISH_REMOTE=public-gh ./scripts/create-github-release.sh YYYY.MDD.P`
3. 验证 GitHub Release 说明指向 `releases/vYYYY.MDD.P.md`

不要重新发布相同的版本。

### 如果稳定版发布后 `latest` 坏了

回滚 dist-tag：

```bash
./scripts/rollback-latest.sh YYYY.MDD.P
```

然后通过新的稳定版向前修复。

## 相关文件

- [`scripts/release.sh`](../scripts/release.sh)
- [`scripts/release-package-map.mjs`](../scripts/release-package-map.mjs)
- [`scripts/create-github-release.sh`](../scripts/create-github-release.sh)
- [`scripts/rollback-latest.sh`](../scripts/rollback-latest.sh)
- [`doc/PUBLISHING.md`](PUBLISHING.md)
- [`doc/RELEASE-AUTOMATION-SETUP.md`](RELEASE-AUTOMATION-SETUP.md)
