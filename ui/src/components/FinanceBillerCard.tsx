import type { FinanceByBiller } from "@paperclipai/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents, providerDisplayName } from "@/lib/utils";
import { useGeneralSettings } from "../context/GeneralSettingsContext";
import { textFor } from "../lib/ui-language";

interface FinanceBillerCardProps {
  row: FinanceByBiller;
}

export function FinanceBillerCard({ row }: FinanceBillerCardProps) {
  const { uiLanguage } = useGeneralSettings();
  return (
    <Card>
      <CardHeader className="px-4 pt-4 pb-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{providerDisplayName(row.biller)}</CardTitle>
            <CardDescription className="mt-1 text-xs">
              {textFor(uiLanguage, {
                en: `${row.eventCount} event${row.eventCount === 1 ? "" : "s"} across ${row.kindCount} kind${row.kindCount === 1 ? "" : "s"}`,
                "zh-CN": `${row.eventCount} 条事件，覆盖 ${row.kindCount} 种类型`,
              })}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold tabular-nums">{formatCents(row.netCents)}</div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {textFor(uiLanguage, { en: "net", "zh-CN": "净额" })}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 pt-3">
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <div className="border border-border p-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {textFor(uiLanguage, { en: "debits", "zh-CN": "支出" })}
            </div>
            <div className="mt-1 font-medium tabular-nums">{formatCents(row.debitCents)}</div>
          </div>
          <div className="border border-border p-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {textFor(uiLanguage, { en: "credits", "zh-CN": "入账" })}
            </div>
            <div className="mt-1 font-medium tabular-nums">{formatCents(row.creditCents)}</div>
          </div>
          <div className="border border-border p-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {textFor(uiLanguage, { en: "estimated", "zh-CN": "估算" })}
            </div>
            <div className="mt-1 font-medium tabular-nums">{formatCents(row.estimatedDebitCents)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
