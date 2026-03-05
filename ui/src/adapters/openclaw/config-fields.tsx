import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
  help,
} from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

export function OpenClawConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  return (
    <>
      <Field label="OpenClaw Agent ID" hint="The agent id in OpenClaw (e.g. main, forge, spark)">
        <DraftInput
          value={
            isCreate
              ? (values as any)!.agentId ?? "main"
              : eff("adapterConfig", "agentId", String(config.agentId ?? "main"))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ agentId: v } as any)
              : mark("adapterConfig", "agentId", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="main"
        />
      </Field>
      <Field label="Working Directory" hint="Workspace path for the agent">
        <DraftInput
          value={
            isCreate
              ? values!.cwd ?? ""
              : eff("adapterConfig", "cwd", String(config.cwd ?? ""))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ cwd: v })
              : mark("adapterConfig", "cwd", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="~/workspaces/agent-name"
        />
      </Field>
      <Field label="Model (optional)" hint="Override model for this agent">
        <DraftInput
          value={
            isCreate
              ? values!.model ?? ""
              : eff("adapterConfig", "model", String(config.model ?? ""))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ model: v })
              : mark("adapterConfig", "model", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="anthropic/claude-sonnet-4-20250514"
        />
      </Field>
      <Field label="Thinking Level" hint="off, minimal, low, medium, high">
        <DraftInput
          value={
            isCreate
              ? (values as any)!.thinking ?? ""
              : eff("adapterConfig", "thinking", String(config.thinking ?? ""))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ thinking: v } as any)
              : mark("adapterConfig", "thinking", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="off"
        />
      </Field>
      {!isCreate && (
        <Field label="Command" hint="Path to openclaw binary (default: openclaw)">
          <DraftInput
            value={eff("adapterConfig", "command", String(config.command ?? "openclaw"))}
            onCommit={(v) => mark("adapterConfig", "command", v || undefined)}
            immediate
            className={inputClass}
            placeholder="openclaw"
          />
        </Field>
      )}
    </>
  );
}
