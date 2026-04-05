import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test, expect } from "@playwright/test";

const HERMES_MODEL = process.env.PAPERCLIP_E2E_HERMES_MODEL ?? "gpt-4o";
const HERMES_NOTIFICATION_DIR = path.join(
  os.homedir(),
  ".hermes",
  "paperclip-notifications",
  "hire-approved",
);

async function listFilesSafe(dirPath: string) {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}

test.describe("Hermes onboarding and hiring flow", () => {
  test.setTimeout(10 * 60 * 1000);

  test("creates a Hermes company, hires an agent through approval, and validates the worker can complete a task", async ({
    page,
  }) => {
    const suffix = Date.now();
    const companyName = `Hermes E2E ${suffix}`;
    const workerName = `HermesWorker${suffix}`;
    const ceoTaskTitle = `Hire ${workerName}`;
    const workerTaskTitle = `Smoke test ${workerName}`;
    const approvalDecisionNote = "Approved by Playwright";
    const notificationFilesBefore = new Set(await listFilesSafe(HERMES_NOTIFICATION_DIR));

    await page.goto("/");

    const wizardHeading = page.locator("h3", { hasText: "Name your company" });
    const newCompanyButton = page.getByRole("button", { name: "New Company" });
    await expect(wizardHeading.or(newCompanyButton)).toBeVisible({ timeout: 15_000 });
    if (await newCompanyButton.isVisible()) {
      await newCompanyButton.click();
    }

    await page.locator('input[placeholder="Acme Corp"]').fill(companyName);
    await page.getByRole("button", { name: "Next" }).click();

    await expect(
      page.locator("h3", { hasText: "Create your first agent" }),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "More Agent Adapter Types" }).click();
    await page.getByRole("button", { name: "Hermes Agent" }).click();

    const modelField = page.locator("label", { hasText: "Model" }).locator("..");
    const modelTrigger = modelField.getByRole("button").first();
    await modelTrigger.click();

    const modelOption = page
      .locator("[data-radix-popper-content-wrapper] button")
      .filter({ hasText: HERMES_MODEL })
      .first();
    await expect(modelOption).toBeVisible({ timeout: 20_000 });
    await modelOption.click();
    await expect(modelTrigger).toContainText(HERMES_MODEL);

    await page.getByRole("button", { name: "Next" }).click();

    await expect(
      page.locator("h3", { hasText: "Give it something to do" }),
    ).toBeVisible({ timeout: 10_000 });

    await page
      .locator('input[placeholder="e.g. Research competitor pricing"]')
      .fill(ceoTaskTitle);
    await page
      .locator("textarea")
      .fill(
        [
          `Create exactly one subordinate agent named ${workerName}.`,
          "Requirements:",
          "- Use the Paperclip hire flow so the board can review the request.",
          "- adapterType must be hermes_local.",
          `- model should be ${HERMES_MODEL} when possible.`,
          "- role should be engineer.",
          "- reportsTo should be yourself.",
          "- Do not create extra agents or duplicate approvals.",
          "- After the hire request exists, wait for the board decision.",
        ].join("\n"),
      );
    await page.getByRole("button", { name: "Next" }).click();

    await expect(
      page.locator("h3", { hasText: "Ready to launch" }),
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Create & Open Issue" }).click();
    await expect(page).toHaveURL(/\/issues\//, { timeout: 20_000 });

    const baseUrl = page.url().split("/").slice(0, 3).join("/");

    const companiesRes = await page.request.get(`${baseUrl}/api/companies`);
    expect(companiesRes.ok()).toBe(true);
    const companies = await companiesRes.json();
    const company = companies.find((entry: { name: string }) => entry.name === companyName);
    expect(company).toBeTruthy();

    if (!company.requireBoardApprovalForNewAgents) {
      const updateRes = await page.request.patch(`${baseUrl}/api/companies/${company.id}`, {
        data: { requireBoardApprovalForNewAgents: true },
      });
      expect(updateRes.ok()).toBe(true);
    }

    const agentsRes = await page.request.get(`${baseUrl}/api/companies/${company.id}/agents`);
    expect(agentsRes.ok()).toBe(true);
    const agents = await agentsRes.json();
    const ceoAgent = agents.find(
      (entry: { name: string }) => entry.name === "CEO",
    );
    expect(ceoAgent).toBeTruthy();
    expect(ceoAgent.adapterType).toBe("hermes_local");
    expect(ceoAgent.adapterConfig.model).toBe(HERMES_MODEL);

    const ceoEnvRes = await page.request.post(
      `${baseUrl}/api/companies/${company.id}/adapters/hermes_local/test-environment`,
      {
        data: { adapterConfig: ceoAgent.adapterConfig },
      },
    );
    expect(ceoEnvRes.ok()).toBe(true);
    const ceoEnv = await ceoEnvRes.json();
    expect(ceoEnv.status).not.toBe("fail");

    let hireApprovalId = "";
    await expect
      .poll(
        async () => {
          const approvalsRes = await page.request.get(
            `${baseUrl}/api/companies/${company.id}/approvals?status=pending`,
          );
          if (!approvalsRes.ok()) return "";
          const approvals = await approvalsRes.json();
          const hireApproval = approvals.find(
            (entry: {
              id: string;
              type: string;
              requestedByAgentId: string | null;
              payload?: { name?: string; adapterType?: string };
            }) =>
              entry.type === "hire_agent" &&
              entry.requestedByAgentId === ceoAgent.id &&
              entry.payload?.name === workerName &&
              entry.payload?.adapterType === "hermes_local",
          );
          hireApprovalId = hireApproval?.id ?? "";
          return hireApprovalId;
        },
        {
          timeout: 4 * 60 * 1000,
          intervals: [5_000, 10_000],
        },
      )
      .not.toBe("");

    const pendingApprovalRes = await page.request.get(`${baseUrl}/api/approvals/${hireApprovalId}`);
    expect(pendingApprovalRes.ok()).toBe(true);
    const pendingApproval = await pendingApprovalRes.json();
    expect(pendingApproval.status).toBe("pending");

    await page.goto(`${baseUrl}/${company.issuePrefix}/approvals/${hireApprovalId}`);
    await expect(page.getByRole("button", { name: "Approve" })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Approval confirmed")).toBeVisible({ timeout: 20_000 });

    const approveNoteRes = await page.request.post(
      `${baseUrl}/api/approvals/${hireApprovalId}/comments`,
      {
        data: { body: approvalDecisionNote },
      },
    );
    expect(approveNoteRes.ok()).toBe(true);

    let workerAgentId = "";
    await expect
      .poll(
        async () => {
          const workerAgentsRes = await page.request.get(
            `${baseUrl}/api/companies/${company.id}/agents`,
          );
          if (!workerAgentsRes.ok()) return "";
          const workerAgents = await workerAgentsRes.json();
          const worker = workerAgents.find(
            (entry: { id: string; name: string; status: string; adapterType: string }) =>
              entry.name === workerName &&
              entry.adapterType === "hermes_local" &&
              entry.status !== "pending_approval",
          );
          workerAgentId = worker?.id ?? "";
          return workerAgentId;
        },
        {
          timeout: 2 * 60 * 1000,
          intervals: [2_000, 5_000],
        },
      )
      .not.toBe("");

    const workerAgentRes = await page.request.get(`${baseUrl}/api/agents/${workerAgentId}`);
    expect(workerAgentRes.ok()).toBe(true);
    const workerAgent = await workerAgentRes.json();
    expect(workerAgent.status).toBe("idle");
    expect(workerAgent.adapterType).toBe("hermes_local");

    await expect
      .poll(
        async () => {
          const files = await listFilesSafe(HERMES_NOTIFICATION_DIR);
          return files.find((fileName) => !notificationFilesBefore.has(fileName)) ?? "";
        },
        {
          timeout: 60_000,
          intervals: [2_000, 5_000],
        },
      )
      .not.toBe("");

    const workerIssueRes = await page.request.post(
      `${baseUrl}/api/companies/${company.id}/issues`,
      {
        data: {
          title: workerTaskTitle,
          description:
            'Post a comment that contains "AGENT_OK" and then mark this issue done.',
          assigneeAgentId: workerAgentId,
          status: "todo",
        },
      },
    );
    expect(workerIssueRes.ok()).toBe(true);
    const workerIssue = await workerIssueRes.json();

    await expect
      .poll(
        async () => {
          const issueRes = await page.request.get(`${baseUrl}/api/issues/${workerIssue.id}`);
          if (!issueRes.ok()) return "";
          const issue = await issueRes.json();
          return issue.status;
        },
        {
          timeout: 4 * 60 * 1000,
          intervals: [5_000, 10_000],
        },
      )
      .toBe("done");

    await expect
      .poll(
        async () => {
          const commentsRes = await page.request.get(
            `${baseUrl}/api/issues/${workerIssue.id}/comments`,
          );
          if (!commentsRes.ok()) return false;
          const comments = await commentsRes.json();
          return comments.some(
            (comment: { body?: string | null }) =>
              typeof comment.body === "string" && comment.body.includes("AGENT_OK"),
          );
        },
        {
          timeout: 2 * 60 * 1000,
          intervals: [5_000, 10_000],
        },
      )
      .toBe(true);
  });
});
