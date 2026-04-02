import type { VirtualOrgPolicySnapshot, VirtualOrgStage } from "@paperclipai/virtual-org-types";

export function defaultAllowedActionsForStage(stage: VirtualOrgStage): string[] {
  if (stage === "discovery" || stage === "validation") {
    return ["research", "positioning", "messaging", "experiments"];
  }
  return ["analysis", "reporting", "monitoring", "recommendations"];
}

export function buildVirtualOrgPolicySnapshot(input: {
  companyId: string;
  stage: VirtualOrgStage;
  approvalRequired: boolean;
  executionTarget: string | null;
  allowedRepos: string[];
  connectedTools: string[];
  allowedActions?: string[];
}): VirtualOrgPolicySnapshot {
  return {
    companyId: input.companyId,
    stage: input.stage,
    allowedActions: input.allowedActions ?? defaultAllowedActionsForStage(input.stage),
    approvalRequired: input.approvalRequired,
    executionTarget: input.executionTarget,
    allowedRepos: input.allowedRepos,
    connectedTools: input.connectedTools,
  };
}
