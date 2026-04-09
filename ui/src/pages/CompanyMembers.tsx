import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { accessApi } from "../api/access";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, Copy, Check, X, Clock, Mail } from "lucide-react";
import type { JoinRequest } from "@paperclipai/shared";

type Member = {
  id: string;
  companyId: string;
  principalType: string;
  principalId: string;
  principalName?: string | null;
  principalEmail?: string | null;
  status: string;
  membershipRole: string | null;
  createdAt: string;
  updatedAt: string;
};

function formatDate(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function InviteDialog({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: () => void;
}) {
  const { pushToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [allowedJoinTypes, setAllowedJoinTypes] = useState<
    "human" | "agent" | "both"
  >("both");

  const inviteMutation = useMutation({
    mutationFn: () =>
      accessApi.createCompanyInvite(companyId, { allowedJoinTypes }),
    onSuccess: () => {
      pushToast({ title: "Invite created", tone: "success" });
    },
    onError: (err) => {
      pushToast({
        title: "Failed to create invite",
        body: err instanceof Error ? err.message : "Unknown error",
        tone: "error",
      });
    },
  });

  const invite = inviteMutation.data;
  const inviteUrl = invite
    ? `${window.location.origin}/invite/${invite.token}`
    : null;

  async function handleCopy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may not be available */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Create Invite</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!invite ? (
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Who can join?
              </label>
              <select
                className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                value={allowedJoinTypes}
                onChange={(e) =>
                  setAllowedJoinTypes(
                    e.target.value as "human" | "agent" | "both",
                  )
                }
              >
                <option value="both">Humans and Agents</option>
                <option value="human">Humans only</option>
                <option value="agent">Agents only</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => inviteMutation.mutate()}
                disabled={inviteMutation.isPending}
              >
                {inviteMutation.isPending ? "Creating..." : "Create Invite"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Share this link with the person or agent you want to invite.
              Expires{" "}
              {new Date(invite.expiresAt).toLocaleString()}.
            </p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
              <code className="flex-1 truncate text-xs">{inviteUrl}</code>
              <button
                onClick={handleCopy}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CompanyMembers() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company", href: "/dashboard" },
      { label: "Members" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  const membersQuery = useQuery({
    queryKey: queryKeys.access.members(selectedCompanyId!),
    queryFn: () => accessApi.listMembers(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const joinRequestsQuery = useQuery({
    queryKey: queryKeys.access.joinRequests(selectedCompanyId!, "pending_approval"),
    queryFn: () =>
      accessApi.listJoinRequests(selectedCompanyId!, "pending_approval"),
    enabled: !!selectedCompanyId,
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: string) =>
      accessApi.approveJoinRequest(selectedCompanyId!, requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.access.joinRequests(selectedCompanyId!),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.access.members(selectedCompanyId!),
      });
      pushToast({ title: "Join request approved", tone: "success" });
    },
    onError: (err) => {
      pushToast({
        title: "Failed to approve",
        body: err instanceof Error ? err.message : "Unknown error",
        tone: "error",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (requestId: string) =>
      accessApi.rejectJoinRequest(selectedCompanyId!, requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.access.joinRequests(selectedCompanyId!),
      });
      pushToast({ title: "Join request rejected", tone: "success" });
    },
    onError: (err) => {
      pushToast({
        title: "Failed to reject",
        body: err instanceof Error ? err.message : "Unknown error",
        tone: "error",
      });
    },
  });

  if (!selectedCompany) {
    return (
      <div className="text-sm text-muted-foreground">
        No company selected. Select a company from the switcher above.
      </div>
    );
  }

  const members = (membersQuery.data ?? []) as Member[];
  const pendingRequests = joinRequestsQuery.data ?? [];

  function getMemberIdentity(member: Member): {
    primaryLabel: string;
    secondaryIdentity: string | null;
  } {
    const isUser = member.principalType === "user";
    const primaryLabel = isUser
      ? member.principalName ?? member.principalEmail ?? member.principalId
      : member.principalName ?? member.principalId;
    const secondaryIdentity = isUser
      ? member.principalEmail && member.principalEmail !== primaryLabel
        ? member.principalEmail
        : null
      : member.principalId !== primaryLabel
        ? member.principalId
        : null;
    return { primaryLabel, secondaryIdentity };
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Members</h1>
        </div>
        <Button size="sm" onClick={() => setShowInviteDialog(true)}>
          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
          Invite
        </Button>
      </div>

      {/* Pending Join Requests */}
      {pendingRequests.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pending Join Requests
          </div>
          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {req.agentName ?? req.requestType}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {req.requestType === "agent" ? "Agent" : "Human"} request
                      {" \u00B7 "}
                      {formatDate(req.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectMutation.mutate(req.id)}
                    disabled={rejectMutation.isPending}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => approveMutation.mutate(req.id)}
                    disabled={approveMutation.isPending}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members List */}
      <div className="space-y-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {members.length} {members.length === 1 ? "Member" : "Members"}
        </div>
        {membersQuery.isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading members...
          </div>
        ) : members.length === 0 ? (
          <div className="rounded-md border border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No members yet. Create an invite to add people or agents.
          </div>
        ) : (
          <div className="rounded-md border border-border divide-y divide-border">
            {members.map((member) => {
              const { primaryLabel, secondaryIdentity } = getMemberIdentity(member);
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    {member.principalType === "agent" ? (
                      <span className="text-xs font-medium text-muted-foreground">
                        A
                      </span>
                    ) : (
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium">
                      {primaryLabel}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {member.principalType === "agent" ? "Agent" : "User"}
                      {secondaryIdentity ? ` \u00B7 ${secondaryIdentity}` : ""}
                      {member.membershipRole
                        ? ` \u00B7 ${member.membershipRole}`
                        : ""}
                      {" \u00B7 Joined "}
                      {formatDate(member.createdAt)}
                    </div>
                  </div>
                  <div>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        member.status === "active"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {member.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showInviteDialog && (
        <InviteDialog
          companyId={selectedCompanyId!}
          onClose={() => setShowInviteDialog(false)}
        />
      )}
    </div>
  );
}
