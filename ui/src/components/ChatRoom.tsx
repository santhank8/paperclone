import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Agent, ChatMessage } from "@paperclipai/shared";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Identity } from "./Identity";
import { AgentIcon } from "./AgentIconPicker";
import { MarkdownBody } from "./MarkdownBody";
import { chatApi } from "../api/chat";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { cn, formatDateTime } from "../lib/utils";
import { useChatTypingAgents } from "../hooks/useChatTypingAgents";

interface ChatRoomProps {
  roomId: string;
  /** For direct rooms, the agent on the other side. null for boardroom. */
  roomAgentId?: string | null;
  agentMap?: Map<string, Agent>;
}

export function ChatRoom({ roomId, roomAgentId, agentMap }: ChatRoomProps) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const typingAgentIds = useChatTypingAgents(selectedCompanyId ?? null, roomId, roomAgentId ?? null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: queryKeys.chat.messages(roomId),
    queryFn: () => chatApi.listMessages(selectedCompanyId!, roomId, { limit: 100 }),
    enabled: Boolean(selectedCompanyId && roomId),
    refetchInterval: 10_000,
  });

  // Messages come newest-first from API, reverse for display
  const sorted = [...messages].reverse();

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      if (!selectedCompanyId) throw new Error("No company selected");
      return chatApi.postMessage(selectedCompanyId, roomId, { body });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(roomId) });
      setAutoScroll(true);
    },
  });

  const handleSend = useCallback(() => {
    const body = draft.trim();
    if (!body || sendMessage.isPending) return;
    setDraft("");
    sendMessage.mutate(body);
  }, [draft, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sorted.length, autoScroll]);

  // Detect manual scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 60);
  }, []);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [roomId]);

  function renderAuthor(msg: ChatMessage) {
    if (msg.authorAgentId && agentMap) {
      const agent = agentMap.get(msg.authorAgentId);
      if (agent) {
        return (
          <span className="inline-flex items-center gap-1.5">
            <AgentIcon icon={(agent as any).iconName ?? "bot"} className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{agent.name}</span>
          </span>
        );
      }
    }
    if (msg.authorUserId) {
      return <Identity name="You" size="xs" />;
    }
    return <span className="text-xs text-muted-foreground">Unknown</span>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4"
      >
        {isLoading && (
          <div className="text-center text-xs text-muted-foreground py-8">Loading messages...</div>
        )}
        {!isLoading && sorted.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">
            No messages yet. Start the conversation!
          </div>
        )}
        {sorted.map((msg) => (
          <div key={msg.id} className="group">
            <div className="flex items-baseline gap-2 mb-0.5">
              {renderAuthor(msg)}
              <span className="text-[10px] text-muted-foreground/60">
                {formatDateTime(msg.createdAt)}
              </span>
            </div>
            <div className="pl-0 prose prose-sm dark:prose-invert max-w-none">
              <MarkdownBody>{msg.body}</MarkdownBody>
            </div>
          </div>
        ))}
      </div>

      {/* Typing indicator */}
      {typingAgentIds.size > 0 && agentMap && (
        <TypingIndicator agentIds={typingAgentIds} agentMap={agentMap} />
      )}

      {/* Composer */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
            rows={1}
            className={cn(
              "flex-1 resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm",
              "outline-none placeholder:text-muted-foreground/40",
              "min-h-[38px] max-h-[160px]",
            )}
            style={{ height: "auto" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
            }}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!draft.trim() || sendMessage.isPending}
            className="h-[38px] px-3"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {sendMessage.isError && (
          <p className="text-xs text-destructive mt-1">
            Failed to send message. Try again.
          </p>
        )}
      </div>
    </div>
  );
}

function TypingIndicator({
  agentIds,
  agentMap,
}: {
  agentIds: Set<string>;
  agentMap: Map<string, Agent>;
}) {
  const agents = [...agentIds]
    .map((id) => agentMap.get(id))
    .filter((a): a is Agent => !!a);

  if (agents.length === 0) return null;

  const label =
    agents.length === 1
      ? `${agents[0].name} is typing`
      : agents.length === 2
        ? `${agents[0].name} and ${agents[1].name} are typing`
        : `${agents[0].name} and ${agents.length - 1} others are typing`;

  return (
    <div className="px-4 py-1.5 text-xs text-muted-foreground flex items-center gap-2">
      <span className="inline-flex items-center gap-1">
        <AgentIcon
          icon={(agents[0] as any).iconName ?? "bot"}
          className="h-3.5 w-3.5 text-muted-foreground"
        />
        <span>{label}</span>
      </span>
      <span className="inline-flex gap-0.5" aria-hidden>
        <span className="typing-dot h-1 w-1 rounded-full bg-muted-foreground/60 animate-[typing-pulse_1.4s_ease-in-out_infinite]" />
        <span className="typing-dot h-1 w-1 rounded-full bg-muted-foreground/60 animate-[typing-pulse_1.4s_ease-in-out_0.2s_infinite]" />
        <span className="typing-dot h-1 w-1 rounded-full bg-muted-foreground/60 animate-[typing-pulse_1.4s_ease-in-out_0.4s_infinite]" />
      </span>
    </div>
  );
}
