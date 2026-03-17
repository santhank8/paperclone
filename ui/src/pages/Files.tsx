import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { filesApi } from "../api/files";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, FolderOpen, ChevronRight, ChevronDown, Save, Pencil, X, FolderTree } from "lucide-react";
import { cn } from "../lib/utils";
import type { Workspace, FileEntry } from "../api/files";
import { MarkdownBody } from "../components/MarkdownBody";

export function Files() {
	const { setBreadcrumbs } = useBreadcrumbs();
	const queryClient = useQueryClient();
	const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
	const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
	const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
	const [editing, setEditing] = useState(false);
	const [editContent, setEditContent] = useState("");

	useEffect(() => {
		setBreadcrumbs([{ label: "Files" }]);
	}, [setBreadcrumbs]);

	const { data: workspaces, isLoading: workspacesLoading, error: workspacesError } = useQuery({
		queryKey: ["files", "workspaces"],
		queryFn: () => filesApi.listWorkspaces(),
	});

	const { data: files, isLoading: filesLoading, error: filesError } = useQuery({
		queryKey: ["files", "list", selectedWorkspace?.id],
		queryFn: () => selectedWorkspace ? filesApi.listFiles(selectedWorkspace.id) : Promise.resolve([]),
		enabled: !!selectedWorkspace,
	});

	const { data: content, isLoading: contentLoading, error: contentError } = useQuery({
		queryKey: ["files", "content", selectedWorkspace?.id, selectedFile?.path],
		queryFn: () =>
			selectedWorkspace && selectedFile
				? filesApi.getFileContent(selectedWorkspace.id, selectedFile.path)
				: Promise.resolve(null),
		enabled: !!selectedWorkspace && !!selectedFile,
	});

	const saveMutation = useMutation({
		mutationFn: () => {
			if (!selectedWorkspace || !selectedFile) throw new Error("No file selected");
			return filesApi.saveFileContent(selectedWorkspace.id, selectedFile.path, editContent);
		},
		onSuccess: () => {
			setEditing(false);
			queryClient.invalidateQueries({ queryKey: ["files", "content", selectedWorkspace?.id, selectedFile?.path] });
		},
	});

	const toggleDir = (dirPath: string) => {
		setExpandedDirs((prev) => {
			const next = new Set(prev);
			next.has(dirPath) ? next.delete(dirPath) : next.add(dirPath);
			return next;
		});
	};

	const startEditing = () => {
		if (content) {
			setEditContent(content.content);
			setEditing(true);
		}
	};

	// Group files by their parent directory
	const renderFileTree = (fileList: FileEntry[]) => {
		const dirs = new Map<string, FileEntry[]>();
		const rootFiles: FileEntry[] = [];

		for (const f of fileList) {
			const slashIdx = f.path.indexOf("/");
			if (slashIdx === -1 && f.type === "file") {
				rootFiles.push(f);
			} else if (f.type === "directory") {
				if (!dirs.has(f.path)) dirs.set(f.path, []);
			} else {
				const parentParts = f.path.split("/");
				const parent = parentParts.slice(0, -1).join("/");
				if (!dirs.has(parent)) dirs.set(parent, []);
				dirs.get(parent)!.push(f);
			}
		}

		const topDirs = [...dirs.keys()].filter((d) => !d.includes("/")).sort();
		const topFiles = rootFiles.sort((a, b) => a.name.localeCompare(b.name));

		return (
			<div className="space-y-0.5">
				{topDirs.map((dirPath) => renderDirNode(dirPath, dirs, fileList))}
				{topFiles.map((f) => renderFileNode(f, 0))}
			</div>
		);
	};

	const renderDirNode = (dirPath: string, dirs: Map<string, FileEntry[]>, allFiles: FileEntry[]) => {
		const isExpanded = expandedDirs.has(dirPath);
		const dirName = dirPath.split("/").pop() || dirPath;
		const depth = dirPath.split("/").length - 1;
		const childDirs = [...dirs.keys()].filter((d) => {
			const parent = d.split("/").slice(0, -1).join("/");
			return parent === dirPath;
		}).sort();
		const childFiles = (dirs.get(dirPath) || []).sort((a, b) => a.name.localeCompare(b.name));

		return (
			<div key={dirPath}>
				<div
					className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/50 rounded text-sm"
					style={{ paddingLeft: `${depth * 16 + 8}px` }}
					onClick={() => toggleDir(dirPath)}
				>
					{isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
					<FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
					<span className="font-medium truncate">{dirName}</span>
				</div>
				{isExpanded && (
					<div>
						{childDirs.map((cd) => renderDirNode(cd, dirs, allFiles))}
						{childFiles.map((f) => renderFileNode(f, depth + 1))}
					</div>
				)}
			</div>
		);
	};

	const renderFileNode = (file: FileEntry, depth: number) => (
		<div
			key={file.path}
			className={cn(
				"flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/50 rounded text-sm",
				selectedFile?.path === file.path && "bg-primary/10",
			)}
			style={{ paddingLeft: `${depth * 16 + 24}px` }}
			onClick={() => { setSelectedFile(file); setEditing(false); }}
		>
			<FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
			<span className="truncate">{file.name}</span>
		</div>
	);

	// Filter to show only project workspaces by default
	const projectWorkspaces = workspaces?.filter((w) => w.source === "project") || [];
	const internalWorkspaces = workspaces?.filter((w) => w.source === "internal") || [];

	if (workspacesLoading) {
		return (
			<div className="flex items-center justify-center p-8 gap-2">
				<FolderTree className="h-6 w-6 animate-pulse text-muted-foreground" />
				<p className="text-sm text-muted-foreground">Loading workspaces...</p>
			</div>
		);
	}

	if (workspacesError) {
		return (
			<div className="flex flex-col items-center justify-center p-8 text-destructive">
				<p>Error loading workspaces</p>
				<p className="text-sm text-muted-foreground">
					{workspacesError instanceof Error ? workspacesError.message : "Unknown error"}
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-1 gap-4 p-4 h-[calc(100vh-64px)]">
			{/* Sidebar: Workspaces + File tree */}
			<div className="w-72 border border-border rounded-lg flex flex-col">
				<CardHeader className="px-4 py-3 border-b border-border">
					<CardTitle className="text-sm font-medium">Projects</CardTitle>
				</CardHeader>
				<CardContent className="p-2 flex-1 overflow-hidden">
					<ScrollArea className="h-full">
						{/* Project workspaces */}
						{projectWorkspaces.map((ws) => (
							<div key={ws.id}>
								<Button
									variant={selectedWorkspace?.id === ws.id ? "secondary" : "ghost"}
									className="w-full justify-start gap-2 h-8 text-sm"
									onClick={() => { setSelectedWorkspace(ws); setSelectedFile(null); setEditing(false); }}
								>
									<FolderOpen className="h-3.5 w-3.5" />
									{ws.label}
								</Button>
								{selectedWorkspace?.id === ws.id && files && !filesLoading && (
									<div className="ml-2 mt-1">
										{renderFileTree(files)}
									</div>
								)}
								{selectedWorkspace?.id === ws.id && filesLoading && (
									<div className="flex items-center gap-2 p-2 ml-4">
										<FileText className="h-3.5 w-3.5 animate-pulse text-muted-foreground" />
										<span className="text-xs text-muted-foreground">Loading...</span>
									</div>
								)}
							</div>
						))}

						{/* Internal workspaces (collapsed) */}
						{internalWorkspaces.length > 0 && (
							<div className="mt-4 pt-4 border-t border-border">
								<p className="text-xs text-muted-foreground px-2 mb-2 uppercase tracking-wider">Internal Workspaces</p>
								{internalWorkspaces.map((ws) => (
									<Button
										key={ws.id}
										variant={selectedWorkspace?.id === ws.id ? "secondary" : "ghost"}
										className="w-full justify-start gap-2 h-8 text-xs font-mono"
										onClick={() => { setSelectedWorkspace(ws); setSelectedFile(null); setEditing(false); }}
									>
										<FolderOpen className="h-3 w-3" />
										{ws.label}
									</Button>
								))}
							</div>
						)}
					</ScrollArea>
				</CardContent>
			</div>

			{/* Main content: File viewer/editor */}
			<div className="flex-1 border border-border rounded-lg flex flex-col overflow-hidden">
				{selectedFile && content && !contentLoading ? (
					<>
						<CardHeader className="px-4 py-3 border-b border-border flex-row items-center justify-between">
							<div className="flex items-center gap-2 min-w-0">
								<FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
								<span className="text-sm font-medium truncate">{selectedFile.path}</span>
								<span className="text-xs text-muted-foreground shrink-0">
									({(content.size / 1024).toFixed(1)}KB)
								</span>
							</div>
							<div className="flex items-center gap-2 shrink-0">
								{editing ? (
									<>
										<Button
											size="sm"
											variant="ghost"
											onClick={() => setEditing(false)}
											className="h-7 text-xs"
										>
											<X className="h-3 w-3 mr-1" /> Cancel
										</Button>
										<Button
											size="sm"
											onClick={() => saveMutation.mutate()}
											disabled={saveMutation.isPending}
											className="h-7 text-xs"
										>
											<Save className="h-3 w-3 mr-1" />
											{saveMutation.isPending ? "Saving..." : "Save"}
										</Button>
									</>
								) : (
									<Button size="sm" variant="ghost" onClick={startEditing} className="h-7 text-xs">
										<Pencil className="h-3 w-3 mr-1" /> Edit
									</Button>
								)}
							</div>
						</CardHeader>
						<CardContent className="p-0 flex-1 overflow-hidden">
							{editing ? (
								<textarea
									value={editContent}
									onChange={(e) => setEditContent(e.target.value)}
									className="w-full h-full p-4 font-mono text-sm bg-transparent border-none outline-none resize-none"
									spellCheck={false}
								/>
							) : (
								<ScrollArea className="h-full">
									{content.type === "markdown" ? (
										<div className="p-4">
											<MarkdownBody>{content.content}</MarkdownBody>
										</div>
									) : (
										<pre className="whitespace-pre-wrap break-words text-sm p-4 font-mono">
											{content.content}
										</pre>
									)}
								</ScrollArea>
							)}
						</CardContent>
						{saveMutation.isError && (
							<div className="px-4 py-2 text-xs text-destructive border-t border-border">
								Error: {saveMutation.error instanceof Error ? saveMutation.error.message : "Save failed"}
							</div>
						)}
					</>
				) : contentLoading ? (
					<div className="flex items-center justify-center h-full gap-2">
						<FileText className="h-5 w-5 animate-pulse text-muted-foreground" />
						<span className="text-sm text-muted-foreground">Loading file...</span>
					</div>
				) : contentError ? (
					<div className="flex items-center justify-center h-full text-destructive text-sm">
						Error loading file
					</div>
				) : (
					<div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
						<FolderTree className="h-12 w-12" />
						<p className="text-sm">Select a file to view</p>
					</div>
				)}
			</div>
		</div>
	);
}
