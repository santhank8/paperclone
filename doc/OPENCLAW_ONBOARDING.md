请严格按照此检查清单操作。

1. 以认证模式启动 Paperclip。
```bash
cd <paperclip-repo-root>
pnpm dev --tailscale-auth
```
然后验证：
```bash
curl -sS http://127.0.0.1:3100/api/health | jq
```

2. 启动一个干净/标准的 OpenClaw Docker。
```bash
OPENCLAW_RESET_STATE=1 OPENCLAW_BUILD=1 ./scripts/smoke/openclaw-docker-ui.sh
```
在浏览器中打开输出的 `Dashboard URL`（包含 `#token=...`）。

3. 在 Paperclip UI 中，进入 `http://127.0.0.1:3100/CLA/company/settings`。

4. 使用 OpenClaw 邀请提示流程。
- 在邀请部分，点击 `Generate OpenClaw Invite Prompt`。
- 从 `OpenClaw Invite Prompt` 复制生成的提示。
- 将其作为一条消息粘贴到 OpenClaw 主聊天中。
- 如果卡住了，发送一条跟进消息：`How is onboarding going? Continue setup now.`

安全/控制说明：
- OpenClaw 邀请提示从受控端点创建：
  - `POST /api/companies/{companyId}/openclaw/invite-prompt`
  - 拥有邀请权限的董事会用户可以调用
  - 智能体调用者仅限于公司 CEO 智能体

5. 在 Paperclip UI 中审批加入请求，然后确认 OpenClaw 智能体出现在 CLA 智能体中。

6. 网关预检（任务测试前必需）。
- 确认创建的智能体使用 `openclaw_gateway`（而非 `openclaw`）。
- 确认网关 URL 为 `ws://...` 或 `wss://...`。
- 确认网关令牌非简单值（非空/非单字符占位符）。
- OpenClaw Gateway 适配器 UI 在正常入门时不应暴露 `disableDeviceAuth`。
- 确认配对模式是显式的：
  - 默认要求：启用设备认证（`adapterConfig.disableDeviceAuth` 为 false/缺失），并持久化 `adapterConfig.devicePrivateKeyPem`
  - 正常入门不要依赖 `disableDeviceAuth`
- 如果你可以使用董事会认证运行 API 检查：
```bash
AGENT_ID="<newly-created-agent-id>"
curl -sS -H "Cookie: $PAPERCLIP_COOKIE" "http://127.0.0.1:3100/api/agents/$AGENT_ID" | jq '{adapterType,adapterConfig:{url:.adapterConfig.url,tokenLen:(.adapterConfig.headers["x-openclaw-token"] // .adapterConfig.headers["x-openclaw-auth"] // "" | length),disableDeviceAuth:(.adapterConfig.disableDeviceAuth // false),hasDeviceKey:(.adapterConfig.devicePrivateKeyPem // "" | length > 0)}}'
```
- 预期结果：`adapterType=openclaw_gateway`、`tokenLen >= 16`、`hasDeviceKey=true`、`disableDeviceAuth=false`。

配对握手说明：
- 干净运行预期：首次任务应无需手动配对命令即可成功。
- 适配器在首次收到 `pairing required` 时会尝试一次自动配对审批 + 重试（当共享网关认证令牌/密码有效时）。
- 如果自动配对无法完成（例如令牌不匹配或无待处理请求），首次网关运行可能仍返回 `pairing required`。
- 这与 Paperclip 邀请审批是分开的审批。你必须在 OpenClaw 本身中审批待处理设备。
- 在 OpenClaw 中审批后，重试任务。
- 对于本地 Docker 冒烟测试，你可以从主机审批：
```bash
docker exec openclaw-docker-openclaw-gateway-1 sh -lc 'openclaw devices approve --latest --json --url "ws://127.0.0.1:18789" --token "$(node -p \"require(process.env.HOME+\\\"/.openclaw/openclaw.json\\\").gateway.auth.token\")"'
```
- 你可以检查待处理与已配对的设备：
```bash
docker exec openclaw-docker-openclaw-gateway-1 sh -lc 'TOK="$(node -e \"const fs=require(\\\"fs\\\");const c=JSON.parse(fs.readFileSync(\\\"/home/node/.openclaw/openclaw.json\\\",\\\"utf8\\\"));process.stdout.write(c.gateway?.auth?.token||\\\"\\\");\")\"; openclaw devices list --json --url \"ws://127.0.0.1:18789\" --token \"$TOK\"'
```

7. 案例 A（手动任务测试）。
- 创建一个分配给 OpenClaw 智能体的任务。
- 输入指令："post comment `OPENCLAW_CASE_A_OK_<timestamp>` and mark done."
- 在 UI 中验证：任务状态变为 `done` 且评论存在。

8. 案例 B（消息工具测试）。
- 创建另一个分配给 OpenClaw 的任务。
- 指令："send `OPENCLAW_CASE_B_OK_<timestamp>` to main webchat via message tool, then comment same marker on issue, then mark done."
- 验证两项：
  - 任务上的标记评论
  - 标记文本出现在 OpenClaw 主聊天中

9. 案例 C（新会话记忆/技能测试）。
- 在 OpenClaw 中，启动 `/new` 会话。
- 要求它在 Paperclip 中创建一个新的 CLA 任务，标题为唯一的 `OPENCLAW_CASE_C_CREATED_<timestamp>`。
- 在 Paperclip UI 中验证新任务存在。

10. 测试期间观察日志（可选但有帮助）：
```bash
docker compose -f /tmp/openclaw-docker/docker-compose.yml -f /tmp/openclaw-docker/.paperclip-openclaw.override.yml logs -f openclaw-gateway
```

11. 预期通过标准。
- 预检：`openclaw_gateway` + 非占位符令牌（`tokenLen >= 16`）。
- 配对模式：稳定的 `devicePrivateKeyPem` 已配置，设备认证已启用（默认路径）。
- 案例 A：`done` + 标记评论。
- 案例 B：`done` + 标记评论 + 主聊天消息可见。
- 案例 C：原始任务完成且从 `/new` 会话创建了新任务。

如果你需要，我还可以提供一个单独的"观察模式"命令，运行标准冒烟测试套件的同时你可以在 UI 中实时观看相同步骤。
