import { useQuery } from "@tanstack/react-query";
import { Clock3, Cpu, FlaskConical, Puzzle, Settings, SlidersHorizontal } from "lucide-react";
import { NavLink } from "@/lib/router";
import { pluginsApi } from "@/api/plugins";
import { queryKeys } from "@/lib/queryKeys";
import { useGeneralSettings } from "@/context/GeneralSettingsContext";
import { SidebarNavItem } from "./SidebarNavItem";
import { textFor } from "@/lib/ui-language";

export function InstanceSidebar() {
  const { uiLanguage } = useGeneralSettings();
  const { data: plugins } = useQuery({
    queryKey: queryKeys.plugins.all,
    queryFn: () => pluginsApi.list(),
  });

  const copy = {
    title: textFor(uiLanguage, {
      en: "Instance Settings",
      "zh-CN": "实例设置",
    }),
    general: textFor(uiLanguage, {
      en: "General",
      "zh-CN": "通用",
    }),
    heartbeats: textFor(uiLanguage, {
      en: "Heartbeats",
      "zh-CN": "心跳",
    }),
    experimental: textFor(uiLanguage, {
      en: "Experimental",
      "zh-CN": "实验功能",
    }),
    plugins: textFor(uiLanguage, {
      en: "Plugins",
      "zh-CN": "插件",
    }),
    adapters: textFor(uiLanguage, {
      en: "Adapters",
      "zh-CN": "适配器",
    }),
  };

  return (
    <aside className="w-60 h-full min-h-0 border-r border-border bg-background flex flex-col">
      <div className="flex items-center gap-2 px-3 h-12 shrink-0">
        <Settings className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
        <span className="flex-1 text-sm font-bold text-foreground truncate">
          {copy.title}
        </span>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-4 px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <SidebarNavItem to="/instance/settings/general" label={copy.general} icon={SlidersHorizontal} end />
          <SidebarNavItem to="/instance/settings/heartbeats" label={copy.heartbeats} icon={Clock3} end />
          <SidebarNavItem to="/instance/settings/experimental" label={copy.experimental} icon={FlaskConical} />
          <SidebarNavItem to="/instance/settings/plugins" label={copy.plugins} icon={Puzzle} />
          <SidebarNavItem to="/instance/settings/adapters" label={copy.adapters} icon={Cpu} />
          {(plugins ?? []).length > 0 ? (
            <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-border/70 pl-3">
              {(plugins ?? []).map((plugin) => (
                <NavLink
                  key={plugin.id}
                  to={`/instance/settings/plugins/${plugin.id}`}
                  className={({ isActive }) =>
                    [
                      "rounded-md px-2 py-1.5 text-xs transition-colors",
                      isActive
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    ].join(" ")
                  }
                >
                  {plugin.manifestJson.displayName ?? plugin.packageName}
                </NavLink>
              ))}
            </div>
          ) : null}
        </div>
      </nav>
    </aside>
  );
}
