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

export interface VirtualOrgRevenueScorecard {
  currency: string;
  periodStart: string;
  periodEnd: string;
  currentMrr: number;
  previousMrr: number;
  newMrr: number;
  expansionMrr: number;
  reactivationMrr: number;
  contractionMrr: number;
  churnedMrr: number;
  netNewMrr: number;
  overallChange: number;
  newCustomers: number;
  reactivatedCustomers: number;
  expandedCustomers: number;
  contractedCustomers: number;
  lostCustomers: number;
  currentCustomers: number;
  previousCustomers: number;
  revenueGrowthRate: number | null;
  revenueChurnRate: number | null;
  customerChurnRate: number | null;
  estimatedLtv: number | null;
  netPosition: "positive" | "flat" | "negative";
  liveRevenueCurrency: string;
  stripeRevenue: number;
  manualRevenue: number;
  totalRevenue: number;
  collectionCurrency: string;
  collectionPeriodStart: string;
  collectionPeriodEnd: string;
  collectedRevenue: number;
  collectedViaStripe: number;
  collectedManually: number;
  collectedOther: number;
  recentCollectionCurrency: string;
  recentCollectionPeriodStart: string;
  recentCollectionPeriodEnd: string;
  recentCollectedRevenue: number;
  recentCollectedViaStripe: number;
  recentCollectedManually: number;
  failedPayments: number;
  failedPaymentAmount: number;
  refunds: number;
  refundAmount: number;
}

export interface VirtualOrgFounderActionItem {
  id: string;
  title: string;
  summary: string;
  recommendedAction: string;
  priority: "high" | "medium" | "low";
  source: "revenue" | "product" | "feedback";
}

export interface VirtualOrgProductPulse {
  status: "healthy" | "watch" | "risk" | "unavailable";
  checkedAt: string | null;
  eventCount: number;
  activeUserTotal: number;
  onboardingEvent: string | null;
  onboardingEventCount: number;
  importantEventCounts: OfficelyPostHogEventMetric[];
  summary: string;
}

export interface VirtualOrgFeedbackHighlight {
  postedAt: string;
  channelName: string | null;
  channelBucket: "customer_feedback" | "tech_issues" | "other";
  authorLabel: string | null;
  text: string;
  categories: string[];
}

export interface VirtualOrgFeedbackPulse {
  status: "healthy" | "watch" | "risk" | "unavailable";
  checkedAt: string | null;
  channelId: string | null;
  channelsReviewed: number;
  channelsWithMessages: number;
  messageCount: number;
  customerMessageCount: number;
  customerFeedbackMessages: number;
  techIssueMessages: number;
  bugMentions: number;
  featureRequestMentions: number;
  churnRiskMentions: number;
  praiseMentions: number;
  supportMentions: number;
  summary: string;
  highlights: VirtualOrgFeedbackHighlight[];
}

export interface VirtualOrgFounderBrief {
  generatedAt: string;
  headline: string;
  summary: string;
  productPulse: VirtualOrgProductPulse;
  feedbackPulse: VirtualOrgFeedbackPulse;
  actionItems: VirtualOrgFounderActionItem[];
}

export interface VirtualOrgOperatingSnapshot {
  revenueScorecard?: VirtualOrgRevenueScorecard | null;
  founderBrief?: VirtualOrgFounderBrief | null;
}

export interface VirtualOrgCompanyProfile {
  companyId: string;
  workspaceKey: string | null;
  stage: VirtualOrgStage;
  primaryGoal: string;
  activeCapabilities: string[];
  decisionCadence: VirtualOrgDecisionCadence;
  approvalPolicy: Record<string, unknown>;
  operatingSnapshotJson: VirtualOrgOperatingSnapshot;
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

export interface OfficelyXeroSetupInput {
  clientId?: string | null;
  clientSecret?: string | null;
}

export interface OfficelyXeroCashReceiptPreview {
  receivedAt: string;
  amount: number;
  currency: string;
  bankAccountName: string | null;
  reference: string | null;
  companyName: string | null;
}

export interface OfficelyXeroSetupResult {
  companyId: string;
  connectorId: string;
  hasSavedClientId: boolean;
  hasSavedClientSecret: boolean;
  invoiceCount: number;
  cashReceiptCount: number;
  stripeCashReceiptCount: number;
  manualPaymentCount: number;
  sampleCompanies: string[];
  latestStripeCashReceipts: OfficelyXeroCashReceiptPreview[];
  usedSavedClientId: boolean;
  usedSavedClientSecret: boolean;
}

export interface OfficelyXeroTestResult {
  companyId: string;
  invoiceCount: number;
  cashReceiptCount: number;
  stripeCashReceiptCount: number;
  manualPaymentCount: number;
  sampleCompanies: string[];
  latestStripeCashReceipts: OfficelyXeroCashReceiptPreview[];
  usedSavedClientId: boolean;
  usedSavedClientSecret: boolean;
}

export interface OfficelyStripeSetupInput {
  secretKey?: string | null;
}

export interface OfficelyStripeSetupResult {
  companyId: string;
  connectorId: string;
  hasSavedSecretKey: boolean;
  eventCount: number;
  failedPaymentCount: number;
  refundCount: number;
  cancellationCount: number;
  upgradeCount: number;
  downgradeCount: number;
  sampleCompanies: string[];
  usedSavedSecretKey: boolean;
}

export interface OfficelyStripeTestResult {
  companyId: string;
  eventCount: number;
  failedPaymentCount: number;
  refundCount: number;
  cancellationCount: number;
  upgradeCount: number;
  downgradeCount: number;
  sampleCompanies: string[];
  usedSavedSecretKey: boolean;
}

export interface OfficelySlackSetupInput {
  enabled: boolean;
  botToken?: string | null;
  appToken?: string | null;
  defaultChannelId?: string | null;
  founderUserId?: string | null;
  intakeMode?: "dm_only" | "dm_and_channel";
}

export interface OfficelySlackSetupResult {
  companyId: string;
  connectorId: string;
  enabled: boolean;
  hasSavedBotToken: boolean;
  hasSavedAppToken: boolean;
  teamId: string | null;
  teamName: string | null;
  botUserId: string | null;
  botUserName: string | null;
  appId: string | null;
  defaultChannelId: string | null;
  founderUserId: string | null;
  intakeMode: "dm_only" | "dm_and_channel";
  usedSavedBotToken: boolean;
  usedSavedAppToken: boolean;
  checkedAt: string;
}

export interface OfficelySlackTestResult {
  companyId: string;
  enabled: boolean;
  teamId: string | null;
  teamName: string | null;
  botUserId: string | null;
  botUserName: string | null;
  appId: string | null;
  defaultChannelId: string | null;
  founderUserId: string | null;
  intakeMode: "dm_only" | "dm_and_channel";
  usedSavedBotToken: boolean;
  usedSavedAppToken: boolean;
  checkedAt: string;
}

export interface OfficelyPostHogSetupInput {
  enabled: boolean;
  apiKey?: string | null;
  projectId?: string | null;
  baseUrl?: string | null;
  onboardingEvent?: string | null;
  importantEvents?: string[];
}

export interface OfficelyPostHogEventMetric {
  eventName: string;
  count: number;
}

export interface OfficelyPostHogSetupResult {
  companyId: string;
  connectorId: string;
  enabled: boolean;
  hasSavedApiKey: boolean;
  projectId: string | null;
  baseUrl: string;
  eventCount: number;
  activeUserTotal: number;
  onboardingEvent: string | null;
  onboardingEventCount: number;
  importantEvents: string[];
  importantEventCounts: OfficelyPostHogEventMetric[];
  usedSavedApiKey: boolean;
  checkedAt: string;
}

export interface OfficelyPostHogTestResult {
  companyId: string;
  enabled: boolean;
  projectId: string | null;
  baseUrl: string;
  eventCount: number;
  activeUserTotal: number;
  onboardingEvent: string | null;
  onboardingEventCount: number;
  importantEvents: string[];
  importantEventCounts: OfficelyPostHogEventMetric[];
  usedSavedApiKey: boolean;
  checkedAt: string;
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
