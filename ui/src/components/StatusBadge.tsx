import { cn } from "../lib/utils";
import { statusBadge, statusBadgeDefault } from "../lib/status-colors";
import { useGeneralSettings } from "../context/GeneralSettingsContext";
import { textFor } from "../lib/ui-language";

export function StatusBadge({ status }: { status: string }) {
  const { uiLanguage } = useGeneralSettings();
  const labelMap: Record<string, string> = {
    idle: textFor(uiLanguage, { en: "idle", "zh-CN": "空闲" }),
    active: textFor(uiLanguage, { en: "active", "zh-CN": "活跃" }),
    running: textFor(uiLanguage, { en: "running", "zh-CN": "运行中" }),
    paused: textFor(uiLanguage, { en: "paused", "zh-CN": "已暂停" }),
    error: textFor(uiLanguage, { en: "error", "zh-CN": "异常" }),
    queued: textFor(uiLanguage, { en: "queued", "zh-CN": "排队中" }),
    blocked: textFor(uiLanguage, { en: "blocked", "zh-CN": "阻塞" }),
    open: textFor(uiLanguage, { en: "open", "zh-CN": "打开" }),
    done: textFor(uiLanguage, { en: "done", "zh-CN": "完成" }),
    closed: textFor(uiLanguage, { en: "closed", "zh-CN": "已关闭" }),
    approved: textFor(uiLanguage, { en: "approved", "zh-CN": "已批准" }),
    rejected: textFor(uiLanguage, { en: "rejected", "zh-CN": "已拒绝" }),
    terminated: textFor(uiLanguage, { en: "terminated", "zh-CN": "已终止" }),
    pending_approval: textFor(uiLanguage, { en: "pending approval", "zh-CN": "待审批" }),
    in_progress: textFor(uiLanguage, { en: "in progress", "zh-CN": "进行中" }),
  };
  const label = labelMap[status] ?? status.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0",
        statusBadge[status] ?? statusBadgeDefault
      )}
    >
      {label}
    </span>
  );
}
