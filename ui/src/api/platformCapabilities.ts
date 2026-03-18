import type { PlatformCapabilitiesPayload } from "@paperclipai/shared";
import { api } from "./client";

export const platformCapabilitiesApi = {
  get: () => api.get<PlatformCapabilitiesPayload>("/platform/capabilities"),
};
