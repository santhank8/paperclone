export type KnowledgeEntryType = "folder" | "document" | "file";

export type KnowledgeEntryScope = "company" | "department" | "agent";

export interface KnowledgeEntry {
  id: string;
  companyId: string;
  parentId: string | null;
  type: KnowledgeEntryType;
  name: string;
  scope: KnowledgeEntryScope;
  scopeAgentId: string | null;
  documentId: string | null;
  assetId: string | null;
  description: string | null;
  sortOrder: number;
  createdByUserId: string | null;
  createdByAgentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeEntryWithContent extends KnowledgeEntry {
  /** Markdown body when type='document' */
  documentBody: string | null;
  /** Latest revision ID when type='document' */
  latestRevisionId: string | null;
  /** Latest revision number when type='document' */
  latestRevisionNumber: number | null;
  /** Asset metadata when type='file' */
  asset: KnowledgeAssetInfo | null;
}

export interface KnowledgeAssetInfo {
  assetId: string;
  provider: string;
  objectKey: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  originalFilename: string | null;
  contentPath: string;
}

export interface KnowledgeDepartment {
  agentId: string;
  agentName: string;
  agentTitle: string | null;
  agentRole: string;
  agentIcon: string | null;
}

export interface KnowledgeDocumentRevision {
  id: string;
  companyId: string;
  documentId: string;
  revisionNumber: number;
  title: string | null;
  format: string;
  body: string;
  changeSummary: string | null;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  createdAt: Date;
}

export interface CreateKnowledgeFolderInput {
  parentId?: string | null;
  name: string;
  scope: KnowledgeEntryScope;
  scopeAgentId?: string | null;
  description?: string | null;
}

export interface CreateKnowledgeDocumentInput {
  parentId?: string | null;
  name: string;
  scope: KnowledgeEntryScope;
  scopeAgentId?: string | null;
  description?: string | null;
  body: string;
}

export interface UpdateKnowledgeEntryInput {
  name?: string;
  parentId?: string | null;
  description?: string | null;
  sortOrder?: number;
}

export interface UpdateKnowledgeDocumentBodyInput {
  body: string;
  baseRevisionId?: string | null;
  changeSummary?: string | null;
}
