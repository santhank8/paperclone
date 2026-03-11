import { Check, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const activeLanguage = i18n.resolvedLanguage ?? i18n.language;

  const changeLanguage = (lng: string) => {
    void i18n.changeLanguage(lng).catch(() => {});
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground shrink-0"
          title={t("languageSwitcher.title")}
        >
          <Languages className="h-4 w-4" />
          <span className="sr-only">{t("languageSwitcher.title")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => changeLanguage("en-US")}>
          {activeLanguage === "en-US" ? <Check className="mr-2 h-3 w-3" /> : <span className="mr-2 w-3" />}
          English (US)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => changeLanguage("zh-CN")}>
          {activeLanguage === "zh-CN" ? <Check className="mr-2 h-3 w-3" /> : <span className="mr-2 w-3" />}
          简体中文
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => changeLanguage("zh-HK")}>
          {activeLanguage === "zh-HK" ? <Check className="mr-2 h-3 w-3" /> : <span className="mr-2 w-3" />}
          繁體中文
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => changeLanguage("ja-JP")}>
          {activeLanguage === "ja-JP" ? <Check className="mr-2 h-3 w-3" /> : <span className="mr-2 w-3" />}
          日本語
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => changeLanguage("ko-KR")}>
          {activeLanguage === "ko-KR" ? <Check className="mr-2 h-3 w-3" /> : <span className="mr-2 w-3" />}
          한국어
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
