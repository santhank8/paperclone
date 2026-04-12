import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "@paperclipai/db";
import { notFound } from "../errors.js";
import { companyService } from "../services/index.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";

interface RoadmapLink {
  label: string;
  path: string;
}

interface ResolvedRoadmapLink extends RoadmapLink {
  absolutePath: string;
}

interface RoadmapItemField {
  key: string;
  value: string;
}

interface RoadmapItem {
  id: string;
  title: string;
  fields: RoadmapItemField[];
}

interface RoadmapSection {
  title: string;
  items: RoadmapItem[];
}

interface CompanyRoadmapContext {
  roadmapPath: string | null;
  name: string | null;
  issuePrefix: string | null;
}

const DEFAULT_REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

function toPosixPath(input: string): string {
  return input.split(path.sep).join("/");
}

function toRepoRelativePath(repoRoot: string, absolutePath: string): string {
  return toPosixPath(path.relative(repoRoot, absolutePath));
}

function normalizeLinkTarget(target: string): string {
  return target.split("#")[0]?.split("?")[0] ?? target;
}

function resolveRepoPath(repoRoot: string, fromPath: string, target: string): string {
  const normalizedTarget = normalizeLinkTarget(target).trim();
  if (!normalizedTarget || /^https?:\/\//i.test(normalizedTarget)) {
    throw notFound("Roadmap canonical link must point to a local markdown file");
  }

  const absolutePath = path.resolve(path.dirname(fromPath), normalizedTarget);
  const normalizedRepoRoot = path.resolve(repoRoot);
  if (absolutePath !== normalizedRepoRoot && !absolutePath.startsWith(`${normalizedRepoRoot}${path.sep}`)) {
    throw notFound("Roadmap canonical link points outside the repository");
  }
  return absolutePath;
}

async function readFirstExistingFile(paths: string[]): Promise<{ path: string; content: string }> {
  for (const candidate of paths) {
    try {
      const content = await fs.readFile(candidate, "utf8");
      return { path: candidate, content };
    } catch (error) {
      const maybeErr = error as NodeJS.ErrnoException;
      if (maybeErr.code === "ENOENT") continue;
      throw error;
    }
  }
  throw notFound("Roadmap file not found. Expected doc/ROADMAP.md or ROADMAP.md.");
}

async function readCanonicalRoadmap(repoRoot: string, indexCandidates: string[]) {
  const { path: indexPath, content: indexMarkdown } = await readFirstExistingFile(indexCandidates);
  const indexDetails = parseRoadmapIndex(indexMarkdown, indexPath, repoRoot);

  let roadmapMarkdown: string;
  try {
    roadmapMarkdown = await fs.readFile(indexDetails.canonicalPath, "utf8");
  } catch (error) {
    const maybeErr = error as NodeJS.ErrnoException;
    if (maybeErr.code === "ENOENT") {
      throw notFound(
        `Canonical roadmap file not found: ${toRepoRelativePath(repoRoot, indexDetails.canonicalPath)}`,
      );
    }
    throw error;
  }

  return {
    indexPath,
    indexMarkdown,
    indexDetails,
    roadmapMarkdown,
  };
}

function buildSyntheticRoadmapIndex(repoRoot: string, absolutePath: string, roadmapMarkdown: string) {
  const parsed = parseRoadmapDocument(roadmapMarkdown);
  const relativePath = toRepoRelativePath(repoRoot, absolutePath);
  return {
    indexPath: absolutePath,
    indexMarkdown: createSyntheticIndexMarkdown(parsed.title, relativePath),
    indexDetails: {
      canonicalLabel: parsed.title,
      canonicalPath: absolutePath,
      links: [{ label: parsed.title, path: relativePath }],
    },
    roadmapMarkdown,
  };
}

function resolveDirectRoadmapPath(repoRoot: string, configuredPath: string): string {
  const normalizedTarget = normalizeLinkTarget(configuredPath).trim();
  if (!normalizedTarget || /^https?:\/\//i.test(normalizedTarget)) {
    throw notFound("Company roadmap override must point to a local markdown file");
  }

  const absolutePath = path.resolve(repoRoot, normalizedTarget);
  const normalizedRepoRoot = path.resolve(repoRoot);
  if (absolutePath !== normalizedRepoRoot && !absolutePath.startsWith(`${normalizedRepoRoot}${path.sep}`)) {
    throw notFound("Company roadmap override points outside the repository");
  }
  if (path.extname(absolutePath).toLowerCase() !== ".md") {
    throw notFound("Company roadmap override must point to a markdown file");
  }
  return absolutePath;
}

function createSyntheticIndexMarkdown(label: string, roadmapPath: string): string {
  return [
    "# Roadmap",
    "",
    "Canonical roadmap source:",
    "",
    `- [${label}](${roadmapPath})`,
  ].join("\n");
}

function slugifyCompanyName(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildAutoDetectRoadmapCandidates(context: CompanyRoadmapContext): string[] {
  const candidates = new Set<string>();
  const slug = slugifyCompanyName(context.name);
  if (slug) {
    candidates.add(`doc/company-roadmaps/${slug}-roadmap.md`);
  }
  const issuePrefix = context.issuePrefix?.trim().toLowerCase() ?? "";
  if (issuePrefix) {
    candidates.add(`doc/company-roadmaps/${issuePrefix}-roadmap.md`);
  }
  return [...candidates];
}

async function readExistingRoadmapCandidate(repoRoot: string, candidatePaths: string[]) {
  for (const candidatePath of candidatePaths) {
    const absolutePath = resolveDirectRoadmapPath(repoRoot, candidatePath);
    try {
      const roadmapMarkdown = await fs.readFile(absolutePath, "utf8");
      return { absolutePath, roadmapMarkdown };
    } catch (error) {
      const maybeErr = error as NodeJS.ErrnoException;
      if (maybeErr.code === "ENOENT") continue;
      throw error;
    }
  }
  return null;
}

function parseRoadmapIndex(
  markdown: string,
  indexPath: string,
  repoRoot: string,
): {
    canonicalLabel: string;
    canonicalPath: string;
    links: RoadmapLink[];
  } {
  const links: ResolvedRoadmapLink[] = [];
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(linkPattern)) {
    const label = match[1]?.trim();
    const target = match[2]?.trim();
    if (!label || !target || /^https?:\/\//i.test(target)) continue;
    try {
      const absolutePath = resolveRepoPath(repoRoot, indexPath, target);
      links.push({
        label,
        path: toRepoRelativePath(repoRoot, absolutePath),
        absolutePath,
      });
    } catch {
      // Ignore links that do not resolve to local repo files.
    }
  }

  if (links.length === 0) {
    throw notFound("No canonical roadmap link found in ROADMAP.md.");
  }

  const canonical = links[0];
  return {
    canonicalLabel: canonical.label,
    canonicalPath: canonical.absolutePath,
    links: links.map(({ absolutePath: _unused, ...link }) => link),
  };
}

function parseRoadmapDocument(markdown: string): {
  title: string;
  status: string | null;
  owner: string | null;
  lastUpdated: string | null;
  contract: string[];
  sections: RoadmapSection[];
} {
  const lines = markdown.split(/\r?\n/);
  let title = "Roadmap";
  let status: string | null = null;
  let owner: string | null = null;
  let lastUpdated: string | null = null;
  const contract: string[] = [];
  const sections: RoadmapSection[] = [];

  let inContract = false;
  let currentSection: RoadmapSection | null = null;
  let currentItem: RoadmapItem | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("# ") && title === "Roadmap") {
      title = line.slice(2).trim();
      continue;
    }

    const metaMatch = line.match(/^(Status|Owner|Last Updated):\s*(.+)$/i);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      const value = metaMatch[2].trim();
      if (key === "status") status = value;
      if (key === "owner") owner = value;
      if (key === "last updated") lastUpdated = value;
      continue;
    }

    if (line.startsWith("## ")) {
      const heading = line.slice(3).trim();
      inContract = heading.toLowerCase() === "contract";
      currentItem = null;
      currentSection = null;
      if (!inContract) {
        currentSection = { title: heading, items: [] };
        sections.push(currentSection);
      }
      continue;
    }

    if (inContract) {
      const contractMatch = line.match(/^\d+\.\s+(.+)$/);
      if (contractMatch) {
        contract.push(contractMatch[1].trim());
      }
      continue;
    }

    if (line.startsWith("### ")) {
      const heading = line.slice(4).trim();
      const itemMatch = heading.match(/^(RM-[A-Za-z0-9-]+)\s+(.+)$/);
      const id = itemMatch ? itemMatch[1] : heading;
      const itemTitle = itemMatch ? itemMatch[2] : heading;
      currentItem = { id, title: itemTitle, fields: [] };
      currentSection?.items.push(currentItem);
      continue;
    }

    if (line.startsWith("- ") && currentItem) {
      const bullet = line.slice(2).trim();
      const fieldMatch = bullet.match(/^([^:]+):\s*(.*)$/);
      if (fieldMatch) {
        currentItem.fields.push({
          key: fieldMatch[1].trim(),
          value: fieldMatch[2].trim(),
        });
      } else {
        currentItem.fields.push({ key: "Note", value: bullet });
      }
    }
  }

  return {
    title,
    status,
    owner,
    lastUpdated,
    contract,
    sections,
  };
}

function renameRoadmapItemTitle(markdown: string, roadmapId: string, nextTitle: string, lastUpdatedDate: string): string | null {
  const lines = markdown.split(/\r?\n/);
  let renamed = false;
  let updatedLastUpdated = false;
  const normalizedRoadmapId = roadmapId.trim().toUpperCase();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const headingMatch = line.match(/^(\s*###\s+)(RM-[A-Za-z0-9-]+)(\s+)(.+?)(\s*)$/);
    if (headingMatch && headingMatch[2]?.toUpperCase() === normalizedRoadmapId) {
      lines[index] = `${headingMatch[1]}${headingMatch[2]} ${nextTitle}${headingMatch[5] ?? ""}`;
      renamed = true;
      continue;
    }

    if (/^\s*Last Updated:\s*/i.test(line)) {
      lines[index] = "Last Updated: " + lastUpdatedDate;
      updatedLastUpdated = true;
    }
  }

  if (!renamed) {
    return null;
  }

  if (!updatedLastUpdated) {
    const statusIndex = lines.findIndex((line) => /^\s*(Status|Owner):\s*/i.test(line));
    const insertAt = statusIndex >= 0 ? statusIndex + 1 : 1;
    lines.splice(insertAt, 0, `Last Updated: ${lastUpdatedDate}`);
  }

  return lines.join("\n");
}

export function roadmapRoutes(opts: {
  repoRoot?: string;
  db?: Db;
  resolveCompanyRoadmapPath?: (companyId: string) => Promise<string | null>;
  resolveCompanyRoadmapContext?: (companyId: string) => Promise<CompanyRoadmapContext | null>;
} = {}) {
  const router = Router();
  const repoRoot = path.resolve(opts.repoRoot ?? DEFAULT_REPO_ROOT);
  const indexCandidates = [
    path.join(repoRoot, "doc", "ROADMAP.md"),
    path.join(repoRoot, "ROADMAP.md"),
  ];
  const companiesSvc = opts.db ? companyService(opts.db) : null;

  async function resolveCompanyRoadmapContext(companyId: string): Promise<CompanyRoadmapContext | null> {
    if (opts.resolveCompanyRoadmapContext) {
      return await opts.resolveCompanyRoadmapContext(companyId);
    }
    if (companiesSvc) {
      const company = await companiesSvc.getById(companyId);
      if (!company) return null;
      return {
        roadmapPath: company.roadmapPath?.trim() || null,
        name: company.name?.trim() || null,
        issuePrefix: company.issuePrefix?.trim() || null,
      };
    }
    if (opts.resolveCompanyRoadmapPath) {
      return {
        roadmapPath: (await opts.resolveCompanyRoadmapPath(companyId))?.trim() || null,
        name: null,
        issuePrefix: null,
      };
    }
    return null;
  }

  async function readRoadmapForRequest(companyId: string | null) {
    if (companyId) {
      const companyContext = await resolveCompanyRoadmapContext(companyId);
      const companyRoadmapPath = companyContext?.roadmapPath?.trim() || null;
      if (companyRoadmapPath) {
        const absolutePath = resolveDirectRoadmapPath(repoRoot, companyRoadmapPath);
        let roadmapMarkdown: string;
        try {
          roadmapMarkdown = await fs.readFile(absolutePath, "utf8");
        } catch (error) {
          const maybeErr = error as NodeJS.ErrnoException;
          if (maybeErr.code === "ENOENT") {
            throw notFound(`Company roadmap file not found: ${toRepoRelativePath(repoRoot, absolutePath)}`);
          }
          throw error;
        }
        return buildSyntheticRoadmapIndex(repoRoot, absolutePath, roadmapMarkdown);
      }

      if (companyContext) {
        const autoDetected = await readExistingRoadmapCandidate(
          repoRoot,
          buildAutoDetectRoadmapCandidates(companyContext),
        );
        if (autoDetected) {
          return buildSyntheticRoadmapIndex(repoRoot, autoDetected.absolutePath, autoDetected.roadmapMarkdown);
        }
      }
    }

    return await readCanonicalRoadmap(repoRoot, indexCandidates);
  }

  router.patch("/roadmap/items/:roadmapId", async (req, res) => {
    assertBoard(req);
    const companyIdQuery = typeof req.query.companyId === "string" && req.query.companyId.trim().length > 0
      ? req.query.companyId.trim()
      : null;
    if (companyIdQuery) {
      assertCompanyAccess(req, companyIdQuery);
    }

    const roadmapId = String(req.params.roadmapId ?? "").trim();
    const nextTitle = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!roadmapId || !nextTitle) {
      res.status(400).json({ error: "roadmapId and title are required" });
      return;
    }

    const { indexPath, indexMarkdown, indexDetails, roadmapMarkdown } = await readRoadmapForRequest(companyIdQuery);
    const updatedMarkdown = renameRoadmapItemTitle(
      roadmapMarkdown,
      roadmapId,
      nextTitle,
      new Date().toISOString().slice(0, 10),
    );
    if (!updatedMarkdown) {
      throw notFound(`Roadmap item not found: ${roadmapId}`);
    }

    await fs.writeFile(indexDetails.canonicalPath, updatedMarkdown, "utf8");
    const parsed = parseRoadmapDocument(updatedMarkdown);
    const updatedItem = parsed.sections.flatMap((section) => section.items).find((item) => item.id === roadmapId) ?? null;

    res.json({
      item: updatedItem ?? { id: roadmapId, title: nextTitle },
      roadmap: {
        label: indexDetails.canonicalLabel,
        path: toRepoRelativePath(repoRoot, indexDetails.canonicalPath),
        markdown: updatedMarkdown,
        ...parsed,
      },
      index: {
        path: toRepoRelativePath(repoRoot, indexPath),
        markdown: indexMarkdown,
        links: indexDetails.links,
      },
    });
  });

  router.get("/roadmap", async (req, res) => {
    const companyIdQuery = typeof req.query.companyId === "string" && req.query.companyId.trim().length > 0
      ? req.query.companyId.trim()
      : null;
    if (companyIdQuery) {
      assertCompanyAccess(req, companyIdQuery);
    } else {
      assertBoard(req);
    }

    const { indexPath, indexMarkdown, indexDetails, roadmapMarkdown } = await readRoadmapForRequest(companyIdQuery);

    const parsed = parseRoadmapDocument(roadmapMarkdown);
    res.json({
      index: {
        path: toRepoRelativePath(repoRoot, indexPath),
        markdown: indexMarkdown,
        links: indexDetails.links,
      },
      roadmap: {
        label: indexDetails.canonicalLabel,
        path: toRepoRelativePath(repoRoot, indexDetails.canonicalPath),
        markdown: roadmapMarkdown,
        ...parsed,
      },
    });
  });

  return router;
}
