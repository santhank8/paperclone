import { cn } from "../lib/utils";
import { statusBadge, statusBadgeDefault } from "../lib/status-colors";

const statusLabels: Record<string, string> = {
  "open": "开放",
  "in_progress": "进行中",
  "in progress": "进行中",
  "completed": "已完成",
  "cancelled": "已取消",
  "blocked": "已阻塞",
  "running": "运行中",
  "queued": "排队中",
  "failed": "失败",
  "errored": "出错",
  "paused": "已暂停",
  "active": "活跃",
  "terminated": "已终止",
  "pending": "待处理",
  "approved": "已批准",
  "rejected": "已拒绝",
  "backlog": "待处理",
  "planned": "已规划",
  "archived": "已归档",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0",
        statusBadge[status] ?? statusBadgeDefault
      )}
    >
      {statusLabels[status.toLowerCase()] ?? status.replace("_", " ")}
    </span>
  );
}
