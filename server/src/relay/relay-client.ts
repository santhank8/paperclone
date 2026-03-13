/**
 * Relay tunnel client. Maintains an outbound WebSocket connection to the relay
 * server and dispatches incoming messages to the HTTP forwarder and WS bridge.
 */

import { createRequire } from "node:module";
import { forwardHttpRequest } from "./http-forwarder.js";
import { handleWsOpen, handleWsMessage, handleWsClose, closeAllBridges } from "./ws-bridge.js";
import type { TunnelMessage } from "./protocol.js";
import { logger } from "../middleware/logger.js";

const require = createRequire(import.meta.url);
const WS = require("ws") as { new (url: string, opts?: { headers?: Record<string, string> }): WsInstance; OPEN: number };

interface WsInstance {
  readyState: number;
  on(event: string, cb: (...args: any[]) => void): void;
  send(data: string): void;
  close(code?: number): void;
}

const BACKOFF_SCHEDULE = [1000, 2000, 5000, 10_000, 30_000];

export interface RelayClientOptions {
  relayUrl: string;
  relayToken: string;
  localPort: number;
  onReady?: (instanceId: string, publicUrl: string) => void;
}

export function startRelayClient(opts: RelayClientOptions): { close: () => void } {
  let ws: WsInstance | null = null;
  let closed = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function send(msg: TunnelMessage): void {
    if (ws && ws.readyState === WS.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function connect(): void {
    if (closed) return;

    const url = `${opts.relayUrl}/tunnel`;
    ws = new WS(url, {
      headers: { authorization: `Bearer ${opts.relayToken}` },
    });

    ws.on("open", () => {
      reconnectAttempt = 0;
      logger.info("Relay tunnel WebSocket connected");
    });

    ws.on("message", (data: { toString(): string }) => {
      let msg: TunnelMessage;
      try {
        msg = JSON.parse(data.toString()) as TunnelMessage;
      } catch {
        logger.warn("Relay: received unparseable message");
        return;
      }

      switch (msg.type) {
        case "tunnel-ready": {
          // Construct the public URL from the relay base URL (wss:// → https://)
          const relayOrigin = opts.relayUrl.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
          const publicUrl = msg.publicUrl || relayOrigin;
          logger.info({ instanceId: msg.instanceId, publicUrl }, "Relay tunnel ready");
          opts.onReady?.(msg.instanceId, publicUrl);
          break;
        }

        case "http-request":
          forwardHttpRequest(msg, opts.localPort)
            .then((res) => send(res))
            .catch((err) => {
              logger.error({ err, requestId: msg.id }, "Relay: failed to forward HTTP request");
              send({
                id: msg.id,
                type: "http-response",
                status: 502,
                headers: { "content-type": "text/plain" },
                body: Buffer.from("Bad Gateway: local server unreachable").toString("base64"),
              });
            });
          break;

        case "ws-open":
          handleWsOpen(msg, opts.localPort, send);
          break;

        case "ws-message":
          handleWsMessage(msg);
          break;

        case "ws-close":
          handleWsClose(msg);
          break;

        default:
          break;
      }
    });

    ws.on("close", () => {
      closeAllBridges();
      scheduleReconnect();
    });

    ws.on("error", (err: Error) => {
      logger.warn({ err: err.message }, "Relay tunnel WebSocket error");
    });
  }

  function scheduleReconnect(): void {
    if (closed) return;
    const delay = BACKOFF_SCHEDULE[Math.min(reconnectAttempt, BACKOFF_SCHEDULE.length - 1)];
    reconnectAttempt++;
    logger.info({ delay, attempt: reconnectAttempt }, "Relay: reconnecting");
    reconnectTimer = setTimeout(connect, delay);
  }

  connect();

  return {
    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      closeAllBridges();
      if (ws) {
        ws.close(1000);
        ws = null;
      }
    },
  };
}
