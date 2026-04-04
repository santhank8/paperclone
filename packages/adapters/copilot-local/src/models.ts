export const GITHUB_MODELS = [
  { id: "gpt-4o", label: "GPT-4o", provider: "openai", contextLength: 128000 },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai", contextLength: 128000 },
  { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet", provider: "anthropic", contextLength: 200000 },
  { id: "claude-3-5-haiku", label: "Claude 3.5 Haiku", provider: "anthropic", contextLength: 200000 },
  { id: "llama-3.3-70b-instruct", label: "Llama 3.3 70B", provider: "meta", contextLength: 128000 },
  { id: "mistral-large", label: "Mistral Large", provider: "mistral", contextLength: 128000 },
];

export const DEFAULT_GITHUB_MODEL = "gpt-4o";
