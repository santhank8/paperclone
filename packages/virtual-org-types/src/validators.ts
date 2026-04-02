import { z } from "zod";
import {
  virtualOrgDecisionCadenceSchema,
  virtualOrgInboxSourceSchema,
  virtualOrgStageSchema,
} from "./types.js";

export const upsertVirtualOrgCompanyProfileSchema = z.object({
  stage: virtualOrgStageSchema,
  primaryGoal: z.string().min(1),
  activeCapabilities: z.array(z.string().min(1)).default([]),
  decisionCadence: virtualOrgDecisionCadenceSchema,
  approvalPolicy: z.record(z.unknown()).optional().default({}),
  defaultRepo: z.string().nullable().optional(),
  allowedRepos: z.array(z.string()).optional().default([]),
  connectedTools: z.array(z.string()).optional().default([]),
});

export type UpsertVirtualOrgCompanyProfile = z.infer<typeof upsertVirtualOrgCompanyProfileSchema>;

export const createVirtualOrgInboxItemSchema = z.object({
  companyId: z.string().uuid().nullable().optional(),
  source: virtualOrgInboxSourceSchema.optional().default("manual"),
  sourceThreadId: z.string().nullable().optional(),
  rawContent: z.string().min(1),
  structuredSummary: z.string().nullable().optional(),
  urgency: z.enum(["low", "medium", "high"]).optional().default("medium"),
  workType: z.string().min(1).optional().default("general"),
});

export type CreateVirtualOrgInboxItem = z.infer<typeof createVirtualOrgInboxItemSchema>;

export const clarifyVirtualOrgInboxItemSchema = z.object({
  companyId: z.string().uuid(),
  clarificationReply: z.string().min(1),
});

export type ClarifyVirtualOrgInboxItem = z.infer<typeof clarifyVirtualOrgInboxItemSchema>;

export const officelyInternalDatabaseSetupSchema = z.object({
  connectionString: z.string().min(1).nullable().optional(),
  sqlQuery: z.string().min(1),
});

export type OfficelyInternalDatabaseSetup = z.infer<typeof officelyInternalDatabaseSetupSchema>;
