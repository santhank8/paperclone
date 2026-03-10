import { z } from "zod";

export const MEMORY_CATEGORIES = [
  "general",
  "pattern",
  "preference",
  "decision",
  "learning",
  "context",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const createAgentMemorySchema = z.object({
  category: z.string().min(1).optional().default("general"),
  key: z.string().min(1),
  content: z.string().min(1),
  importance: z.number().int().min(1).max(10).optional().default(5),
  sourceRunId: z.string().uuid().optional().nullable(),
  sourceIssueId: z.string().uuid().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
});

export type CreateAgentMemory = z.infer<typeof createAgentMemorySchema>;

export const updateAgentMemorySchema = z.object({
  content: z.string().min(1).optional(),
  importance: z.number().int().min(1).max(10).optional(),
  category: z.string().min(1).optional(),
  expiresAt: z.coerce.date().optional().nullable(),
});

export type UpdateAgentMemory = z.infer<typeof updateAgentMemorySchema>;
