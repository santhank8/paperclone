import { z } from "zod";
import {
  databaseBackupConfigSchema,
  runtimeConfigSchema,
  secretsConfigSchema,
  storageConfigSchema,
} from "../config-schema.js";

export const updateInstanceSettingsSchema = z.object({
  storage: storageConfigSchema.optional(),
  storageAuth: z.object({
    s3: z.object({
      accessKeyId: z.string().optional(),
      secretAccessKey: z.string().optional(),
      sessionToken: z.string().optional(),
      clear: z.boolean().optional(),
    }).optional(),
  }).optional(),
  databaseBackup: databaseBackupConfigSchema.optional(),
  secrets: secretsConfigSchema.optional(),
  runtime: runtimeConfigSchema.optional(),
  agentAuth: z.object({
    claudeLocal: z.object({
      useApiKey: z.boolean(),
      apiKey: z.string().optional(),
      clearApiKey: z.boolean().optional(),
      subscriptionEstimate: z.object({
        enabled: z.boolean(),
        windowHours: z.number().int().min(1).max(24 * 30),
        unit: z.enum(["runs", "input_tokens", "total_tokens"]),
        capacity: z.number().int().positive(),
        extraCapacity: z.number().int().nonnegative(),
      }).optional(),
    }).optional(),
    codexLocal: z.object({
      useApiKey: z.boolean(),
      apiKey: z.string().optional(),
      clearApiKey: z.boolean().optional(),
      subscriptionEstimate: z.object({
        enabled: z.boolean(),
        windowHours: z.number().int().min(1).max(24 * 30),
        unit: z.enum(["runs", "input_tokens", "total_tokens"]),
        capacity: z.number().int().positive(),
        extraCapacity: z.number().int().nonnegative(),
      }).optional(),
    }).optional(),
  }).optional(),
});

export type UpdateInstanceSettings = z.infer<typeof updateInstanceSettingsSchema>;
