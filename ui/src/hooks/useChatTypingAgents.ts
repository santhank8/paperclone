import { useEffect, useRef, useState } from "react";
import type { LiveEvent } from "@paperclipai/shared";

const TYPING_TIMEOUT_MS = 90_000;

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

interface TypingEntry {
  agentId: string;
  expiresAt: number;
}

/**
 * Tracks which agents are currently "typing" (have active heartbeat runs)
 * in a given chat room by listening to live WebSocket events.
 *
 * An agent is considered typing when:
 * - A `heartbeat.run.queued` event fires with invocationSource "chat"
 * - A `heartbeat.run.status` event fires with status "running" and invocationSource "chat"
 *
 * An agent stops typing when:
 * - A `heartbeat.run.status` event fires with a terminal status
 * - A `chat.message.created` event fires with that agent as author in this room
 * - The 90-second timeout expires
 */
export function useChatTypingAgents(
  companyId: string | null,
  roomId: string | null,
  roomAgentId: string | null,
): Set<string> {
  const [typingAgentIds, setTypingAgentIds] = useState<Set<string>>(new Set());
  const entriesRef = useRef<Map<string, TypingEntry>>(new Map());
  const cleanupTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!companyId || !roomId) return;

    let closed = false;
    let reconnectTimer: number | null = null;
    let socket: WebSocket | null = null;

    const syncState = () => {
      const now = Date.now();
      let changed = false;
      for (const [agentId, entry] of entriesRef.current) {
        if (entry.expiresAt <= now) {
          entriesRef.current.delete(agentId);
          changed = true;
        }
      }
      const next = new Set(entriesRef.current.keys());
      setTypingAgentIds((prev) => {
        if (prev.size === next.size && [...prev].every((id) => next.has(id))) return prev;
        return next;
      });

      // Schedule next cleanup
      if (cleanupTimerRef.current !== null) {
        window.clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
      if (entriesRef.current.size > 0) {
        const earliest = Math.min(...[...entriesRef.current.values()].map((e) => e.expiresAt));
        const delay = Math.max(1000, earliest - now);
        cleanupTimerRef.current = window.setTimeout(syncState, delay);
      }
    };

    const addTyping = (agentId: string) => {
      entriesRef.current.set(agentId, {
        agentId,
        expiresAt: Date.now() + TYPING_TIMEOUT_MS,
      });
      syncState();
    };

    const removeTyping = (agentId: string) => {
      if (entriesRef.current.has(agentId)) {
        entriesRef.current.delete(agentId);
        syncState();
      }
    };

    const isTerminalStatus = (status: string) =>
      status === "succeeded" || status === "failed" || status === "cancelled" || status === "timed_out";

    const isRelevantAgent = (agentId: string) => {
      // For direct rooms, only track the room's agent
      if (roomAgentId) return agentId === roomAgentId;
      // For boardroom, track any agent
      return true;
    };

    const scheduleReconnect = () => {
      if (closed) return;
      reconnectTimer = window.setTimeout(connect, 2000);
    };

    const connect = () => {
      if (closed) return;
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${protocol}://${window.location.host}/api/companies/${encodeURIComponent(companyId)}/events/ws`;
      socket = new WebSocket(url);

      socket.onmessage = (message) => {
        const raw = typeof message.data === "string" ? message.data : "";
        if (!raw) return;

        let event: LiveEvent;
        try {
          event = JSON.parse(raw) as LiveEvent;
        } catch {
          return;
        }

        if (event.companyId !== companyId) return;
        const payload = event.payload ?? {};

        if (event.type === "heartbeat.run.queued") {
          const agentId = readString(payload.agentId);
          const invocationSource = readString(payload.invocationSource);
          if (agentId && invocationSource === "chat" && isRelevantAgent(agentId)) {
            addTyping(agentId);
          }
          return;
        }

        if (event.type === "heartbeat.run.status") {
          const agentId = readString(payload.agentId);
          const status = readString(payload.status);
          const invocationSource = readString(payload.invocationSource);
          if (!agentId || !status) return;
          if (isTerminalStatus(status)) {
            removeTyping(agentId);
          } else if (status === "running" && invocationSource === "chat" && isRelevantAgent(agentId)) {
            addTyping(agentId);
          }
          return;
        }

        if (event.type === "chat.message.created") {
          const msgRoomId = readString(payload.chatRoomId);
          const authorAgentId = readString(payload.authorAgentId);
          if (msgRoomId === roomId && authorAgentId) {
            removeTyping(authorAgentId);
          }
          return;
        }
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        if (!closed) scheduleReconnect();
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (cleanupTimerRef.current !== null) window.clearTimeout(cleanupTimerRef.current);
      entriesRef.current.clear();
      if (socket) {
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close(1000, "chat_typing_unmount");
      }
    };
  }, [companyId, roomId, roomAgentId]);

  return typingAgentIds;
}
