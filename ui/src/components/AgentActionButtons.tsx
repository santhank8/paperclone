import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGeneralSettings } from "../context/GeneralSettingsContext";
import { textFor } from "../lib/ui-language";

export function RunButton({
  onClick,
  disabled,
  label = "Run now",
  size = "sm",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "default";
}) {
  const { uiLanguage } = useGeneralSettings();
  const resolvedLabel = label === "Run now"
    ? textFor(uiLanguage, { en: "Run now", "zh-CN": "立即运行" })
    : label;
  return (
    <Button variant="outline" size={size} onClick={onClick} disabled={disabled}>
      <Play className="h-3.5 w-3.5 sm:mr-1" />
      <span className="hidden sm:inline">{resolvedLabel}</span>
    </Button>
  );
}

export function PauseResumeButton({
  isPaused,
  onPause,
  onResume,
  disabled,
  size = "sm",
}: {
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  disabled?: boolean;
  size?: "sm" | "default";
}) {
  const { uiLanguage } = useGeneralSettings();
  if (isPaused) {
    return (
      <Button variant="outline" size={size} onClick={onResume} disabled={disabled}>
        <Play className="h-3.5 w-3.5 sm:mr-1" />
        <span className="hidden sm:inline">{textFor(uiLanguage, { en: "Resume", "zh-CN": "恢复" })}</span>
      </Button>
    );
  }

  return (
    <Button variant="outline" size={size} onClick={onPause} disabled={disabled}>
      <Pause className="h-3.5 w-3.5 sm:mr-1" />
      <span className="hidden sm:inline">{textFor(uiLanguage, { en: "Pause", "zh-CN": "暂停" })}</span>
    </Button>
  );
}
