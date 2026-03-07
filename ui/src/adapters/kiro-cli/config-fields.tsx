import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  ToggleField,
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
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

export function KiroCliConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  // Access Kiro-specific create-mode values via the generic bag
  const v = values as unknown as Record<string, unknown> | null;
  const patchSet = set as unknown as ((patch: Record<string, unknown>) => void) | null;

  return (
    <>
      <Field label="Agent profile" hint="Named agent profile (--agent flag)">
        <DraftInput
          value={
            isCreate
              ? String(v?.agent ?? "")
              : eff("adapterConfig", "agent", String(config.agent ?? ""))
          }
          onCommit={(val) =>
            isCreate
              ? patchSet!({ agent: val })
              : mark("adapterConfig", "agent", val || undefined)
          }
          immediate
          className={inputClass}
          placeholder="my-agent"
        />
      </Field>
      <Field label="Extra args (comma-separated)" hint="Additional command arguments appended after acp">
        <DraftInput
          value={
            isCreate
              ? values!.args || ""
              : eff("adapterConfig", "args", formatArgList(config.args))
          }
          onCommit={(val) =>
            isCreate
              ? set!({ args: val })
              : mark(
                  "adapterConfig",
                  "args",
                  val ? parseCommaArgs(val) : undefined,
                )
          }
          immediate
          className={inputClass}
          placeholder="--verbose"
        />
      </Field>
      <ToggleField
        label="Trust all tools"
        hint="Auto-approve all tool permission requests (--trust-all-tools)"
        checked={
          isCreate
            ? v?.trustAllTools === true
            : eff(
                "adapterConfig",
                "trustAllTools",
                config.trustAllTools === true,
              )
        }
        onChange={(val) =>
          isCreate
            ? patchSet!({ trustAllTools: val })
            : mark("adapterConfig", "trustAllTools", val)
        }
      />
    </>
  );
}
