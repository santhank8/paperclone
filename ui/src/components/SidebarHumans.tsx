import { useState } from "react";
import { NavLink, useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, User } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useSidebar } from "../context/SidebarContext";
import { accessApi } from "../api/access";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function SidebarHumans() {
  const [open, setOpen] = useState(true);
  const { selectedCompanyId } = useCompany();
  const { isMobile, setSidebarOpen } = useSidebar();
  const location = useLocation();

  const { data: members = [] } = useQuery({
    queryKey: queryKeys.access.humanMembers(selectedCompanyId!),
    queryFn: () => accessApi.listHumanMembers(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (members.length === 0) return null;

  const humanMatch = location.pathname.match(/^\/(?:[^/]+\/)?humans\/([^/]+)/);
  const activeUserId = humanMatch?.[1] ?? null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="group">
        <div className="flex items-center px-3 py-1.5">
          <CollapsibleTrigger className="flex items-center gap-1 flex-1 min-w-0">
            <ChevronRight
              className={cn(
                "h-3 w-3 text-muted-foreground/60 transition-transform opacity-0 group-hover:opacity-100",
                open && "rotate-90"
              )}
            />
            <span className="text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60">
              Humans
            </span>
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsibleContent>
        <div className="flex flex-col gap-0.5 mt-0.5">
          {members.map((member) => {
            const label = member.name ?? member.email ?? member.id.slice(0, 8);
            return (
              <NavLink
                key={member.id}
                to={`/humans/${member.id}/dashboard`}
                onClick={() => {
                  if (isMobile) setSidebarOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium transition-colors",
                  activeUserId === member.id
                    ? "bg-accent text-foreground"
                    : "text-foreground/80 hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <User className="shrink-0 h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1 truncate">{label}</span>
              </NavLink>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
