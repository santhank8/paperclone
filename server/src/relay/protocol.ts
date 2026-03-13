/**
 * Relay tunnel protocol message types.
 *
 * These messages are sent over the persistent WebSocket tunnel between the
 * Paperclip server (tunnel client) and the relay server. The relay forwards
 * HTTP requests and WebSocket frames without inspecting payloads.
 */

// ── Tunnel lifecycle ────────────────────────────────────────────────────────

export interface TunnelReady {
  type: "tunnel-ready";
  instanceId: string;
  publicUrl?: string;
}

// ── HTTP request/response ───────────────────────────────────────────────────

export interface HttpRequest {
  id: string;
  type: "http-request";
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string; // base64-encoded
}

export interface HttpResponse {
  id: string;
  type: "http-response";
  status: number;
  headers: Record<string, string>;
  body: string; // base64-encoded
}

// ── WebSocket bridging ──────────────────────────────────────────────────────

export interface WsOpen {
  type: "ws-open";
  id: string;
  path: string;
  headers: Record<string, string>;
}

export interface WsMessage {
  type: "ws-message";
  id: string;
  data: string;
}

export interface WsClose {
  type: "ws-close";
  id: string;
  code?: number;
}

export interface WsError {
  type: "ws-error";
  id: string;
  message: string;
}

// ── Union type ──────────────────────────────────────────────────────────────

export type TunnelMessage =
  | TunnelReady
  | HttpRequest
  | HttpResponse
  | WsOpen
  | WsMessage
  | WsClose
  | WsError;
