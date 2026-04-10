import type { FinanceEvent } from "@paperclipai/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  financeDirectionDisplayName,
  financeEventKindDisplayName,
  formatCents,
  formatDateTime,
  providerDisplayName,
} from "@/lib/utils";
import { useGeneralSettings } from "../context/GeneralSettingsContext";
import { textFor } from "../lib/ui-language";

interface FinanceTimelineCardProps {
  rows: FinanceEvent[];
  emptyMessage?: string;
}

export function FinanceTimelineCard({
  rows,
  emptyMessage = "No financial events in this period.",
}: FinanceTimelineCardProps) {
  const { uiLanguage } = useGeneralSettings();
  return (
    <Card>
      <CardHeader className="px-4 pt-4 pb-1">
        <CardTitle className="text-base">{textFor(uiLanguage, { en: "Recent financial events", "zh-CN": "最近财务事件" })}</CardTitle>
        <CardDescription>
          {textFor(uiLanguage, { en: "Top-ups, fees, credits, commitments, and other non-request charges.", "zh-CN": "充值、费用、积分、承诺金及其他非请求级收费。" })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 pt-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {emptyMessage === "No financial events in this period."
              ? textFor(uiLanguage, { en: emptyMessage, "zh-CN": "当前时间范围内没有财务事件。" })
              : emptyMessage}
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="border border-border p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{financeEventKindDisplayName(row.eventKind)}</Badge>
                    <Badge variant={row.direction === "credit" ? "outline" : "secondary"}>
                      {financeDirectionDisplayName(row.direction)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(row.occurredAt)}</span>
                  </div>
                  <div className="text-sm font-medium">
                    {providerDisplayName(row.biller)}
                    {row.provider ? ` -> ${providerDisplayName(row.provider)}` : ""}
                    {row.model ? <span className="ml-1 font-mono text-xs text-muted-foreground">{row.model}</span> : null}
                  </div>
                  {(row.description || row.externalInvoiceId || row.region || row.pricingTier) && (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {row.description ? <div>{row.description}</div> : null}
                      {row.externalInvoiceId ? <div>{textFor(uiLanguage, { en: `invoice ${row.externalInvoiceId}`, "zh-CN": `发票 ${row.externalInvoiceId}` })}</div> : null}
                      {row.region ? <div>{textFor(uiLanguage, { en: `region ${row.region}`, "zh-CN": `区域 ${row.region}` })}</div> : null}
                      {row.pricingTier ? <div>{textFor(uiLanguage, { en: `tier ${row.pricingTier}`, "zh-CN": `层级 ${row.pricingTier}` })}</div> : null}
                    </div>
                  )}
                </div>
                <div className="text-right tabular-nums">
                  <div className="text-sm font-semibold">{formatCents(row.amountCents)}</div>
                  <div className="text-xs text-muted-foreground">{row.currency}</div>
                  {row.estimated ? (
                    <div className="text-[11px] uppercase tracking-[0.12em] text-amber-600">
                      {textFor(uiLanguage, { en: "estimated", "zh-CN": "估算" })}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
