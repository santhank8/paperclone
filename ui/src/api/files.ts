export type Workspace = {
	id: string;
	path: string;
};

export type FileEntry = {
	name: string;
	path: string;
	type: "file" | "directory";
};

export type FileContent = {
	path: string;
	content: string;
	size: number;
	type: "markdown" | "json" | "text";
	modifiedAt: Date;
};

export const filesApi = {
	listWorkspaces: async (): Promise<Workspace[]> => {
		const res = await fetch("/api/files/workspaces", {
			credentials: "include",
			headers: { Accept: "application/json" },
		});
		if (!res.ok) {
			const payload = (await res.json().catch(() => null)) as {
				error?: string;
			} | null;
			throw new Error(
				payload?.error ?? `Failed to list workspaces (${res.status})`,
			);
		}
		return res.json();
	},

	listFiles: async (workspaceId: string): Promise<FileEntry[]> => {
		const res = await fetch(
			`/api/files/workspaces/${encodeURIComponent(workspaceId)}/files`,
			{
				credentials: "include",
				headers: { Accept: "application/json" },
			},
		);
		if (!res.ok) {
			const payload = (await res.json().catch(() => null)) as {
				error?: string;
			} | null;
			throw new Error(payload?.error ?? `Failed to list files (${res.status})`);
		}
		return res.json();
	},

	getFileContent: async (
		workspaceId: string,
		filePath: string,
	): Promise<FileContent> => {
		const res = await fetch(
			`/api/files/workspaces/${encodeURIComponent(workspaceId)}/content?path=${encodeURIComponent(filePath)}`,
			{
				credentials: "include",
				headers: { Accept: "application/json" },
			},
		);
		if (!res.ok) {
			const payload = (await res.json().catch(() => null)) as {
				error?: string;
			} | null;
			throw new Error(
				payload?.error ?? `Failed to get file content (${res.status})`,
			);
		}
		return res.json();
	},
};
