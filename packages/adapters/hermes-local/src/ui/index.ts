/**
 * UI module exports — used by Paperclip's dashboard for run viewing
 * and agent configuration forms.
 */

import type { StdoutLineParser } from "@paperclipai/adapter-utils";
import { parseHermesStdoutLine as parseLine } from "./parse-stdout.js";

// Re-export for consumers
export { buildHermesConfig } from "./build-config.js";

// Wrap parser to match expected signature (ts is already correct, but explicit export)
export const parseHermesStdoutLine: StdoutLineParser = parseLine;