import { test, expect } from "@playwright/test";

/**
 * E2E: Company create → delete lifecycle.
 *
 * Creates a company via the API, verifies it exists, then deletes it
 * and confirms all data is removed from the database.
 */

const COMPANY_NAME = `E2E-Lifecycle-${Date.now()}`;

test.describe("Company lifecycle", () => {
  test("creates and deletes a company via API", async ({ request, baseURL }) => {
    // --- Create a company ---
    const createRes = await request.post(`${baseURL}/api/companies`, {
      data: { name: COMPANY_NAME },
    });
    expect(createRes.ok()).toBe(true);
    const company = await createRes.json();
    expect(company.name).toBe(COMPANY_NAME);
    expect(company.id).toBeTruthy();
    expect(company.issuePrefix).toBeTruthy();

    const companyId = company.id;

    // --- Verify it appears in the list ---
    const listRes = await request.get(`${baseURL}/api/companies`);
    expect(listRes.ok()).toBe(true);
    const companies = await listRes.json();
    expect(companies.some((c: { id: string }) => c.id === companyId)).toBe(true);

    // --- Create an agent so the delete exercises agent cleanup ---
    const agentRes = await request.post(`${baseURL}/api/companies/${companyId}/agents`, {
      data: {
        name: "TestCEO",
        role: "ceo",
        adapterType: "claude_local",
      },
    });
    expect(agentRes.ok()).toBe(true);
    const agent = await agentRes.json();
    expect(agent.id).toBeTruthy();

    // --- Create an issue so the delete exercises issue cleanup ---
    const issueRes = await request.post(`${baseURL}/api/companies/${companyId}/issues`, {
      data: {
        title: "Lifecycle test issue",
        description: "Will be deleted with the company.",
        assigneeAgentId: agent.id,
      },
    });
    expect(issueRes.ok()).toBe(true);
    const issue = await issueRes.json();
    expect(issue.id).toBeTruthy();

    // --- Delete the company ---
    const deleteRes = await request.delete(`${baseURL}/api/companies/${companyId}`);
    expect(deleteRes.ok()).toBe(true);
    const deleteBody = await deleteRes.json();
    expect(deleteBody.ok).toBe(true);

    // --- Verify company is gone from the list ---
    const listAfterRes = await request.get(`${baseURL}/api/companies`);
    expect(listAfterRes.ok()).toBe(true);
    const companiesAfter = await listAfterRes.json();
    expect(companiesAfter.some((c: { id: string }) => c.id === companyId)).toBe(false);

    // --- Verify agent is gone (endpoint may return empty list or 404) ---
    const agentAfterRes = await request.get(`${baseURL}/api/companies/${companyId}/agents`);
    if (agentAfterRes.ok()) {
      const agentsAfter = await agentAfterRes.json();
      expect(agentsAfter).toHaveLength(0);
    }

    // --- Verify issue is gone (endpoint may return empty or 404) ---
    const issueAfterRes = await request.get(`${baseURL}/api/issues/${issue.id}`);
    expect(issueAfterRes.ok()).toBe(false);
  });
});
