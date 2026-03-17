import {
  Code,
  Coffee,
  Crown,
  Server,
  Users,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Code,
  Coffee,
  Crown,
  Server,
  Users,
  AlertTriangle,
};

interface OfficeAreaProps {
  id: string;
  name: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export function OfficeAreaRect({ name, icon, x, y, width, height, color }: OfficeAreaProps) {
  const Icon = iconMap[icon] ?? Code;

  return (
    <div
      className="absolute rounded-xl border-2 select-none pointer-events-none"
      style={{
        left: x,
        top: y,
        width,
        height,
        borderColor: `${color}40`,
        background: `linear-gradient(135deg, ${color}08 0%, ${color}15 100%)`,
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ color }}
      >
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
          {name}
        </span>
      </div>
    </div>
  );
}
