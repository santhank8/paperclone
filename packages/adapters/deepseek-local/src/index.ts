export const type = "deepseek_local";
export const label = "DeepSeek (深度求索)";
export const DEFAULT_DEEPSEEK_LOCAL_MODEL = "deepseek-chat";
export const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";

export const models = [
  { id: "deepseek-chat", label: "DeepSeek Chat (对话)" },
  { id: "deepseek-reasoner", label: "DeepSeek Reasoner (深度推理)" },
];

export const agentConfigurationDoc = `# deepseek_local 智能体配置

适配器：deepseek_local

适用场景：
- 使用 DeepSeek API 运行智能体任务
- 需要高性价比的中文 AI 模型
- 需要深度推理能力（deepseek-reasoner）

不适用场景：
- 需要 Webhook 式外部调用（请使用 http 或 openclaw_gateway）
- 只需要一次性脚本执行（请使用 process）

核心字段：
- model (string, 可选)：DeepSeek 模型 ID，默认 deepseek-chat
- baseUrl (string, 可选)：API 基础地址，默认 https://api.deepseek.com
- maxTokens (number, 可选)：最大输出 token 数
- temperature (number, 可选)：温度参数 (0-2)

环境变量：
- DEEPSEEK_API_KEY (必需)：DeepSeek API 密钥

注意：
- deepseek-reasoner 模型支持思维链推理（reasoning_content）
- 使用 OpenAI 兼容 API 格式
`;
