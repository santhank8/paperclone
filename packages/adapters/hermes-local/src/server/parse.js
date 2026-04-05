
import { TOOL_NAME_MAP } from '../shared/constants.js';
import { firstNonEmptyLine, stripAnsi } from '../shared/utils.js';

export const SESSION_ID_REGEX = /^session_id:\s*(\S+)/m;
export const SESSION_ID_REGEX_LEGACY = /session[_ ](?:id|saved)[:\s]+([A-Za-z0-9_-]+)/i;
export const TOKEN_USAGE_REGEX = /tokens?[:\s]+(\d+)\s*(?:input|in)\b.*?(\d+)\s*(?:output|out)\b/i;
export const COST_REGEX = /(?:cost|spent)[:\s]*\$?([\d.]+)/i;
export const UNKNOWN_SESSION_PATTERNS = [
  /unknown session/i,
  /session .* not found/i,
  /resume .* failed/i,
];

/**
 * @param {string} value
 */
export function cleanResponse(value) {
  return stripAnsi(value)
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (trimmed.startsWith('[tool]')) return false;
      if (trimmed.startsWith('[hermes]')) return false;
      if (trimmed.startsWith('[paperclip]')) return false;
      if (trimmed.startsWith('session_id:')) return false;
      if (/^\[\d{4}-\d{2}-\d{2}T/.test(trimmed)) return false;
      if (/^\[done\]\s*┊/.test(trimmed)) return false;
      if (/^┊\s*[^\w\s]/u.test(trimmed) && !/^┊\s*💬/.test(trimmed)) return false;
      return true;
    })
    .map((line) => line.replace(/^\s*┊\s*💬\s*/, '').replace(/^\[done\]\s*/, '').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @param {string} stdout
 * @param {string} stderr
 */
export function parseHermesOutput(stdout, stderr) {
  const result = {
    sessionId: null,
    response: '',
    usage: null,
    costUsd: null,
    errorMessage: '',
  };

  const sessionMatch = stdout.match(SESSION_ID_REGEX);
  if (sessionMatch?.[1]) {
    result.sessionId = sessionMatch[1];
    const index = stdout.lastIndexOf('\nsession_id:');
    result.response = cleanResponse(index > 0 ? stdout.slice(0, index) : stdout.replace(SESSION_ID_REGEX, ''));
  } else {
    const combined = `${stdout}\n${stderr}`;
    const legacy = combined.match(SESSION_ID_REGEX_LEGACY);
    if (legacy?.[1]) result.sessionId = legacy[1];
    result.response = cleanResponse(stdout);
  }

  const usageMatch = `${stdout}\n${stderr}`.match(TOKEN_USAGE_REGEX);
  if (usageMatch) {
    result.usage = {
      inputTokens: Number(usageMatch[1]) || 0,
      outputTokens: Number(usageMatch[2]) || 0,
    };
  }

  const costMatch = `${stdout}\n${stderr}`.match(COST_REGEX);
  if (costMatch?.[1]) result.costUsd = Number(costMatch[1]);

  const errorLines = stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /error|exception|traceback|failed/i.test(line))
    .filter((line) => !/INFO|DEBUG|WARN|WARNING/.test(line));

  if (errorLines.length) result.errorMessage = errorLines.slice(0, 5).join('\n');

  return result;
}

export function isUnknownSessionError(stdout, stderr) {
  const combined = `${stdout}\n${stderr}`;
  return UNKNOWN_SESSION_PATTERNS.some((pattern) => pattern.test(combined));
}

/**
 * Lightweight parser for Hermes transcript stdout lines.
 *
 * @param {string} line
 * @param {string} ts
 */
export function parseHermesStdoutLine(line, ts) {
  const trimmed = line.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[hermes]') || trimmed.startsWith('[paperclip]')) {
    return [{ kind: 'system', ts, text: trimmed }];
  }

  if (trimmed.startsWith('session_id:')) {
    return [{ kind: 'system', ts, text: trimmed }];
  }

  if (/^\[\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    return [{ kind: 'stderr', ts, text: trimmed }];
  }

  if (/^┊\s*💬/.test(trimmed)) {
    return [{ kind: 'assistant', ts, text: trimmed.replace(/^┊\s*💬\s*/, '') }];
  }

  const tool = parseToolCompletionLine(trimmed);
  if (tool) {
    const toolUseId = `hermes-tool-${stableToolId(trimmed, ts)}`;
    return [
      { kind: 'tool_call', ts, name: tool.name, input: { detail: tool.detail }, toolUseId },
      { kind: 'tool_result', ts, toolUseId, content: tool.detailWithDuration, isError: tool.hasError },
    ];
  }

  if (/error|traceback/i.test(trimmed)) {
    return [{ kind: 'stderr', ts, text: trimmed }];
  }

  return [{ kind: 'assistant', ts, text: trimmed }];
}

/**
 * @param {string} line
 */
export function parseToolCompletionLine(line) {
  let cleaned = line.replace(/^\[done\]\s*/, '').trim();
  if (!cleaned.startsWith('┊')) return null;
  cleaned = cleaned.slice(1).trim();

  const durationMatch = cleaned.match(/([\d.]+s)\s*(?:\([\d.]+s\))?\s*$/);
  const duration = durationMatch?.[1] || '';
  const prefix = durationMatch ? cleaned.slice(0, cleaned.lastIndexOf(durationMatch[0])).trim() : cleaned;
  const verbMatch = prefix.match(/^(\S+)\s+(.*)$/);
  if (!verbMatch) return null;

  const verb = verbMatch[1];
  const detail = verbMatch[2].trim();
  const toolName = TOOL_NAME_MAP[verb.toLowerCase()] || verb;
  const hasError = /\[(?:error|exit \d+|full)\]/i.test(prefix);
  return {
    name: toolName,
    detail,
    detailWithDuration: duration ? `${detail}  ${duration}` : detail,
    hasError,
  };
}

/**
 * @param {string} raw
 * @param {string} ts
 */
function stableToolId(raw, ts) {
  const source = `${ts}:${raw}`;
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}
