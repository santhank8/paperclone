import type { FinanceByKind } from "@paperclipai/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { financeEventKindDisplayName, formatCents } from "@/lib/utils";
import { useGeneralSettings } from "../context/GeneralSettingsContext";
import { textFor } from "../lib/ui-language";

interface FinanceKindCardProps {
  rows: FinanceByKind[];
}

export function FinanceKindCard({ rows }: FinanceKindCardProps) {
  const { uiLanguage } = useGeneralSettings();
  return (
    <Card>
      <CardHeader className="px-4 pt-4 pb-1">
        <CardTitle className="text-base">{textFor(uiLanguage, { en: "Financial event mix", "zh-CN": "财务事件构成" })}</CardTitle>
        <CardDescription>
          {textFor(uiLanguage, { en: "Account-level charges grouped by event kind.", "zh-CN": "按事件类型聚合的账户级费用。" })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4 pt-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{textFor(uiLanguage, { en: "No finance events in this period.", "zh-CN": "当前时间范围内没有财务事件。" })}</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.eventKind}
              className="flex items-center justify-between gap-3 border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{financeEventKindDisplayName(row.eventKind)}</div>
                <div className="text-xs text-muted-foreground">
                  {textFor(uiLanguage, {
                    en: `${row.eventCount} event${row.eventCount === 1 ? "" : "s"} · ${row.billerCount} biller${row.billerCount === 1 ? "" : "s"}`,
                    "zh-CN": `${row.eventCount} 条事件 · ${row.billerCount} 个 biller`,
                  })}
                </div>
              </div>
              <div className="text-right tabular-nums">
                <div className="text-sm font-medium">{formatCents(row.netCents)}</div>
                <div className="text-xs text-muted-foreground">
                  {textFor(uiLanguage, {
                    en: `${formatCents(row.debitCents)} debits`,
                    "zh-CN": `${formatCents(row.debitCents)} 支出`,
                  })}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
