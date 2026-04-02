import { z } from "zod";

export const VIRTUAL_ORG_STAGES = ["discovery", "validation", "growth", "scale"] as const;
export type VirtualOrgStage = (typeof VIRTUAL_ORG_STAGES)[number];

export const VIRTUAL_ORG_DECISION_CADENCES = ["daily", "weekly", "monthly"] as const;
export type VirtualOrgDecisionCadence = (typeof VIRTUAL_ORG_DECISION_CADENCES)[number];

export const VIRTUAL_ORG_CONNECTOR_KINDS = [
  "slack",
  "manual_capture",
  "product_analytics",
  "marketing_analytics",
  "website_analytics",
  "competitor_monitoring",
  "internal_database",
  "xero",
  "stripe",
  "posthog",
  "hubspot",
  "intercom",
  "google_analytics",
  "search_console",
  "tempa",
  "website_crawler",
  "help_center_crawler",
] as const;
export type VirtualOrgConnectorKind = (typeof VIRTUAL_ORG_CONNECTOR_KINDS)[number];

export const VIRTUAL_ORG_CONNECTOR_STATUSES = ["planned", "connected", "syncing", "error"] as const;
export type VirtualOrgConnectorStatus = (typeof VIRTUAL_ORG_CONNECTOR_STATUSES)[number];

export const VIRTUAL_ORG_INSIGHT_STATUSES = ["active", "dismissed", "acted_on"] as const;
export type VirtualOrgInsightStatus = (typeof VIRTUAL_ORG_INSIGHT_STATUSES)[number];

export const VIRTUAL_ORG_INBOX_SOURCES = ["manual", "slack", "email", "web_form"] as const;
export type VirtualOrgInboxSource = (typeof VIRTUAL_ORG_INBOX_SOURCES)[number];

export const VIRTUAL_ORG_INBOX_STATUSES = [
  "captured",
  "clarification_needed",
  "ready",
  "task_created",
  "archived",
] as const;
export type VirtualOrgInboxStatus = (typeof VIRTUAL_ORG_INBOX_STATUSES)[number];

export interface VirtualOrgCompanyProfile {
  companyId: string;
  workspaceKey: string | null;
  stage: VirtualOrgStage;
  primaryGoal: string;
  activeCapabilities: string[];
  decisionCadence: VirtualOrgDecisionCadence;
  approvalPolicy: Record<string, unknown>;
  defaultRepo: string | null;
  allowedRepos: string[];
  connectedTools: string[];
  updatedAt: Date;
}

export interface VirtualOrgAgentTemplate {
  id: string;
  companyId: string | null;
  key: string;
  name: string;
  description: string;
  stageCompatibility: VirtualOrgStage[];
  defaultRole: string;
  defaultTitle: string;
  defaultResponsibilities: string[];
  allowedActions: string[];
  requiredConnectors: VirtualOrgConnectorKind[];
  defaultApprovalMode: "not_needed" | "pending";
}

export interface VirtualOrgInboxItem {
  id: string;
  companyId: string | null;
  issueId: string | null;
  source: VirtualOrgInboxSource;
  sourceThreadId: string | null;
  companyConfidence: number | null;
  workType: string;
  urgency: "low" | "medium" | "high";
  status: VirtualOrgInboxStatus;
  rawContent: string;
  structuredSummary: string | null;
  needsClarification: boolean;
  clarificationThreadId: string | null;
  clarificationQuestion: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VirtualOrgDataConnector {
  id: string;
  companyId: string;
  kind: VirtualOrgConnectorKind;
  status: VirtualOrgConnectorStatus;
  displayName: string;
  configSummary: string | null;
  configJson: Record<string, unknown>;
  policyJson: Record<string, unknown>;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VirtualOrgCustomerProfile {
  id: string;
  companyId: string;
  companyName: string;
  accountName: string | null;
  workspaceId: string | null;
  primaryEmailDomain: string | null;
  planName: string | null;
  accountStatus: string | null;
  firstSeenAt: Date | null;
  ownerUserId: string | null;
  hubspotCompanyId: string | null;
  hubspotDealIds: string[];
  stripeCustomerId: string | null;
  xeroContactId: string | null;
  intercomCompanyId: string | null;
  posthogGroupKey: string | null;
  internalAccountId: string | null;
  attributesJson: Record<string, unknown>;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VirtualOrgInsightCard {
  id: string;
  companyId: string;
  type: string;
  title: string;
  summary: string;
  confidence: number;
  sourceConnectorIds: string[];
  recommendedAction: string | null;
  status: VirtualOrgInsightStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface VirtualOrgDecisionLog {
  id: string;
  companyId: string;
  title: string;
  summary: string;
  linkedInsightIds: string[];
  linkedTaskIds: string[];
  decidedAt: Date;
  createdAt: Date;
}

export interface VirtualOrgPortfolioCompany {
  companyId: string;
  name: string;
  issuePrefix: string;
  brandColor: string | null;
  stage: VirtualOrgStage;
  primaryGoal: string;
  activeCapabilities: string[];
  connectedToolCount: number;
  pendingApprovals: number;
  blockedIssues: number;
  activeAgents: number;
  activeInsights: number;
  openIssues: number;
}

export interface VirtualOrgPortfolioSummary {
  companies: VirtualOrgPortfolioCompany[];
}

export interface VirtualOrgWorkspaceSummary {
  company: {
    id: string;
    name: string;
    issuePrefix: string;
    brandColor: string | null;
    description: string | null;
  };
  profile: VirtualOrgCompanyProfile;
  templates: VirtualOrgAgentTemplate[];
  connectors: VirtualOrgDataConnector[];
  insights: VirtualOrgInsightCard[];
  inbox: VirtualOrgInboxItem[];
  recentDecisions: VirtualOrgDecisionLog[];
  activeIssues: Array<{
    id: string;
    identifier: string | null;
    title: string;
    status: string;
    priority: string;
  }>;
}

export interface CreateVirtualOrgInboxItemInput {
  companyId?: string | null;
  source?: VirtualOrgInboxSource;
  sourceThreadId?: string | null;
  rawContent: string;
  structuredSummary?: string | null;
  urgency?: "low" | "medium" | "high";
  workType?: string;
}

export interface ClarifyVirtualOrgInboxItemInput {
  companyId: string;
  clarificationReply: string;
}

export interface UpsertVirtualOrgCompanyProfileInput {
  stage: VirtualOrgStage;
  primaryGoal: string;
  activeCapabilities: string[];
  decisionCadence: VirtualOrgDecisionCadence;
  approvalPolicy?: Record<string, unknown>;
  defaultRepo?: string | null;
  allowedRepos?: string[];
  connectedTools?: string[];
}

export interface OfficelyInternalDatabaseSetupInput {
  connectionString?: string | null;
  sqlQuery: string;
}

export interface OfficelyInternalDatabaseSetupResult {
  companyId: string;
  connectorId: string;
  secretName: string;
  hasSavedConnection: boolean;
  queryConfigured: boolean;
  accountCount: number;
  sampleCompanies: string[];
  usedSavedConnection: boolean;
}

export interface OfficelyInternalDatabaseTestResult {
  companyId: string;
  accountCount: number;
  sampleCompanies: string[];
  usedSavedConnection: boolean;
}

export interface VirtualOrgPolicySnapshot {
  companyId: string;
  stage: VirtualOrgStage;
  allowedActions: string[];
  approvalRequired: boolean;
  executionTarget: string | null;
  allowedRepos: string[];
  connectedTools: string[];
}

export const virtualOrgStageSchema = z.enum(VIRTUAL_ORG_STAGES);
export const virtualOrgDecisionCadenceSchema = z.enum(VIRTUAL_ORG_DECISION_CADENCES);
export const virtualOrgConnectorKindSchema = z.enum(VIRTUAL_ORG_CONNECTOR_KINDS);
export const virtualOrgConnectorStatusSchema = z.enum(VIRTUAL_ORG_CONNECTOR_STATUSES);
export const virtualOrgInsightStatusSchema = z.enum(VIRTUAL_ORG_INSIGHT_STATUSES);
export const virtualOrgInboxSourceSchema = z.enum(VIRTUAL_ORG_INBOX_SOURCES);
export const virtualOrgInboxStatusSchema = z.enum(VIRTUAL_ORG_INBOX_STATUSES);
