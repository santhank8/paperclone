import type { AdapterConfigFieldsProps } from "../types";
import { ClaudeLocalConfigFields } from "../claude-local/config-fields";
import {
  Field,
  DraftInput,
} from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

export function HybridLocalConfigFields(props: AdapterConfigFieldsProps) {
  const { isCreate, values, set, config, eff, mark } = props;

  return (
    <>
      {/* Reuse all Claude config fields (model, cwd, instructions, workspace, etc.) */}
      <ClaudeLocalConfigFields {...props} />

      <Field
        label="Local endpoint URL"
        hint="OpenAI-compatible API endpoint for local models (LM Studio, Ollama, LiteLLM, etc.)"
      >
        <DraftInput
          value={
            isCreate
              ? ""
              : eff(
                  "adapterConfig",
                  "localBaseUrl",
                  String(config.localBaseUrl ?? "http://127.0.0.1:1234/v1"),
                )
          }
          onCommit={(v) =>
            isCreate
              ? set?.({})
              : mark("adapterConfig", "localBaseUrl", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="http://127.0.0.1:1234/v1"
        />
      </Field>

      <Field
        label="Fallback model"
        hint="Model to use when the primary is unavailable. Can be Claude (e.g. claude-haiku-4-6) or local. Leave empty to disable fallback."
      >
        <DraftInput
          value={
            isCreate
              ? ""
              : eff(
                  "adapterConfig",
                  "fallbackModel",
                  String(config.fallbackModel ?? ""),
                )
          }
          onCommit={(v) =>
            isCreate
              ? set?.({})
              : mark("adapterConfig", "fallbackModel", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="claude-haiku-4-6 or qwen/qwen3.5-9b"
        />
      </Field>
    </>
  );
}
