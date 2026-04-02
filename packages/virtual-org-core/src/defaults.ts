import type {
  UpsertVirtualOrgCompanyProfileInput,
  VirtualOrgAgentTemplate,
  VirtualOrgConnectorKind,
  VirtualOrgConnectorStatus,
} from "@paperclipai/virtual-org-types";

type SeedCompanyKey = "muster" | "officely";

export interface VirtualOrgSeedCompany {
  key: SeedCompanyKey;
  name: string;
  description: string;
  issuePrefix: string;
  profile: UpsertVirtualOrgCompanyProfileInput;
  connectors: Array<{
    kind: VirtualOrgConnectorKind;
    status?: VirtualOrgConnectorStatus;
    displayName: string;
    configSummary: string;
    configJson?: Record<string, unknown>;
    policyJson?: Record<string, unknown>;
  }>;
}

export const VIRTUAL_ORG_SEED_COMPANIES: VirtualOrgSeedCompany[] = [
  {
    key: "muster",
    name: "Muster",
    description: "Early-stage company discovery workspace.",
    issuePrefix: "MUS",
    profile: {
      stage: "discovery",
      primaryGoal: "Find the right buyer, sharpen positioning, and turn early testing into a repeatable offer.",
      activeCapabilities: ["research", "positioning", "messaging", "experiments"],
      decisionCadence: "weekly",
      approvalPolicy: {
        customerFacingRequiresApproval: true,
        autoExecution: "limited",
      },
      defaultRepo: null,
      allowedRepos: [],
      connectedTools: ["slack", "manual_capture"],
    },
    connectors: [
      {
        kind: "manual_capture",
        displayName: "Founder capture",
        configSummary: "Manual notes, founder messages, and interview answers.",
      },
      {
        kind: "slack",
        displayName: "Slack intake",
        configSummary: "Incoming founder requests from Slack threads.",
      },
    ],
  },
  {
    key: "officely",
    name: "Officely",
    description: "Growth-stage operating system with connected decision feeds.",
    issuePrefix: "OFF",
    profile: {
      stage: "growth",
      primaryGoal: "Turn product, marketing, and website signals into faster operating decisions.",
      activeCapabilities: ["analytics", "reporting", "competitor_monitoring", "growth"],
      decisionCadence: "daily",
      approvalPolicy: {
        customerFacingRequiresApproval: true,
        autoExecution: "guarded",
      },
      defaultRepo: null,
      allowedRepos: [],
      connectedTools: ["slack", "internal_database", "xero", "stripe", "posthog"],
    },
    connectors: [
      {
        kind: "slack",
        status: "connected",
        displayName: "Slack intake",
        configSummary: "Founder requests and approvals from Slack.",
        configJson: {
          provider: "slack",
          role: "founder_intake",
        },
        policyJson: {},
      },
      {
        kind: "internal_database",
        displayName: "Internal database",
        configSummary: "Identity anchor for accounts, plans, status, and internal ownership.",
        configJson: {
          provider: "internal_database",
          syncMode: "manual_snapshot",
          recommended: true,
          sourceOfTruthFor: ["customer_identity"],
        },
        policyJson: {
          readOnly: true,
        },
      },
      {
        kind: "xero",
        displayName: "Xero",
        configSummary: "Booked revenue and manual payment truth for finance-backed reporting.",
        configJson: {
          provider: "xero",
          syncMode: "manual_snapshot",
          recommended: true,
          sourceOfTruthFor: ["booked_revenue", "manual_payments"],
        },
        policyJson: {
          readOnly: true,
        },
      },
      {
        kind: "stripe",
        displayName: "Stripe",
        configSummary: "Automated billing events like failures, upgrades, downgrades, and refunds.",
        configJson: {
          provider: "stripe",
          syncMode: "manual_snapshot",
          recommended: true,
          sourceOfTruthFor: ["payment_events"],
        },
        policyJson: {
          readOnly: true,
        },
      },
      {
        kind: "posthog",
        displayName: "PostHog",
        configSummary: "Product usage, onboarding, and retention signals for account health.",
        configJson: {
          provider: "posthog",
          syncMode: "manual_snapshot",
          recommended: true,
          sourceOfTruthFor: ["product_usage"],
        },
        policyJson: {
          readOnly: true,
        },
      },
    ],
  },
];

export const VIRTUAL_ORG_AGENT_TEMPLATES: Array<Omit<VirtualOrgAgentTemplate, "id" | "companyId">> = [
  {
    key: "researcher",
    name: "Researcher",
    description: "Finds evidence, market signals, and user needs.",
    stageCompatibility: ["discovery", "validation", "growth", "scale"],
    defaultRole: "researcher",
    defaultTitle: "Research Lead",
    defaultResponsibilities: ["User research", "Market scans", "Evidence summaries"],
    allowedActions: ["research", "briefs", "recommendations"],
    requiredConnectors: ["manual_capture"],
    defaultApprovalMode: "not_needed",
  },
  {
    key: "strategist",
    name: "Strategist",
    description: "Turns raw learning into positioning and direction.",
    stageCompatibility: ["discovery", "validation"],
    defaultRole: "pm",
    defaultTitle: "Strategy Lead",
    defaultResponsibilities: ["Positioning", "ICP framing", "Experiment briefs"],
    allowedActions: ["planning", "positioning", "messaging"],
    requiredConnectors: ["manual_capture"],
    defaultApprovalMode: "pending",
  },
  {
    key: "messaging_lead",
    name: "Messaging Lead",
    description: "Owns drafts for website, launch, and pitch language.",
    stageCompatibility: ["discovery", "validation", "growth"],
    defaultRole: "cmo",
    defaultTitle: "Messaging Lead",
    defaultResponsibilities: ["Website copy", "Positioning copy", "Narrative drafts"],
    allowedActions: ["copywriting", "messaging", "landing_pages"],
    requiredConnectors: ["manual_capture"],
    defaultApprovalMode: "pending",
  },
  {
    key: "experiment_operator",
    name: "Experiment Operator",
    description: "Plans and runs small demand tests.",
    stageCompatibility: ["discovery", "validation"],
    defaultRole: "pm",
    defaultTitle: "Experiment Operator",
    defaultResponsibilities: ["Test plans", "Demand experiments", "Learning loops"],
    allowedActions: ["planning", "experiments", "analysis"],
    requiredConnectors: ["manual_capture"],
    defaultApprovalMode: "pending",
  },
  {
    key: "analyst",
    name: "Analyst",
    description: "Turns business data into decision-ready summaries.",
    stageCompatibility: ["growth", "scale"],
    defaultRole: "general",
    defaultTitle: "Business Analyst",
    defaultResponsibilities: ["Dashboards", "Trend analysis", "Executive summaries"],
    allowedActions: ["analysis", "reporting", "recommendations"],
    requiredConnectors: ["posthog"],
    defaultApprovalMode: "not_needed",
  },
  {
    key: "reporting_lead",
    name: "Reporting Lead",
    description: "Owns recurring operating reports and decision cadences.",
    stageCompatibility: ["growth", "scale"],
    defaultRole: "cfo",
    defaultTitle: "Reporting Lead",
    defaultResponsibilities: ["Weekly reports", "KPI tracking", "Decision packets"],
    allowedActions: ["reporting", "synthesis", "planning"],
    requiredConnectors: ["internal_database", "xero", "stripe", "posthog"],
    defaultApprovalMode: "not_needed",
  },
  {
    key: "competitor_monitor",
    name: "Competitor Monitor",
    description: "Tracks market moves and turns them into action ideas.",
    stageCompatibility: ["growth", "scale"],
    defaultRole: "researcher",
    defaultTitle: "Competitor Monitor",
    defaultResponsibilities: ["Competitor tracking", "Change alerts", "Response suggestions"],
    allowedActions: ["monitoring", "analysis", "recommendations"],
    requiredConnectors: ["competitor_monitoring"],
    defaultApprovalMode: "not_needed",
  },
  {
    key: "growth_operator",
    name: "Growth Operator",
    description: "Connects analytics to marketing and product action.",
    stageCompatibility: ["growth", "scale"],
    defaultRole: "cmo",
    defaultTitle: "Growth Operator",
    defaultResponsibilities: ["Growth loops", "Funnel actions", "Experiment execution"],
    allowedActions: ["analysis", "planning", "experiments"],
    requiredConnectors: ["posthog", "google_analytics", "search_console"],
    defaultApprovalMode: "pending",
  },
];
