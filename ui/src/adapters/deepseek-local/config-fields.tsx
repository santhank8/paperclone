import type { AdapterConfigFieldsProps } from "../types";
import {
  DraftInput,
  Field,
} from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

export function DeepSeekLocalConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  return (
    <>
      <Field label="API 基础地址" hint="DeepSeek API 端点地址，一般不需要修改">
        <DraftInput
          value={
            isCreate
              ? (values!.url ?? "https://api.deepseek.com")
              : eff("adapterConfig", "baseUrl", String(config.baseUrl ?? "https://api.deepseek.com"))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ url: v })
              : mark("adapterConfig", "baseUrl", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="https://api.deepseek.com"
        />
      </Field>
    </>
  );
}
