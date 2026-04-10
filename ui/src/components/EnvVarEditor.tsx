import { useEffect, useRef, useState } from "react";
import type { CompanySecret, EnvBinding } from "@paperclipai/shared";
import { X } from "lucide-react";
import { cn } from "../lib/utils";
import { useGeneralSettings } from "../context/GeneralSettingsContext";
import { textFor } from "../lib/ui-language";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

type Row = {
  key: string;
  source: "plain" | "secret";
  plainValue: string;
  secretId: string;
};

function toRows(rec: Record<string, EnvBinding> | null | undefined): Row[] {
  if (!rec || typeof rec !== "object") {
    return [{ key: "", source: "plain", plainValue: "", secretId: "" }];
  }
  const entries = Object.entries(rec).map(([key, binding]) => {
    if (typeof binding === "string") {
      return { key, source: "plain" as const, plainValue: binding, secretId: "" };
    }
    if (
      typeof binding === "object" &&
      binding !== null &&
      "type" in binding &&
      (binding as { type?: unknown }).type === "secret_ref"
    ) {
      const record = binding as { secretId?: unknown };
      return {
        key,
        source: "secret" as const,
        plainValue: "",
        secretId: typeof record.secretId === "string" ? record.secretId : "",
      };
    }
    if (
      typeof binding === "object" &&
      binding !== null &&
      "type" in binding &&
      (binding as { type?: unknown }).type === "plain"
    ) {
      const record = binding as { value?: unknown };
      return {
        key,
        source: "plain" as const,
        plainValue: typeof record.value === "string" ? record.value : "",
        secretId: "",
      };
    }
    return { key, source: "plain" as const, plainValue: "", secretId: "" };
  });
  return [...entries, { key: "", source: "plain", plainValue: "", secretId: "" }];
}

export function EnvVarEditor({
  value,
  secrets,
  onCreateSecret,
  onChange,
}: {
  value: Record<string, EnvBinding>;
  secrets: CompanySecret[];
  onCreateSecret: (name: string, value: string) => Promise<CompanySecret>;
  onChange: (env: Record<string, EnvBinding> | undefined) => void;
}) {
  const { uiLanguage } = useGeneralSettings();
  const [rows, setRows] = useState<Row[]>(() => toRows(value));
  const [sealError, setSealError] = useState<string | null>(null);
  const valueRef = useRef(value);
  const emittingRef = useRef(false);

  useEffect(() => {
    if (emittingRef.current) {
      emittingRef.current = false;
      valueRef.current = value;
      return;
    }
    if (value !== valueRef.current) {
      valueRef.current = value;
      setRows(toRows(value));
    }
  }, [value]);

  function emit(nextRows: Row[]) {
    const rec: Record<string, EnvBinding> = {};
    for (const row of nextRows) {
      const key = row.key.trim();
      if (!key) continue;
      if (row.source === "secret") {
        if (row.secretId) {
          rec[key] = { type: "secret_ref", secretId: row.secretId, version: "latest" };
        } else {
          rec[key] = { type: "plain", value: row.plainValue };
        }
      } else {
        rec[key] = { type: "plain", value: row.plainValue };
      }
    }
    emittingRef.current = true;
    onChange(Object.keys(rec).length > 0 ? rec : undefined);
  }

  function updateRow(index: number, patch: Partial<Row>) {
    const withPatch = rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row));
    if (
      withPatch[withPatch.length - 1].key ||
      withPatch[withPatch.length - 1].plainValue ||
      withPatch[withPatch.length - 1].secretId
    ) {
      withPatch.push({ key: "", source: "plain", plainValue: "", secretId: "" });
    }
    setRows(withPatch);
    emit(withPatch);
  }

  function removeRow(index: number) {
    const next = rows.filter((_, rowIndex) => rowIndex !== index);
    if (
      next.length === 0 ||
      next[next.length - 1].key ||
      next[next.length - 1].plainValue ||
      next[next.length - 1].secretId
    ) {
      next.push({ key: "", source: "plain", plainValue: "", secretId: "" });
    }
    setRows(next);
    emit(next);
  }

  function defaultSecretName(key: string) {
    return key
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 64);
  }

  async function sealRow(index: number) {
    const row = rows[index];
    if (!row) return;
    const key = row.key.trim();
    const plain = row.plainValue;
    if (!key || plain.length === 0) return;

    const suggested = defaultSecretName(key) || textFor(uiLanguage, { en: "secret", "zh-CN": "secret" });
    const name = window.prompt(textFor(uiLanguage, { en: "Secret name", "zh-CN": "密钥名称" }), suggested)?.trim();
    if (!name) return;

    try {
      setSealError(null);
      const created = await onCreateSecret(name, plain);
      updateRow(index, { source: "secret", secretId: created.id });
    } catch (error) {
      setSealError(error instanceof Error ? error.message : textFor(uiLanguage, { en: "Failed to create secret", "zh-CN": "创建密钥失败" }));
    }
  }
  const copy = {
    plain: textFor(uiLanguage, { en: "Plain", "zh-CN": "明文" }),
    secret: textFor(uiLanguage, { en: "Secret", "zh-CN": "密钥" }),
    selectSecret: textFor(uiLanguage, { en: "Select secret...", "zh-CN": "选择密钥..." }),
    new: textFor(uiLanguage, { en: "New", "zh-CN": "新建" }),
    createFromCurrent: textFor(uiLanguage, { en: "Create secret from current plain value", "zh-CN": "根据当前明文值创建密钥" }),
    value: textFor(uiLanguage, { en: "value", "zh-CN": "值" }),
    seal: textFor(uiLanguage, { en: "Seal", "zh-CN": "加密保存" }),
    sealTitle: textFor(uiLanguage, { en: "Store value as secret and replace with reference", "zh-CN": "将该值保存为密钥并替换为引用" }),
    runtimeNote: textFor(uiLanguage, { en: "PAPERCLIP_* variables are injected automatically at runtime.", "zh-CN": "PAPERCLIP_* 变量会在运行时自动注入。" }),
  };

  return (
    <div className="space-y-1.5">
      {rows.map((row, index) => {
        const isTrailing =
          index === rows.length - 1 &&
          !row.key &&
          !row.plainValue &&
          !row.secretId;
        return (
          <div key={index} className="flex items-center gap-1.5">
            <input
              className={cn(inputClass, "flex-[2]")}
              placeholder="KEY"
              value={row.key}
              onChange={(event) => updateRow(index, { key: event.target.value })}
            />
            <select
              className={cn(inputClass, "flex-[1] bg-background")}
              value={row.source}
              onChange={(event) =>
                updateRow(index, {
                  source: event.target.value === "secret" ? "secret" : "plain",
                  ...(event.target.value === "plain" ? { secretId: "" } : {}),
                })
              }
            >
              <option value="plain">{copy.plain}</option>
              <option value="secret">{copy.secret}</option>
            </select>
            {row.source === "secret" ? (
              <>
                <select
                  className={cn(inputClass, "flex-[3] bg-background")}
                  value={row.secretId}
                  onChange={(event) => updateRow(index, { secretId: event.target.value })}
                >
                  <option value="">{copy.selectSecret}</option>
                  {secrets.map((secret) => (
                    <option key={secret.id} value={secret.id}>
                      {secret.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors shrink-0"
                  onClick={() => sealRow(index)}
                  disabled={!row.key.trim() || !row.plainValue}
                  title={copy.createFromCurrent}
                >
                  {copy.new}
                </button>
              </>
            ) : (
              <>
                <input
                  className={cn(inputClass, "flex-[3]")}
                  placeholder={copy.value}
                  value={row.plainValue}
                  onChange={(event) => updateRow(index, { plainValue: event.target.value })}
                />
                <button
                  type="button"
                  className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors shrink-0"
                  onClick={() => sealRow(index)}
                  disabled={!row.key.trim() || !row.plainValue}
                  title={copy.sealTitle}
                >
                  {copy.seal}
                </button>
              </>
            )}
            {!isTrailing ? (
              <button
                type="button"
                className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                onClick={() => removeRow(index)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <div className="w-[26px] shrink-0" />
            )}
          </div>
        );
      })}
      {sealError && <p className="text-[11px] text-destructive">{sealError}</p>}
      <p className="text-[11px] text-muted-foreground/60">
        {copy.runtimeNote}
      </p>
    </div>
  );
}
