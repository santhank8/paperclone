import { useState } from "react";
import type { OfficeConfig, OfficeArea, OfficeMovementRule } from "@paperclipai/shared";
import { DEFAULT_OFFICE_CONFIG, AGENT_STATUSES, AGENT_ROLES } from "@paperclipai/shared";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, RotateCcw } from "lucide-react";

interface OfficeConfigPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: OfficeConfig;
  onSave: (config: OfficeConfig) => void;
}

export function OfficeConfigPanel({ open, onOpenChange, config, onSave }: OfficeConfigPanelProps) {
  const [draft, setDraft] = useState<OfficeConfig>(config);

  const updateArea = (id: string, patch: Partial<OfficeArea>) => {
    setDraft((prev) => ({
      ...prev,
      areas: prev.areas.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  };

  const removeArea = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      areas: prev.areas.filter((a) => a.id !== id),
    }));
  };

  const addArea = () => {
    const id = `area-${Date.now()}`;
    setDraft((prev) => ({
      ...prev,
      areas: [
        ...prev.areas,
        {
          id,
          name: "New Area",
          icon: "Code",
          x: 20,
          y: 20,
          width: 300,
          height: 200,
          color: "#6366f1",
        },
      ],
    }));
  };

  const updateRule = (id: string, patch: Partial<OfficeMovementRule>) => {
    setDraft((prev) => ({
      ...prev,
      movementRules: prev.movementRules.map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      ),
    }));
  };

  const removeRule = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      movementRules: prev.movementRules.filter((r) => r.id !== id),
    }));
  };

  const addRule = () => {
    const id = `rule-${Date.now()}`;
    setDraft((prev) => ({
      ...prev,
      movementRules: [
        ...prev.movementRules,
        {
          id,
          priority: 50,
          condition: { status: ["idle"] },
          targetAreaId: prev.areas[0]?.id ?? "break-room",
        },
      ],
    }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Office Configuration</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-4">
          {/* Areas */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Areas</h3>
              <Button variant="ghost" size="sm" onClick={addArea}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-3">
              {draft.areas.map((area) => (
                <div key={area.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={area.color}
                      onChange={(e) => updateArea(area.id, { color: e.target.value })}
                      className="h-6 w-6 rounded cursor-pointer bg-transparent p-0"
                    />
                    <Input
                      value={area.name}
                      onChange={(e) => updateArea(area.id, { name: e.target.value })}
                      className="h-7 text-xs flex-1"
                    />
                    <button
                      className="p-1 text-muted-foreground hover:text-destructive"
                      onClick={() => removeArea(area.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <div>
                      <label className="text-[10px] text-muted-foreground">X</label>
                      <Input
                        type="number"
                        value={area.x}
                        onChange={(e) => updateArea(area.id, { x: Number(e.target.value) })}
                        className="h-6 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Y</label>
                      <Input
                        type="number"
                        value={area.y}
                        onChange={(e) => updateArea(area.id, { y: Number(e.target.value) })}
                        className="h-6 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">W</label>
                      <Input
                        type="number"
                        value={area.width}
                        onChange={(e) => updateArea(area.id, { width: Number(e.target.value) })}
                        className="h-6 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">H</label>
                      <Input
                        type="number"
                        value={area.height}
                        onChange={(e) => updateArea(area.id, { height: Number(e.target.value) })}
                        className="h-6 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Movement Rules */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Movement Rules</h3>
              <Button variant="ghost" size="sm" onClick={addRule}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-3">
              {[...draft.movementRules]
                .sort((a, b) => b.priority - a.priority)
                .map((rule) => (
                  <div key={rule.id} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-muted-foreground">Priority</label>
                        <Input
                          type="number"
                          value={rule.priority}
                          onChange={(e) => updateRule(rule.id, { priority: Number(e.target.value) })}
                          className="h-6 text-xs"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-muted-foreground">Target Area</label>
                        <select
                          value={rule.targetAreaId}
                          onChange={(e) => updateRule(rule.id, { targetAreaId: e.target.value })}
                          className="w-full h-6 text-xs rounded border border-border bg-background px-1"
                        >
                          {draft.areas.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        className="p-1 text-muted-foreground hover:text-destructive mt-3"
                        onClick={() => removeRule(rule.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Status (comma-separated)</label>
                        <Input
                          value={(rule.condition.status ?? []).join(", ")}
                          onChange={(e) =>
                            updateRule(rule.id, {
                              condition: {
                                ...rule.condition,
                                status: e.target.value
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              },
                            })
                          }
                          className="h-6 text-xs"
                          placeholder="e.g. running, active"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Role (comma-separated)</label>
                        <Input
                          value={(rule.condition.role ?? []).join(", ")}
                          onChange={(e) =>
                            updateRule(rule.id, {
                              condition: {
                                ...rule.condition,
                                role: e.target.value
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              },
                            })
                          }
                          className="h-6 text-xs"
                          placeholder="e.g. engineer, devops"
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </section>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(DEFAULT_OFFICE_CONFIG);
              }}
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Reset to Default
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onSave(draft);
                onOpenChange(false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
