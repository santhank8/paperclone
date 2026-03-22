import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { localizationPackSchema, type LocalizationPack } from "@paperclipai/shared";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { localesApi } from "@/api/locales";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useI18n } from "../i18n";
import { enMessages } from "../i18n/resources/en";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildEnglishPack(): LocalizationPack {
  return {
    schemaVersion: 1,
    locale: "en",
    label: "English",
    baseLocale: "en",
    messages: { ...enMessages },
  };
}

export function InstanceGeneralSettings() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedExportLocale, setSelectedExportLocale] = useState("en");
  const [selectedImportFileName, setSelectedImportFileName] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const {
    t,
    locales,
    localePreference,
    setLocalePreference,
  } = useI18n();

  useEffect(() => {
    setBreadcrumbs([
      { label: t("breadcrumbs.instanceSettings") },
      { label: t("breadcrumbs.general") },
    ]);
  }, [setBreadcrumbs, t]);

  const generalQuery = useQuery({
    queryKey: queryKeys.instance.generalSettings,
    queryFn: () => instanceSettingsApi.getGeneral(),
  });

  const updateGeneralMutation = useMutation({
    mutationFn: instanceSettingsApi.updateGeneral,
    onSuccess: async (_, variables) => {
      setActionError(null);
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: queryKeys.instance.generalSettings }),
      ];
      if (variables.defaultLocale !== undefined) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.instance.locales }),
        );
      }
      await Promise.all(invalidations);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t("instance.general.updateFailed"));
    },
  });

  const importLocaleMutation = useMutation({
    mutationFn: async (pack: LocalizationPack) => localesApi.put(pack.locale, pack),
    onSuccess: async (pack) => {
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.instance.locales }),
        queryClient.invalidateQueries({ queryKey: queryKeys.instance.localePack(pack.locale) }),
      ]);
      setSelectedImportFileName(null);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : t("instance.general.importFailed"));
    },
  });

  const localeOptions = useMemo(() => {
    return locales.map((locale) => ({
      value: locale.locale,
      label: locale.label ?? locale.locale,
    }));
  }, [locales]);

  useEffect(() => {
    if (localeOptions.some((option) => option.value === selectedExportLocale)) return;
    setSelectedExportLocale("en");
  }, [localeOptions, selectedExportLocale]);

  if (generalQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{t("instance.general.loading")}</div>;
  }

  if (generalQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {generalQuery.error instanceof Error
          ? generalQuery.error.message
          : t("instance.general.loadFailed")}
      </div>
    );
  }

  const censorUsernameInLogs = generalQuery.data?.censorUsernameInLogs === true;
  const defaultLocale = generalQuery.data?.defaultLocale ?? "en";

  async function handleExportLocalePack() {
    setIsExporting(true);
    try {
      setActionError(null);
      const pack = selectedExportLocale === "en"
        ? buildEnglishPack()
        : await localesApi.get(selectedExportLocale);
      downloadJson(`${pack.locale}.json`, pack);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("instance.general.exportFailed"));
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedImportFileName(file.name);
    try {
      const parsed = localizationPackSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) {
        setActionError(t("instance.general.importFailed"));
        return;
      }
      importLocaleMutation.mutate(parsed.data);
    } catch {
      setActionError(t("instance.general.importFailed"));
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t("instance.general.title")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t("instance.general.description")}</p>
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t("instance.general.censorUsernames")}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("instance.general.censorUsernamesDescription")}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("instance.general.censorUsernamesToggle")}
            disabled={updateGeneralMutation.isPending}
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              censorUsernameInLogs ? "bg-green-600" : "bg-muted",
            )}
            onClick={() => updateGeneralMutation.mutate({ censorUsernameInLogs: !censorUsernameInLogs })}
          >
            <span
              className={cn(
                "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                censorUsernameInLogs ? "translate-x-4.5" : "translate-x-0.5",
              )}
            />
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="space-y-1.5">
          <h2 className="text-sm font-semibold">{t("instance.general.defaultLocale")}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("instance.general.defaultLocaleDescription")}
          </p>
        </div>
        <Select
          value={defaultLocale}
          onValueChange={(value) => updateGeneralMutation.mutate({ defaultLocale: value })}
          disabled={updateGeneralMutation.isPending}
        >
          <SelectTrigger className="w-full md:max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {localeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="space-y-1.5">
          <h2 className="text-sm font-semibold">{t("instance.general.localePreference")}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("instance.general.localePreferenceDescription")}
          </p>
        </div>
        <Select value={localePreference} onValueChange={setLocalePreference}>
          <SelectTrigger className="w-full md:max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="instance">{t("common.instanceDefault")}</SelectItem>
            <SelectItem value="browser">{t("common.browserLanguage")}</SelectItem>
            {localeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="space-y-1.5">
          <h2 className="text-sm font-semibold">{t("common.language")}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("instance.general.localePackDescription")}
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Select value={selectedExportLocale} onValueChange={setSelectedExportLocale}>
            <SelectTrigger className="w-full md:max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {localeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={handleExportLocalePack}
            disabled={isExporting}
          >
            {isExporting ? t("common.loading") : t("instance.general.exportLocalePack")}
          </Button>
        </div>

        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportFileChange}
          />
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importLocaleMutation.isPending}
            >
              {importLocaleMutation.isPending
                ? t("common.loading")
                : t("instance.general.chooseFile")}
            </Button>
            <span className="text-sm text-muted-foreground">
              {selectedImportFileName ?? t("instance.general.noFileChosen")}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
