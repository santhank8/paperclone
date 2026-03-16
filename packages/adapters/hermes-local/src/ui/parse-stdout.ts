/**
 * Parse Hermes stdout lines for UI display.
 */

import type { TranscriptEntry } from "@paperclipai/adapter-utils";
import {
  SESSION_ID_REGEX,
  SESSION_ID_REGEX_LEGACY,
  TOOL_OUTPUT_PREFIX,
  THINKING_PREFIX,
} from "../server/constants.js";

/**
 * Parse a single line of Hermes stdout for display in the UI.
 * Returns an array of TranscriptEntry objects (may be empty).
 */
export function parseHermesStdoutLine(
  line: string,
  ts: string
): TranscriptEntry[] {
  if (!line || !line.trim()) return [];

  // Tool output lines start with ┊
  if (line.startsWith(TOOL_OUTPUT_PREFIX)) {
    const content = line.slice(TOOL_OUTPUT_PREFIX.length).trim();
    // Parse tool output: ┊ 💻 $ command or ┊ 💬 message
    const toolMatch = content.match(/^💻\s*\$\s*(.+)$/s);
    if (toolMatch) {
      // Command execution
      return [{ kind: "stdout", ts, text: `$ ${toolMatch[1].trim()}` }];
    }
    // Regular tool output
    return [{ kind: "stdout", ts, text: content }];
  }

  // Thinking blocks start with 💭
  if (line.startsWith(THINKING_PREFIX)) {
    return [
      { kind: "thinking", ts, text: line.slice(THINKING_PREFIX.length).trim() },
    ];
  }

  // Session ID lines
  const sessionMatch = line.match(SESSION_ID_REGEX) || line.match(SESSION_ID_REGEX_LEGACY);
  if (sessionMatch) {
    return [{ kind: "system", ts, text: `Session: ${sessionMatch[1]}` }];
  }

  // Regular output - just treat as stdout
  return [{ kind: "stdout", ts, text: line }];
}