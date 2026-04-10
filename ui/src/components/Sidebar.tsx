import {
  Inbox,
  CircleDot,
  Target,
  LayoutDashboard,
  DollarSign,
  History,
  Search,
  SquarePen,
  Network,
  Boxes,
  Repeat,
  Settings,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarProjects } from "./SidebarProjects";
import { SidebarAgents } from "./SidebarAgents";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { useGeneralSettings } from "../context/GeneralSettingsContext";
import { heartbeatsApi } from "../api/heartbeats";
import { queryKeys } from "../lib/queryKeys";
import { useInboxBadge } from "../hooks/useInboxBadge";
import { Button } from "@/components/ui/button";
import { PluginSlotOutlet } from "@/plugins/slots";
import { textFor } from "../lib/ui-language";

export function Sidebar() {
  const { openNewIssue } = useDialog();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { uiLanguage } = useGeneralSettings();
  const inboxBadge = useInboxBadge(selectedCompanyId);
  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });
  const liveRunCount = liveRuns?.length ?? 0;

  function openSearch() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  }

  const pluginContext = {
    companyId: selectedCompanyId,
    companyPrefix: selectedCompany?.issuePrefix ?? null,
  };

  const copy = {
    selectCompany: textFor(uiLanguage, {
      en: "Select company",
      "zh-CN": "选择公司",
    }),
    newIssue: textFor(uiLanguage, {
      en: "New Issue",
      "zh-CN": "新建任务",
    }),
    dashboard: textFor(uiLanguage, {
      en: "Dashboard",
      "zh-CN": "仪表盘",
    }),
    inbox: textFor(uiLanguage, {
      en: "Inbox",
      "zh-CN": "收件箱",
    }),
    work: textFor(uiLanguage, {
      en: "Work",
      "zh-CN": "工作",
    }),
    issues: textFor(uiLanguage, {
      en: "Issues",
      "zh-CN": "任务",
    }),
    routines: textFor(uiLanguage, {
      en: "Routines",
      "zh-CN": "例行任务",
    }),
    goals: textFor(uiLanguage, {
      en: "Goals",
      "zh-CN": "目标",
    }),
    company: textFor(uiLanguage, {
      en: "Company",
      "zh-CN": "公司",
    }),
    org: textFor(uiLanguage, {
      en: "Org",
      "zh-CN": "组织架构",
    }),
    skills: textFor(uiLanguage, {
      en: "Skills",
      "zh-CN": "技能",
    }),
    costs: textFor(uiLanguage, {
      en: "Costs",
      "zh-CN": "成本",
    }),
    activity: textFor(uiLanguage, {
      en: "Activity",
      "zh-CN": "活动",
    }),
    settings: textFor(uiLanguage, {
      en: "Settings",
      "zh-CN": "设置",
    }),
  };

  return (
    <aside className="w-60 h-full min-h-0 border-r border-border bg-background flex flex-col">
      {/* Top bar: Company name (bold) + Search — aligned with top sections (no visible border) */}
      <div className="flex items-center gap-1 px-3 h-12 shrink-0">
        {selectedCompany?.brandColor && (
          <div
            className="w-4 h-4 rounded-sm shrink-0 ml-1"
            style={{ backgroundColor: selectedCompany.brandColor }}
          />
        )}
        <span className="flex-1 text-sm font-bold text-foreground truncate pl-1">
          {selectedCompany?.name ?? copy.selectCompany}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground shrink-0"
          onClick={openSearch}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-4 px-3 py-2">
        <div className="flex flex-col gap-0.5">
          {/* New Issue button aligned with nav items */}
          <button
            onClick={() => openNewIssue()}
            className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
          >
            <SquarePen className="h-4 w-4 shrink-0" />
            <span className="truncate">{copy.newIssue}</span>
          </button>
          <SidebarNavItem to="/dashboard" label={copy.dashboard} icon={LayoutDashboard} liveCount={liveRunCount} />
          <SidebarNavItem
            to="/inbox"
            label={copy.inbox}
            icon={Inbox}
            badge={inboxBadge.inbox}
            badgeTone={inboxBadge.failedRuns > 0 ? "danger" : "default"}
            alert={inboxBadge.failedRuns > 0}
          />
          <PluginSlotOutlet
            slotTypes={["sidebar"]}
            context={pluginContext}
            className="flex flex-col gap-0.5"
            itemClassName="text-[13px] font-medium"
            missingBehavior="placeholder"
          />
        </div>

        <SidebarSection label={copy.work}>
          <SidebarNavItem to="/issues" label={copy.issues} icon={CircleDot} />
          <SidebarNavItem to="/routines" label={copy.routines} icon={Repeat} textBadge={uiLanguage === "zh-CN" ? "测试版" : "Beta"} textBadgeTone="amber" />
          <SidebarNavItem to="/goals" label={copy.goals} icon={Target} />
        </SidebarSection>

        <SidebarProjects />

        <SidebarAgents />

        <SidebarSection label={copy.company}>
          <SidebarNavItem to="/org" label={copy.org} icon={Network} />
          <SidebarNavItem to="/skills" label={copy.skills} icon={Boxes} />
          <SidebarNavItem to="/costs" label={copy.costs} icon={DollarSign} />
          <SidebarNavItem to="/activity" label={copy.activity} icon={History} />
          <SidebarNavItem to="/company/settings" label={copy.settings} icon={Settings} />
        </SidebarSection>

        <PluginSlotOutlet
          slotTypes={["sidebarPanel"]}
          context={pluginContext}
          className="flex flex-col gap-3"
          itemClassName="rounded-lg border border-border p-3"
          missingBehavior="placeholder"
        />
      </nav>
    </aside>
  );
}
