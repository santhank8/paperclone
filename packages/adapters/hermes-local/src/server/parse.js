
import { TOOL_NAME_MAP } from '../shared/constants.js';
import { stripAnsi } from '../shared/utils.js';

export const SESSION_ID_REGEX = /^session_id:\s*(\S+)/m;
export const SESSION_ID_REGEX_LEGACY = /session[_ ](?:id|saved)[:\s]+([A-Za-z0-9_-]+)/i;
export const TOKEN_USAGE_REGEX = /tokens?[:\s]+(\d+)\s*(?:input|in)\b.*?(\d+)\s*(?:output|out)\b/i;
export const COST_REGEX = /(?:cost|spent)[:\s]*\$?([\d.]+)/i;
export const UNKNOWN_SESSION_PATTERNS = [
  /unknown session/i,
  /session .* not found/i,
  /resume .* failed/i,
];

const HERMES_BANNER_HEADER_REGEX = /^╭[─\s]*Hermes Agent v/i;
const HERMES_PANEL_HEADER_REGEX = /^╭─\s*⚕\s*Hermes\b/i;
const HERMES_BORDER_FOOTER_REGEX = /^╰[─]+╯$/;
const HERMES_SEPARATOR_REGEX = /^─{8,}$/;
const HERMES_QUERY_HEADER_REGEX = /^Query:\s*/i;
const HERMES_INIT_LINE_REGEX = /^Initializing agent\.\.\.$/i;
const HERMES_RESUME_HEADER_REGEX = /^Resume this session with:$/i;
const HERMES_RESUME_COMMAND_REGEX = /^hermes --resume\b/i;
const HERMES_SESSION_SUMMARY_REGEX = /^(?:Session|Duration|Messages):\s+/i;
const HERMES_DIFF_FILE_HEADER_REGEX = /^(.+?)\s+→\s+(.+)$/u;
const HERMES_DIFF_TRUNCATION_REGEX = /^… omitted \d+ diff line\(s\)/u;
const HERMES_TOOL_DURATION_REGEX = /\s+(\d+(?:\.\d+)?s)\s*(?:\(([\d.]+s)\))?\s*$/i;
const HERMES_TOOL_FAILURE_REGEX = /\s+\[(error|full|exit \d+)\]\s*$/i;
const HERMES_PREPARING_TOOL_REGEX = /^preparing\s+([a-z0-9_:-]+)…$/i;

function normalizeHermesLine(value) {
  return stripAnsi(value).replace(/\r/g, '').trimEnd();
}

function isHermesBannerHeader(line) {
  return HERMES_BANNER_HEADER_REGEX.test(line);
}

function isHermesPanelHeader(line) {
  return HERMES_PANEL_HEADER_REGEX.test(line);
}

function isHermesPanelFooter(line) {
  return HERMES_BORDER_FOOTER_REGEX.test(line);
}

function isHermesSessionIdLine(line) {
  return SESSION_ID_REGEX.test(line);
}

function isHermesSessionSummaryLine(line) {
  return HERMES_SESSION_SUMMARY_REGEX.test(line);
}

function isHermesResumeHeader(line) {
  return HERMES_RESUME_HEADER_REGEX.test(line);
}

function isHermesResumeCommand(line) {
  return HERMES_RESUME_COMMAND_REGEX.test(line);
}

function isHermesQueryHeader(line) {
  return HERMES_QUERY_HEADER_REGEX.test(line);
}

function isHermesInitLine(line) {
  return HERMES_INIT_LINE_REGEX.test(line);
}

function isHermesSeparatorLine(line) {
  return HERMES_SEPARATOR_REGEX.test(line);
}

function isHermesSuppressedMetadataLine(line) {
  return (
    isHermesSessionIdLine(line)
    || isHermesResumeHeader(line)
    || isHermesResumeCommand(line)
    || isHermesSessionSummaryLine(line)
    || isHermesInitLine(line)
    || isHermesSeparatorLine(line)
  );
}

function isHermesQueryTerminator(line) {
  return (
    isHermesInitLine(line)
    || isHermesSeparatorLine(line)
    || isHermesPanelHeader(line)
    || isHermesResumeHeader(line)
    || isHermesSessionIdLine(line)
    || parseToolCompletionLine(line) !== null
  );
}

function normalizeHermesPanelContent(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith('│') && trimmed.endsWith('│')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function cleanupAssistantBlock(lines) {
  const normalized = [];
  let blankStreak = 0;
  for (const rawLine of lines) {
    const line = normalizeHermesPanelContent(rawLine);
    if (!line) {
      blankStreak += 1;
      if (blankStreak <= 1) normalized.push('');
      continue;
    }
    blankStreak = 0;
    normalized.push(line);
  }

  while (normalized[0] === '') normalized.shift();
  while (normalized[normalized.length - 1] === '') normalized.pop();
  return normalized.join('\n').trim();
}

function extractHermesResponseBlocks(stdout) {
  const lines = stripAnsi(stdout).replace(/\r/g, '').split('\n');
  const blocks = [];
  let inBanner = false;
  let inQuery = false;
  let inResponsePanel = false;
  let currentBlock = [];

  const flushBlock = () => {
    if (currentBlock.length === 0) return;
    const text = cleanupAssistantBlock(currentBlock);
    currentBlock = [];
    if (text) blocks.push(text);
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      if (inResponsePanel) currentBlock.push('');
      continue;
    }

    if (inBanner) {
      if (isHermesPanelFooter(trimmed)) inBanner = false;
      continue;
    }

    if (isHermesBannerHeader(trimmed)) {
      inBanner = true;
      continue;
    }

    if (inQuery) {
      if (isHermesQueryTerminator(trimmed)) {
        inQuery = false;
      } else {
        continue;
      }
    }

    if (inResponsePanel) {
      if (
        isHermesPanelHeader(trimmed)
        || isHermesPanelFooter(trimmed)
        || isHermesResumeHeader(trimmed)
        || isHermesSessionIdLine(trimmed)
      ) {
        flushBlock();
        inResponsePanel = false;
        if (isHermesPanelHeader(trimmed)) inResponsePanel = true;
        continue;
      }
      currentBlock.push(line);
      continue;
    }

    if (isHermesQueryHeader(trimmed)) {
      inQuery = true;
      continue;
    }

    if (isHermesPanelHeader(trimmed)) {
      inResponsePanel = true;
      continue;
    }

    if (isHermesSuppressedMetadataLine(trimmed)) {
      continue;
    }
  }

  if (inResponsePanel) flushBlock();
  return blocks;
}

function fallbackCleanResponse(value) {
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
 * @param {string} value
 */
export function cleanResponse(value) {
  const responseBlocks = extractHermesResponseBlocks(value);
  if (responseBlocks.length > 0) {
    return responseBlocks.join('\n\n').trim();
  }
  return fallbackCleanResponse(value);
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

function stripHermesToolPrefix(line) {
  let cleaned = line.replace(/^\[done\]\s*/i, '').trim();
  if (!cleaned.includes('┊')) return null;
  cleaned = cleaned.slice(cleaned.indexOf('┊') + 1).trim();
  if (!cleaned) return null;

  const failureMatch = cleaned.match(HERMES_TOOL_FAILURE_REGEX);
  const failureLabel = failureMatch?.[1]?.toLowerCase() || null;
  if (failureMatch) {
    cleaned = cleaned.slice(0, failureMatch.index).trimEnd();
  }

  const durationMatch = cleaned.match(HERMES_TOOL_DURATION_REGEX);
  const duration = durationMatch?.[1] || '';
  if (durationMatch) {
    cleaned = cleaned.slice(0, durationMatch.index).trimEnd();
  }

  cleaned = cleaned.replace(/^[^A-Za-z0-9$]+/u, '').trimStart();
  return {
    display: cleaned,
    duration,
    hasError: Boolean(failureLabel),
    failureLabel,
  };
}

function parseHermesToolLabel(display) {
  const matchers = [
    { pattern: /^\$\s+(.*)$/i, name: 'shell', buildInput: (detail) => ({ command: detail }) },
    { pattern: /^proc\s+(.*)$/i, name: 'process', buildInput: (detail) => ({ target: detail }) },
    { pattern: /^read\s+(.*)$/i, name: 'read', buildInput: (detail) => ({ path: detail }) },
    { pattern: /^write\s+(.*)$/i, name: 'write', buildInput: (detail) => ({ path: detail }) },
    { pattern: /^patch\s+(.*)$/i, name: 'patch', buildInput: (detail) => ({ path: detail }) },
    { pattern: /^(?:grep|find)\s+(.*)$/i, name: 'search', buildInput: (detail) => ({ pattern: detail }) },
    { pattern: /^navigate\s+(.*)$/i, name: 'browser', buildInput: (detail) => ({ url: detail }) },
    { pattern: /^(?:snapshot|click|scroll|back|press|close|images|vision)\b(?:\s+(.*))?$/i, name: 'browser', buildInput: (detail) => ({ target: detail || 'browser' }) },
    { pattern: /^type\s+(.*)$/i, name: 'browser', buildInput: (detail) => ({ text: detail }) },
    { pattern: /^plan\b(?:\s+(.*))?$/i, name: 'plan', buildInput: (detail) => ({ target: detail || 'plan' }) },
    { pattern: /^recall\s+(.*)$/i, name: 'recall', buildInput: (detail) => ({ query: detail }) },
    { pattern: /^memory\b(?:\s+(.*))?$/i, name: 'memory', buildInput: (detail) => ({ target: detail || 'memory' }) },
    { pattern: /^skills?\s+(.*)$/i, name: 'skill', buildInput: (detail) => ({ name: detail }) },
    { pattern: /^create\s+(.*)$/i, name: 'image', buildInput: (detail) => ({ prompt: detail }) },
    { pattern: /^speak\s+(.*)$/i, name: 'speech', buildInput: (detail) => ({ text: detail }) },
    { pattern: /^reason\s+(.*)$/i, name: 'reason', buildInput: (detail) => ({ prompt: detail }) },
    { pattern: /^send\s+(.*)$/i, name: 'message', buildInput: (detail) => ({ message: detail }) },
    { pattern: /^cron\b(?:\s+(.*))?$/i, name: 'cron', buildInput: (detail) => ({ target: detail || 'cron' }) },
    { pattern: /^rl\b(?:\s+(.*))?$/i, name: 'rl', buildInput: (detail) => ({ target: detail || 'rl' }) },
    { pattern: /^exec\s+(.*)$/i, name: 'execute_code', buildInput: (detail) => ({ command: detail }) },
    { pattern: /^delegate\s+(.*)$/i, name: 'delegate', buildInput: (detail) => ({ target: detail }) },
  ];

  for (const matcher of matchers) {
    const match = display.match(matcher.pattern);
    if (!match) continue;
    const detail = (match[1] || '').trim();
    return {
      name: matcher.name,
      detail,
      input: matcher.buildInput(detail),
    };
  }

  const generic = display.match(/^([a-z0-9_.-]+)\b(?:\s+(.*))?$/i);
  if (!generic) return null;
  const verb = generic[1];
  const detail = (generic[2] || '').trim();
  return {
    name: TOOL_NAME_MAP[verb.toLowerCase()] || verb,
    detail,
    input: detail ? { target: detail } : {},
  };
}

/**
 * Lightweight parser for Hermes transcript stdout lines.
 *
 * @param {string} line
 * @param {string} ts
 */
export function parseHermesStdoutLine(line, ts) {
  return createHermesStdoutParser().parseLine(line, ts);
}

/**
 * @param {string} line
 */
export function parseToolCompletionLine(line) {
  const normalized = normalizeHermesLine(line).trim();
  const stripped = stripHermesToolPrefix(normalized);
  if (!stripped?.display) return null;
  if (HERMES_PREPARING_TOOL_REGEX.test(stripped.display)) return null;

  const parsed = parseHermesToolLabel(stripped.display);
  if (!parsed) return null;
  const resultLines = [`status: ${stripped.hasError ? 'failed' : 'completed'}`];
  if (stripped.failureLabel?.startsWith('exit ')) {
    resultLines.push(`exit_code: ${stripped.failureLabel.slice('exit '.length)}`);
  }
  if (stripped.duration) resultLines.push(`duration: ${stripped.duration}`);
  if (parsed.detail) {
    resultLines.push('');
    resultLines.push(parsed.detail);
  }

  return {
    name: parsed.name,
    detail: parsed.detail,
    input: parsed.input,
    detailWithDuration: resultLines.join('\n').trim(),
    hasError: stripped.hasError,
  };
}

function parseHermesDiffLine(line, ts) {
  if (HERMES_DIFF_TRUNCATION_REGEX.test(line)) {
    return { kind: 'diff', ts, changeType: 'truncation', text: line };
  }

  const fileHeader = line.match(HERMES_DIFF_FILE_HEADER_REGEX);
  if (fileHeader) {
    return { kind: 'diff', ts, changeType: 'file_header', text: `${fileHeader[1]} -> ${fileHeader[2]}` };
  }
  if (line.startsWith('@@')) {
    return { kind: 'diff', ts, changeType: 'hunk', text: line };
  }
  if (line.startsWith('+')) {
    return { kind: 'diff', ts, changeType: 'add', text: line };
  }
  if (line.startsWith('-')) {
    return { kind: 'diff', ts, changeType: 'remove', text: line };
  }
  return { kind: 'diff', ts, changeType: 'context', text: line };
}

export function createHermesStdoutParser() {
  let inBanner = false;
  let inQuery = false;
  let inResponsePanel = false;
  let inResumeHint = false;
  let inDiffPreview = false;

  return {
    parseLine(line, ts) {
      const normalized = normalizeHermesLine(line);
      const trimmed = normalized.trim();
      if (!trimmed) return [];

      if (inBanner) {
        if (isHermesPanelFooter(trimmed)) inBanner = false;
        return [];
      }

      if (isHermesBannerHeader(trimmed)) {
        inBanner = true;
        return [];
      }

      if (inQuery) {
        if (isHermesQueryTerminator(trimmed)) {
          inQuery = false;
        } else {
          return [];
        }
      }

      if (inResponsePanel) {
        if (isHermesPanelFooter(trimmed)) {
          inResponsePanel = false;
          return [];
        }
        if (isHermesSessionIdLine(trimmed)) {
          inResponsePanel = false;
          return [];
        }
        if (isHermesResumeHeader(trimmed)) {
          inResponsePanel = false;
          inResumeHint = true;
          return [];
        }
        if (isHermesPanelHeader(trimmed)) {
          return [];
        }
        return [{ kind: 'assistant', ts, text: normalizeHermesPanelContent(normalized) }];
      }

      if (inResumeHint) {
        if (isHermesResumeCommand(trimmed) || isHermesSessionSummaryLine(trimmed)) {
          return [];
        }
        inResumeHint = false;
      }

      if (inDiffPreview) {
        if (isHermesPanelHeader(trimmed)) {
          inDiffPreview = false;
          inResponsePanel = true;
          return [];
        }
        if (isHermesSuppressedMetadataLine(trimmed)) {
          inDiffPreview = false;
          if (isHermesResumeHeader(trimmed)) inResumeHint = true;
          return [];
        }
        if (trimmed.startsWith('┊ review diff')) {
          return [];
        }
        return [parseHermesDiffLine(trimmed, ts)];
      }

      if (trimmed.startsWith('[hermes]') || trimmed.startsWith('[paperclip]')) {
        return [{ kind: 'system', ts, text: trimmed }];
      }

      if (/^\[\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
        return [{ kind: 'stderr', ts, text: trimmed }];
      }

      if (isHermesPanelHeader(trimmed)) {
        inResponsePanel = true;
        return [];
      }

      if (isHermesQueryHeader(trimmed)) {
        inQuery = true;
        return [];
      }

      if (isHermesResumeHeader(trimmed)) {
        inResumeHint = true;
        return [];
      }

      if (isHermesSuppressedMetadataLine(trimmed)) {
        return [];
      }

      if (/^┊\s*review diff$/i.test(trimmed) || /^\[done\]\s*┊\s*review diff$/i.test(trimmed)) {
        inDiffPreview = true;
        return [];
      }

      if (/^┊\s*💬/.test(trimmed)) {
        return [{ kind: 'assistant', ts, text: trimmed.replace(/^┊\s*💬\s*/, '') }];
      }

      const preparing = stripHermesToolPrefix(trimmed)?.display.match(HERMES_PREPARING_TOOL_REGEX);
      if (preparing) {
        return [];
      }

      const tool = parseToolCompletionLine(trimmed);
      if (tool) {
        const toolUseId = `hermes-tool-${stableToolId(trimmed, ts)}`;
        return [
          { kind: 'tool_call', ts, name: tool.name, input: tool.input, toolUseId },
          { kind: 'tool_result', ts, toolUseId, toolName: tool.name, content: tool.detailWithDuration, isError: tool.hasError },
        ];
      }

      if (/error|traceback/i.test(trimmed)) {
        return [{ kind: 'stderr', ts, text: trimmed }];
      }

      return [{ kind: 'assistant', ts, text: trimmed }];
    },
    reset() {
      inBanner = false;
      inQuery = false;
      inResponsePanel = false;
      inResumeHint = false;
      inDiffPreview = false;
    },
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
