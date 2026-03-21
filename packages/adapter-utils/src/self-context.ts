/**
 * Extracts the pre-rendered selfContext from an AdapterExecutionContext and
 * wraps it in XML-style delimiters so the model can clearly parse it.
 */
export function formatSelfContextBlock(selfContext: string | undefined): string {
  if (!selfContext) return "";
  return `<agent-context>\n${selfContext}\n</agent-context>\n\n`;
}
