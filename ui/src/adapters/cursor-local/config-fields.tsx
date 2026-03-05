import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  ToggleField,
  DraftInput,
  DraftNumberInput,
  help,
} from "../../components/agent-config-primitives";
import { ChoosePathButton } from "../../components/PathInstructionsModal";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";
const instructionsFileHint =
  "Absolute path to a markdown file (e.g. AGENTS.md) that defines this agent's behavior. Injected into context when running the Cursor CLI.";

export function CursorLocalConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  return (
    <>
      <Field label="Agent instructions file" hint={instructionsFileHint}>
        <div className="flex items-center gap-2">
          <DraftInput
            value={
              isCreate
                ? values!.instructionsFilePath ?? ""
                : eff(
                    "adapterConfig",
                    "instructionsFilePath",
                    String(config.instructionsFilePath ?? ""),
                  )
            }
            onCommit={(v) =>
              isCreate
                ? set!({ instructionsFilePath: v })
                : mark("adapterConfig", "instructionsFilePath", v || undefined)
            }
            immediate
            className={inputClass}
            placeholder="/absolute/path/to/AGENTS.md"
          />
          <ChoosePathButton />
        </div>
      </Field>
      <Field label="Model" hint="Cursor model (e.g. gpt-5.2, sonnet-4.5). Leave empty for default.">
        <DraftInput
          value={
            isCreate
              ? values!.model ?? ""
              : eff("adapterConfig", "model", String(config.model ?? ""))
          }
          onCommit={(v) =>
            isCreate ? set!({ model: v }) : mark("adapterConfig", "model", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="gpt-5.2"
        />
      </Field>
      {!isCreate && (
        <>
          <div className="rounded-md border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            If Trust workspace or Force are disabled, the Cursor CLI may show a workspace trust prompt and block headless runs. Keep them enabled for unattended operation.
          </div>
          <ToggleField
            label="Force (allow file modifications in headless)"
            hint="Allow file modifications in print mode without confirmation."
            checked={eff("adapterConfig", "force", config.force === true)}
            onChange={(v) => mark("adapterConfig", "force", v)}
          />
          <ToggleField
            label="Trust workspace"
            hint="Trust workspace without prompting (headless). If disabled, runs may block on the workspace trust prompt."
            checked={eff("adapterConfig", "trust", config.trust === true)}
            onChange={(v) => mark("adapterConfig", "trust", v)}
          />
          <Field label="Timeout (seconds)" hint={help.timeoutSec}>
            <DraftNumberInput
              value={eff("adapterConfig", "timeoutSec", Number(config.timeoutSec ?? 0))}
              onCommit={(v) => mark("adapterConfig", "timeoutSec", v)}
              min={0}
              placeholder="0"
            />
          </Field>
          <Field label="Grace (seconds)" hint={help.graceSec}>
            <DraftNumberInput
              value={eff("adapterConfig", "graceSec", Number(config.graceSec ?? 20))}
              onCommit={(v) => mark("adapterConfig", "graceSec", v)}
              min={0}
              placeholder="20"
            />
          </Field>
        </>
      )}
      <Field label="Extra args" hint={help.extraArgs}>
        <DraftInput
          value={
            isCreate
              ? values!.extraArgs ?? ""
              : eff(
                  "adapterConfig",
                  "extraArgs",
                  Array.isArray(config.extraArgs)
                    ? (config.extraArgs as string[]).join(", ")
                    : String(config.extraArgs ?? ""),
                )
          }
          onCommit={(v) =>
            isCreate
              ? set!({ extraArgs: v })
              : mark(
                  "adapterConfig",
                  "extraArgs",
                  v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
                )
          }
          immediate
          className={inputClass}
          placeholder="--sandbox disabled"
        />
      </Field>
    </>
  );
}
