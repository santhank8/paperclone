/**
 * Reads the application name injected by the server.
 *
 * The server sets `PAPERCLIP_APP_NAME` which is injected into the HTML
 * as `<meta name="paperclip-app-name" content="...">` at serve time.
 * This lets self-hosters rebrand their deployment without forking.
 *
 * Falls back to "Paperclip" when the meta tag is absent (default deployment).
 */
export function getAppName(): string {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="paperclip-app-name"]');
  const value = meta?.content?.trim();
  return value && value.length > 0 ? value : "Paperclip";
}
