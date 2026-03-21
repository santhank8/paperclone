import { cn } from "../lib/utils";

interface OutpostMarkProps {
  className?: string;
  size?: number;
  glow?: boolean;
}

/**
 * Outpost brand mark — fortress floorplan viewed from above.
 * Four corner turrets connected by walls with a central keep.
 */
export function OutpostMark({ className, size = 24, glow = false }: OutpostMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={cn(glow && "drop-shadow-[0_0_8px_oklch(0.78_0.155_70/0.5)]", className)}
    >
      {/* Corner turrets */}
      <rect x="1" y="1" width="4" height="4" />
      <rect x="19" y="1" width="4" height="4" />
      <rect x="1" y="19" width="4" height="4" />
      <rect x="19" y="19" width="4" height="4" />
      {/* Connecting walls */}
      <rect x="6" y="2" width="12" height="2" />
      <rect x="6" y="20" width="12" height="2" />
      <rect x="2" y="6" width="2" height="12" />
      <rect x="20" y="6" width="2" height="12" />
      {/* Central keep */}
      <rect x="10" y="10" width="4" height="4" />
    </svg>
  );
}
