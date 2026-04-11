import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AgentName } from "./AgentName";

type IdentitySize = "xs" | "sm" | "default" | "lg";

export interface IdentityProps {
  name: string;
  avatarUrl?: string | null;
  initials?: string;
  size?: IdentitySize;
  status?: string | null;
  className?: string;
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const textSize: Record<IdentitySize, string> = {
  xs: "text-sm",
  sm: "text-xs",
  default: "text-sm",
  lg: "text-sm",
};

export function Identity({ name, avatarUrl, initials, size = "default", status, className }: IdentityProps) {
  const displayInitials = initials ?? deriveInitials(name);
  const pauseIconSize: Record<IdentitySize, string> = {
    xs: "h-2.5 w-2.5",
    sm: "h-2.5 w-2.5",
    default: "h-3 w-3",
    lg: "h-3 w-3",
  };

  return (
    <span className={cn("inline-flex gap-1.5", size === "xs" ? "items-baseline gap-1" : "items-center", size === "lg" && "gap-2", className)}>
      <Avatar size={size} className={size === "xs" ? "relative -top-px" : undefined}>
        {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
        <AvatarFallback>{displayInitials}</AvatarFallback>
      </Avatar>
      <AgentName
        name={name}
        className="min-w-0"
        textClassName={textSize[size]}
        iconClassName={pauseIconSize[size]}
        status={status}
      />
    </span>
  );
}
