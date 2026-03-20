type Options = {
  baseUrl: string;
  cookie: string;
  companyId: string;
  reportsToName: string;
  gatewayUrl: string;
  gatewayToken: string;
  model: string;
};

type Agent = { id: string; name: string };

type Template = {
  name: string;
  role: "engineer" | "devops";
  title: string;
  capabilities: string;
  budgetMonthlyCents: number;
  reportsTo: string;
};

function parseArg(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function required(value: string | undefined, msg: string): string {
  if (!value || value.trim().length === 0) {
    console.error(msg);
    process.exit(1);
  }
  return value;
}

async function api<T>(baseUrl: string, cookie: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${path}: ${await res.text().catch(() => "")}`);
  }

  return (await res.json()) as T;
}

function buildTemplates(): Template[] {
  return [
    {
      name: "Eng-Manager-01",
      role: "engineer",
      title: "Engineering Manager",
      capabilities: "Sprint planning, architecture alignment, code review governance",
      budgetMonthlyCents: 45000,
      reportsTo: "Board-CTO",
    },
    {
      name: "Senior-Backend-01",
      role: "engineer",
      title: "Senior Backend Engineer",
      capabilities: "API architecture, DB design, backend performance",
      budgetMonthlyCents: 35000,
      reportsTo: "Eng-Manager-01",
    },
    {
      name: "Senior-Frontend-01",
      role: "engineer",
      title: "Senior Frontend Engineer",
      capabilities: "Next.js architecture, accessibility, rendering performance",
      budgetMonthlyCents: 35000,
      reportsTo: "Eng-Manager-01",
    },
    {
      name: "Senior-Platform-01",
      role: "engineer",
      title: "Senior Platform Engineer",
      capabilities: "CI/CD, observability, reliability engineering",
      budgetMonthlyCents: 33000,
      reportsTo: "Eng-Manager-01",
    },
    {
      name: "Junior-Engineer-01",
      role: "engineer",
      title: "Junior Software Engineer",
      capabilities: "Bug fixes, tests, small feature delivery",
      budgetMonthlyCents: 14000,
      reportsTo: "Senior-Backend-01",
    },
    {
      name: "Junior-Engineer-02",
      role: "engineer",
      title: "Junior Frontend Engineer",
      capabilities: "UI implementation, component polish, responsive fixes",
      budgetMonthlyCents: 14000,
      reportsTo: "Senior-Frontend-01",
    },
    {
      name: "Junior-Engineer-03",
      role: "engineer",
      title: "Junior Fullstack Engineer",
      capabilities: "Feature integration, testing, docs updates",
      budgetMonthlyCents: 14000,
      reportsTo: "Senior-Platform-01",
    },
    {
      name: "DevOps-01",
      role: "devops",
      title: "DevOps Engineer",
      capabilities: "Deployment automation, secrets hygiene, uptime monitoring",
      budgetMonthlyCents: 22000,
      reportsTo: "Eng-Manager-01",
    },
  ];
}

async function main() {
  const options: Options = {
    baseUrl: parseArg("base-url", process.env.PAPERCLIP_BASE_URL ?? "http://127.0.0.1:3000")!,
    cookie: required(
      parseArg("cookie", process.env.PAPERCLIP_COOKIE),
      "Missing auth cookie. Set PAPERCLIP_COOKIE or pass --cookie='better-auth.session_token=...'",
    ),
    companyId: required(parseArg("company-id", process.env.PAPERCLIP_COMPANY_ID), "Missing --company-id"),
    reportsToName: parseArg("reports-to-name", "Board-CTO")!,
    gatewayUrl: required(parseArg("gateway-url", process.env.OPENCLAW_GATEWAY_URL), "Missing gateway URL"),
    gatewayToken: required(parseArg("gateway-token", process.env.OPENCLAW_GATEWAY_TOKEN), "Missing gateway token"),
    model: parseArg("model", "gpt-5.3-codex")!,
  };

  const adapterConfig = {
    url: options.gatewayUrl,
    headers: { "x-openclaw-token": options.gatewayToken },
    payloadTemplate: { model: options.model },
    waitTimeoutMs: 120000,
  };

  const existing = await api<Agent[]>(
    options.baseUrl,
    options.cookie,
    `/api/companies/${options.companyId}/agents`,
  );

  const byName = new Map(existing.map((a) => [a.name, a]));
  const cto = byName.get(options.reportsToName);
  if (!cto) {
    throw new Error(`Could not find manager '${options.reportsToName}' in company ${options.companyId}`);
  }

  const templates = buildTemplates();
  const created: Agent[] = [];
  const skipped: string[] = [];

  const ensureManager = new Map<string, Agent>();
  ensureManager.set(options.reportsToName, cto);

  for (const template of templates) {
    const existingAgent = byName.get(template.name);
    if (existingAgent) {
      ensureManager.set(template.name, existingAgent);
      skipped.push(template.name);
      continue;
    }

    const manager = ensureManager.get(template.reportsTo) ?? byName.get(template.reportsTo);
    if (!manager) throw new Error(`Manager '${template.reportsTo}' not created/found yet`);

    const payload = {
      name: template.name,
      role: template.role,
      title: template.title,
      capabilities: template.capabilities,
      reportsTo: manager.id,
      adapterType: "openclaw_gateway",
      adapterConfig,
      budgetMonthlyCents: template.budgetMonthlyCents,
    };

    const agent = await api<Agent>(
      options.baseUrl,
      options.cookie,
      `/api/companies/${options.companyId}/agents`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    byName.set(agent.name, agent);
    ensureManager.set(agent.name, agent);
    created.push(agent);
  }

  console.log("✅ Engineering team provisioning complete");
  console.log(JSON.stringify({ companyId: options.companyId, created, skipped }, null, 2));
}

void main().catch((error) => {
  console.error("❌ Team provisioning failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
