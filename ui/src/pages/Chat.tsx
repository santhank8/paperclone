import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Agent, ChatConversation, ChatMessage } from "@paperclipai/shared";
import { MessageCircle, MessageSquareText, Plus, Search, Send, Smile, Trash2, X } from "lucide-react";
import { authApi } from "../api/auth";
import { agentsApi } from "../api/agents";
import { chatApi } from "../api/chat";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { cn, relativeTime } from "../lib/utils";
import { MarkdownBody } from "../components/MarkdownBody";
import { MarkdownEditor, type MentionOption } from "../components/MarkdownEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const QUICK_REACTIONS = ["👍", "🎉", "✅", "👀", "🔥", "❓"];

function parseMentionAgentIds(body: string, agents: Agent[]) {
  const bodyLower = body.toLowerCase();
  return agents
    .filter((agent) => bodyLower.includes(`@${agent.name.toLowerCase()}`))
    .map((agent) => agent.id);
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

function authorLabel(message: ChatMessage, agentsById: Map<string, Agent>): string {
  if (message.authorAgentId) return agentsById.get(message.authorAgentId)?.name ?? "Agent";
  if (message.authorUserId) return "Board";
  return "Unknown";
}

function deliveryStatus(message: ChatMessage, agentsById: Map<string, Agent>) {
  const delivery = message.delivery;
  if (!delivery) return null;
  const targetName = agentsById.get(delivery.targetAgentId)?.name ?? "agent";
  switch (delivery.status) {
    case "pending":
      return { label: `Sending to ${targetName}`, className: "bg-muted text-muted-foreground", title: null };
    case "retrying":
      return { label: `Retrying ${targetName}`, className: "bg-amber-100 text-amber-800", title: null };
    case "replied":
      return { label: `${targetName} replied`, className: "bg-emerald-100 text-emerald-800", title: null };
    case "timed_out":
      return {
        label: `${targetName} timed out`,
        className: "bg-red-100 text-red-700",
        title: delivery.lastError ?? "Agent did not reply in time",
      };
    case "failed":
      return {
        label: `Failed to wake ${targetName}`,
        className: "bg-red-100 text-red-700",
        title: delivery.lastError ?? "Wakeup failed",
      };
    default:
      return null;
  }
}

interface DeleteMutationContext {
  conversationId: string;
  snapshots: Array<[readonly unknown[], ChatMessage[] | undefined]>;
}

export function Chat() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedThreadRootId, setSelectedThreadRootId] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [threadComposer, setThreadComposer] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const readCursorRef = useRef<Record<string, string>>({});
  const timelineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Chat" }]);
  }, [setBreadcrumbs]);

  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
  });
  const currentUserId = session?.user?.id ?? session?.session?.userId ?? "local-board";
  const currentPrincipalKey = `user:${currentUserId}`;

  const { data: conversations = [] } = useQuery({
    queryKey: queryKeys.chat.conversations(selectedCompanyId ?? ""),
    queryFn: () => chatApi.listConversations(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId ?? ""),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentsById = useMemo(() => {
    const mapped = new Map<string, Agent>();
    for (const agent of agents) mapped.set(agent.id, agent);
    return mapped;
  }, [agents]);

  useEffect(() => {
    if (conversations.length === 0) {
      setSelectedConversationId(null);
      return;
    }
    if (!selectedConversationId) {
      setSelectedConversationId(conversations[0]!.id);
      return;
    }
    const stillExists = conversations.some((conversation) => conversation.id === selectedConversationId);
    if (!stillExists) {
      setSelectedConversationId(conversations[0]!.id);
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    setSelectedThreadRootId(null);
  }, [selectedConversationId]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const { data: rootMessages = [] } = useQuery({
    queryKey: queryKeys.chat.messages(selectedConversationId ?? "", null),
    queryFn: () => chatApi.listMessages(selectedConversationId!, { limit: 100 }),
    enabled: !!selectedConversationId,
  });

  const hasSelectedThreadRoot = useMemo(
    () => !!selectedThreadRootId && rootMessages.some((message) => message.id === selectedThreadRootId),
    [rootMessages, selectedThreadRootId],
  );

  const { data: threadMessages = [] } = useQuery({
    queryKey: queryKeys.chat.messages(selectedConversationId ?? "", selectedThreadRootId),
    queryFn: () =>
      chatApi.listMessages(selectedConversationId!, {
        threadRootMessageId: selectedThreadRootId,
        limit: 200,
      }),
    enabled: !!selectedConversationId && hasSelectedThreadRoot,
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: queryKeys.chat.search(selectedCompanyId ?? "", searchQuery),
    queryFn: () => chatApi.search(selectedCompanyId!, { q: searchQuery, limit: 30 }),
    enabled: !!selectedCompanyId && searchQuery.trim().length >= 2,
  });

  const totalUnread = useMemo(
    () => conversations.reduce((sum, conversation) => sum + (conversation.unreadCount ?? 0), 0),
    [conversations],
  );

  const mentionOptions = useMemo<MentionOption[]>(
    () =>
      agents
        .filter((agent) => agent.status !== "terminated")
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((agent) => ({
          id: `agent:${agent.id}`,
          name: agent.name,
          kind: "agent" as const,
        })),
    [agents],
  );

  const createChannelMutation = useMutation({
    mutationFn: (name: string) => chatApi.createChannel(selectedCompanyId!, { name }),
    onSuccess: (channel) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations(selectedCompanyId ?? "") });
      setSelectedConversationId(channel.id);
      pushToast({ title: `Created #${channel.slug ?? channel.name}`, tone: "success" });
    },
    onError: (error: Error) => {
      pushToast({ title: "Failed to create channel", body: error.message, tone: "error" });
    },
  });

  const openDmMutation = useMutation({
    mutationFn: (participantAgentId: string) => chatApi.openDm(selectedCompanyId!, { participantAgentId }),
    onSuccess: (conversation) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations(selectedCompanyId ?? "") });
      setSelectedConversationId(conversation.id);
    },
    onError: (error: Error) => {
      pushToast({ title: "Failed to open DM", body: error.message, tone: "error" });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (input: { conversationId: string; lastReadMessageId?: string | null }) =>
      chatApi.markRead(input.conversationId, { lastReadMessageId: input.lastReadMessageId ?? null }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations(selectedCompanyId ?? "") });
    },
  });

  function markConversationReadIfNeeded(conversationId: string, lastReadMessageId: string) {
    if (readCursorRef.current[conversationId] === lastReadMessageId) return;
    readCursorRef.current[conversationId] = lastReadMessageId;
    markReadMutation.mutate({
      conversationId,
      lastReadMessageId,
    });
  }

  const createMessageMutation = useMutation({
    mutationFn: (input: { conversationId: string; body: string; threadRootMessageId?: string | null }) =>
      chatApi.createMessage(input.conversationId, {
        body: input.body,
        threadRootMessageId: input.threadRootMessageId ?? null,
        mentionAgentIds: parseMentionAgentIds(input.body, agents),
      }),
    onSuccess: (message) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(message.conversationId, null) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.chat.messages(
          message.conversationId,
          message.threadRootMessageId ?? message.id,
        ),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations(selectedCompanyId ?? "") });
      if (message.threadRootMessageId) {
        setThreadComposer("");
      } else {
        setComposer("");
      }
      markConversationReadIfNeeded(message.conversationId, message.id);
    },
    onError: (error: Error) => {
      pushToast({ title: "Failed to send message", body: error.message, tone: "error" });
    },
  });

  const deleteMessageMutation = useMutation<ChatMessage, Error, string, DeleteMutationContext | null>({
    mutationFn: (messageId: string) => chatApi.deleteMessage(messageId),
    onMutate: async (messageId) => {
      if (!selectedConversationId) return null;
      await queryClient.cancelQueries({ queryKey: ["chat", "messages", selectedConversationId] });
      const snapshots = queryClient.getQueriesData<ChatMessage[]>({
        queryKey: ["chat", "messages", selectedConversationId],
      });

      queryClient.setQueriesData<ChatMessage[]>(
        { queryKey: ["chat", "messages", selectedConversationId] },
        (existing) => {
          if (!existing || existing.length === 0) return existing;
          return existing.filter(
            (message) => message.id !== messageId && message.threadRootMessageId !== messageId,
          );
        },
      );

      if (selectedThreadRootId === messageId) {
        setSelectedThreadRootId(null);
      }

      return {
        conversationId: selectedConversationId,
        snapshots,
      };
    },
    onError: (error, _messageId, context) => {
      if (context?.snapshots) {
        for (const [queryKey, data] of context.snapshots) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      pushToast({ title: "Delete failed", body: error.message, tone: "error" });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations(selectedCompanyId ?? "") });
    },
    onSettled: (_message, _error, _messageId, context) => {
      if (context?.conversationId) {
        void queryClient.invalidateQueries({ queryKey: ["chat", "messages", context.conversationId] });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.conversations(selectedCompanyId ?? "") });
    },
  });

  const addReactionMutation = useMutation({
    mutationFn: (input: { messageId: string; emoji: string }) => chatApi.addReaction(input.messageId, input.emoji),
    onSuccess: () => {
      if (!selectedConversationId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(selectedConversationId, null) });
      if (selectedThreadRootId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(selectedConversationId, selectedThreadRootId) });
      }
    },
  });

  const removeReactionMutation = useMutation({
    mutationFn: (input: { messageId: string; emoji: string }) => chatApi.removeReaction(input.messageId, input.emoji),
    onSuccess: () => {
      if (!selectedConversationId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(selectedConversationId, null) });
      if (selectedThreadRootId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(selectedConversationId, selectedThreadRootId) });
      }
    },
  });

  useEffect(() => {
    if (!selectedConversationId || rootMessages.length === 0) return;
    const lastMessage = rootMessages[rootMessages.length - 1];
    if (!lastMessage) return;
    markConversationReadIfNeeded(selectedConversationId, lastMessage.id);
  }, [selectedConversationId, rootMessages, markReadMutation]);

  useEffect(() => {
    if (!selectedThreadRootId) return;
    const rootStillExists = rootMessages.some((message) => message.id === selectedThreadRootId);
    if (!rootStillExists) {
      setSelectedThreadRootId(null);
    }
  }, [rootMessages, selectedThreadRootId]);

  function handleTimelineScroll() {
    const element = timelineRef.current;
    if (!element || !selectedConversationId || rootMessages.length === 0) return;
    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceToBottom > 48) return;
    const lastMessage = rootMessages[rootMessages.length - 1];
    if (!lastMessage) return;
    markConversationReadIfNeeded(selectedConversationId, lastMessage.id);
  }

  function participantLabel(participant: { principalType: string; principalId: string }) {
    if (participant.principalType === "agent") {
      return agentsById.get(participant.principalId)?.name ?? `Agent ${participant.principalId.slice(0, 8)}`;
    }
    return participant.principalId === currentUserId ? "Board (You)" : "Board";
  }

  function conversationLabel(conversation: ChatConversation) {
    if (conversation.kind === "channel") {
      return `#${conversation.slug ?? conversation.name}`;
    }
    const participants = conversation.participants ?? [];
    const other = participants.find(
      (participant) => `${participant.principalType}:${participant.principalId}` !== currentPrincipalKey,
    );
    if (other && participants.some((participant) => `${participant.principalType}:${participant.principalId}` === currentPrincipalKey)) {
      return participantLabel(other);
    }
    if (participants.length >= 2) {
      return `${participantLabel(participants[0]!)} • ${participantLabel(participants[1]!)}`;
    }
    return "Direct message";
  }

  function handleCreateChannel() {
    if (!selectedCompanyId) return;
    const name = window.prompt("Channel name");
    if (!name || !name.trim()) return;
    createChannelMutation.mutate(name.trim());
  }

  function handlePostRootMessage() {
    if (!selectedConversationId || !composer.trim()) return;
    createMessageMutation.mutate({
      conversationId: selectedConversationId,
      body: composer,
    });
  }

  function handlePostThreadMessage() {
    if (!selectedConversationId || !selectedThreadRootId || !threadComposer.trim()) return;
    createMessageMutation.mutate({
      conversationId: selectedConversationId,
      body: threadComposer,
      threadRootMessageId: selectedThreadRootId,
    });
  }

  function handleToggleReaction(message: ChatMessage, emoji: string) {
    const existing = (message.reactions ?? []).find((reaction) => reaction.emoji === emoji);
    if (existing?.reacted) {
      removeReactionMutation.mutate({ messageId: message.id, emoji });
    } else {
      addReactionMutation.mutate({ messageId: message.id, emoji });
    }
  }

  function handleJumpToSearchResult(result: {
    conversationId: string;
    threadRootMessageId: string | null;
    messageId: string;
  }) {
    setSelectedConversationId(result.conversationId);
    setSelectedThreadRootId(result.threadRootMessageId ?? result.messageId);
  }

  if (!selectedCompanyId) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        Select a company to use chat.
      </div>
    );
  }

  const channels = conversations.filter((conversation) => conversation.kind === "channel");
  const allDms = conversations.filter((conversation) => conversation.kind === "dm");
  const boardAgentDmsByAgentId = new Map<string, ChatConversation>();
  const otherDms: ChatConversation[] = [];

  for (const conversation of allDms) {
    const participants = conversation.participants ?? [];
    const hasCurrentUser = participants.some(
      (participant) => participant.principalType === "user" && participant.principalId === currentUserId,
    );
    const agentParticipants = participants.filter((participant) => participant.principalType === "agent");
    if (hasCurrentUser && participants.length === 2 && agentParticipants.length === 1) {
      boardAgentDmsByAgentId.set(agentParticipants[0]!.principalId, conversation);
      continue;
    }
    otherDms.push(conversation);
  }

  const agentDmEntries = agents
    .filter((agent) => agent.status !== "terminated")
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((agent) => ({
      agent,
      conversation: boardAgentDmsByAgentId.get(agent.id) ?? null,
    }));

  function handleOpenOrSelectAgentDm(agentId: string) {
    if (!selectedCompanyId) return;
    const existing = boardAgentDmsByAgentId.get(agentId);
    if (existing) {
      setSelectedConversationId(existing.id);
      return;
    }
    openDmMutation.mutate(agentId);
  }

  return (
    <div className="-mx-4 -my-4 flex h-[calc(100dvh-7.5rem)] min-h-[620px] overflow-hidden bg-background md:-mx-6 md:-my-6">
      <aside className="w-72 shrink-0 border-r border-border bg-muted/20">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="text-sm font-semibold">Conversations</div>
          <div className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {totalUnread} unread
          </div>
        </div>
        <div className="border-b border-border p-3 space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search messages..."
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCreateChannel}>
              <Plus className="mr-1 h-3 w-3" />
              Channel
            </Button>
            <div className="text-xs text-muted-foreground">Click any agent below to open/select its DM.</div>
          </div>
        </div>

        {searchQuery.trim().length >= 2 && (
          <div className="border-b border-border px-3 py-2">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Search Results</div>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {searchResults.length === 0 && (
                <div className="text-xs text-muted-foreground">No results.</div>
              )}
              {searchResults.map((result) => (
                <button
                  key={result.messageId}
                  type="button"
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-left hover:bg-accent"
                  onClick={() => handleJumpToSearchResult(result)}
                >
                  <div className="text-[11px] font-medium text-muted-foreground">
                    {result.conversationKind === "channel" ? "#" : ""}
                    {result.conversationName} • {relativeTime(result.createdAt)}
                  </div>
                  <div className="text-xs">{stripHtmlTags(result.snippet)}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="h-[calc(100%-13.5rem)] overflow-y-auto p-2">
          <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Channels</div>
          {channels.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className={cn(
                "mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                selectedConversationId === conversation.id && "bg-accent",
              )}
              onClick={() => setSelectedConversationId(conversation.id)}
            >
              <MessageSquareText className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{conversationLabel(conversation)}</span>
              {(conversation.unreadCount ?? 0) > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[11px] text-primary-foreground">
                  {conversation.unreadCount}
                </span>
              )}
            </button>
          ))}

          <div className="mb-1 mt-3 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Direct Messages</div>
          {agentDmEntries.map(({ agent, conversation }) => (
            <button
              key={agent.id}
              type="button"
              className={cn(
                "mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                conversation?.id && selectedConversationId === conversation.id && "bg-accent",
              )}
              onClick={() => handleOpenOrSelectAgentDm(agent.id)}
              disabled={openDmMutation.isPending}
            >
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{agent.name}</span>
              {(conversation?.unreadCount ?? 0) > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[11px] text-primary-foreground">
                  {conversation?.unreadCount ?? 0}
                </span>
              )}
            </button>
          ))}
          {otherDms.length > 0 && (
            <>
              <div className="mb-1 mt-3 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Other DMs
              </div>
              {otherDms.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={cn(
                    "mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                    selectedConversationId === conversation.id && "bg-accent",
                  )}
                  onClick={() => setSelectedConversationId(conversation.id)}
                >
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{conversationLabel(conversation)}</span>
                  {(conversation.unreadCount ?? 0) > 0 && (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[11px] text-primary-foreground">
                      {conversation.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border px-4 py-2">
          <div className="text-sm font-semibold">
            {selectedConversation ? conversationLabel(selectedConversation) : "Select a conversation"}
          </div>
        </div>

        <div ref={timelineRef} onScroll={handleTimelineScroll} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {!selectedConversation && (
            <div className="text-sm text-muted-foreground">Choose a channel or DM to start messaging.</div>
          )}
          {selectedConversation && rootMessages.length === 0 && (
            <div className="text-sm text-muted-foreground">No messages yet.</div>
          )}
          {rootMessages.map((message) => {
            const delivery = deliveryStatus(message, agentsById);
            return (
              <div key={message.id} className="rounded-md border border-border bg-background px-3 py-2">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{authorLabel(message, agentsById)}</span>
                  <span>{relativeTime(message.createdAt)}</span>
                  {delivery && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[11px] font-medium",
                        delivery.className,
                      )}
                      title={delivery.title ?? undefined}
                    >
                      {delivery.label}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 hover:bg-accent"
                      onClick={() => setSelectedThreadRootId(message.id)}
                    >
                      Thread ({message.replyCount ?? 0})
                    </button>
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 text-destructive hover:bg-destructive/10"
                      onClick={() => deleteMessageMutation.mutate(message.id)}
                      title="Delete message"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <MarkdownBody>{message.body}</MarkdownBody>

                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {(message.reactions ?? []).map((reaction) => (
                    <button
                      key={`${message.id}-${reaction.emoji}`}
                      type="button"
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs",
                        reaction.reacted ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent",
                      )}
                      onClick={() => handleToggleReaction(message, reaction.emoji)}
                    >
                      {reaction.emoji} {reaction.count}
                    </button>
                  ))}
                  <div className="ml-1 flex items-center gap-1">
                    <Smile className="h-3.5 w-3.5 text-muted-foreground" />
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={`${message.id}-quick-${emoji}`}
                        type="button"
                        className="rounded px-1 py-0.5 text-xs hover:bg-accent"
                        onClick={() => handleToggleReaction(message, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {selectedConversation && (
          <div className="border-t border-border p-3">
            <MarkdownEditor
              value={composer}
              onChange={setComposer}
              placeholder={`Message ${conversationLabel(selectedConversation)}`}
              mentions={mentionOptions}
              onSubmit={handlePostRootMessage}
            />
            <div className="mt-2 flex justify-end">
              <Button onClick={handlePostRootMessage} disabled={!composer.trim() || createMessageMutation.isPending}>
                <Send className="mr-1 h-4 w-4" />
                Send
              </Button>
            </div>
          </div>
        )}
      </section>

      <aside className="w-96 shrink-0 border-l border-border bg-muted/10">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="text-sm font-semibold">Thread</div>
          {selectedThreadRootId && (
            <Button variant="ghost" size="icon-sm" onClick={() => setSelectedThreadRootId(null)}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="h-[calc(100%-2.5rem)] flex flex-col">
          {!selectedThreadRootId && (
            <div className="p-3 text-sm text-muted-foreground">
              Select a root message to view or reply in a thread.
            </div>
          )}
          {selectedThreadRootId && (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {threadMessages.map((message) => (
                  <div key={message.id} className="rounded-md border border-border bg-background px-3 py-2">
                    <div className="mb-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{authorLabel(message, agentsById)}</span>
                      <span className="ml-2">{relativeTime(message.createdAt)}</span>
                    </div>
                    <MarkdownBody>{message.body}</MarkdownBody>
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-3">
                <MarkdownEditor
                  value={threadComposer}
                  onChange={setThreadComposer}
                  placeholder="Reply in thread"
                  mentions={mentionOptions}
                  onSubmit={handlePostThreadMessage}
                />
                <div className="mt-2 flex justify-end">
                  <Button onClick={handlePostThreadMessage} disabled={!threadComposer.trim() || createMessageMutation.isPending}>
                    Reply
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
