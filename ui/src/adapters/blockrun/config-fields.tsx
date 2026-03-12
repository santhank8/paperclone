import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
  DraftNumberInput,
} from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

function SecretField({
  label,
  hint,
  value,
  onCommit,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          {visible ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
        </button>
        <DraftInput
          value={value}
          onCommit={onCommit}
          immediate
          type={visible ? "text" : "password"}
          className={inputClass + " pl-8"}
          placeholder={placeholder}
        />
      </div>
    </Field>
  );
}

const ROUTING_MODES = [
  { value: "balanced", label: "Balanced (GPT-4o, Claude Sonnet)" },
  { value: "fast", label: "Fast (Gemini Flash, GPT-4o-mini)" },
  { value: "powerful", label: "Powerful (GPT-5.4, Claude Opus)" },
  { value: "cheap", label: "Cheap (DeepSeek, Gemini Flash)" },
  { value: "reasoning", label: "Reasoning (o3, DeepSeek Reasoner)" },
] as const;

export function BlockRunConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
  models,
}: AdapterConfigFieldsProps) {
  const hasModels = models.length > 0;
  const effectiveModel = isCreate
    ? values!.model
    : eff("adapterConfig", "model", String(config.model ?? ""));

  return (
    <>
      {/* Private Key (required for paid models) */}
      {isCreate ? (
        <SecretField
          label="Wallet private key"
          hint="Ethereum hex private key (0x-prefixed) for x402 USDC payments. Only needed for paid models."
          value={values!.url ?? ""}
          onCommit={(v) => set!({ url: v })}
          placeholder="0xac0974bec39a17e36ba..."
        />
      ) : (
        <SecretField
          label="Wallet private key"
          hint="Ethereum hex private key (0x-prefixed) for x402 USDC payments."
          value={eff(
            "adapterConfig",
            "privateKey",
            String(config.privateKey ?? ""),
          )}
          onCommit={(v) =>
            mark("adapterConfig", "privateKey", v || undefined)
          }
          placeholder="0xac0974bec39a17e36ba..."
        />
      )}

      {/* Model selector */}
      <Field
        label="Model"
        hint='Select a model or leave blank to use routing mode. Format: provider/model (e.g., "openai/gpt-4o").'
      >
        {hasModels ? (
          <select
            value={effectiveModel}
            onChange={(e) =>
              isCreate
                ? set!({ model: e.target.value })
                : mark(
                    "adapterConfig",
                    "model",
                    e.target.value || undefined,
                  )
            }
            className={inputClass}
          >
            <option value="">Auto (use routing mode)</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        ) : (
          <DraftInput
            value={effectiveModel}
            onCommit={(v) =>
              isCreate
                ? set!({ model: v })
                : mark("adapterConfig", "model", v || undefined)
            }
            immediate
            className={inputClass}
            placeholder="openai/gpt-4o"
          />
        )}
      </Field>

      {/* Routing mode (when no model set) */}
      {!effectiveModel && (
        <Field
          label="Routing mode"
          hint="Smart routing selects the best model for the task."
        >
          <select
            value={
              isCreate
                ? "balanced"
                : eff(
                    "adapterConfig",
                    "routingMode",
                    String(config.routingMode ?? "balanced"),
                  )
            }
            onChange={(e) =>
              isCreate
                ? set!({ extraArgs: e.target.value })
                : mark("adapterConfig", "routingMode", e.target.value)
            }
            className={inputClass}
          >
            {ROUTING_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* Network */}
      {!isCreate && (
        <>
          <Field
            label="Network"
            hint="mainnet uses real USDC, testnet uses Base Sepolia."
          >
            <select
              value={eff(
                "adapterConfig",
                "network",
                String(config.network ?? "mainnet"),
              )}
              onChange={(e) =>
                mark("adapterConfig", "network", e.target.value)
              }
              className={inputClass}
            >
              <option value="mainnet">Mainnet (Base)</option>
              <option value="testnet">Testnet (Base Sepolia)</option>
            </select>
          </Field>

          {/* System prompt */}
          <Field
            label="System prompt"
            hint="Additional instructions prepended to every request."
          >
            <textarea
              className={`${inputClass} min-h-[80px]`}
              value={eff(
                "adapterConfig",
                "systemPrompt",
                String(config.systemPrompt ?? ""),
              )}
              onChange={(e) =>
                mark(
                  "adapterConfig",
                  "systemPrompt",
                  e.target.value || undefined,
                )
              }
              placeholder="You are a helpful assistant..."
            />
          </Field>

          {/* Max tokens */}
          <Field label="Max tokens" hint="Maximum output tokens per request.">
            <DraftNumberInput
              value={eff(
                "adapterConfig",
                "maxTokens",
                Number(config.maxTokens ?? 4096),
              )}
              onCommit={(v) =>
                mark("adapterConfig", "maxTokens", v || 4096)
              }
              immediate
              className={inputClass}
            />
          </Field>

          {/* Temperature */}
          <Field label="Temperature" hint="Sampling temperature (0-2).">
            <DraftNumberInput
              value={eff(
                "adapterConfig",
                "temperature",
                Number(config.temperature ?? 0.7),
              )}
              onCommit={(v) =>
                mark("adapterConfig", "temperature", v ?? 0.7)
              }
              immediate
              className={inputClass}
            />
          </Field>

          {/* API URL override */}
          <Field
            label="API URL override"
            hint="Custom BlockRun API URL. Leave blank for default."
          >
            <DraftInput
              value={eff(
                "adapterConfig",
                "apiUrl",
                String(config.apiUrl ?? ""),
              )}
              onCommit={(v) =>
                mark("adapterConfig", "apiUrl", v || undefined)
              }
              immediate
              className={inputClass}
              placeholder="https://blockrun.ai/api"
            />
          </Field>

          {/* Timeout */}
          <Field label="Timeout (seconds)">
            <DraftNumberInput
              value={eff(
                "adapterConfig",
                "timeoutSec",
                Number(config.timeoutSec ?? 120),
              )}
              onCommit={(v) =>
                mark("adapterConfig", "timeoutSec", v || 120)
              }
              immediate
              className={inputClass}
            />
          </Field>
        </>
      )}
    </>
  );
}
