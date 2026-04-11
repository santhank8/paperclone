import { Pause } from "lucide-react";
import { cn } from "../lib/utils";

interface AgentNameProps {
  name: string;
  status?: string | null;
  className?: string;
  textClassName?: string;
  iconClassName?: string;
}

export function AgentName({
  name,
  status,
  className,
  textClassName,
  iconClassName,
}: AgentNameProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      <span className={cn("truncate", textClassName)}>{name}</span>
      {status === "paused" ? (
        <Pause
          className={cn("h-3 w-3 shrink-0 text-amber-500", iconClassName)}
          aria-label="Paused"
          role="img"
        />
      ) : null}
    </span>
  );
}
