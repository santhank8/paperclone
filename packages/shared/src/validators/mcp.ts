import { z } from "zod";

export const mcpServerConfigSchema = z.object({
  transport: z.enum(["stdio", "http"]),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().optional(),
  headers: z.record(z.string()).optional(),
  env: z.record(z.string()).optional(),
  enabled: z.boolean().optional(),
});

export const mcpServersConfigSchema = z.record(mcpServerConfigSchema);

export type McpServerConfig = z.infer<typeof mcpServerConfigSchema>;
export type McpServersConfig = z.infer<typeof mcpServersConfigSchema>;
