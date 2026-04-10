import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  KnowledgeEntry,
  KnowledgeEntryWithContent,
  KnowledgeDepartment,
  KnowledgeEntryScope,
} from "@paperclipai/shared";
import { knowledgeApi } from "../api/knowledge";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { MarkdownBody } from "../components/MarkdownBody";
import { MarkdownEditor } from "../components/MarkdownEditor";
import { PageSkeleton } from "../components/PageSkeleton";
import { PageTabBar } from "../components/PageTabBar";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronDown,
  ChevronRight,
  Download,
  File,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  FilePlus,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────

type TreeNode = KnowledgeEntry & { children: TreeNode[] };

// ── Tree helpers ────────────────────────────────────────────────────

function buildTree(entries: KnowledgeEntry[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const entry of entries) {
    map.set(entry.id, { ...entry, children: [] });
  }
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// ── Tree item component ─────────────────────────────────────────────

function TreeItem({
  node,
  depth,
  selectedId,
  onSelect,
  expandedIds,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const isFolder = node.type === "folder";
  const isExpanded = expandedIds.has(node.id);
  const isSelected = node.id === selectedId;
  const hasChildren = node.children.length > 0;

  const Icon = isFolder
    ? isExpanded
      ? FolderOpen
      : Folder
    : node.type === "document"
      ? FileText
      : File;

  return (
    <>
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
          isSelected && "bg-accent font-medium",
        )}
        style={{ paddingLeft: `${8 + depth * 20}px` }}
        onClick={() => {
          if (isFolder && hasChildren) onToggle(node.id);
          onSelect(node.id);
        }}
      >
        {isFolder ? (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )
            ) : null}
          </span>
        ) : (
          <span className="h-4 w-4" />
        )}
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{node.name}</span>
      </button>
      {isFolder && isExpanded &&
        node.children.map((child) => (
          <TreeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            expandedIds={expandedIds}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

// ── Create dialogs ──────────────────────────────────────────────────

function CreateFolderDialog({
  open,
  onOpenChange,
  companyId,
  scope,
  scopeAgentId,
  parentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  scope: KnowledgeEntryScope;
  scopeAgentId: string | null;
  parentId: string | null;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const mutation = useMutation({
    mutationFn: () =>
      knowledgeApi.createFolder(companyId, {
        name,
        scope,
        scopeAgentId,
        parentId,
        description: description.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", companyId] });
      pushToast({ title: "Folder created", tone: "success" });
      setName("");
      setDescription("");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      pushToast({ title: "Error", body: err.message, tone: "error" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Folder name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Textarea
          placeholder="Description (optional) — helps agents understand what's inside"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="resize-none"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateDocumentDialog({
  open,
  onOpenChange,
  companyId,
  scope,
  scopeAgentId,
  parentId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  scope: KnowledgeEntryScope;
  scopeAgentId: string | null;
  parentId: string | null;
  onCreated: (entry: KnowledgeEntryWithContent) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const mutation = useMutation({
    mutationFn: () =>
      knowledgeApi.createDocument(companyId, {
        name,
        scope,
        scopeAgentId,
        parentId,
        description: description.trim() || null,
        body: "",
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", companyId] });
      pushToast({ title: "Document created", tone: "success" });
      setName("");
      setDescription("");
      onOpenChange(false);
      onCreated(result);
    },
    onError: (err: Error) => {
      pushToast({ title: "Error", body: err.message, tone: "error" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Document</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Document name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Textarea
          placeholder="Description (optional) — helps agents understand what this document covers"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="resize-none"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Content pane ────────────────────────────────────────────────────

function ContentPane({
  companyId,
  entryId,
}: {
  companyId: string;
  entryId: string | null;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [editBody, setEditBody] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: entry, isLoading } = useQuery({
    queryKey: queryKeys.knowledge.detail(companyId, entryId ?? ""),
    queryFn: () => knowledgeApi.detail(companyId, entryId!),
    enabled: !!entryId,
  });

  // Sync edit body when entry changes
  useEffect(() => {
    if (entry?.type === "document" && entry.documentBody !== null) {
      setEditBody(entry.documentBody);
    } else {
      setEditBody(null);
    }
  }, [entry?.id, entry?.documentBody]);

  const bodyMutation = useMutation({
    mutationFn: (body: string) =>
      knowledgeApi.updateBody(companyId, entryId!, {
        body,
        baseRevisionId: entry?.latestRevisionId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.detail(companyId, entryId!) });
    },
    onError: (err: Error) => {
      pushToast({ title: "Save failed", body: err.message, tone: "error" });
    },
  });

  const handleBodyChange = useCallback(
    (value: string) => {
      setEditBody(value);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        bodyMutation.mutate(value);
      }, 1500);
    },
    [bodyMutation],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  if (!entryId) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Select a file or folder to view its contents
      </div>
    );
  }

  if (isLoading) return <PageSkeleton />;
  if (!entry) return <EmptyState icon={FileText} message="Entry not found" />;

  // Folder view
  if (entry.type === "folder") {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold">{entry.name}</h2>
        {entry.description && (
          <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          Select a file from the tree to view its contents.
        </p>
      </div>
    );
  }

  // Document view
  if (entry.type === "document") {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">{entry.name}</h2>
          {bodyMutation.isPending && (
            <span className="text-xs text-muted-foreground">Saving...</span>
          )}
        </div>
        <div className="flex-1 overflow-auto">
          <MarkdownEditor
            value={editBody ?? ""}
            onChange={handleBodyChange}
            placeholder="Start writing..."
            bordered={false}
          />
        </div>
      </div>
    );
  }

  // File view
  if (entry.type === "file" && entry.asset) {
    const isImage = entry.asset.contentType.startsWith("image/");
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <File className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">{entry.name}</h2>
        </div>
        {entry.description && (
          <p className="text-sm text-muted-foreground">{entry.description}</p>
        )}
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Type: {entry.asset.contentType}</p>
          <p>Size: {(entry.asset.byteSize / 1024).toFixed(1)} KB</p>
          {entry.asset.originalFilename && <p>Original: {entry.asset.originalFilename}</p>}
        </div>
        {isImage && (
          <img
            src={entry.asset.contentPath}
            alt={entry.name}
            className="max-w-full rounded border"
          />
        )}
        <a
          href={entry.asset.contentPath}
          download={entry.asset.originalFilename ?? entry.name}
          className="inline-flex items-center gap-2"
        >
          <Button variant="ghost" size="sm">
            <Download className="mr-1 h-4 w-4" />
            Download
          </Button>
        </a>
      </div>
    );
  }

  return null;
}

// ── File upload handler ─────────────────────────────────────────────

function UploadFileDialog({
  open,
  onOpenChange,
  companyId,
  scope,
  scopeAgentId,
  parentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  scope: KnowledgeEntryScope;
  scopeAgentId: string | null;
  parentId: string | null;
}) {
  const [file, setFile] = useState<globalThis.File | null>(null);
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name);
      formData.append("scope", scope);
      if (scopeAgentId) formData.append("scopeAgentId", scopeAgentId);
      if (parentId) formData.append("parentId", parentId);
      if (description.trim()) formData.append("description", description.trim());
      return knowledgeApi.uploadFile(companyId, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", companyId] });
      pushToast({ title: "File uploaded", tone: "success" });
      setFile(null);
      setDescription("");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      pushToast({ title: "Upload failed", body: err.message, tone: "error" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
        </DialogHeader>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <Textarea
          placeholder="Description (optional) — what's in this file?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="resize-none"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!file || mutation.isPending}>
            {mutation.isPending ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Scope panel (left side within a tab) ────────────────────────────

function ScopePanel({
  companyId,
  scope,
  scopeAgentId,
  selectedId,
  onSelect,
}: {
  companyId: string;
  scope: KnowledgeEntryScope;
  scopeAgentId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showCreateDoc, setShowCreateDoc] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const treeParams = useMemo(
    () => ({ scope, ...(scopeAgentId ? { scopeAgentId } : {}) }),
    [scope, scopeAgentId],
  );

  const { data: entries, isLoading } = useQuery({
    queryKey: queryKeys.knowledge.tree(companyId, scope, scopeAgentId ?? undefined),
    queryFn: () => knowledgeApi.tree(companyId, treeParams),
  });

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => knowledgeApi.delete(companyId, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", companyId] });
      pushToast({ title: "Deleted", tone: "success" });
    },
    onError: (err: Error) => {
      pushToast({ title: "Error", body: err.message, tone: "error" });
    },
  });

  const tree = useMemo(() => buildTree(entries ?? []), [entries]);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Selected entry's parent folder for creating siblings
  const selectedEntry = entries?.find((e) => e.id === selectedId);
  const parentIdForCreate = selectedEntry?.type === "folder" ? selectedEntry.id : (selectedEntry?.parentId ?? null);

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto p-2">
        {tree.length === 0 ? (
          <div className="px-2 py-8 text-center text-sm text-muted-foreground">
            No files yet. Create a folder or document to get started.
          </div>
        ) : (
          tree.map((node) => (
            <TreeItem
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggle={handleToggle}
            />
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1 border-t p-2">
        <Button variant="ghost" size="sm" onClick={() => setShowCreateFolder(true)}>
          <FolderPlus className="mr-1 h-3.5 w-3.5" />
          Folder
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowCreateDoc(true)}>
          <FilePlus className="mr-1 h-3.5 w-3.5" />
          Document
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowUpload(true)}>
          <Upload className="mr-1 h-3.5 w-3.5" />
          Upload
        </Button>
        {selectedId && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm("Delete this entry and all its children?")) {
                deleteMutation.mutate(selectedId);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <CreateFolderDialog
        open={showCreateFolder}
        onOpenChange={setShowCreateFolder}
        companyId={companyId}
        scope={scope}
        scopeAgentId={scopeAgentId}
        parentId={parentIdForCreate}
      />
      <CreateDocumentDialog
        open={showCreateDoc}
        onOpenChange={setShowCreateDoc}
        companyId={companyId}
        scope={scope}
        scopeAgentId={scopeAgentId}
        parentId={parentIdForCreate}
        onCreated={(entry) => onSelect(entry.id)}
      />
      <UploadFileDialog
        open={showUpload}
        onOpenChange={setShowUpload}
        companyId={companyId}
        scope={scope}
        scopeAgentId={scopeAgentId}
        parentId={parentIdForCreate}
      />
    </div>
  );
}

// ── Department tab ──────────────────────────────────────────────────

function DepartmentsTab({
  companyId,
  selectedId,
  onSelect,
}: {
  companyId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  const { data: departments, isLoading } = useQuery({
    queryKey: queryKeys.knowledge.departments(companyId),
    queryFn: () => knowledgeApi.departments(companyId),
  });

  if (isLoading) return <PageSkeleton />;
  if (!departments?.length) {
    return (
      <EmptyState
        icon={Folder}
        message="No departments found. Departments are derived from your org chart — agents who report directly to the CEO form department heads."
      />
    );
  }

  return (
    <div className="flex h-full">
      {/* Department list */}
      <div className="w-48 shrink-0 border-r overflow-auto">
        {departments.map((dept) => (
          <button
            key={dept.agentId}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
              selectedDept === dept.agentId && "bg-accent font-medium",
            )}
            onClick={() => setSelectedDept(dept.agentId)}
          >
            <Folder className="h-4 w-4 text-muted-foreground" />
            <div className="truncate">
              <div className="truncate">{dept.agentName}</div>
              <div className="truncate text-xs text-muted-foreground">{dept.agentTitle ?? dept.agentRole}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Department files */}
      <div className="flex-1">
        {selectedDept ? (
          <ScopePanel
            companyId={companyId}
            scope="department"
            scopeAgentId={selectedDept}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a department
          </div>
        )}
      </div>
    </div>
  );
}

// ── Agents tab ──────────────────────────────────────────────────────

function AgentsTab({
  companyId,
  selectedId,
  onSelect,
}: {
  companyId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Reuse agents list from existing query key
  const { data: agentsList, isLoading } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: async () => {
      const { api } = await import("../api/client");
      return api.get<Array<{ id: string; name: string; title: string | null; role: string; status: string }>>(
        `/agents?companyId=${encodeURIComponent(companyId)}`,
      );
    },
  });

  const activeAgents = useMemo(
    () => (agentsList ?? []).filter((a) => a.status !== "terminated"),
    [agentsList],
  );

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="flex h-full">
      {/* Agent list */}
      <div className="w-48 shrink-0 border-r overflow-auto">
        {activeAgents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
              selectedAgent === agent.id && "bg-accent font-medium",
            )}
            onClick={() => setSelectedAgent(agent.id)}
          >
            <div className="truncate">
              <div className="truncate">{agent.name}</div>
              <div className="truncate text-xs text-muted-foreground">{agent.title ?? agent.role}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Agent files */}
      <div className="flex-1">
        {selectedAgent ? (
          <ScopePanel
            companyId={companyId}
            scope="agent"
            scopeAgentId={selectedAgent}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select an agent
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────

export function CompanyFiles() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [activeTab, setActiveTab] = useState("company");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Files" }]);
  }, [setBreadcrumbs]);

  if (!selectedCompanyId) return <PageSkeleton />;

  const tabs = [
    { value: "company", label: "Company" },
    { value: "departments", label: "Departments" },
    { value: "agents", label: "Agents" },
  ];

  return (
    <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedId(null); }}>
      <div className="flex h-full flex-col">
        <div className="border-b px-4 pt-2">
          <PageTabBar items={tabs} value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedId(null); }} align="start" />
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left panel: tree */}
          <div className="w-72 shrink-0 border-r overflow-hidden flex flex-col">
            <TabsContent value="company" className="flex-1 overflow-hidden mt-0">
              <ScopePanel
                companyId={selectedCompanyId}
                scope="company"
                scopeAgentId={null}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </TabsContent>
            <TabsContent value="departments" className="flex-1 overflow-hidden mt-0">
              <DepartmentsTab
                companyId={selectedCompanyId}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </TabsContent>
            <TabsContent value="agents" className="flex-1 overflow-hidden mt-0">
              <AgentsTab
                companyId={selectedCompanyId}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </TabsContent>
          </div>

          {/* Right panel: content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <ContentPane companyId={selectedCompanyId} entryId={selectedId} />
          </div>
        </div>
      </div>
    </Tabs>
  );
}
