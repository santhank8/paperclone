import type { InstanceLocalesResponse, LocalizationPack } from "@paperclipai/shared";
import { api } from "./client";

export const localesApi = {
  list: () => api.get<InstanceLocalesResponse>("/instance/locales"),
  get: (locale: string) => api.get<LocalizationPack>(`/instance/locales/${encodeURIComponent(locale)}`),
  put: (locale: string, pack: LocalizationPack) =>
    api.put<LocalizationPack>(`/instance/locales/${encodeURIComponent(locale)}`, pack),
};
