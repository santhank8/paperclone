import { useQuery } from "@tanstack/react-query";
import { healthApi } from "../api/health";
import { queryKeys } from "../lib/queryKeys";

/**
 * Returns `true` when the instance is running in FleetOS (Raava) mode.
 * Uses the cached health query so there is no extra network request.
 */
export function useIsRaava(): boolean {
  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    staleTime: 60_000,
  });
  return healthQuery.data?.deploymentMode === "fleetos";
}
