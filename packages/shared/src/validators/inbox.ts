import { z } from "zod";
import { INBOX_DISMISSAL_KINDS } from "../constants.js";

export const createInboxDismissalSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal(INBOX_DISMISSAL_KINDS[0]),
    runId: z.string().uuid(),
  }),
  z.object({
    kind: z.literal(INBOX_DISMISSAL_KINDS[1]),
    issueId: z.string().uuid(),
  }),
  z.object({
    kind: z.literal(INBOX_DISMISSAL_KINDS[2]),
  }),
  z.object({
    kind: z.literal(INBOX_DISMISSAL_KINDS[3]),
  }),
]);

export type CreateInboxDismissal = z.infer<typeof createInboxDismissalSchema>;
