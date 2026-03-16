# The 5 MCPs That Cover 90% of Use Cases

## 1. Filesystem — Scoped Read/Write Beyond Your Project

**Use when:** Claude needs to access files outside the current project directory (home directory, /tmp, shared folders).

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/tmp",
        "/Users/yourname/Documents"
      ]
    }
  }
}
```

**No API key needed.** The paths in `args` define what the MCP can access — add only what Claude legitimately needs.

**Common mistake:** Adding `/` or `/Users/yourname` as the allowed path — that's full filesystem access. Scope it to exactly what's needed.

---

## 2. GitHub — Issues, PRs, Repo Access

**Use when:** Claude needs to read/create GitHub issues, PRs, review code, or search repositories.

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

**Get a token:** GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens. Minimum scopes: `Contents: Read`, `Issues: Read and write`, `Pull requests: Read and write`.

**Common mistake:** Using a classic token with `repo` scope (full access) when fine-grained read-only suffices for most use cases.

---

## 3. Postgres — Direct SQL Queries

**Use when:** Claude needs to query a database — analytics, data exploration, schema inspection.

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "${DATABASE_URL}"
      ]
    }
  }
}
```

Set `DATABASE_URL` in your environment:
```bash
export DATABASE_URL=postgresql://user:password@localhost:5432/mydb
```

**Common mistake:** Using a read-write connection string for exploratory use. Create a read-only Postgres role for Claude:
```sql
CREATE USER claude_readonly WITH PASSWORD 'yourpassword';
GRANT CONNECT ON DATABASE mydb TO claude_readonly;
GRANT USAGE ON SCHEMA public TO claude_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO claude_readonly;
```

**SQLite variant:**
```json
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite", "--db-path", "./data/mydb.sqlite"]
    }
  }
}
```

---

## 4. Brave Search — Web Search

**Use when:** Claude needs to search the web for current information (documentation, pricing, recent events).

```json
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "${BRAVE_API_KEY}"
      }
    }
  }
}
```

**Get a free API key:** [brave.com/search/api](https://brave.com/search/api) — free tier includes 2,000 queries/month.

**Common mistake:** Expecting this to behave like a browser. Brave Search returns search results (titles, URLs, snippets) — not rendered page content. For page content, use Puppeteer.

---

## 5. Puppeteer — Browser Automation

**Use when:** Claude needs to scrape page content, take screenshots, interact with web UIs, or test frontend behavior.

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
    }
  }
}
```

**No API key needed.** Puppeteer downloads Chromium on first run (takes ~30 seconds). Budget for this on first install.

**Common mistake:** Using Puppeteer when Brave Search is sufficient. Puppeteer is heavier — spinning up a browser takes 2-3 seconds. Use search for information retrieval, Puppeteer only when you need the rendered page or UI interaction.

---

## Combined Project Config

All five in one file:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "${DATABASE_URL}"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": { "BRAVE_API_KEY": "${BRAVE_API_KEY}" }
    },
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
    }
  }
}
```
