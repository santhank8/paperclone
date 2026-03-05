import { z } from "zod";

export const chatChannelSlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-_]{0,62}$/, "Slug must use lowercase letters, numbers, hyphen, or underscore");

export const createChatChannelSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: chatChannelSlugSchema.optional().nullable(),
});

export type CreateChatChannel = z.infer<typeof createChatChannelSchema>;

export const updateChatConversationSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => value.name !== undefined || value.archived !== undefined, {
    message: "At least one field must be provided",
  });

export type UpdateChatConversation = z.infer<typeof updateChatConversationSchema>;

export const openChatDmSchema = z
  .object({
    participantAgentId: z.string().uuid().optional().nullable(),
    participantUserId: z.string().trim().min(1).optional().nullable(),
  })
  .refine(
    (value) =>
      (value.participantAgentId ? 1 : 0) + (value.participantUserId ? 1 : 0) === 1,
    { message: "Exactly one DM participant must be provided" },
  );

export type OpenChatDm = z.infer<typeof openChatDmSchema>;

export const createChatMessageSchema = z.object({
  body: z.string().min(1),
  threadRootMessageId: z.string().uuid().optional().nullable(),
  mentionAgentIds: z.array(z.string().uuid()).optional().default([]),
});

export type CreateChatMessage = z.infer<typeof createChatMessageSchema>;

export const toggleChatReactionSchema = z.object({
  emoji: z.string().trim().min(1).max(64),
});

export type ToggleChatReaction = z.infer<typeof toggleChatReactionSchema>;

export const updateChatReadStateSchema = z.object({
  lastReadMessageId: z.string().uuid().optional().nullable(),
});

export type UpdateChatReadState = z.infer<typeof updateChatReadStateSchema>;

export const chatSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  conversationId: z.string().uuid().optional().nullable(),
});

export type ChatSearchQuery = z.infer<typeof chatSearchQuerySchema>;

export const listChatConversationsQuerySchema = z.object({
  includeArchived: z.coerce.boolean().optional().default(false),
});

export type ListChatConversationsQuery = z.infer<typeof listChatConversationsQuerySchema>;

export const listChatMessagesQuerySchema = z.object({
  threadRootMessageId: z.string().uuid().optional().nullable(),
  before: z.string().datetime().optional(),
  after: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export type ListChatMessagesQuery = z.infer<typeof listChatMessagesQuerySchema>;
