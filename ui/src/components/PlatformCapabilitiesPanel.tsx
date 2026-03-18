import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { platformCapabilitiesApi } from "../api/platformCapabilities";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";

type Variant = "full" | "compact";

export function PlatformCapabilitiesPanel({ variant = "full" }: { variant?: Variant }) {
  const [open, setOpen] = useState(variant === "full");
  const q = useQuery({
    queryKey: queryKeys.instance.platformCapabilities,
    queryFn: () => platformCapabilitiesApi.get(),
    staleTime: 60_000,
    retry: false,
  });

  if (q.isLoading) {
    return (
      <p className="text-xs text-muted-foreground">
        {variant === "compact" ? "" : "Loading platform capabilities…"}
      </p>
    );
  }
  if (q.isError || !q.data) {
    return variant === "compact" ? null : (
      <p className="text-xs text-muted-foreground">
        Could not load capabilities (sign in may be required).
      </p>
    );
  }

  const { core, installedAgentAdapters, version, deploymentMode } = q.data;

  if (variant === "compact") {
    return (
      <div className="rounded-md border border-border bg-muted/20 text-left">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted/40"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1">What this Paperclip can do</span>
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
        </button>
        {open && (
          <div className="border-t border-border px-3 py-2 space-y-2 max-h-48 overflow-y-auto">
            <p className="text-[11px] text-muted-foreground">
              v{version} · {deploymentMode}
            </p>
            <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
              {core.slice(0, 3).map((d) => (
                <li key={d.id}>
                  <span className="font-medium text-foreground">{d.title}</span>
                  {d.abilities[0] ? ` — ${d.abilities[0].slice(0, 80)}…` : ""}
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-muted-foreground">
              Full list: Instance settings → Platform capabilities.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Platform capabilities</h3>
        <span className="text-xs text-muted-foreground">
          v{version} · {deploymentMode}
        </span>
      </div>
      <div className="space-y-3">
        {core.map((domain) => (
          <div key={domain.id} className="rounded-md border border-border p-3">
            <h4 className="text-xs font-semibold text-foreground mb-1">{domain.title}</h4>
            {domain.description && (
              <p className="text-[11px] text-muted-foreground mb-2">{domain.description}</p>
            )}
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              {domain.abilities.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="rounded-md border border-border p-3">
        <h4 className="text-xs font-semibold mb-2">Installed agent adapter types</h4>
        <div className="flex flex-wrap gap-1.5">
          {installedAgentAdapters.map((a) => (
            <span
              key={a.type}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-md bg-muted font-mono",
                a.supportsLocalAgentJwt && "ring-1 ring-border",
              )}
              title={
                a.supportsLocalAgentJwt
                  ? "JWT injection on heartbeat supported"
                  : undefined
              }
            >
              {a.type}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
