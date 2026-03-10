import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  help,
} from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

const modelHint = "Gemini model to use (e.g., gemini-2.5-flash, gemini-2.5-pro)";
const apiKeyHint = "Set GEMINI_API_KEY or GOOGLE_API_KEY environment variable, or run `gemini login` for OAuth";

export function GeminiLocalConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  return (
    <Field label="API Key" hint={apiKeyHint}>
      <div className="text-xs text-muted-foreground">
        Set GEMINI_API_KEY in environment variables, or use OAuth by running `gemini login`
      </div>
    </Field>
  );
}
