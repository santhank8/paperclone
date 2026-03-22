import type { AdapterConfigFieldsProps } from "../types";
import {
  DraftInput,
  Field,
} from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

export function QwenLocalConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  return (
    <>
      <Field label="API 基础地址" hint="阿里云 DashScope 兼容模式端点地址，一般不需要修改">
        <DraftInput
          value={
            isCreate
              ? (values!.url ?? "https://dashscope.aliyuncs.com/compatible-mode/v1")
              : eff("adapterConfig", "baseUrl", String(config.baseUrl ?? "https://dashscope.aliyuncs.com/compatible-mode/v1"))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ url: v })
              : mark("adapterConfig", "baseUrl", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
        />
      </Field>
    </>
  );
}
