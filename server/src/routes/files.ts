import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { resolvePaperclipInstanceRoot } from "../home-paths.js";

const ALLOWED_EXTENSIONS = [".md", ".markdown", ".txt", ".json", ".yaml", ".yml", ".toml", ".csv", ".tsv"];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".next", ".vite", "__pycache__", ".cache", ".opencode", ".claude"]);

// Project directories that agents produce work in.
// Each entry: { id: human-readable slug, label: display name, path: absolute path }
const PROJECT_DIRS = [
	{ id: "moqcai", label: "MoqcAI", path: "/home/claw-1/moqcai", writable: true },
	{ id: "paperclip", label: "Paperclip", path: "/home/claw-1/paperclip", writable: false },
	{ id: "openclaw", label: "OpenClaw", path: "/home/claw-1/openclaw", writable: false },
];

function isAllowedFile(filename: string): boolean {
	const ext = path.extname(filename).toLowerCase();
	return ALLOWED_EXTENSIONS.includes(ext);
}

function isSafePath(baseDir: string, targetPath: string): boolean {
	const resolved = path.resolve(baseDir, targetPath);
	return resolved.startsWith(baseDir);
}

async function walkDir(
	dir: string,
	baseDir: string,
	maxDepth = 5,
	currentDepth = 0,
): Promise<{ name: string; path: string; type: "file" | "directory" }[]> {
	if (currentDepth > maxDepth) return [];
	let entries;
	try {
		entries = await fs.readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	const results: { name: string; path: string; type: "file" | "directory" }[] = [];
	for (const entry of entries) {
		if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
		const entryPath = path.join(dir, entry.name);
		const relPath = path.relative(baseDir, entryPath);
		if (entry.isDirectory()) {
			const nested = await walkDir(entryPath, baseDir, maxDepth, currentDepth + 1);
			if (nested.length > 0) {
				results.push({ name: entry.name, path: relPath, type: "directory" }, ...nested);
			}
		} else if (entry.isFile() && isAllowedFile(entry.name)) {
			results.push({ name: entry.name, path: relPath, type: "file" });
		}
	}
	return results;
}

export function fileRoutes() {
	const router = Router();
	const instanceRoot = resolvePaperclipInstanceRoot();
	const workspacesRoot = path.join(instanceRoot, "workspaces");

	// List available workspaces — combines project dirs + paperclip internal workspaces
	router.get("/workspaces", async (_req, res, next) => {
		try {
			const workspaces: { id: string; label: string; path: string; source: "project" | "internal" }[] = [];

			// Add project directories
			for (const proj of PROJECT_DIRS) {
				try {
					await fs.access(proj.path);
					workspaces.push({ id: proj.id, label: proj.label, path: proj.path, source: "project" });
				} catch {
					// dir doesn't exist, skip
				}
			}

			// Add internal paperclip workspaces (only non-empty ones)
			try {
				const dirs = await fs.readdir(workspacesRoot, { withFileTypes: true });
				for (const d of dirs) {
					if (!d.isDirectory()) continue;
					const wsPath = path.join(workspacesRoot, d.name);
					const contents = await fs.readdir(wsPath).catch(() => []);
					if (contents.length > 0) {
						workspaces.push({
							id: d.name,
							label: d.name.slice(0, 8) + "...",
							path: wsPath,
							source: "internal",
						});
					}
				}
			} catch {
				// no workspaces dir
			}

			res.json(workspaces);
		} catch (err) {
			next(err);
		}
	});

	// Resolve workspace path from ID
	function resolveWorkspacePath(workspaceId: string): string | null {
		const proj = PROJECT_DIRS.find((p) => p.id === workspaceId);
		if (proj) return proj.path;
		const internal = path.join(workspacesRoot, workspaceId);
		if (isSafePath(workspacesRoot, workspaceId)) return internal;
		return null;
	}

	function isWorkspaceWritable(workspaceId: string): boolean {
		const proj = PROJECT_DIRS.find((p) => p.id === workspaceId);
		if (proj) return proj.writable;
		return true; // internal workspaces are writable
	}

	// List files in a workspace
	router.get("/workspaces/:workspaceId/files", async (req, res, next) => {
		const wsPath = resolveWorkspacePath(req.params.workspaceId);
		if (!wsPath) { res.status(400).json({ error: "Invalid workspace" }); return; }

		try {
			const stat = await fs.stat(wsPath);
			if (!stat.isDirectory()) { res.status(404).json({ error: "Workspace not found" }); return; }
			const files = await walkDir(wsPath, wsPath);
			res.json(files);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") {
				res.status(404).json({ error: "Workspace not found" });
				return;
			}
			next(err);
		}
	});

	// Get file content
	router.get("/workspaces/:workspaceId/content", async (req, res, next) => {
		const wsPath = resolveWorkspacePath(req.params.workspaceId);
		if (!wsPath) { res.status(400).json({ error: "Invalid workspace" }); return; }
		const filePath = req.query.path as string;
		if (!filePath) { res.status(400).json({ error: "File path required" }); return; }
		if (!isSafePath(wsPath, filePath)) { res.status(400).json({ error: "Invalid file path" }); return; }
		if (!isAllowedFile(filePath)) { res.status(400).json({ error: "File type not allowed" }); return; }

		const fullPath = path.join(wsPath, filePath);
		try {
			const stat = await fs.stat(fullPath);
			if (!stat.isFile()) { res.status(404).json({ error: "File not found" }); return; }
			if (stat.size > MAX_FILE_SIZE_BYTES) { res.status(413).json({ error: "File too large" }); return; }
			const content = await fs.readFile(fullPath, "utf-8");
			const ext = path.extname(filePath).toLowerCase();
			res.json({
				path: filePath,
				content,
				size: stat.size,
				type: ext === ".md" || ext === ".markdown" ? "markdown" : ext === ".json" ? "json" : "text",
				modifiedAt: stat.mtime,
			});
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") {
				res.status(404).json({ error: "File not found" });
				return;
			}
			next(err);
		}
	});

	// Save file content
	router.put("/workspaces/:workspaceId/content", async (req, res, next) => {
		const wsPath = resolveWorkspacePath(req.params.workspaceId);
		if (!wsPath) { res.status(400).json({ error: "Invalid workspace" }); return; }
		if (!isWorkspaceWritable(req.params.workspaceId)) { res.status(403).json({ error: "This workspace is read-only" }); return; }
		const filePath = req.body.path as string;
		const content = req.body.content as string;
		if (!filePath || typeof content !== "string") { res.status(400).json({ error: "path and content required" }); return; }
		if (!isSafePath(wsPath, filePath)) { res.status(400).json({ error: "Invalid file path" }); return; }
		if (!isAllowedFile(filePath)) { res.status(400).json({ error: "File type not allowed" }); return; }

		const fullPath = path.join(wsPath, filePath);
		try {
			await fs.mkdir(path.dirname(fullPath), { recursive: true });
			await fs.writeFile(fullPath, content, "utf-8");
			const stat = await fs.stat(fullPath);
			res.json({ path: filePath, size: stat.size, modifiedAt: stat.mtime });
		} catch (err) {
			next(err);
		}
	});

	return router;
}
