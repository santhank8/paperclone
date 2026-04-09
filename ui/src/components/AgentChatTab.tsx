import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Agent } from "@paperclipai/shared";
import { chatsApi } from "../api/chats";
import { queryKeys } from "../lib/queryKeys";
import { AgentChatSessionSidebar } from "./AgentChatSessionSidebar";
import { AgentChatThread } from "./AgentChatThread";

interface AgentChatTabProps {
  agent: Agent;
}

export function AgentChatTab({ agent }: AgentChatTabProps) {
  const agentId = agent.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedChatId = searchParams.get("chatId");
  const queryClient = useQueryClient();

  const { data: chats = [] } = useQuery({
    queryKey: queryKeys.chats.list(agentId),
    queryFn: () => chatsApi.list(agentId),
    staleTime: 10000,
  });

  const createChat = useMutation({
    mutationFn: () => chatsApi.create(agentId),
    onSuccess: (newChat) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.list(agentId) });
      setSearchParams({ chatId: newChat.id });
    },
  });

  // Auto-select the most recent active chat or create one on first load
  useEffect(() => {
    if (chats.length === 0 || selectedChatId) return;
    const activeChats = chats.filter((c) => c.status === "active");
    if (activeChats.length > 0) {
      setSearchParams({ chatId: activeChats[0]!.id });
    }
  }, [chats, selectedChatId, setSearchParams]);

  const handleSelect = (chatId: string) => {
    setSearchParams({ chatId });
  };

  const handleNew = () => {
    createChat.mutate();
  };

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[400px] border border-border rounded-lg overflow-hidden">
      {/* Session sidebar */}
      <div className="w-48 shrink-0">
        <AgentChatSessionSidebar
          agentId={agentId}
          chats={chats}
          selectedChatId={selectedChatId}
          onSelect={handleSelect}
          onNew={handleNew}
        />
      </div>

      {/* Thread panel */}
      <div className="flex-1 min-w-0">
        {selectedChatId ? (
          <AgentChatThread
            agentId={agentId}
            chatId={selectedChatId}
            agent={agent}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {createChat.isPending ? "Creating chat…" : "Select or start a new chat"}
          </div>
        )}
      </div>
    </div>
  );
}
