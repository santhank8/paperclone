import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
} from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

function formatArgList(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .join(", ");
  }
  return typeof value === "string" ? value : "";
}

function parseCommaArgs(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AcpConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  return (
    <Field label="Args (comma-separated)" hint="Command arguments (default: acp)">
      <DraftInput
        value={
          isCreate
            ? values!.args || "acp"
            : eff("adapterConfig", "args", formatArgList(config.args))
        }
        onCommit={(v) =>
          isCreate
            ? set!({ args: v })
            : mark(
                "adapterConfig",
                "args",
                v ? parseCommaArgs(v) : undefined,
              )
        }
        immediate
        className={inputClass}
        placeholder="acp, --agent, my-agent"
      />
    </Field>
  );
}
