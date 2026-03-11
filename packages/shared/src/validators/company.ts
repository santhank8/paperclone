import { z } from "zod";
import { AGENT_ROLES, COMPANY_STATUSES } from "../constants.js";

export const companyHeartbeatIntervalsByRoleSchema = z
  .object(
    Object.fromEntries(
      AGENT_ROLES.map((role) => [role, z.number().int().min(30).max(86_400).optional()]),
    ) as Record<(typeof AGENT_ROLES)[number], z.ZodOptional<z.ZodNumber>>,
  )
  .partial();

export const companyRuntimePolicySchema = z.object({
  heartbeat: z.object({
    intervalsByRole: companyHeartbeatIntervalsByRoleSchema.optional().default({}),
  }).optional().default({}),
});

export const createCompanySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  budgetMonthlyCents: z.number().int().nonnegative().optional().default(0),
  runtimePolicy: companyRuntimePolicySchema.optional().default({}),
});

export type CreateCompany = z.infer<typeof createCompanySchema>;

export const updateCompanySchema = createCompanySchema
  .partial()
  .extend({
    status: z.enum(COMPANY_STATUSES).optional(),
    spentMonthlyCents: z.number().int().nonnegative().optional(),
    requireBoardApprovalForNewAgents: z.boolean().optional(),
    runtimePolicy: companyRuntimePolicySchema.optional(),
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  });

export type UpdateCompany = z.infer<typeof updateCompanySchema>;
