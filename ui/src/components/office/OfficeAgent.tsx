import { useState } from "react";
import type { Agent } from "@paperclipai/shared";
import { AgentIcon } from "../AgentIconPicker";

const statusRingColor: Record<string, string> = {
  running: "#22d3ee",
  active: "#4ade80",
  paused: "#facc15",
  idle: "#a3a3a3",
  error: "#f87171",
  pending_approval: "#a78bfa",
  terminated: "#6b7280",
};

const statusLabel: Record<string, string> = {
  running: "Running",
  active: "Active",
  paused: "Paused",
  idle: "Idle",
  error: "Error",
  pending_approval: "Pending",
  terminated: "Off",
};

interface OfficeAgentProps {
  agent: Agent;
  x: number;
  y: number;
  onSelect: (agent: Agent) => void;
  onRightClick?: (agent: Agent, pos: { x: number; y: number }) => void;
  selected?: boolean;
}

export function OfficeAgentAvatar({ agent, x, y, onSelect, onRightClick, selected }: OfficeAgentProps) {
  const ringColor = statusRingColor[agent.status] ?? "#a3a3a3";
  const isRunning = agent.status === "running" || agent.status === "active";
  const isError = agent.status === "error";

  return (
    <div
      data-office-agent
      className="absolute transition-all duration-[1500ms] ease-in-out"
      style={{ transform: `translate(${x}px, ${y}px)` }}
    >
      <button
        className={`flex flex-col items-center gap-0.5 cursor-pointer group ${selected ? "scale-110" : ""}`}
        onClick={(e) => { e.stopPropagation(); onSelect(agent); }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRightClick?.(agent, { x: e.clientX, y: e.clientY });
        }}
      >
        {/* Avatar */}
        <div className="relative">
          <div
            className={`
              w-11 h-11 rounded-full bg-card border-[2.5px] flex items-center justify-center
              shadow-md group-hover:shadow-lg transition-shadow duration-200
              ${isRunning ? "animate-pulse" : ""}
              ${isError ? "animate-[shake_0.5s_ease-in-out_infinite]" : ""}
              ${selected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}
            `}
            style={{ borderColor: ringColor }}
          >
            <AgentIcon icon={agent.icon} className="h-5 w-5 text-foreground/80" />
          </div>
          {/* Status dot */}
          <span
            className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card"
            style={{ backgroundColor: ringColor }}
          />
          {/* Running glow */}
          {isRunning && (
            <span
              className="absolute inset-0 rounded-full animate-ping opacity-20"
              style={{ backgroundColor: ringColor }}
            />
          )}
        </div>
        {/* Name + status */}
        <span className="text-[10px] font-semibold text-foreground max-w-[72px] truncate leading-tight text-center drop-shadow-sm">
          {agent.name.split(" ")[0]}
        </span>
        <span className="text-[8px] text-muted-foreground font-medium" style={{ color: ringColor }}>
          {statusLabel[agent.status] ?? agent.status}
        </span>
      </button>
    </div>
  );
}
