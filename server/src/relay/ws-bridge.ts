/**
 * Bridges WebSocket connections from the relay tunnel to local Paperclip
 * WebSocket endpoints. Each bridged connection is identified by a unique ID.
 */

import { createRequire } from "node:module";
import type { WsOpen, WsMessage, WsClose, TunnelMessage } from "./protocol.js";

const require = createRequire(import.meta.url);
const WS = require("ws") as { new (url: string, opts?: object): WsInstance; OPEN: number };

interface WsInstance {
  readyState: number;
  on(event: string, cb: (...args: any[]) => void): void;
  send(data: string): void;
  close(code?: number): void;
}

type SendFn = (msg: TunnelMessage) => void;

// Module-level singleton — safe because a single Paperclip server runs one
// relay client at a time, so all bridged connections share one map.
const activeBridges = new Map<string, WsInstance>();

export function handleWsOpen(msg: WsOpen, localPort: number, send: SendFn): void {
  const url = `ws://127.0.0.1:${localPort}${msg.path}`;

  const headers: Record<string, string> = { ...msg.headers };
  headers.host = `127.0.0.1:${localPort}`;

  const localWs = new WS(url, { headers });

  localWs.on("open", () => {
    activeBridges.set(msg.id, localWs);
  });

  localWs.on("message", (data: { toString(): string }) => {
    send({
      type: "ws-message",
      id: msg.id,
      data: data.toString(),
    });
  });

  localWs.on("close", (code: number) => {
    activeBridges.delete(msg.id);
    send({
      type: "ws-close",
      id: msg.id,
      code,
    });
  });

  localWs.on("error", (err: Error) => {
    activeBridges.delete(msg.id);
    send({
      type: "ws-error",
      id: msg.id,
      message: err.message,
    });
  });
}

export function handleWsMessage(msg: WsMessage): void {
  const localWs = activeBridges.get(msg.id);
  if (localWs && localWs.readyState === WS.OPEN) {
    localWs.send(msg.data);
  }
}

export function handleWsClose(msg: WsClose): void {
  const localWs = activeBridges.get(msg.id);
  if (localWs) {
    activeBridges.delete(msg.id);
    try {
      localWs.close(msg.code ?? 1000);
    } catch {
      localWs.close(1000);
    }
  }
}

export function closeAllBridges(): void {
  activeBridges.forEach((ws, id) => {
    ws.close(1001);
    activeBridges.delete(id);
  });
}
