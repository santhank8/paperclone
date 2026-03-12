export { execute } from "./execute.js";
export { testEnvironment } from "./test.js";

/**
 * Dynamically fetch the full model catalog from the BlockRun API.
 * Falls back to the static list in ../index.ts if the API is unreachable.
 */
export async function listModels(): Promise<
  Array<{ id: string; label: string }>
> {
  try {
    const res = await fetch("https://blockrun.ai/api/v1/models", {
      method: "GET",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      data?: Array<{
        id?: string;
        owned_by?: string;
        billing_mode?: string;
        pricing?: { input?: number; output?: number; flat?: number };
      }>;
    };

    if (!Array.isArray(data.data)) return [];

    return data.data
      .filter((m) => typeof m.id === "string")
      .map((m) => {
        const id = m.id!;
        const parts = id.split("/");
        const provider = parts[0] ?? "";
        const name = parts.slice(1).join("/");
        const providerLabel =
          provider.charAt(0).toUpperCase() + provider.slice(1);
        const modelLabel = name
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
        const free = m.billing_mode === "free" ? " (Free)" : "";
        return { id, label: `${providerLabel} ${modelLabel}${free}` };
      });
  } catch {
    return [];
  }
}
