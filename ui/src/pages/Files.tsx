import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { filesApi } from "../api/files";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, FolderOpen, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";
import type { Workspace, FileEntry } from "../api/files";

import { queryKeys } from "../lib/queryKeys";

export function Files() {
	const { setBreadcrumbs } = useBreadcrumbs();
	const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
		null,
	);
	const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
	const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

	useEffect(() => {
		setBreadcrumbs([{ label: "Files" }]);
	}, [setBreadcrumbs]);

	const {
		data: workspaces,
		isLoading: workspacesLoading,
		error: workspacesError,
	} = useQuery({
		queryKey: ["files", "workspaces"],
		queryFn: () => filesApi.listWorkspaces(),
	});

	const {
		data: files,
		isLoading: filesLoading,
		error: filesError,
	} = useQuery({
		queryKey: ["files", "workspaces", selectedWorkspace?.id],
		queryFn: () =>
			selectedWorkspace
				? filesApi.listFiles(selectedWorkspace.id)
				: Promise.resolve([]),
		enabled: !!selectedWorkspace,
	});

	const {
		data: content,
		isLoading: contentLoading,
		error: contentError,
	} = useQuery({
		queryKey: ["files", "content", selectedWorkspace?.id, selectedFile?.path],
		queryFn: () =>
			selectedWorkspace && selectedFile
				? filesApi.getFileContent(selectedWorkspace.id, selectedFile.path)
				: Promise.resolve(null),
		enabled: !!selectedWorkspace && !!selectedFile,
	});

	const toggleDir = (path: string) => {
		setExpandedDirs((prev) => {
			const next = new Set(prev);
			if (next.has(path)) {
				next.delete(path);
			} else {
				next.add(path);
			}
			return next;
		});
	};

	const organizeFiles = (fileList: FileEntry[]): Map<string, FileEntry[]> => {
		const organized = new Map<string, FileEntry[]>();
		for (const file of fileList) {
			const parts = file.path.split("/");
			const dirPath = parts.slice(0, -1).join("/");
			if (dirPath) {
				if (!organized.has(dirPath)) {
					organized.set(dirPath, []);
				}
				organized.get(dirPath)!.push(file);
			}
		}
		return organized;
	};

	const renderFileList = (
		fileList: FileEntry[],
		parentPath: string = "",
	): React.ReactNode => {
		const organized = organizeFiles(fileList);
		const currentLevelFiles = fileList.filter((f) => {
			const parts = f.path.split("/");
			const dir = parts.slice(0, -1).join("/");
			return dir === parentPath;
		});

		const sortedFiles = currentLevelFiles.sort((a, b) => {
			if (a.type === "directory" && b.type !== "directory") return -1;
			if (a.type !== "directory" && b.type === "directory") return 1;
			return a.name.localeCompare(b.name);
		});

		return (
			<div className="space-y-0.5">
				{sortedFiles.map((file) => {
					const isExpanded = expandedDirs.has(file.path);
					const isDirectory = file.type === "directory";
					const depth = file.path.split("/").length - 1;

					return (
						<div key={file.path}>
							{isDirectory ? (
								<div
									className={cn(
										"flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/50 rounded",
										depth > 0 && "ml-4",
									)}
									onClick={() => toggleDir(file.path)}
								>
									{isExpanded ? (
										<ChevronDown className="h-4 w-4" />
									) : (
										<ChevronRight className="h-4 w-4" />
									)}
									<FolderOpen className="h-4 w-4 text-muted" />
									<span className="text-sm font-medium truncate">
										{file.name}
									</span>
								</div>
							) : (
								<div
									className={cn(
										"flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/50 rounded",
										depth > 0 && "ml-4",
										selectedFile?.path === file.path && "bg-primary/10",
									)}
									onClick={() => setSelectedFile(file)}
								>
									<FileText className="h-4 w-4 text-muted" />
									<span className="text-sm truncate">{file.name}</span>
								</div>
							)}

							{isDirectory && isExpanded && (
								<div className="ml-4">
									{renderFileList(fileList, file.path)}
								</div>
							)}
						</div>
					);
				})}
			</div>
		);
	};

	if (workspacesLoading) {
		return (
			<div className="flex items-center justify-center p-8">
				<FileText className="h-8 w-8 animate-pulse text-muted" />
				<p className="text-sm text-muted-foreground">Loading workspaces...</p>
			</div>
		);
	}

	if (workspacesError) {
		return (
			<div className="flex flex-col items-center justify-center p-8 text-destructive">
				<p>Error loading workspaces</p>
				<p className="text-sm text-muted-foreground">
					{workspacesError instanceof Error
						? workspacesError.message
						: "Unknown error"}
				</p>
			</div>
		);
	}

	if (!workspaces || workspaces.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center p-8">
				<FolderOpen className="h-12 w-12 text-muted" />
				<p className="text-sm text-muted-foreground">No workspaces found</p>
			</div>
		);
	}

	return (
		<div className="flex flex-1 gap-4 p-4">
			<div className="w-64 border border-border rounded-lg">
				<CardHeader className="px-4">
					<CardTitle className="text-lg">Workspaces</CardTitle>
				</CardHeader>
				<CardContent className="p-2">
					<ScrollArea className="h-[calc(100vh-250px)]">
						{workspaces.map((ws) => (
							<Button
								key={ws.id}
								variant={selectedWorkspace?.id === ws.id ? "default" : "ghost"}
								className={cn(
									"w-full justify-start",
									selectedWorkspace?.id === ws.id && "bg-primary/10",
								)}
								onClick={() => {
									setSelectedWorkspace(ws);
									setSelectedFile(null);
								}}
							>
								<div className="flex items-center gap-2">
									<FolderOpen className="h-4 w-4" />
									<span className="text-sm font-mono truncate">{ws.id}</span>
								</div>
							</Button>
						))}
					</ScrollArea>
				</CardContent>
			</div>

			<div className="flex-1 border border-border rounded-lg">
				<CardHeader className="px-4">
					<CardTitle className="text-lg">
						{selectedWorkspace ? "Files" : "Select a Workspace"}
					</CardTitle>
				</CardHeader>
				<CardContent className="p-2">
					{selectedWorkspace ? (
						filesLoading ? (
							<div className="flex items-center justify-center p-4">
								<FileText className="h-6 w-6 animate-pulse text-muted" />
								<p className="text-sm text-muted-foreground">
									Loading files...
								</p>
							</div>
						) : filesError ? (
							<div className="flex flex-col items-center justify-center p-4 text-destructive">
								<p>Error loading files</p>
							</div>
						) : files && files.length > 0 ? (
							<ScrollArea className="h-[calc(100vh-250px)]">
								{renderFileList(files)}
							</ScrollArea>
						) : (
							<div className="flex flex-col items-center justify-center p-4">
								<FileText className="h-6 w-6 text-muted" />
								<p className="text-sm text-muted-foreground">No files found</p>
							</div>
						)
					) : (
						<div className="flex flex-col items-center justify-center text-muted p-8">
							<FolderOpen className="h-12 w-12" />
							<p>Select a workspace to view files</p>
						</div>
					)}
				</CardContent>
			</div>

			{selectedFile && (
				<div className="flex-1 border border-border rounded-lg">
					<CardHeader className="px-4">
						<CardTitle className="text-lg flex items-center gap-2">
							<FileText className="h-4 w-4" />
							<span className="truncate">{selectedFile.name}</span>
						</CardTitle>
					</CardHeader>
					<CardContent className="p-4">
						{contentLoading ? (
							<div className="flex items-center justify-center p-4">
								<FileText className="h-6 w-6 animate-pulse text-muted" />
								<p className="text-sm text-muted-foreground">
									Loading content...
								</p>
							</div>
						) : contentError ? (
							<div className="flex flex-col items-center justify-center p-4 text-destructive">
								<p>Error loading file content</p>
							</div>
						) : content ? (
							<ScrollArea className="h-[calc(100vh-350px)]">
								<pre className="whitespace-pre-wrap break-words text-sm p-4">
									{content.content}
								</pre>
							</ScrollArea>
						) : null}
					</CardContent>
				</div>
			)}
		</div>
	);
}
