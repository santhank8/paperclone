type RoleTemplate = {
  name: string;
  role: string;
  title: string;
  capabilities: string;
  budgetMonthlyCents: number;
  reportsTo?: string;
  adapterConfig: Record<string, unknown>;
};

type CreatedAgent = { id: string; name: string };

type Options = {
  baseUrl: string;
  cookie: string;
  companyName: string;
  companyDescription: string;
  companyBudgetMonthlyCents: number;
  gatewayUrl: string;
  gatewayToken: string;
  model: string;
};

function parseArg(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  if (match) return match.slice(prefix.length);
  return fallback;
}

function required(value: string | undefined, message: string): string {
  if (!value || value.trim().length === 0) {
    console.error(message);
    process.exit(1);
  }
  return value;
}

async function api<T>(
  options: Options,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${options.baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Cookie: options.cookie,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${path}: ${body}`);
  }

  return (await res.json()) as T;
}

function buildRoles(options: Options): RoleTemplate[] {
  const adapterConfigBase = {
    url: options.gatewayUrl,
    headers: {
      "x-openclaw-token": options.gatewayToken,
    },
    payloadTemplate: {
      model: options.model,
    },
    waitTimeoutMs: 120000,
  };

  return [
    {
      name: "Board-CTO",
      role: "cto",
      title: "Chief Technology Officer",
      capabilities: "Architecture planning, priority decisions, technical governance",
      budgetMonthlyCents: 15000,
      adapterConfig: adapterConfigBase,
    },
    {
      name: "Engineer-01",
      role: "engineer",
      title: "Software Engineer",
      capabilities: "Feature implementation, refactors, tests",
      budgetMonthlyCents: 30000,
      reportsTo: "Board-CTO",
      adapterConfig: adapterConfigBase,
    },
    {
      name: "QA-01",
      role: "qa",
      title: "QA Engineer",
      capabilities: "Test planning, regression checks, bug reproduction",
      budgetMonthlyCents: 8000,
      reportsTo: "Board-CTO",
      adapterConfig: adapterConfigBase,
    },
    {
      name: "Research-01",
      role: "researcher",
      title: "Research Analyst",
      capabilities: "Competitive and market research",
      budgetMonthlyCents: 6000,
      reportsTo: "Board-CTO",
      adapterConfig: adapterConfigBase,
    },
  ];
}

async function main() {
  const options: Options = {
    baseUrl: parseArg("base-url", process.env.PAPERCLIP_BASE_URL ?? "http://127.0.0.1:3100")!,
    cookie: required(
      parseArg("cookie", process.env.PAPERCLIP_COOKIE),
      "Missing auth cookie. Set PAPERCLIP_COOKIE or pass --cookie='better-auth.session_token=...'",
    ),
    companyName: parseArg("company-name", "OpenClaw Ops")!,
    companyDescription: parseArg(
      "company-description",
      "Paperclip company orchestrating OpenClaw agents with strict budget and governance.",
    )!,
    companyBudgetMonthlyCents: Number(parseArg("company-budget-cents", "100000")),
    gatewayUrl: required(
      parseArg("gateway-url", process.env.OPENCLAW_GATEWAY_URL),
      "Missing gateway URL. Set OPENCLAW_GATEWAY_URL or pass --gateway-url=ws://127.0.0.1:18789",
    ),
    gatewayToken: required(
      parseArg("gateway-token", process.env.OPENCLAW_GATEWAY_TOKEN),
      "Missing gateway token. Set OPENCLAW_GATEWAY_TOKEN or pass --gateway-token=...",
    ),
    model: parseArg("model", "gpt-5.3-codex")!,
  };

  const company = await api<{ id: string }>(options, "/api/companies", {
    method: "POST",
    body: JSON.stringify({
      name: options.companyName,
      description: options.companyDescription,
    }),
  });

  await api(options, `/api/companies/${company.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      budgetMonthlyCents: options.companyBudgetMonthlyCents,
    }),
  });

  const templates = buildRoles(options);
  const created = new Map<string, CreatedAgent>();

  for (const template of templates) {
    const reportsToId = template.reportsTo ? created.get(template.reportsTo)?.id : null;

    const payload: Record<string, unknown> = {
      name: template.name,
      role: template.role,
      title: template.title,
      capabilities: template.capabilities,
      adapterType: "openclaw_gateway",
      adapterConfig: template.adapterConfig,
      budgetMonthlyCents: template.budgetMonthlyCents,
    };

    if (reportsToId) payload.reportsTo = reportsToId;

    const agent = await api<{ id: string; name: string }>(
      options,
      `/api/companies/${company.id}/agents`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    created.set(template.name, { id: agent.id, name: agent.name });
  }

  console.log("✅ Company bootstrap complete");
  console.log(JSON.stringify({
    companyId: company.id,
    agents: Array.from(created.values()),
    baseUrl: options.baseUrl,
  }, null, 2));
}

void main().catch((error) => {
  console.error("❌ Bootstrap failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
