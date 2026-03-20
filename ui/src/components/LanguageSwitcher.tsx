import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { instanceSettingsApi } from "@/api/instanceSettings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/lib/queryKeys";

const LANGUAGES = [
  { code: "en", key: "languageSwitcher.en" },
  { code: "pt-BR", key: "languageSwitcher.ptBR" },
] as const;

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();
  const generalSettingsQuery = useQuery({
    queryKey: queryKeys.instance.generalSettings,
    queryFn: () => instanceSettingsApi.getGeneral(),
  });

  const updateLanguageMutation = useMutation({
    mutationFn: async (language: "en" | "pt-BR") =>
      instanceSettingsApi.updateGeneral({ language }),
    onSuccess: async (settings) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.generalSettings });
      await i18n.changeLanguage(settings.language);
    },
  });

  useEffect(() => {
    const preferredLanguage = generalSettingsQuery.data?.language;
    if (!preferredLanguage) return;
    if (i18n.language === preferredLanguage) return;
    void i18n.changeLanguage(preferredLanguage);
  }, [generalSettingsQuery.data?.language, i18n]);

  function handleLanguageSelect(language: "en" | "pt-BR") {
    if (generalSettingsQuery.isError) {
      void i18n.changeLanguage(language);
      return;
    }
    updateLanguageMutation.mutate(language);
  }

  const currentLanguage =
    LANGUAGES.find((language) => language.code === (generalSettingsQuery.data?.language ?? i18n.language))
    ?? LANGUAGES.find((language) => (generalSettingsQuery.data?.language ?? i18n.language).startsWith(language.code))
    ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          aria-label={t("languageSwitcher.label")}
        >
          <Globe className="h-4 w-4" />
          <span className="text-xs">{t(currentLanguage.key)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {LANGUAGES.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageSelect(language.code)}
            className={
              currentLanguage.code === language.code ? "font-semibold bg-accent/40" : ""
            }
          >
            {t(language.key)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
