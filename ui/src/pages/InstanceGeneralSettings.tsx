import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Languages, SlidersHorizontal } from "lucide-react";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useI18n, type LocalePreference } from "../context/I18nContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";

const localePreferenceOptions: Array<{
  value: LocalePreference;
  labelKey: string;
  descriptionEn: string;
  descriptionRu: string;
}> = [
  {
    value: "system",
    labelKey: "lang.system",
    descriptionEn: "Follow your browser language when possible.",
    descriptionRu: "Использовать язык браузера, когда это возможно.",
  },
  {
    value: "ru",
    labelKey: "lang.russian",
    descriptionEn: "Always show the interface in Russian.",
    descriptionRu: "Всегда показывать интерфейс на русском.",
  },
  {
    value: "en",
    labelKey: "lang.english",
    descriptionEn: "Always show the interface in English.",
    descriptionRu: "Всегда показывать интерфейс на английском.",
  },
];

export function InstanceGeneralSettings() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { locale, localePreference, setLocalePreference, t } = useI18n();
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: t("nav.instanceSettings") },
      { label: "General" },
    ]);
  }, [setBreadcrumbs, t]);

  const generalQuery = useQuery({
    queryKey: queryKeys.instance.generalSettings,
    queryFn: () => instanceSettingsApi.getGeneral(),
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) =>
      instanceSettingsApi.updateGeneral({ censorUsernameInLogs: enabled }),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.generalSettings });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Failed to update general settings.");
    },
  });

  if (generalQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading general settings...</div>;
  }

  if (generalQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {generalQuery.error instanceof Error
          ? generalQuery.error.message
          : "Failed to load general settings."}
      </div>
    );
  }

  const censorUsernameInLogs = generalQuery.data?.censorUsernameInLogs === true;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">General</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure instance-wide defaults that affect how operator-visible logs are displayed.
        </p>
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">Censor username in logs</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Hide the username segment in home-directory paths and similar operator-visible log output. Standalone
              username mentions outside of paths are not yet masked in the live transcript view. This is off by
              default.
            </p>
          </div>
          <button
            type="button"
            data-slot="toggle"
            aria-label="Toggle username log censoring"
            disabled={toggleMutation.isPending}
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              censorUsernameInLogs ? "bg-green-600" : "bg-muted",
            )}
            onClick={() => toggleMutation.mutate(!censorUsernameInLogs)}
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

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">{t("lang.section")}</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("preferences.desc")}
          </p>
        </div>

        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{t("lang.preference")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("lang.preferenceDesc")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("lang.preferenceStored")}
          </p>
        </div>

        <div className="space-y-3">
          {localePreferenceOptions.map((option) => {
            const isSelected = localePreference === option.value;
            const description = locale === "ru" ? option.descriptionRu : option.descriptionEn;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setLocalePreference(option.value)}
                className={cn(
                  "flex w-full items-start justify-between gap-4 rounded-lg border px-4 py-3 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-accent/40"
                    : "border-border hover:bg-accent/20",
                )}
              >
                <div className="space-y-1">
                  <div className="text-sm font-medium">{t(option.labelKey)}</div>
                  <div className="text-sm text-muted-foreground">{description}</div>
                </div>
                <span
                  className={cn(
                    "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-transparent",
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
              </button>
            );
          })}
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-semibold">{t("lang.current")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {locale === "ru" ? t("lang.russian") : t("lang.english")}
          </p>
        </div>
      </section>
    </div>
  );
}
