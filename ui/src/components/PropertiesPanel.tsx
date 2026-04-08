import { X } from "lucide-react";
import { usePanel } from "../context/PanelContext";
import { useSidebar } from "../context/SidebarContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function PropertiesPanel() {
  const { panelContent, panelVisible, setPanelVisible } = usePanel();
  const { isTablet } = useSidebar();

  if (!panelContent) return null;

  const innerW = isTablet ? 280 : 320;

  return (
    <aside
      className="hidden md:flex border-l border-border bg-card flex-col shrink-0 overflow-hidden transition-[width,opacity] duration-200 ease-in-out"
      style={{ width: panelVisible ? innerW : 0, opacity: panelVisible ? 1 : 0 }}
    >
      <div className="flex-1 flex flex-col min-h-0" style={{ width: innerW, minWidth: innerW }}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <span className="text-sm font-medium">Properties</span>
          <Button variant="ghost" size="icon-xs" onClick={() => setPanelVisible(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4">{panelContent}</div>
        </ScrollArea>
      </div>
    </aside>
  );
}
