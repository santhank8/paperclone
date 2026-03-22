export const type = "moonshot_local";
export const label = "Kimi / 月之暗面 (Moonshot)";
export const DEFAULT_MOONSHOT_LOCAL_MODEL = "moonshot-v1-32k";
export const DEFAULT_MOONSHOT_BASE_URL = "https://api.moonshot.cn/v1";

export const models = [
  { id: "moonshot-v1-8k", label: "Moonshot v1 8K" },
  { id: "moonshot-v1-32k", label: "Moonshot v1 32K" },
  { id: "moonshot-v1-128k", label: "Moonshot v1 128K (长文本)" },
];

export const agentConfigurationDoc = `# moonshot_local 智能体配置

适配器：moonshot_local

适用场景：
- 使用 Moonshot/Kimi API 运行智能体任务
- 需要超长上下文窗口（最高 128K）
- 需要中文语境优化的 AI 模型

不适用场景：
- 需要 Webhook 式外部调用（请使用 http 或 openclaw_gateway）
- 只需要一次性脚本执行（请使用 process）

核心字段：
- model (string, 可选)：Moonshot 模型 ID，默认 moonshot-v1-32k
- baseUrl (string, 可选)：API 基础地址，默认 https://api.moonshot.cn/v1
- maxTokens (number, 可选)：最大输出 token 数
- temperature (number, 可选)：温度参数 (0-1)

环境变量：
- MOONSHOT_API_KEY (必需)：Moonshot API 密钥

注意：
- 使用 OpenAI 兼容 API 格式
- moonshot-v1-128k 支持超长文本输入，适合处理大量文档
- 温度范围 0-1（与 OpenAI 的 0-2 不同）
`;
