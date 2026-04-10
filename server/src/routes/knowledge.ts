import { Router, type Request, type Response } from "express";
import multer from "multer";
import type { Db } from "@paperclipai/db";
import type { KnowledgeEntryScope } from "@paperclipai/shared";
import type { StorageService } from "../storage/types.js";
import { assetService, knowledgeService, logActivity } from "../services/index.js";
import { isAllowedContentType, MAX_ATTACHMENT_BYTES } from "../attachment-types.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { unprocessable } from "../errors.js";

const VALID_SCOPES = new Set(["company", "department", "agent"]);
const VALID_TYPES = new Set(["folder", "document"]);

function assertValidScope(scope: string): asserts scope is KnowledgeEntryScope {
  if (!VALID_SCOPES.has(scope)) {
    throw unprocessable(`Invalid scope: ${scope}. Must be one of: company, department, agent`);
  }
}

export function knowledgeRoutes(db: Db, storage: StorageService) {
  const router = Router();
  const svc = knowledgeService(db);
  const assetSvc = assetService(db);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 },
  });

  async function runSingleFileUpload(req: Request, res: Response) {
    await new Promise<void>((resolve, reject) => {
      upload.single("file")(req, res, (err: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // List entries
  router.get("/companies/:companyId/knowledge", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const scope = req.query.scope as string | undefined;
    const scopeAgentId = req.query.scopeAgentId as string | undefined;
    const parentId = req.query.parentId as string | undefined;

    const filters: Parameters<typeof svc.list>[1] = {};
    if (scope) {
      assertValidScope(scope);
      filters.scope = scope;
    }
    if (scopeAgentId) filters.scopeAgentId = scopeAgentId;
    if (parentId !== undefined) {
      filters.parentId = parentId === "null" || parentId === "" ? null : parentId;
    }

    const result = await svc.list(companyId, filters);
    res.json(result);
  });

  // List departments (derived from org tree)
  router.get("/companies/:companyId/knowledge/departments", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.listDepartments(companyId);
    res.json(result);
  });

  // Full tree
  router.get("/companies/:companyId/knowledge/tree", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const scope = req.query.scope as string | undefined;
    const scopeAgentId = req.query.scopeAgentId as string | undefined;

    const filters: Parameters<typeof svc.listTree>[1] = {};
    if (scope) {
      assertValidScope(scope);
      filters.scope = scope;
    }
    if (scopeAgentId) filters.scopeAgentId = scopeAgentId;

    const result = await svc.listTree(companyId, filters);
    res.json(result);
  });

  // Get entry with content
  router.get("/companies/:companyId/knowledge/:entryId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const entryId = req.params.entryId as string;
    assertCompanyAccess(req, companyId);

    const result = await svc.getById(companyId, entryId);
    if (!result) {
      res.status(404).json({ error: "Knowledge entry not found" });
      return;
    }
    res.json(result);
  });

  // Create folder or document
  router.post("/companies/:companyId/knowledge", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const actor = getActorInfo(req);
    const { type, name, scope, scopeAgentId, parentId, description, body } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw unprocessable("name is required");
    }
    if (!type || !VALID_TYPES.has(type)) {
      throw unprocessable("type must be 'folder' or 'document'");
    }
    if (!scope) {
      throw unprocessable("scope is required");
    }
    assertValidScope(scope);

    const commonInput = {
      parentId: parentId ?? null,
      name: name.trim(),
      scope,
      scopeAgentId: scopeAgentId ?? null,
      description: description ?? null,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
      createdByAgentId: actor.agentId,
    };

    let result;
    if (type === "folder") {
      result = await svc.createFolder(companyId, commonInput);
    } else {
      if (typeof body !== "string") {
        throw unprocessable("body is required for document type");
      }
      result = await svc.createDocument(companyId, { ...commonInput, body });
    }

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: `knowledge.${type}_created`,
      entityType: "knowledge_entry",
      entityId: result.id,
      details: { name: result.name, scope: result.scope, type },
    });

    res.status(201).json(result);
  });

  // Upload binary file
  router.post("/companies/:companyId/knowledge/upload", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    try {
      await runSingleFileUpload(req, res);
    } catch (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(422).json({ error: `File exceeds ${MAX_ATTACHMENT_BYTES} bytes` });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    const file = (req as Request & { file?: { mimetype: string; buffer: Buffer; originalname: string } }).file;
    if (!file) {
      res.status(400).json({ error: "Missing file field 'file'" });
      return;
    }

    const contentType = (file.mimetype || "").toLowerCase();
    if (!isAllowedContentType(contentType)) {
      res.status(422).json({ error: `Unsupported file type: ${contentType || "unknown"}` });
      return;
    }

    if (file.buffer.length <= 0) {
      res.status(422).json({ error: "File is empty" });
      return;
    }

    const actor = getActorInfo(req);
    const scope = (req.body.scope || "company") as string;
    assertValidScope(scope);
    const scopeAgentId = req.body.scopeAgentId || null;
    const parentId = req.body.parentId || null;
    const description = req.body.description || null;
    const name = req.body.name || file.originalname || "Untitled";

    // Store file via storage service
    const stored = await storage.putFile({
      companyId,
      namespace: "knowledge",
      originalFilename: file.originalname || null,
      contentType,
      body: file.buffer,
    });

    // Create asset record
    const asset = await assetSvc.create(companyId, {
      provider: stored.provider,
      objectKey: stored.objectKey,
      contentType: stored.contentType,
      byteSize: stored.byteSize,
      sha256: stored.sha256,
      originalFilename: stored.originalFilename,
      createdByAgentId: actor.agentId,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
    });

    // Create knowledge entry
    const result = await svc.createFile(
      companyId,
      {
        parentId,
        name: name.trim(),
        scope,
        scopeAgentId,
        description,
        createdByUserId: actor.actorType === "user" ? actor.actorId : null,
        createdByAgentId: actor.agentId,
      },
      asset,
    );

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "knowledge.file_uploaded",
      entityType: "knowledge_entry",
      entityId: result.id,
      details: {
        name: result.name,
        scope: result.scope,
        contentType,
        byteSize: stored.byteSize,
      },
    });

    res.status(201).json(result);
  });

  // Update entry metadata (rename, move, description)
  router.patch("/companies/:companyId/knowledge/:entryId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const entryId = req.params.entryId as string;
    assertCompanyAccess(req, companyId);

    const { name, parentId, description, sortOrder } = req.body;
    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      throw unprocessable("name must be a non-empty string");
    }
    const result = await svc.updateEntry(companyId, entryId, {
      name: name !== undefined ? name.trim() : undefined,
      ...(parentId !== undefined ? { parentId } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
    });

    if (!result) {
      res.status(404).json({ error: "Knowledge entry not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "knowledge.entry_updated",
      entityType: "knowledge_entry",
      entityId: result.id,
      details: { name: result.name },
    });

    res.json(result);
  });

  // Update document body
  router.put("/companies/:companyId/knowledge/:entryId/body", async (req, res) => {
    const companyId = req.params.companyId as string;
    const entryId = req.params.entryId as string;
    assertCompanyAccess(req, companyId);

    const actor = getActorInfo(req);
    const { body, baseRevisionId, changeSummary } = req.body;

    if (typeof body !== "string") {
      throw unprocessable("body is required");
    }

    const result = await svc.updateDocumentBody(companyId, entryId, {
      body,
      baseRevisionId: baseRevisionId ?? null,
      changeSummary: changeSummary ?? null,
      createdByUserId: actor.actorType === "user" ? actor.actorId : null,
      createdByAgentId: actor.agentId,
    });

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "knowledge.document_updated",
      entityType: "knowledge_entry",
      entityId: entryId,
      details: { changeSummary },
    });

    res.json(result);
  });

  // List document revisions
  router.get("/companies/:companyId/knowledge/:entryId/revisions", async (req, res) => {
    const companyId = req.params.companyId as string;
    const entryId = req.params.entryId as string;
    assertCompanyAccess(req, companyId);

    const result = await svc.listRevisions(companyId, entryId);
    res.json(result);
  });

  // Delete entry
  router.delete("/companies/:companyId/knowledge/:entryId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const entryId = req.params.entryId as string;
    assertCompanyAccess(req, companyId);

    const result = await svc.deleteEntry(companyId, entryId);
    if (!result) {
      res.status(404).json({ error: "Knowledge entry not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "knowledge.entry_deleted",
      entityType: "knowledge_entry",
      entityId: result.id,
      details: { name: result.name, type: result.type },
    });

    res.json(result);
  });

  // All entries visible to a specific agent
  router.get("/companies/:companyId/knowledge/agent/:agentId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const agentId = req.params.agentId as string;
    assertCompanyAccess(req, companyId);

    const result = await svc.resolveAgentVisibleEntries(companyId, agentId);
    res.json(result);
  });

  return router;
}
