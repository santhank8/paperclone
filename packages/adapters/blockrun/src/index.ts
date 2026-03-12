export const type = "blockrun";
export const label = "BlockRun";

export const models: { id: string; label: string }[] = [
  // OpenAI
  { id: "openai/gpt-5.4", label: "GPT-5.4" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "openai/o3", label: "o3 (Reasoning)" },
  { id: "openai/o1", label: "o1 (Reasoning)" },
  // Anthropic
  { id: "anthropic/claude-opus-4.6", label: "Claude Opus 4.6" },
  { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
  { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" },
  // Google
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  // DeepSeek
  { id: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
  { id: "deepseek/deepseek-reasoner", label: "DeepSeek Reasoner" },
  // xAI
  { id: "xai/grok-3", label: "Grok-3" },
  { id: "xai/grok-3-mini", label: "Grok-3 Mini" },
  // Free
  { id: "nvidia/gpt-oss-120b", label: "GPT-OSS 120B (Free)" },
  { id: "nvidia/gpt-oss-20b", label: "GPT-OSS 20B (Free)" },
];

export const agentConfigurationDoc = `# blockrun agent configuration

Adapter: blockrun

BlockRun provides pay-per-request access to 30+ AI models (OpenAI, Anthropic, Google,
DeepSeek, xAI, and more) via micropayments on Base (USDC). No subscriptions, no API keys
from individual providers — just a single funded wallet.

Use when:
- You want access to multiple AI providers through a single adapter.
- You need pay-per-request billing with on-chain settlement (x402 protocol).
- You want automatic model routing (fast, balanced, powerful, cheap, reasoning).
- You want to avoid managing API keys for each provider individually.

Don't use when:
- You already have direct API keys for all providers you need.
- Your deployment cannot make outbound HTTPS requests to blockrun.ai.
- You need streaming responses (not yet supported).

## Core fields

- **privateKey** (string, required for paid models): Ethereum private key (hex, 0x-prefixed)
  for signing x402 USDC payments on Base. The corresponding wallet must hold USDC on Base
  mainnet (or Base Sepolia for testnet). Never share this key.

- **model** (string, optional): Model ID in \`provider/model\` format.
  Examples: \`openai/gpt-4o\`, \`anthropic/claude-sonnet-4.6\`, \`deepseek/deepseek-chat\`.
  If omitted, uses \`routingMode\` for automatic selection.

- **routingMode** (string, optional): Smart routing mode when no specific model is set.
  Values: \`fast\`, \`balanced\`, \`powerful\`, \`cheap\`, \`reasoning\`.
  Default: \`balanced\`.

- **network** (string, optional): \`mainnet\` (default) or \`testnet\`.
  Mainnet uses https://blockrun.ai/api, testnet uses https://testnet.blockrun.ai/api.

## Request behavior fields

- **apiUrl** (string, optional): Override BlockRun API base URL.
  Default is derived from \`network\` setting.

- **systemPrompt** (string, optional): Additional system prompt prepended to every request.

- **maxTokens** (number, optional): Maximum output tokens. Default: 4096.

- **temperature** (number, optional): Sampling temperature 0-2. Default: 0.7.

- **timeoutSec** (number, optional): Request timeout in seconds. Default: 120.

## Smart routing modes

| Mode       | Models                          | Best for            |
|------------|---------------------------------|---------------------|
| fast       | Gemini Flash, GPT-4o-mini       | Quick tasks         |
| balanced   | GPT-4o, Claude Sonnet           | General use         |
| powerful   | GPT-5.4, Claude Opus 4.6        | Complex reasoning   |
| cheap      | DeepSeek, Gemini Flash           | High volume         |
| reasoning  | o3, DeepSeek Reasoner            | Logic & math        |

## Pricing

BlockRun charges per-token with a 5% platform margin. Free models (nvidia/gpt-oss-*)
require no wallet or payment. See https://blockrun.ai for current model pricing.

## Wallet setup

1. Create or use an existing Ethereum wallet (e.g., via MetaMask)
2. Bridge USDC to Base network (https://bridge.base.org)
3. Copy the private key (Settings > Security in MetaMask)
4. Paste into the privateKey config field

For testnet: get Base Sepolia USDC from a faucet.
`;
