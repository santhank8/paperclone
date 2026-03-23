import { DEFAULT_OLLAMA_BASE_URL } from "@paperclipai/adapter-ollama-local";
import type { AdapterConfigFieldsProps } from "../types";
import {
  DraftInput,
  Field,
} from "../../components/agent-config-primitives";
import { ChoosePathButton } from "../../components/PathInstructionsModal";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";
const instructionsFileHint =
  "Absolute path to a markdown file (for example AGENTS.md) appended to the Ollama system prompt.";

export function OllamaLocalConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
  hideInstructionsFile,
}: AdapterConfigFieldsProps) {
  const baseUrlValue = isCreate
    ? values!.url
    : eff("adapterConfig", "baseUrl", String(config.baseUrl ?? config.url ?? ""));
  const modelValue = isCreate
    ? values!.model
    : eff("adapterConfig", "model", String(config.model ?? ""));
  const allowUndiscoveredModel = isCreate
    ? values!.allowUndiscoveredModel
    : eff("adapterConfig", "allowUndiscoveredModel", config.allowUndiscoveredModel === true);

  return (
    <>
      <Field label="Ollama base URL">
        <DraftInput
          value={baseUrlValue}
          onCommit={(value) =>
            isCreate
              ? set!({ url: value })
              : mark("adapterConfig", "baseUrl", value || undefined)
          }
          immediate
          className={inputClass}
          placeholder={DEFAULT_OLLAMA_BASE_URL}
        />
      </Field>

      <Field label="Model">
        <DraftInput
          value={modelValue}
          onCommit={(value) =>
            isCreate
              ? set!({ model: value })
              : mark("adapterConfig", "model", value || undefined)
          }
          immediate
          className={inputClass}
          placeholder="qwen2.5:7b"
        />
      </Field>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={allowUndiscoveredModel}
          onChange={(event) =>
            isCreate
              ? set!({ allowUndiscoveredModel: event.target.checked })
              : mark("adapterConfig", "allowUndiscoveredModel", event.target.checked)
          }
        />
        Allow manual model even if <span className="font-mono">/api/tags</span> does not list it
      </label>

      {!hideInstructionsFile && (
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
              onCommit={(value) =>
                isCreate
                  ? set!({ instructionsFilePath: value })
                  : mark("adapterConfig", "instructionsFilePath", value || undefined)
              }
              immediate
              className={inputClass}
              placeholder="/absolute/path/to/AGENTS.md"
            />
            <ChoosePathButton />
          </div>
        </Field>
      )}

      <p className="text-[11px] text-muted-foreground">
        This adapter talks to Ollama directly and posts the model response back to the Issue. It does not provide a full tool-using coding CLI.
      </p>
    </>
  );
}
