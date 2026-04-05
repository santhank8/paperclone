import type { TranscriptEntry } from "@paperclipai/adapter-utils";

export function buildHermesConfig(values: Record<string, unknown>): Record<string, unknown>;
export function parseEnvText(text: string): Record<string, string>;
export function parseHermesStdoutLine(line: string, ts: string): TranscriptEntry[];
