import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { Button } from "@/components/ui/button";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";

export function InstanceGeneralSettings() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { i18n, t } = useTranslation();
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: t("instanceSettings.title") },
      { label: t("instanceSettings.general") },
    ]);
  }, [setBreadcrumbs, t]);

  const languageOptions = [
    {
      code: "en" as const,
      title: t("languageSwitcher.en"),
      description: t("instanceSettings.generalPage.languageOptions.en"),
    },
    {
      code: "pt-BR" as const,
      title: t("languageSwitcher.ptBR"),
      description: t("instanceSettings.generalPage.languageOptions.ptBR"),
    },
  ];

  const generalQuery = useQuery({
    queryKey: queryKeys.instance.generalSettings,
    queryFn: () => instanceSettingsApi.getGeneral(),
  });

  const updateLanguageMutation = useMutation({
    mutationFn: async (language: "en" | "pt-BR") =>
      instanceSettingsApi.updateGeneral({ language }),
    onSuccess: async (settings) => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.generalSettings });
      await i18n.changeLanguage(settings.language);
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : t("instanceSettings.generalPage.errors.updateLanguage"),
      );
    },
  });

  if (generalQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{t("instanceSettings.generalPage.loading")}</div>;
  }

  if (generalQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {generalQuery.error instanceof Error
          ? generalQuery.error.message
          : t("instanceSettings.generalPage.errors.load")}
      </div>
    );
  }

  const selectedLanguage = generalQuery.data?.language ?? "en";

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t("instanceSettings.general")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t("instanceSettings.generalPage.description")}</p>
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{t("instanceSettings.generalPage.systemLanguageTitle")}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("instanceSettings.generalPage.systemLanguageDescription")}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {languageOptions.map((option) => {
              const selected = selectedLanguage === option.code;
              const saving =
                updateLanguageMutation.isPending && updateLanguageMutation.variables === option.code;
              return (
                <div
                  key={option.code}
                  className={[
                    "rounded-xl border p-4 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-accent/30",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">{option.title}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{option.description}</div>
                    </div>
                    <Button
                      type="button"
                      variant={selected ? "default" : "outline"}
                      size="sm"
                      disabled={updateLanguageMutation.isPending}
                      onClick={(event) => {
                        event.stopPropagation();
                        updateLanguageMutation.mutate(option.code);
                      }}
                    >
                      {saving
                        ? t("instanceSettings.generalPage.actions.saving")
                        : selected
                          ? t("instanceSettings.generalPage.actions.selected")
                          : t("instanceSettings.generalPage.actions.use")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
