import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { issuesApi } from "../api/issues";
import { queryKeys } from "../lib/queryKeys";
import { useCompany } from "../context/CompanyContext";
import { StatusIcon } from "./StatusIcon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Plus, X, Link2, ArrowRight, Ban, Copy } from "lucide-react";
import type { IssueRelationType } from "@paperclipai/shared";

const RELATION_LABELS: Record<IssueRelationType, string> = {
  blocks: "Blocks",
  blocked_by: "Blocked by",
  related: "Related to",
  duplicate: "Duplicate of",
};

const RELATION_ICONS: Record<IssueRelationType, typeof Link2> = {
  blocks: ArrowRight,
  blocked_by: Ban,
  related: Link2,
  duplicate: Copy,
};

interface IssueRelationsProps {
  issueId: string;
}

export function IssueRelations({ issueId }: IssueRelationsProps) {
  const { selectedCompanyId } = useCompany();
  const companyId = selectedCompanyId!;
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [relationType, setRelationType] = useState<IssueRelationType>("blocks");
  const [searchQuery, setSearchQuery] = useState("");

  const relationsQueryKey = [...queryKeys.issues.list(companyId), issueId, "relations"];

  const { data: relations = [] } = useQuery({
    queryKey: relationsQueryKey,
    queryFn: () => issuesApi.listRelations(issueId),
  });

  const { data: allIssues = [] } = useQuery({
    queryKey: queryKeys.issues.list(companyId),
    queryFn: () => issuesApi.list(companyId),
    enabled: addOpen,
  });

  const addRelation = useMutation({
    mutationFn: (data: { relatedIssueId: string; type: IssueRelationType }) =>
      issuesApi.createRelation(issueId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: relationsQueryKey });
      setAddOpen(false);
      setSearchQuery("");
    },
  });

  const removeRelation = useMutation({
    mutationFn: (relationId: string) => issuesApi.deleteRelation(issueId, relationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: relationsQueryKey });
    },
  });

  const filteredIssues = allIssues.filter(
    (i) =>
      i.id !== issueId &&
      !relations.some((r) => r.relatedIssueId === i.id) &&
      (searchQuery === "" ||
        (i.identifier ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.title.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  if (relations.length === 0 && !addOpen) {
    return (
      <div className="px-1">
        <button
          onClick={() => setAddOpen(true)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Add relation
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-1">
      <div className="text-xs font-medium text-muted-foreground">Relations</div>
      {relations.map((rel) => {
        const Icon = RELATION_ICONS[rel.type as IssueRelationType] ?? Link2;
        return (
          <div key={rel.id} className="flex items-center gap-1.5 group text-sm">
            <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground shrink-0">
              {RELATION_LABELS[rel.type as IssueRelationType] ?? rel.type}
            </span>
            <Link
              to={`/issues/${rel.relatedIssueId}`}
              className="truncate hover:underline text-xs"
            >
              {rel.relatedIssue?.identifier && (
                <span className="font-mono text-muted-foreground mr-1">{rel.relatedIssue.identifier}</span>
              )}
              {rel.relatedIssue?.title ?? rel.relatedIssueId.slice(0, 8)}
            </Link>
            {rel.relatedIssue?.status && (
              <StatusIcon status={rel.relatedIssue.status} className="h-3 w-3 shrink-0" />
            )}
            <button
              onClick={() => removeRelation.mutate(rel.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive ml-auto shrink-0"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}

      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger asChild>
          <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <Plus className="h-3 w-3" />
            Add relation
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <div className="space-y-2">
            <select
              value={relationType}
              onChange={(e) => setRelationType(e.target.value as IssueRelationType)}
              className="w-full text-xs bg-transparent border border-border rounded px-2 py-1"
            >
              <option value="blocks">Blocks</option>
              <option value="blocked_by">Blocked by</option>
              <option value="related">Related to</option>
              <option value="duplicate">Duplicate of</option>
            </select>
            <input
              type="text"
              placeholder="Search issues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-transparent border border-border rounded px-2 py-1"
              autoFocus
            />
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {filteredIssues.slice(0, 20).map((i) => (
                <button
                  key={i.id}
                  onClick={() => addRelation.mutate({ relatedIssueId: i.id, type: relationType })}
                  className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent flex items-center gap-1.5 truncate"
                >
                  <StatusIcon status={i.status} className="h-3 w-3 shrink-0" />
                  {i.identifier && <span className="font-mono text-muted-foreground">{i.identifier}</span>}
                  <span className="truncate">{i.title}</span>
                </button>
              ))}
              {filteredIssues.length === 0 && (
                <div className="text-xs text-muted-foreground px-2 py-1">No matching issues</div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
