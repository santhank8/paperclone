import crypto from "node:crypto";
import type { NormalizedWebhookEvent, WebhookProviderHandler } from "./types.js";

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export const githubProvider: WebhookProviderHandler = {
  verifySignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
    if (!signature) return false;
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return timingSafeEqual(expected, signature);
  },

  parseEvent(eventHeader: string, payload: Record<string, unknown>): NormalizedWebhookEvent {
    const action = (payload.action as string) ?? "";
    const branches: string[] = [];
    const prNumbers: number[] = [];
    let prTitle: string | null = null;
    let prBody: string | null = null;
    let repoFullName: string | null = null;
    let conclusion: string | null = null;
    let sender: string | null = null;

    const repo = payload.repository as Record<string, unknown> | undefined;
    if (repo?.full_name) repoFullName = repo.full_name as string;

    const senderObj = payload.sender as Record<string, unknown> | undefined;
    if (senderObj?.login) sender = senderObj.login as string;

    let eventType = eventHeader;

    if (eventHeader === "check_run") {
      const checkRun = payload.check_run as Record<string, unknown> | undefined;
      conclusion = (checkRun?.conclusion as string) ?? null;
      eventType = `check_run.${action}${conclusion ? "." + conclusion : ""}`;

      const pullRequests = checkRun?.pull_requests as Array<Record<string, unknown>> | undefined;
      if (pullRequests) {
        for (const pr of pullRequests) {
          if (pr.number) prNumbers.push(pr.number as number);
          const head = pr.head as Record<string, unknown> | undefined;
          if (head?.ref) branches.push(head.ref as string);
        }
      }
    } else if (eventHeader === "workflow_run") {
      const workflowRun = payload.workflow_run as Record<string, unknown> | undefined;
      conclusion = (workflowRun?.conclusion as string) ?? null;
      eventType = `workflow_run.${action}${conclusion ? "." + conclusion : ""}`;

      if (workflowRun?.head_branch) branches.push(workflowRun.head_branch as string);

      const pullRequests = workflowRun?.pull_requests as Array<Record<string, unknown>> | undefined;
      if (pullRequests) {
        for (const pr of pullRequests) {
          if (pr.number) prNumbers.push(pr.number as number);
        }
      }
    } else if (eventHeader === "pull_request") {
      const pr = payload.pull_request as Record<string, unknown> | undefined;
      eventType = `pull_request.${action}`;

      if (pr) {
        if (pr.number) prNumbers.push(pr.number as number);
        prTitle = (pr.title as string) ?? null;
        prBody = (pr.body as string) ?? null;
        const head = pr.head as Record<string, unknown> | undefined;
        if (head?.ref) branches.push(head.ref as string);
      }
    } else if (action) {
      eventType = `${eventHeader}.${action}`;
    }

    return {
      eventType,
      branches,
      prNumbers,
      prTitle,
      prBody,
      repoFullName,
      conclusion,
      sender,
      raw: payload,
    };
  },
};
