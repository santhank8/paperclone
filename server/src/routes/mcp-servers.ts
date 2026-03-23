import { Router, type Request } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import type { Db } from "@paperclipai/db";
import { isUuidLike } from "@paperclipai/shared";
import {
  mcpConfigPath,
  fromClaudeMcpJson,
  fromOpenCodeJson,
  fromCodexToml,
  toClaudeMcpJson,
  toOpenCodeMcpJson,
  toCodexToml,
  type McpServersMap,
} from "@paperclipai/adapter-utils";
import { agentService } from "../services/index.js";
import { badRequest, notFound, unprocessable, conflict, forbidden } from "../errors.js";
import { assertCompanyAccess } from "./authz.js";

export function mcpServerRoutes(db: Db) {
  const router = Router();
  const svc = agentService(db);

  async function resolveAgent(req: Request) {
    const rawParam = req.params.id;
    const rawId = typeof rawParam === "string" ? rawParam.trim() : "";
    if (!rawId) throw badRequest("Agent ID is required");

    if (isUuidLike(rawId)) {
      const agent = await svc.getById(rawId);
      if (!agent) throw notFound("Agent not found");
      return agent;
    }

    const companyIdQuery = req.query.companyId;
    const companyId =
      typeof companyIdQuery === "string" && companyIdQuery.trim().length > 0
        ? companyIdQuery.trim()
        : req.actor?.type === "agent"
          ? req.actor.companyId
          : null;

    if (!companyId) {
      throw unprocessable("Agent shortname lookup requires companyId query parameter");
    }

    const resolved = await svc.resolveByReference(companyId, rawId);
    if (resolved.ambiguous) {
      throw conflict("Agent shortname is ambiguous in this company. Use the agent ID.");
    }
    if (!resolved.agent) throw notFound("Agent not found");
    return resolved.agent;
  }

  function getCwd(agent: { adapterConfig: unknown }): string {
    const config = agent.adapterConfig as Record<string, unknown> | null;
    const cwd = config?.cwd;
    if (!cwd || typeof cwd !== "string") {
      throw badRequest("Agent has no workspace directory configured");
    }
    return cwd;
  }

  function getAdapterType(agent: { adapterType: string }): string {
    return agent.adapterType;
  }

  function parseFileContent(content: string, format: string): McpServersMap {
    switch (format) {
      case "claude":
      case "cursor":
        return fromClaudeMcpJson(content);
      case "opencode":
        return fromOpenCodeJson(content);
      case "codex":
        return fromCodexToml(content);
      default:
        return {};
    }
  }

  /**
   * GET /api/agents/:id/mcp-servers
   * Reads MCP config from the agent's workspace config file on disk.
   */
  router.get("/agents/:id/mcp-servers", async (req, res, next) => {
    try {
      const agent = await resolveAgent(req);
      assertCompanyAccess(req, agent.companyId);

      const cwd = getCwd(agent);
      const adapterType = getAdapterType(agent);
      const pathInfo = mcpConfigPath(adapterType);

      if (!pathInfo) {
        res.json({ servers: {}, adapterType, filePath: null });
        return;
      }

      const fullPath = path.resolve(cwd, pathInfo.filePath);

      let servers: McpServersMap = {};
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        servers = parseFileContent(content, pathInfo.format);
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }

      res.json({ servers, adapterType, filePath: pathInfo.filePath });
    } catch (err) {
      next(err);
    }
  });

  /**
   * PUT /api/agents/:id/mcp-servers
   * Writes MCP config to the agent's workspace config file on disk.
   * For opencode.json, preserves non-MCP keys (permission, $schema, etc.).
   */
  router.put("/agents/:id/mcp-servers", async (req, res, next) => {
    try {
      const agent = await resolveAgent(req);
      assertCompanyAccess(req, agent.companyId);

      const cwd = getCwd(agent);
      const adapterType = getAdapterType(agent);
      const pathInfo = mcpConfigPath(adapterType);

      if (!pathInfo) {
        throw badRequest(`Adapter type "${adapterType}" does not support disk-based MCP configuration`);
      }

      const body = req.body as { servers?: McpServersMap };
      if (!body.servers || typeof body.servers !== "object" || Array.isArray(body.servers)) {
        throw badRequest("Request body must include a `servers` object");
      }
      const servers = body.servers;

      const fullPath = path.resolve(cwd, pathInfo.filePath);
      let output: string;

      if (pathInfo.format === "opencode") {
        let existing: Record<string, unknown> = {};
        try {
          const content = await fs.readFile(fullPath, "utf-8");
          existing = JSON.parse(content);
        } catch (err: unknown) {
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        }

        const mcpSection: Record<string, unknown> = {};
        for (const [name, srv] of Object.entries(servers)) {
          if (srv.transport === "stdio") {
            mcpSection[name] = {
              type: "local",
              enabled: srv.enabled !== false,
              command: [srv.command ?? "", ...(srv.args ?? [])],
              ...(srv.env && Object.keys(srv.env).length > 0 ? { environment: srv.env } : {}),
            };
          } else {
            mcpSection[name] = {
              type: "remote",
              enabled: srv.enabled !== false,
              url: srv.url ?? "",
              ...(srv.headers && Object.keys(srv.headers).length > 0 ? { headers: srv.headers } : {}),
              ...(srv.env && Object.keys(srv.env).length > 0 ? { environment: srv.env } : {}),
            };
          }
        }
        existing.mcp = mcpSection;
        output = JSON.stringify(existing, null, 2) + "\n";
      } else if (pathInfo.format === "codex") {
        output = toCodexToml(servers);
      } else {
        output = toClaudeMcpJson(servers) + "\n";
      }

      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, output, "utf-8");

      res.json({ servers, filePath: pathInfo.filePath });
    } catch (err) {
      next(err);
    }
  });

  const MCP_INSTRUCTIONS_DIR = ".agents/mcp-instructions";

  function instructionsPath(cwd: string, serverName: string): string {
    const safeName = serverName.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.resolve(cwd, MCP_INSTRUCTIONS_DIR, `${safeName}.md`);
  }

  /**
   * GET /api/agents/:id/mcp-servers/:serverName/instructions
   * Reads per-MCP custom instructions from disk.
   */
  router.get("/agents/:id/mcp-servers/:serverName/instructions", async (req, res, next) => {
    try {
      const agent = await resolveAgent(req);
      assertCompanyAccess(req, agent.companyId);

      const cwd = getCwd(agent);
      const serverName = req.params.serverName as string;
      if (!serverName?.trim()) throw badRequest("Server name is required");

      const filePath = instructionsPath(cwd, serverName);

      let content = "";
      try {
        content = await fs.readFile(filePath, "utf-8");
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }

      res.json({ content, serverName });
    } catch (err) {
      next(err);
    }
  });

  /**
   * PUT /api/agents/:id/mcp-servers/:serverName/instructions
   * Writes per-MCP custom instructions to disk.
   */
  router.put("/agents/:id/mcp-servers/:serverName/instructions", async (req, res, next) => {
    try {
      const agent = await resolveAgent(req);
      assertCompanyAccess(req, agent.companyId);

      const cwd = getCwd(agent);
      const serverName = req.params.serverName as string;
      if (!serverName?.trim()) throw badRequest("Server name is required");

      const body = req.body as { content?: string };
      if (typeof body.content !== "string") {
        throw badRequest("Request body must include a `content` string");
      }

      const filePath = instructionsPath(cwd, serverName);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, body.content, "utf-8");

      res.json({ content: body.content, serverName });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
