import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { resolvePaperclipInstanceRoot } from "../home-paths.js";

const ALLOWED_EXTENSIONS = [".md", ".markdown", ".txt", ".json"];
const MAX_FILE_SIZE_BYTES = 1024 * 1024;

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
): Promise<{ name: string; path: string; type: "file" | "directory" }[]> {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const results: { name: string; path: string; type: "file" | "directory" }[] =
		[];
	for (const entry of entries) {
		const entryPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			const nested = await walkDir(entryPath, baseDir);
			results.push(
				{ name: entry.name, path: entryPath, type: "directory" },
				...nested,
			);
		} else if (entry.isFile() && isAllowedFile(entry.name)) {
			results.push({ name: entry.name, path: entryPath, type: "file" });
		}
	}
	return results;
}

export function fileRoutes() {
	const router = Router();
	const instanceRoot = resolvePaperclipInstanceRoot();
	const workspacesRoot = path.join(instanceRoot, "workspaces");

	router.get("/workspaces", async (_req, res, next) => {
		try {
			const dirs = await fs.readdir(workspacesRoot, { withFileTypes: true });
			const workspaces = dirs
				.filter((d) => d.isDirectory())
				.map((d) => ({ id: d.name, path: path.join(workspacesRoot, d.name) }));
			res.json(workspaces);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") {
				res.json([]);
				return;
			}
			next(err);
		}
	});

	router.get("/workspaces/:workspaceId/files", async (req, res, next) => {
		const workspaceId = req.params.workspaceId as string;
		const workspacePath = path.join(workspacesRoot, workspaceId);

		if (!isSafePath(workspacesRoot, workspaceId)) {
			res.status(400).json({ error: "Invalid workspace path" });
			return;
		}

		try {
			const stat = await fs.stat(workspacePath);
			if (!stat.isDirectory()) {
				res.status(404).json({ error: "Workspace not found" });
				return;
			}
			const files = await walkDir(workspacePath, workspacePath);
			res.json(files);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") {
				res.status(404).json({ error: "Workspace not found" });
				return;
			}
			next(err);
		}
	});

	router.get("/workspaces/:workspaceId/content", async (req, res, next) => {
		const workspaceId = req.params.workspaceId as string;
		const filePath = req.query.path as string;
		const workspacePath = path.join(workspacesRoot, workspaceId);

		if (!isSafePath(workspacesRoot, workspaceId)) {
			res.status(400).json({ error: "Invalid workspace path" });
			return;
		}
		if (!filePath) {
			res.status(400).json({ error: "File path required" });
			return;
		}
		if (!isSafePath(workspacePath, filePath)) {
			res.status(400).json({ error: "Invalid file path" });
			return;
		}
		if (!isAllowedFile(filePath)) {
			res.status(400).json({ error: "File type not allowed" });
			return;
		}

		const fullPath = path.join(workspacePath, filePath);
		try {
			const stat = await fs.stat(fullPath);
			if (!stat.isFile()) {
				res.status(404).json({ error: "File not found" });
				return;
			}
			if (stat.size > MAX_FILE_SIZE_BYTES) {
				res.status(413).json({ error: "File too large" });
				return;
			}
			const content = await fs.readFile(fullPath, "utf-8");
			const ext = path.extname(filePath).toLowerCase();
			res.json({
				path: filePath,
				content,
				size: stat.size,
				type:
					ext === ".md" || ext === ".markdown"
						? "markdown"
						: ext === ".json"
							? "json"
							: "text",
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

	return router;
}
