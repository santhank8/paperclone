export interface OfficeArea {
  id: string;
  name: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  description?: string;
}

export interface OfficeMovementRule {
  id: string;
  priority: number;
  condition: {
    status?: string[];
    role?: string[];
    adapterType?: string[];
  };
  targetAreaId: string;
}

export interface OfficeConfig {
  areas: OfficeArea[];
  movementRules: OfficeMovementRule[];
  defaultAreaId: string;
  canvasWidth: number;
  canvasHeight: number;
}

export interface OfficeAgentPosition {
  agentId: string;
  areaId: string;
  x: number;
  y: number;
}

export const DEFAULT_OFFICE_CONFIG: OfficeConfig = {
  canvasWidth: 1200,
  canvasHeight: 800,
  defaultAreaId: "break-room",
  areas: [
    {
      id: "executive-suite",
      name: "Executive Suite",
      icon: "Crown",
      x: 420,
      y: 20,
      width: 360,
      height: 200,
      color: "#6366f1",
      description: "C-suite and leadership",
    },
    {
      id: "engineering-lab",
      name: "Engineering Lab",
      icon: "Code",
      x: 20,
      y: 20,
      width: 380,
      height: 340,
      color: "#06b6d4",
      description: "Where engineers build",
    },
    {
      id: "meeting-room",
      name: "Meeting Room",
      icon: "Users",
      x: 420,
      y: 240,
      width: 360,
      height: 200,
      color: "#22c55e",
      description: "Collaboration and reviews",
    },
    {
      id: "server-room",
      name: "Server Room",
      icon: "Server",
      x: 800,
      y: 20,
      width: 380,
      height: 340,
      color: "#64748b",
      description: "DevOps and infrastructure",
    },
    {
      id: "break-room",
      name: "Break Room",
      icon: "Coffee",
      x: 20,
      y: 400,
      width: 560,
      height: 200,
      color: "#f59e0b",
      description: "Idle and paused agents",
    },
    {
      id: "error-bay",
      name: "Error Bay",
      icon: "AlertTriangle",
      x: 800,
      y: 400,
      width: 380,
      height: 200,
      color: "#ef4444",
      description: "Agents needing attention",
    },
  ],
  movementRules: [
    {
      id: "error-agents",
      priority: 100,
      condition: { status: ["error"] },
      targetAreaId: "error-bay",
    },
    {
      id: "executives",
      priority: 90,
      condition: { role: ["ceo", "cto", "cfo", "cmo"] },
      targetAreaId: "executive-suite",
    },
    {
      id: "devops-running",
      priority: 80,
      condition: { status: ["running", "active"], role: ["devops"] },
      targetAreaId: "server-room",
    },
    {
      id: "engineers-running",
      priority: 70,
      condition: { status: ["running", "active"], role: ["engineer", "designer", "qa"] },
      targetAreaId: "engineering-lab",
    },
    {
      id: "reviewing",
      priority: 60,
      condition: { status: ["pending_approval"] },
      targetAreaId: "meeting-room",
    },
    {
      id: "idle-paused",
      priority: 10,
      condition: { status: ["idle", "paused", "terminated"] },
      targetAreaId: "break-room",
    },
  ],
};
