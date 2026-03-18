export type ArtifactType = "file" | "pr" | "document" | "config" | "report";
export type ArtifactStatus = "active" | "archived" | "deleted";

export interface Artifact {
  id: string;
  companyId: string;
  agentId: string | null;
  issueId: string | null;
  heartbeatRunId: string | null;
  type: ArtifactType;
  name: string;
  description: string | null;
  contentType: string | null;
  contentText: string | null;
  contentRef: string | null;
  sizeBytes: number | null;
  metadata: Record<string, unknown> | null;
  status: ArtifactStatus;
  createdAt: Date;
  updatedAt: Date;
}
