import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { buildInviteOnboardingTextDocument } from "../routes/access.js";

function buildReq(host: string): Request {
  return {
    protocol: "http",
    header(name: string) {
      if (name.toLowerCase() === "host") return host;
      return undefined;
    },
  } as unknown as Request;
}

describe("buildInviteOnboardingTextDocument", () => {
  it("renders a plain-text onboarding doc with expected endpoint references", () => {
    const req = buildReq("localhost:3100");
    const invite = {
      id: "invite-1",
      companyId: "company-1",
      inviteType: "company_join",
      allowedJoinTypes: "agent",
      tokenHash: "hash",
      defaultsPayload: null,
      expiresAt: new Date("2026-03-05T00:00:00.000Z"),
      invitedByUserId: null,
      revokedAt: null,
      acceptedAt: null,
      createdAt: new Date("2026-03-04T00:00:00.000Z"),
      updatedAt: new Date("2026-03-04T00:00:00.000Z"),
    } as const;

    const text = buildInviteOnboardingTextDocument(req, "token-123", invite as any, {
      deploymentMode: "local_trusted",
      deploymentExposure: "private",
      bindHost: "127.0.0.1",
      allowedHostnames: [],
    });

    expect(text).toContain("Онбординг Paperclip для OpenClaw Gateway");
    expect(text).toContain("/api/invites/token-123/accept");
    expect(text).toContain("/api/join-requests/{requestId}/claim-api-key");
    expect(text).toContain("/api/invites/token-123/onboarding.txt");
    expect(text).toContain("Рекомендуемые base URL Paperclip для проверки");
    expect(text).toContain("http://localhost:3100");
    expect(text).toContain("host.docker.internal");
    expect(text).toContain("paperclipApiUrl");
    expect(text).toContain("adapterType \"openclaw_gateway\"");
    expect(text).toContain("headers.x-openclaw-token");
    expect(text).toContain("НЕ используй /v1/responses или /hooks/*");
    expect(text).toContain("используй первый доступный адрес как agentDefaultsPayload.paperclipApiUrl");
    expect(text).toContain("~/.openclaw/workspace/paperclip-claimed-api-key.json");
    expect(text).toContain("PAPERCLIP_API_KEY");
    expect(text).toContain("из сохранённого токена");
    expect(text).toContain("Gateway token unexpectedly short");
  });

  it("includes loopback diagnostics for authenticated/private onboarding", () => {
    const req = buildReq("localhost:3100");
    const invite = {
      id: "invite-2",
      companyId: "company-1",
      inviteType: "company_join",
      allowedJoinTypes: "both",
      tokenHash: "hash",
      defaultsPayload: null,
      expiresAt: new Date("2026-03-05T00:00:00.000Z"),
      invitedByUserId: null,
      revokedAt: null,
      acceptedAt: null,
      createdAt: new Date("2026-03-04T00:00:00.000Z"),
      updatedAt: new Date("2026-03-04T00:00:00.000Z"),
    } as const;

    const text = buildInviteOnboardingTextDocument(req, "token-456", invite as any, {
      deploymentMode: "authenticated",
      deploymentExposure: "private",
      bindHost: "127.0.0.1",
      allowedHostnames: [],
    });

    expect(text).toContain("Диагностика сетевой доступности");
    expect(text).toContain("loopback hostname");
    expect(text).toContain("Если ни один адрес не доступен");
  });

  it("includes inviter message in the onboarding text when provided", () => {
    const req = buildReq("localhost:3100");
    const invite = {
      id: "invite-3",
      companyId: "company-1",
      inviteType: "company_join",
      allowedJoinTypes: "agent",
      tokenHash: "hash",
      defaultsPayload: {
        agentMessage: "Please join as our QA lead and prioritize flaky test triage first.",
      },
      expiresAt: new Date("2026-03-05T00:00:00.000Z"),
      invitedByUserId: null,
      revokedAt: null,
      acceptedAt: null,
      createdAt: new Date("2026-03-04T00:00:00.000Z"),
      updatedAt: new Date("2026-03-04T00:00:00.000Z"),
    } as const;

    const text = buildInviteOnboardingTextDocument(req, "token-789", invite as any, {
      deploymentMode: "local_trusted",
      deploymentExposure: "private",
      bindHost: "127.0.0.1",
      allowedHostnames: [],
    });

    expect(text).toContain("Сообщение от приглашающей стороны");
    expect(text).toContain("prioritize flaky test triage first");
  });
});
