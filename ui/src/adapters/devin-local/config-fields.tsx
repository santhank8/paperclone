import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
} from "../../components/agent-config-primitives";
import { ChoosePathButton } from "../../components/PathInstructionsModal";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

const instructionsFileHint =
  "Absolute path to a markdown file (e.g. AGENTS.md) that defines this agent's behavior. Prepended to the prompt at runtime.";

const permissionModeHint =
  'Permission mode for Devin CLI. "dangerous" auto-approves all tools (recommended for headless use). "auto" auto-approves read-only tools only.';

const PERMISSION_MODES = ["dangerous", "auto"] as const;

export function DevinLocalConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
  models,
}: AdapterConfigFieldsProps) {
  const modelOptions = models.length > 0 ? models : [];

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

      <Field label="Model">
        {modelOptions.length > 0 ? (
          <select
            value={
              isCreate
                ? values!.model
                : eff("adapterConfig", "model", String(config.model ?? ""))
            }
            onChange={(e) =>
              isCreate
                ? set!({ model: e.target.value })
                : mark("adapterConfig", "model", e.target.value || undefined)
            }
            className={inputClass}
          >
            <option value="">Default</option>
            {modelOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        ) : (
          <DraftInput
            value={
              isCreate
                ? values!.model
                : eff("adapterConfig", "model", String(config.model ?? ""))
            }
            onCommit={(v) =>
              isCreate
                ? set!({ model: v })
                : mark("adapterConfig", "model", v || undefined)
            }
            immediate
            className={inputClass}
            placeholder="claude-sonnet-4"
          />
        )}
      </Field>

      <Field label="Permission mode" hint={permissionModeHint}>
        <select
          value={
            isCreate
              ? "dangerous"
              : eff("adapterConfig", "permissionMode", String(config.permissionMode ?? "dangerous"))
          }
          onChange={(e) =>
            isCreate
              ? undefined
              : mark("adapterConfig", "permissionMode", e.target.value)
          }
          disabled={isCreate}
          className={inputClass}
        >
          {PERMISSION_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
      </Field>

      {!isCreate && (
        <>
          <Field label="Working directory">
            <DraftInput
              value={eff("adapterConfig", "cwd", String(config.cwd ?? ""))}
              onCommit={(v) => mark("adapterConfig", "cwd", v || undefined)}
              immediate
              className={inputClass}
              placeholder="/absolute/path/to/workspace"
            />
          </Field>

          <Field label="Timeout (seconds)">
            <DraftInput
              value={eff("adapterConfig", "timeoutSec", String(config.timeoutSec ?? "0"))}
              onCommit={(v) => {
                const parsed = Number.parseInt(v.trim(), 10);
                mark(
                  "adapterConfig",
                  "timeoutSec",
                  Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined,
                );
              }}
              immediate
              className={inputClass}
              placeholder="0 (no timeout)"
            />
          </Field>

          <Field label="Command override">
            <DraftInput
              value={eff("adapterConfig", "command", String(config.command ?? ""))}
              onCommit={(v) => mark("adapterConfig", "command", v || undefined)}
              immediate
              className={inputClass}
              placeholder="devin"
            />
          </Field>
        </>
      )}
    </>
  );
}
