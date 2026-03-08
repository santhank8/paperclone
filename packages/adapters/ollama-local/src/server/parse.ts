
import type { AdapterSessionCodec } from "@paperclipai/adapter-utils";

export const sessionCodec: AdapterSessionCodec = {
  deserialize: (session: unknown) => {
    if (session && typeof session === 'object') return session as Record<string, unknown>;
    return { type: "ollama" };
  },
  serialize: (session: Record<string, unknown> | null) => session || { type: "ollama" },
  getDisplayId: (session) => {
    return null;
  },
};
