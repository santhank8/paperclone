/**
 * Parse Hermes stdout lines for UI display.
 */

import {
  SESSION_ID_REGEX,
  SESSION_ID_REGEX_LEGACY,
  TOOL_OUTPUT_PREFIX,
  THINKING_PREFIX,
} from "../server/constants.js";

export interface ParsedStdoutLine {
  type: "tool" | "thinking" | "session" | "output";
  content: string;
  toolName?: string;
}

/**
 * Parse a single line of Hermes stdout for display in the UI.
 */
export function parseHermesStdoutLine(line: string): ParsedStdoutLine | null {
  if (!line || !line.trim()) return null;

  // Tool output lines start with ┊
  if (line.startsWith(TOOL_OUTPUT_PREFIX)) {
    const content = line.slice(TOOL_OUTPUT_PREFIX.length).trim();
    const toolMatch = content.match(/^\[(\w+)\]/);
    return {
      type: "tool",
      content,
      toolName: toolMatch?.[1],
    };
  }

  // Thinking blocks start with 💭
  if (line.startsWith(THINKING_PREFIX)) {
    return {
      type: "thinking",
      content: line.slice(THINKING_PREFIX.length).trim(),
    };
  }

  // Session ID lines
  const sessionMatch = line.match(SESSION_ID_REGEX) || line.match(SESSION_ID_REGEX_LEGACY);
  if (sessionMatch) {
    return {
      type: "session",
      content: sessionMatch[1],
    };
  }

  // Regular output
  return {
    type: "output",
    content: line,
  };
}