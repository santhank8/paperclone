import type { VirtualOrgPortfolioCompany } from "@paperclipai/virtual-org-types";
import * as React from "react";
import { StageBadge } from "./StageBadge.js";

export function CompanyHealthCard({
  company,
  href,
}: {
  company: VirtualOrgPortfolioCompany;
  href?: string;
}) {
  const content = (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {company.brandColor ? (
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: company.brandColor }}
              />
            ) : null}
            <h3 className="text-base font-semibold">{company.name}</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{company.primaryGoal}</p>
        </div>
        <StageBadge stage={company.stage} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Metric label="Agents" value={company.activeAgents} />
        <Metric label="Open work" value={company.openIssues} />
        <Metric label="Blocked" value={company.blockedIssues} />
        <Metric label="Approvals" value={company.pendingApprovals} />
        <Metric label="Insights" value={company.activeInsights} />
        <Metric label="Tools" value={company.connectedToolCount} />
      </div>
    </div>
  );

  if (!href) return content;
  return <a href={href}>{content}</a>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
