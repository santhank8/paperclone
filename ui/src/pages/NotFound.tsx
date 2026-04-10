import { useEffect } from "react";
import { Link, useLocation } from "@/lib/router";
import { AlertTriangle, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { useGeneralSettings } from "../context/GeneralSettingsContext";
import { textFor } from "../lib/ui-language";

type NotFoundScope = "board" | "invalid_company_prefix" | "global";

interface NotFoundPageProps {
  scope?: NotFoundScope;
  requestedPrefix?: string;
}

export function NotFoundPage({ scope = "global", requestedPrefix }: NotFoundPageProps) {
  const location = useLocation();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { companies, selectedCompany } = useCompany();
  const { uiLanguage } = useGeneralSettings();
  const copy = {
    notFound: textFor(uiLanguage, {
      en: "Not Found",
      "zh-CN": "未找到",
    }),
    companyNotFound: textFor(uiLanguage, {
      en: "Company not found",
      "zh-CN": "未找到公司",
    }),
    pageNotFound: textFor(uiLanguage, {
      en: "Page not found",
      "zh-CN": "页面不存在",
    }),
    unknown: textFor(uiLanguage, {
      en: "unknown",
      "zh-CN": "未知",
    }),
    routeDoesNotExist: textFor(uiLanguage, {
      en: "This route does not exist.",
      "zh-CN": "这个路由不存在。",
    }),
    requestedPath: textFor(uiLanguage, {
      en: "Requested path:",
      "zh-CN": "请求路径：",
    }),
    openDashboard: textFor(uiLanguage, {
      en: "Open dashboard",
      "zh-CN": "打开仪表盘",
    }),
    goHome: textFor(uiLanguage, {
      en: "Go home",
      "zh-CN": "回到首页",
    }),
  };

  useEffect(() => {
    setBreadcrumbs([{ label: copy.notFound }]);
  }, [copy.notFound, setBreadcrumbs]);

  const fallbackCompany = selectedCompany ?? companies[0] ?? null;
  const dashboardHref = fallbackCompany ? `/${fallbackCompany.issuePrefix}/dashboard` : "/";
  const currentPath = `${location.pathname}${location.search}${location.hash}`;
  const normalizedPrefix = requestedPrefix?.toUpperCase();

  const title = scope === "invalid_company_prefix" ? copy.companyNotFound : copy.pageNotFound;
  const description =
    scope === "invalid_company_prefix"
      ? uiLanguage === "zh-CN"
        ? `没有公司匹配前缀“${normalizedPrefix ?? copy.unknown}”。`
        : `No company matches prefix "${normalizedPrefix ?? copy.unknown}".`
      : copy.routeDoesNotExist;

  return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {copy.requestedPath} <code className="font-mono">{currentPath}</code>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild>
            <Link to={dashboardHref}>
              <Compass className="mr-1.5 h-4 w-4" />
              {copy.openDashboard}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">{copy.goHome}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
