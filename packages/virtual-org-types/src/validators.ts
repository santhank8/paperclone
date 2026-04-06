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

export const officelyXeroSetupSchema = z.object({
  clientId: z.string().min(1).nullable().optional(),
  clientSecret: z.string().min(1).nullable().optional(),
});

export type OfficelyXeroSetup = z.infer<typeof officelyXeroSetupSchema>;

export const officelyStripeSetupSchema = z.object({
  secretKey: z.string().min(1).nullable().optional(),
});

export type OfficelyStripeSetup = z.infer<typeof officelyStripeSetupSchema>;

export const officelySlackSetupSchema = z.object({
  enabled: z.boolean().default(true),
  botToken: z.string().min(1).nullable().optional(),
  appToken: z.string().min(1).nullable().optional(),
  defaultChannelId: z.string().min(1).nullable().optional(),
  founderUserId: z.string().min(1).nullable().optional(),
  intakeMode: z.enum(["dm_only", "dm_and_channel"]).optional().default("dm_only"),
});

export type OfficelySlackSetup = z.infer<typeof officelySlackSetupSchema>;

export const officelyPostHogSetupSchema = z.object({
  enabled: z.boolean().default(true),
  apiKey: z.string().min(1).nullable().optional(),
  projectId: z.string().min(1).nullable().optional(),
  baseUrl: z.string().url().nullable().optional(),
  onboardingEvent: z.string().min(1).nullable().optional(),
  importantEvents: z.array(z.string().min(1)).optional().default([]),
});

export type OfficelyPostHogSetup = z.infer<typeof officelyPostHogSetupSchema>;
