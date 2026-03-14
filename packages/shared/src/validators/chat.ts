import { z } from "zod";

export const chatMessageRoleSchema = z.enum(["user", "assistant"]);

export const addChatMessageSchema = z.object({
  content: z.string().trim().min(1),
});

export type ChatMessageRole = z.infer<typeof chatMessageRoleSchema>;
export type AddChatMessage = z.infer<typeof addChatMessageSchema>;
