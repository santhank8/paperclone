import type { AdapterConfigFieldsProps } from "../types";
import {
  DraftInput,
  Field,
  ToggleField,
} from "../../components/agent-config-primitives";
import { ChoosePathButton } from "../../components/PathInstructionsModal";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";
const instructionsFileHint =
  "Markdown 文件的绝对路径（例如 AGENTS.md），用于定义此 Agent 的行为。运行时预置到 Gemini 提示词中。";

export function GeminiLocalConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  return (
    <>
      <Field label="Agent 指令文件" hint={instructionsFileHint}>
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
            placeholder="/绝对路径/AGENTS.md"
          />
          <ChoosePathButton />
        </div>
      </Field>
      <ToggleField
        label="Yolo 模式"
        hint="以 --approval-mode yolo 运行 Gemini，用于无人值守操作。"
        checked={
          isCreate
            ? values!.dangerouslyBypassSandbox
            : eff("adapterConfig", "yolo", config.yolo === true)
        }
        onChange={(v) =>
          isCreate
            ? set!({ dangerouslyBypassSandbox: v })
            : mark("adapterConfig", "yolo", v)
        }
      />
    </>
  );
}
