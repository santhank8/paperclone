# Build a Custom MCP in 40 Lines

## When You Need a Custom MCP

The official `@modelcontextprotocol/*` packages cover common external services. Build a custom MCP when:
- You have an internal API with no published MCP
- You need project-specific tools (run a specific script, query a proprietary system)
- You want to expose domain logic as a named tool Claude can call by name

## Setup

```bash
mkdir my-mcp-server && cd my-mcp-server
bun init -y
bun add @modelcontextprotocol/sdk zod
```

## The 40-Line Server

```typescript
// my-mcp-server/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "my-project-tools",
  version: "1.0.0",
});

// Define a tool
server.tool(
  "get_deployment_status",
  "Returns the current deployment status for a given environment",
  {
    environment: z.enum(["staging", "production"]).describe("Target environment"),
  },
  async ({ environment }) => {
    // Replace with your actual logic
    const status = await fetch(`https://internal-api.example.com/status/${environment}`)
      .then(r => r.json());

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(status, null, 2),
        },
      ],
    };
  }
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
```

Run it to test: `bun run index.ts` — it should sit waiting on stdin.

## Add to `.mcp.json`

```json
{
  "mcpServers": {
    "my-project-tools": {
      "command": "bun",
      "args": ["run", "./my-mcp-server/index.ts"],
      "env": {
        "INTERNAL_API_KEY": "${INTERNAL_API_KEY}"
      }
    }
  }
}
```

Restart Claude Code. Run `/mcp` to confirm `my-project-tools: connected`.

## Verify in Claude Code

Ask Claude: "Use the get_deployment_status tool to check staging." Claude should call your tool and return its output.

## Adding More Tools

Call `server.tool()` multiple times before `server.connect()`. Each tool appears as a separate callable in Claude Code:

```typescript
server.tool("tool_one", "Description", { param: z.string() }, async ({ param }) => {
  // ...
});

server.tool("tool_two", "Description", { param: z.number() }, async ({ param }) => {
  // ...
});
```

## Adding Resources

Resources are readable documents (not callable actions). Claude can fetch them like files:

```typescript
server.resource(
  "project-config",
  "config://project",
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify({ projectId: "my-project", region: "us-east-1" }),
        mimeType: "application/json",
      },
    ],
  })
);
```

## Error Handling

Return errors in the content array, not as thrown exceptions:

```typescript
async ({ environment }) => {
  try {
    const result = await fetchStatus(environment);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
}
```

## SDK Reference

Full SDK docs: https://github.com/modelcontextprotocol/typescript-sdk
