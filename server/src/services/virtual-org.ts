import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agentTemplates,
  agents,
  approvals,
  companies,
  companyProfiles,
  dataConnectors,
  decisionLogs,
  insightCards,
  issues,
  virtualOrgInboxItems,
} from "@paperclipai/db";
import { approvalService } from "./approvals.js";
import { companyService } from "./companies.js";
import { officelyConnectorService } from "./officely-connectors.js";
import { issueApprovalService } from "./issue-approvals.js";
import { issueService } from "./issues.js";
import { notFound } from "../errors.js";
import { buildVirtualOrgPolicySnapshot, defaultAllowedActionsForStage, VIRTUAL_ORG_AGENT_TEMPLATES, VIRTUAL_ORG_SEED_COMPANIES } from "@paperclipai/virtual-org-core";
import type {
  CreateVirtualOrgInboxItemInput,
  OfficelyInternalDatabaseSetupInput,
  UpsertVirtualOrgCompanyProfileInput,
  VirtualOrgPolicySnapshot,
} from "@paperclipai/virtual-org-types";

function priorityForUrgency(urgency: "low" | "medium" | "high"): "low" | "medium" | "high" {
  return urgency;
}

function titleFromContent(rawContent: string, structuredSummary?: string | null) {
  const source = (structuredSummary?.trim() || rawContent.trim()).replace(/\s+/g, " ");
  return source.length <= 80 ? source : `${source.slice(0, 77)}...`;
}

function defaultProfileInput(companyName: string): UpsertVirtualOrgCompanyProfileInput {
  return {
    stage: "validation",
    primaryGoal: `Run ${companyName} with clearer priorities and safer AI execution.`,
    activeCapabilities: ["research", "planning"],
    decisionCadence: "weekly",
    approvalPolicy: {
      customerFacingRequiresApproval: true,
      autoExecution: "guarded",
    },
    defaultRepo: null,
    allowedRepos: [],
    connectedTools: [],
  };
}

export function virtualOrgService(db: Db) {
  const companiesSvc = companyService(db);
  const issuesSvc = issueService(db);
  const approvalsSvc = approvalService(db);
  const officelySvc = officelyConnectorService(db);
  const issueApprovalsSvc = issueApprovalService(db);

  async function getCompany(companyId: string) {
    const company = await companiesSvc.getById(companyId);
    if (!company) throw notFound("Company not found");
    return company;
  }

  async function ensureProfile(companyId: string) {
    const existing = await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.companyId, companyId))
      .then((rows) => rows[0] ?? null);
    if (existing) return existing;
    const company = await getCompany(companyId);
    const [created] = await db
      .insert(companyProfiles)
      .values({
        companyId,
        workspaceKey: null,
        ...defaultProfileInput(company.name),
      })
      .returning();
    return created!;
  }

  async function listTemplatesForStage(stage: string) {
    const rows = await db
      .select()
      .from(agentTemplates)
      .where(isNull(agentTemplates.companyId))
      .orderBy(asc(agentTemplates.name));
    return rows.filter((row) => (row.stageCompatibility as string[]).includes(stage));
  }

  async function createTaskFromInboxItem(input: {
    companyId: string;
    inboxItemId: string;
    rawContent: string;
    structuredSummary: string | null;
    urgency: "low" | "medium" | "high";
    workType: string;
  }) {
    const profile = await ensureProfile(input.companyId);
    const approvalRequired = profile.stage !== "growth";
    const policySnapshot: VirtualOrgPolicySnapshot = buildVirtualOrgPolicySnapshot({
      companyId: input.companyId,
      stage: profile.stage as "discovery" | "validation" | "growth" | "scale",
      approvalRequired,
      executionTarget: approvalRequired ? "approval_queue" : "agent_execution",
      allowedRepos: (profile.allowedRepos as string[]) ?? [],
      connectedTools: (profile.connectedTools as string[]) ?? [],
      allowedActions: defaultAllowedActionsForStage(profile.stage as "discovery" | "validation" | "growth" | "scale"),
    });

    const issue = await issuesSvc.create(input.companyId, {
      title: titleFromContent(input.rawContent, input.structuredSummary),
      description: input.structuredSummary ?? input.rawContent,
      status: approvalRequired ? "backlog" : "todo",
      priority: priorityForUrgency(input.urgency),
      originKind: "virtual_org_inbox",
      originId: input.inboxItemId,
      virtualOrgPolicySnapshot: policySnapshot as unknown as Record<string, unknown>,
      virtualOrgExecutionTarget: policySnapshot.executionTarget,
    } as typeof issues.$inferInsert);

    if (approvalRequired) {
      const approval = await approvalsSvc.create(input.companyId, {
        type: "approve_ceo_strategy",
        requestedByAgentId: null,
        payload: {
          source: "virtual_org_inbox",
          inboxItemId: input.inboxItemId,
          issueId: issue!.id,
          workType: input.workType,
          companyStage: profile.stage,
        },
        status: "pending",
      });
      await issueApprovalsSvc.link(issue!.id, approval!.id, { userId: "virtual-org" });
    }

    await db
      .update(virtualOrgInboxItems)
      .set({
        issueId: issue!.id,
        status: "task_created",
        needsClarification: false,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(virtualOrgInboxItems.id, input.inboxItemId));

    return issue;
  }

  return {
    bootstrapDefaults: async () => {
      const existingCompanies = await companiesSvc.list();
      const byName = new Map(existingCompanies.map((company) => [company.name.toLowerCase(), company]));

      const templateCount = await db
        .select({ count: count() })
        .from(agentTemplates)
        .where(isNull(agentTemplates.companyId))
        .then((rows) => Number(rows[0]?.count ?? 0));

      if (templateCount === 0) {
        await db.insert(agentTemplates).values(
          VIRTUAL_ORG_AGENT_TEMPLATES.map((template) => ({
            ...template,
            companyId: null,
          })),
        );
      }

      const results: Array<{ companyId: string; name: string }> = [];

      for (const seed of VIRTUAL_ORG_SEED_COMPANIES) {
        let company = byName.get(seed.name.toLowerCase()) ?? null;
        if (!company) {
          company = await companiesSvc.create({
            name: seed.name,
            description: seed.description,
            budgetMonthlyCents: 0,
          });
        }

        await db
          .insert(companyProfiles)
          .values({
            companyId: company.id,
            workspaceKey: seed.key,
            ...seed.profile,
          })
          .onConflictDoUpdate({
            target: companyProfiles.companyId,
            set: {
              workspaceKey: seed.key,
              stage: seed.profile.stage,
              primaryGoal: seed.profile.primaryGoal,
              activeCapabilities: seed.profile.activeCapabilities,
              decisionCadence: seed.profile.decisionCadence,
              approvalPolicy: seed.profile.approvalPolicy ?? {},
              defaultRepo: seed.profile.defaultRepo ?? null,
              allowedRepos: seed.profile.allowedRepos ?? [],
              connectedTools: seed.profile.connectedTools ?? [],
              updatedAt: new Date(),
            },
          });

        const existingConnectors = await db
          .select()
          .from(dataConnectors)
          .where(eq(dataConnectors.companyId, company.id));
        if (seed.key === "officely") {
          await officelySvc.ensureV1Connectors(company.id);
        } else if (existingConnectors.length === 0) {
          await db.insert(dataConnectors).values(
            seed.connectors.map((connector) => ({
              companyId: company.id,
              kind: connector.kind,
              status: connector.status ?? (connector.kind === "slack" || connector.kind === "manual_capture" ? "connected" : "planned"),
              displayName: connector.displayName,
              configSummary: connector.configSummary,
              configJson: connector.configJson ?? {},
              policyJson: connector.policyJson ?? {},
            })),
          );
        }

        const existingInsights = await db
          .select({ count: count() })
          .from(insightCards)
          .where(eq(insightCards.companyId, company.id))
          .then((rows) => Number(rows[0]?.count ?? 0));

        if (existingInsights === 0) {
          const isMuster = seed.key === "muster";
          await db.insert(insightCards).values(
            isMuster
              ? [
                  {
                    companyId: company.id,
                    type: "discovery",
                    title: "Buyer clarity is still the main bottleneck",
                    summary: "Most captured work points to discovery, messaging, and demand tests rather than execution.",
                    confidence: 0.82,
                    sourceConnectorIds: [],
                    recommendedAction: "Run 5 founder interviews and tighten the ICP before scaling outreach.",
                    status: "active",
                  },
                ]
              : [
                  {
                    companyId: company.id,
                    type: "officely_v1_setup",
                    title: "Officely V1 starts with identity and business heartbeat",
                    summary: "The first useful slice is internal database + Xero + Stripe + PostHog so customer identity, revenue, billing changes, and usage all line up.",
                    confidence: 0.95,
                    sourceConnectorIds: [],
                    recommendedAction: "Load a normalized snapshot for those four sources to start generating real weekly insight cards.",
                    status: "active",
                  },
                ],
          );
        }

        results.push({ companyId: company.id, name: company.name });
      }

      return results;
    },

    portfolio: async () => {
      const companyRows = await companiesSvc.list();
      const profileRows = await db.select().from(companyProfiles);
      const profileByCompany = new Map(profileRows.map((profile) => [profile.companyId, profile]));

      const agentCounts = await db
        .select({ companyId: agents.companyId, count: sql<number>`count(*)` })
        .from(agents)
        .where(inArray(agents.status, ["active", "idle", "running"]))
        .groupBy(agents.companyId);
      const issueCounts = await db
        .select({
          companyId: issues.companyId,
          openCount: sql<number>`count(*) filter (where ${issues.status} != 'done' and ${issues.status} != 'cancelled')`,
          blockedCount: sql<number>`count(*) filter (where ${issues.status} = 'blocked')`,
        })
        .from(issues)
        .groupBy(issues.companyId);
      const approvalCounts = await db
        .select({
          companyId: approvals.companyId,
          count: sql<number>`count(*)`,
        })
        .from(approvals)
        .where(eq(approvals.status, "pending"))
        .groupBy(approvals.companyId);
      const connectorCounts = await db
        .select({
          companyId: dataConnectors.companyId,
          count: sql<number>`count(*)`,
        })
        .from(dataConnectors)
        .where(eq(dataConnectors.status, "connected"))
        .groupBy(dataConnectors.companyId);
      const insightCounts = await db
        .select({
          companyId: insightCards.companyId,
          count: sql<number>`count(*)`,
        })
        .from(insightCards)
        .where(eq(insightCards.status, "active"))
        .groupBy(insightCards.companyId);

      const countMap = <T extends { companyId: string; count?: number; openCount?: number; blockedCount?: number }>(rows: T[]) =>
        new Map(rows.map((row) => [row.companyId, row]));

      const agentsByCompany = countMap(agentCounts);
      const issuesByCompany = countMap(issueCounts);
      const approvalsByCompany = countMap(approvalCounts);
      const connectorsByCompany = countMap(connectorCounts);
      const insightsByCompany = countMap(insightCounts);

      return {
        companies: companyRows
          .map((company) => {
            const profile = profileByCompany.get(company.id);
            if (!profile) return null;
            const issueRow = issuesByCompany.get(company.id);
            return {
              companyId: company.id,
              name: company.name,
              issuePrefix: company.issuePrefix,
              brandColor: company.brandColor,
              stage: profile.stage,
              primaryGoal: profile.primaryGoal,
              activeCapabilities: profile.activeCapabilities as string[],
              connectedToolCount: Number(connectorsByCompany.get(company.id)?.count ?? 0),
              pendingApprovals: Number(approvalsByCompany.get(company.id)?.count ?? 0),
              blockedIssues: Number(issueRow?.blockedCount ?? 0),
              activeAgents: Number(agentsByCompany.get(company.id)?.count ?? 0),
              activeInsights: Number(insightsByCompany.get(company.id)?.count ?? 0),
              openIssues: Number(issueRow?.openCount ?? 0),
            };
          })
          .filter(Boolean),
      };
    },

    workspace: async (companyId: string) => {
      const company = await getCompany(companyId);
      const profile = await ensureProfile(companyId);
      const [templates, connectorsList, insights, inbox, recentDecisions, activeIssues] = await Promise.all([
        listTemplatesForStage(profile.stage),
        db.select().from(dataConnectors).where(eq(dataConnectors.companyId, companyId)).orderBy(asc(dataConnectors.displayName)),
        db.select().from(insightCards).where(eq(insightCards.companyId, companyId)).orderBy(desc(insightCards.createdAt)).limit(6),
        db.select().from(virtualOrgInboxItems).where(eq(virtualOrgInboxItems.companyId, companyId)).orderBy(desc(virtualOrgInboxItems.createdAt)).limit(6),
        db.select().from(decisionLogs).where(eq(decisionLogs.companyId, companyId)).orderBy(desc(decisionLogs.decidedAt)).limit(5),
        db
          .select({
            id: issues.id,
            identifier: issues.identifier,
            title: issues.title,
            status: issues.status,
            priority: issues.priority,
          })
          .from(issues)
          .where(and(eq(issues.companyId, companyId), inArray(issues.status, ["backlog", "todo", "in_progress", "blocked"])))
          .orderBy(desc(issues.updatedAt))
          .limit(6),
      ]);

      return {
        company: {
          id: company.id,
          name: company.name,
          issuePrefix: company.issuePrefix,
          brandColor: company.brandColor,
          description: company.description,
        },
        profile,
        templates,
        connectors: connectorsList,
        insights,
        inbox,
        recentDecisions,
        activeIssues,
      };
    },

    getProfile: (companyId: string) => ensureProfile(companyId),

    upsertProfile: async (companyId: string, input: UpsertVirtualOrgCompanyProfileInput) => {
      await getCompany(companyId);
      const [row] = await db
        .insert(companyProfiles)
        .values({
          companyId,
          workspaceKey: null,
          ...input,
        })
        .onConflictDoUpdate({
          target: companyProfiles.companyId,
          set: {
            stage: input.stage,
            primaryGoal: input.primaryGoal,
            activeCapabilities: input.activeCapabilities,
            decisionCadence: input.decisionCadence,
            approvalPolicy: input.approvalPolicy ?? {},
            defaultRepo: input.defaultRepo ?? null,
            allowedRepos: input.allowedRepos ?? [],
            connectedTools: input.connectedTools ?? [],
            updatedAt: new Date(),
          },
        })
        .returning();
      return row!;
    },

    listInbox: async (companyId: string) => {
      await getCompany(companyId);
      return db
        .select()
        .from(virtualOrgInboxItems)
        .where(eq(virtualOrgInboxItems.companyId, companyId))
        .orderBy(desc(virtualOrgInboxItems.createdAt));
    },

    syncOfficelyV1: async (companyId: string) => {
      await getCompany(companyId);
      const result = await officelySvc.syncV1FromConnectors(companyId);
      return {
        companyId,
        profileCount: result.profiles.length,
        insightCount: result.insights.length,
        counts: result.counts,
      };
    },

    saveOfficelyInternalDatabaseSetup: async (companyId: string, input: OfficelyInternalDatabaseSetupInput) => {
      await getCompany(companyId);
      return officelySvc.saveInternalDatabaseSetup(companyId, input);
    },

    testOfficelyInternalDatabaseSetup: async (companyId: string, input: OfficelyInternalDatabaseSetupInput) => {
      await getCompany(companyId);
      return officelySvc.testInternalDatabaseSetup(companyId, input);
    },

    createInboxItem: async (input: CreateVirtualOrgInboxItemInput) => {
      const companyId = input.companyId ?? null;
      if (!companyId) {
        const [item] = await db
          .insert(virtualOrgInboxItems)
          .values({
            companyId: null,
            source: input.source ?? "manual",
            sourceThreadId: input.sourceThreadId ?? null,
            companyConfidence: null,
            workType: input.workType ?? "general",
            urgency: input.urgency ?? "medium",
            status: "clarification_needed",
            rawContent: input.rawContent,
            structuredSummary: input.structuredSummary ?? null,
            needsClarification: true,
            clarificationThreadId: input.sourceThreadId ?? null,
            clarificationQuestion: "Which company does this belong to?",
          })
          .returning();
        return item!;
      }

      await getCompany(companyId);
      const [item] = await db
        .insert(virtualOrgInboxItems)
        .values({
          companyId,
          source: input.source ?? "manual",
          sourceThreadId: input.sourceThreadId ?? null,
          companyConfidence: 1,
          workType: input.workType ?? "general",
          urgency: input.urgency ?? "medium",
          status: "ready",
          rawContent: input.rawContent,
          structuredSummary: input.structuredSummary ?? null,
          needsClarification: false,
        })
        .returning();

      await createTaskFromInboxItem({
        companyId,
        inboxItemId: item!.id,
        rawContent: input.rawContent,
        structuredSummary: input.structuredSummary ?? null,
        urgency: input.urgency ?? "medium",
        workType: input.workType ?? "general",
      });

      return db
        .select()
        .from(virtualOrgInboxItems)
        .where(eq(virtualOrgInboxItems.id, item!.id))
        .then((rows) => rows[0]!);
    },

    clarifyInboxItem: async (itemId: string, companyId: string, clarificationReply: string) => {
      await getCompany(companyId);
      const existing = await db
        .select()
        .from(virtualOrgInboxItems)
        .where(eq(virtualOrgInboxItems.id, itemId))
        .then((rows) => rows[0] ?? null);
      if (!existing) throw notFound("Inbox item not found");

      const [updated] = await db
        .update(virtualOrgInboxItems)
        .set({
          companyId,
          companyConfidence: 1,
          status: "ready",
          needsClarification: false,
          clarificationQuestion: null,
          structuredSummary: existing.structuredSummary
            ? `${existing.structuredSummary}\n\nClarification: ${clarificationReply}`
            : `Clarification: ${clarificationReply}`,
          updatedAt: new Date(),
        })
        .where(eq(virtualOrgInboxItems.id, itemId))
        .returning();

      await createTaskFromInboxItem({
        companyId,
        inboxItemId: updated!.id,
        rawContent: existing.rawContent,
        structuredSummary: updated!.structuredSummary,
        urgency: existing.urgency as "low" | "medium" | "high",
        workType: existing.workType,
      });

      return db
        .select()
        .from(virtualOrgInboxItems)
        .where(eq(virtualOrgInboxItems.id, itemId))
        .then((rows) => rows[0]!);
    },
  };
}
