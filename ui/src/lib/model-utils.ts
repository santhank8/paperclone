export function extractProviderId(modelId: string): string | null {
  const trimmed = modelId.trim();
  if (!trimmed.includes("/")) return null;
  const provider = trimmed.slice(0, trimmed.indexOf("/")).trim();
  return provider || null;
}

export function extractProviderIdWithFallback(modelId: string, fallback = "other"): string {
  return extractProviderId(modelId) ?? fallback;
}

export function extractModelName(modelId: string): string {
  const trimmed = modelId.trim();
  if (!trimmed.includes("/")) return trimmed;
  return trimmed.slice(trimmed.indexOf("/") + 1).trim();
}

export function isProviderModelId(modelId: string): boolean {
  const trimmed = modelId.trim();
  if (!trimmed.includes("/")) return false;
  const slashIndex = trimmed.indexOf("/");
  const provider = trimmed.slice(0, slashIndex).trim();
  const model = trimmed.slice(slashIndex + 1).trim();
  return provider.length > 0 && model.length > 0;
}

export function shouldOfferCustomModelEntry(
  search: string,
  modelIds: readonly string[],
): boolean {
  const trimmed = search.trim();
  if (!isProviderModelId(trimmed)) return false;
  return !modelIds.some((modelId) => modelId === trimmed);
}
