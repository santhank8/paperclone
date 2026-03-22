export function formatMessage(template: string, params?: Record<string, string | number | boolean | null | undefined>) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? "" : String(value);
  });
}
