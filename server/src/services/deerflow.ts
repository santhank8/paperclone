const DEERFLOW_GATEWAY_URL =
  process.env.DEERFLOW_GATEWAY_URL ?? "http://deerflow-gateway:8001";

export const DEERFLOW_LANGGRAPH_URL =
  process.env.DEERFLOW_LANGGRAPH_URL ?? "http://deerflow-langgraph:2024";

/**
 * Check whether the DeerFlow gateway is reachable and healthy.
 * Returns `true` when the gateway responds with an HTTP 2xx within 3 s.
 */
export async function isDeerflowAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${DEERFLOW_GATEWAY_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export { DEERFLOW_GATEWAY_URL };
