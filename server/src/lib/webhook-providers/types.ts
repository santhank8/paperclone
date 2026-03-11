export interface NormalizedWebhookEvent {
  eventType: string;
  branches: string[];
  prNumbers: number[];
  prTitle: string | null;
  prBody: string | null;
  repoFullName: string | null;
  conclusion: string | null;
  sender: string | null;
  raw: Record<string, unknown>;
}

export interface WebhookProviderHandler {
  verifySignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean;
  parseEvent(eventHeader: string, payload: Record<string, unknown>): NormalizedWebhookEvent;
}
