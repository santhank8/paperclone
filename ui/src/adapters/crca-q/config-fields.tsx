import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
} from "../../components/agent-config-primitives";

type ExecutionMode = "disabled" | "paper" | "live";

function normalizeMode(s: string | undefined): ExecutionMode {
  if (s === "paper" || s === "live") return s;
  return "disabled";
}

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono";

function baseEnv(config: Record<string, unknown>): Record<string, string> {
  const e = config.env;
  if (!e || typeof e !== "object" || Array.isArray(e)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(e as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export function CrcaQConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  const env = baseEnv(config);
  const modeFromConfig = normalizeMode(env.CRCA_Q_EXECUTION_MODE);

  const editMode: ExecutionMode = (() => {
    if (isCreate) return normalizeMode(values!.crcaExecutionMode);
    const merged = eff("adapterConfig", "env", env) as Record<
      string,
      unknown
    >;
    const m = merged.CRCA_Q_EXECUTION_MODE;
    if (m === "paper" || m === "live" || m === "disabled") return m;
    return modeFromConfig;
  })();

  return (
    <>
      <Field
        label="Working directory"
        hint="Intellitrade-CRCA root (must contain CR-CA/). From Intellitrade-CRCA/crca_q run: pip install -e ."
      >
        <DraftInput
          value={
            isCreate
              ? values!.cwd
              : eff("adapterConfig", "cwd", String(config.cwd ?? ""))
          }
          onCommit={(v: string) =>
            isCreate
              ? set!({ cwd: v })
              : mark("adapterConfig", "cwd", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder="/path/to/Intellitrade-CRCA"
        />
      </Field>
      <Field
        label="Execution mode"
        hint="disabled = no orders; paper/live use ccxt when enabled in CRCA-Q"
      >
        <select
          className={inputClass}
          value={editMode}
          onChange={(e) => {
            const m = e.target.value as ExecutionMode;
            if (isCreate) {
              set!({ crcaExecutionMode: m });
            } else {
              const merged = eff("adapterConfig", "env", env) as Record<
                string,
                unknown
              >;
              const flat: Record<string, string> = {};
              for (const [k, v] of Object.entries(merged)) {
                if (typeof v === "string") flat[k] = v;
              }
              mark("adapterConfig", "env", {
                ...flat,
                CRCA_Q_EXECUTION_MODE: m,
              });
            }
          }}
        >
          <option value="disabled">disabled (safest)</option>
          <option value="paper">paper</option>
          <option value="live">live</option>
        </select>
      </Field>
    </>
  );
}
