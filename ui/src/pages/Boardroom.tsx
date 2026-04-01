import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Agent } from "@paperclipai/shared";
import { ChatRoom } from "../components/ChatRoom";
import { chatApi } from "../api/chat";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";

export function Boardroom() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Boardroom" }]);
  }, [setBreadcrumbs]);

  // Get or create the boardroom
  const { data: room, isLoading: roomLoading } = useQuery({
    queryKey: [...queryKeys.chat.rooms(selectedCompanyId!), "boardroom"],
    queryFn: async () => {
      const rooms = await chatApi.listRooms(selectedCompanyId!);
      const existing = rooms.find((r) => r.kind === "boardroom");
      if (existing) return existing;
      return chatApi.getOrCreateRoom(selectedCompanyId!, { kind: "boardroom" });
    },
    enabled: Boolean(selectedCompanyId),
  });

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents) map.set(a.id, a);
    return map;
  }, [agents]);

  if (roomLoading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Loading boardroom...
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Could not create boardroom.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <h1 className="text-lg font-semibold">Boardroom</h1>
        <p className="text-xs text-muted-foreground">
          Company-wide chat. @mention agents to get their attention.
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <ChatRoom roomId={room.id} agentMap={agentMap} />
      </div>
    </div>
  );
}
