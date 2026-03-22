export const type = "qwen_local";
export const label = "通义千问 (Qwen)";
export const DEFAULT_QWEN_LOCAL_MODEL = "qwen-plus";
export const DEFAULT_QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

export const models = [
  { id: "qwen-turbo", label: "Qwen Turbo (快速)" },
  { id: "qwen-plus", label: "Qwen Plus (增强)" },
  { id: "qwen-max", label: "Qwen Max (旗舰)" },
  { id: "qwen-long", label: "Qwen Long (长文本)" },
];

export const agentConfigurationDoc = `# qwen_local 智能体配置

适配器：qwen_local

适用场景：
- 使用阿里云通义千问 API 运行智能体任务
- 需要中文语境优化的 AI 模型
- 使用阿里云 DashScope 平台

不适用场景：
- 需要 Webhook 式外部调用（请使用 http 或 openclaw_gateway）
- 只需要一次性脚本执行（请使用 process）

核心字段：
- model (string, 可选)：Qwen 模型 ID，默认 qwen-plus
- baseUrl (string, 可选)：API 基础地址，默认 DashScope 兼容模式端点
- maxTokens (number, 可选)：最大输出 token 数
- temperature (number, 可选)：温度参数 (0-2)

环境变量：
- DASHSCOPE_API_KEY (必需)：阿里云 DashScope API 密钥

注意：
- 使用 OpenAI 兼容 API 格式（DashScope 兼容模式）
- qwen-long 模型支持超长文本输入
`;
