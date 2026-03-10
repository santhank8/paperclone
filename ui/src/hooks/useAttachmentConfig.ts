import { useQuery } from "@tanstack/react-query";
import { healthApi } from "../api/health";
import { queryKeys } from "../lib/queryKeys";

const DEFAULT_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/**
 * Returns the `accept` attribute value for file inputs,
 * derived from the server's allowed attachment types configuration.
 */
export function useAttachmentConfig() {
  const { data } = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    staleTime: Infinity, // already fetched at app boot
  });

  const types = data?.allowedAttachmentTypes;
  const accept = types && types.length > 0 ? types.join(",") : DEFAULT_ACCEPT;

  return { accept };
}
