import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "@/lib/router";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { companiesApi } from "../api/companies";
import { accessApi } from "../api/access";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Settings, Check } from "lucide-react";
import { CompanyPatternIcon } from "../components/CompanyPatternIcon";
import { InstanceSettingsPanel } from "../components/InstanceSettingsPanel";
import {
  AGENT_ROLE_LABELS,
  AGENT_ROLES,
  type CompanyHeartbeatIntervalsByRole,
} from "@paperclipai/shared";
import {
  Field,
  ToggleField,
  HintIcon
} from "../components/agent-config-primitives";

type AgentSnippetInput = {
  onboardingTextUrl: string;
  connectionCandidates?: string[] | null;
  testResolutionUrl?: string | null;
};

const HEARTBEAT_ROLE_GROUPS: Array<{
  title: string;
  roles: Array<(typeof AGENT_ROLES)[number]>;
}> = [
  { title: "Leadership", roles: ["ceo", "cfo", "cmo"] },
  { title: "Managers", roles: ["cto", "pm", "qa"] },
  { title: "Builders", roles: ["engineer", "devops", "designer", "researcher", "general"] },
];

function emptyHeartbeatIntervalDraft(): Record<(typeof AGENT_ROLES)[number], string> {
  return Object.fromEntries(AGENT_ROLES.map((role) => [role, ""])) as Record<(typeof AGENT_ROLES)[number], string>;
}

function heartbeatIntervalsToDraft(
  intervals?: CompanyHeartbeatIntervalsByRole,
): Record<(typeof AGENT_ROLES)[number], string> {
  const next = emptyHeartbeatIntervalDraft();
  for (const role of AGENT_ROLES) {
    const value = intervals?.[role];
    next[role] = typeof value === "number" && Number.isFinite(value) ? String(value) : "";
  }
  return next;
}

function draftToHeartbeatIntervals(
  draft: Record<(typeof AGENT_ROLES)[number], string>,
): CompanyHeartbeatIntervalsByRole {
  const next: CompanyHeartbeatIntervalsByRole = {};
  for (const role of AGENT_ROLES) {
    const raw = draft[role].trim();
    if (!raw) continue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 30) next[role] = Math.floor(parsed);
  }
  return next;
}

function heartbeatIntervalsEqual(
  left?: CompanyHeartbeatIntervalsByRole,
  right?: CompanyHeartbeatIntervalsByRole,
): boolean {
  for (const role of AGENT_ROLES) {
    if ((left?.[role] ?? null) !== (right?.[role] ?? null)) return false;
  }
  return true;
}

export function CompanySettings() {
  const {
    companies,
    selectedCompany,
    selectedCompanyId,
    setSelectedCompanyId
  } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const settingsView = searchParams.get("view") ?? "company";
  const isCompanyView = settingsView === "company";
  const instanceSection =
    settingsView === "instance-auth"
      ? "agent-auth"
      : settingsView === "instance-secrets"
        ? "secrets"
        : "operations";
  const instanceViewTitle =
    settingsView === "instance-auth"
      ? "Provider Keys & Auth"
      : settingsView === "instance-secrets"
        ? "Paperclip Secrets"
        : "Storage, Backups & Runtime";
  const instanceViewDescription =
    settingsView === "instance-auth"
      ? "Store instance-level OpenAI and Anthropic keys, and choose how new Claude/Codex local agents authenticate by default."
      : settingsView === "instance-secrets"
        ? "Global secret-storage settings for how Paperclip encrypts and resolves sensitive values."
        : "Global app settings for file storage, S3 destination and credentials, database backups, and scheduler/runtime automation.";

  // General settings local state
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [heartbeatIntervalsByRole, setHeartbeatIntervalsByRole] = useState<
    Record<(typeof AGENT_ROLES)[number], string>
  >(emptyHeartbeatIntervalDraft);

  // Sync local state from selected company
  useEffect(() => {
    if (!selectedCompany) return;
    setCompanyName(selectedCompany.name);
    setDescription(selectedCompany.description ?? "");
    setBrandColor(selectedCompany.brandColor ?? "");
    setHeartbeatIntervalsByRole(
      heartbeatIntervalsToDraft(
        selectedCompany.runtimePolicy?.heartbeat?.intervalsByRole,
      ),
    );
  }, [selectedCompany]);

  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSnippet, setInviteSnippet] = useState<string | null>(null);
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [snippetCopyDelightId, setSnippetCopyDelightId] = useState(0);

  const generalDirty =
    !!selectedCompany &&
    (companyName !== selectedCompany.name ||
      description !== (selectedCompany.description ?? "") ||
      brandColor !== (selectedCompany.brandColor ?? ""));

  const heartbeatPolicyDirty =
    !!selectedCompany &&
    !heartbeatIntervalsEqual(
      draftToHeartbeatIntervals(heartbeatIntervalsByRole),
      selectedCompany.runtimePolicy?.heartbeat?.intervalsByRole,
    );

  const generalMutation = useMutation({
    mutationFn: (data: {
      name: string;
      description: string | null;
      brandColor: string | null;
    }) => companiesApi.update(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    }
  });

  const settingsMutation = useMutation({
    mutationFn: (requireApproval: boolean) =>
      companiesApi.update(selectedCompanyId!, {
        requireBoardApprovalForNewAgents: requireApproval
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
    }
  });

  const heartbeatPolicyMutation = useMutation({
    mutationFn: (intervalsByRole: CompanyHeartbeatIntervalsByRole) =>
      companiesApi.update(selectedCompanyId!, {
        runtimePolicy: {
          heartbeat: {
            intervalsByRole,
          },
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      if (selectedCompanyId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.companies.detail(selectedCompanyId) });
      }
    },
  });

  const applyHeartbeatPolicyMutation = useMutation({
    mutationFn: () => companiesApi.applyHeartbeatPolicy(selectedCompanyId!),
    onSuccess: async () => {
      if (!selectedCompanyId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(selectedCompanyId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activity(selectedCompanyId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(selectedCompanyId) }),
      ]);
    },
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      accessApi.createOpenClawInvitePrompt(selectedCompanyId!),
    onSuccess: async (invite) => {
      setInviteError(null);
      const base = window.location.origin.replace(/\/+$/, "");
      const onboardingTextLink =
        invite.onboardingTextUrl ??
        invite.onboardingTextPath ??
        `/api/invites/${invite.token}/onboarding.txt`;
      const absoluteUrl = onboardingTextLink.startsWith("http")
        ? onboardingTextLink
        : `${base}${onboardingTextLink}`;
      setSnippetCopied(false);
      setSnippetCopyDelightId(0);
      let snippet: string;
      try {
        const manifest = await accessApi.getInviteOnboarding(invite.token);
        snippet = buildAgentSnippet({
          onboardingTextUrl: absoluteUrl,
          connectionCandidates:
            manifest.onboarding.connectivity?.connectionCandidates ?? null,
          testResolutionUrl:
            manifest.onboarding.connectivity?.testResolutionEndpoint?.url ??
            null
        });
      } catch {
        snippet = buildAgentSnippet({
          onboardingTextUrl: absoluteUrl,
          connectionCandidates: null,
          testResolutionUrl: null
        });
      }
      setInviteSnippet(snippet);
      try {
        await navigator.clipboard.writeText(snippet);
        setSnippetCopied(true);
        setSnippetCopyDelightId((prev) => prev + 1);
        setTimeout(() => setSnippetCopied(false), 2000);
      } catch {
        /* clipboard may not be available */
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.sidebarBadges(selectedCompanyId!)
      });
    },
    onError: (err) => {
      setInviteError(
        err instanceof Error ? err.message : "Failed to create invite"
      );
    }
  });

  useEffect(() => {
    setInviteError(null);
    setInviteSnippet(null);
    setSnippetCopied(false);
    setSnippetCopyDelightId(0);
  }, [selectedCompanyId]);
  const archiveMutation = useMutation({
    mutationFn: ({
      companyId,
      nextCompanyId
    }: {
      companyId: string;
      nextCompanyId: string | null;
    }) => companiesApi.archive(companyId).then(() => ({ nextCompanyId })),
    onSuccess: async ({ nextCompanyId }) => {
      if (nextCompanyId) {
        setSelectedCompanyId(nextCompanyId);
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.companies.all
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.companies.stats
      });
    }
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company", href: "/dashboard" },
      { label: "Settings" }
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  if (!selectedCompany) {
    return (
      <div className="text-sm text-muted-foreground">
        No company selected. Select a company from the switcher above.
      </div>
    );
  }

  function handleSaveGeneral() {
    generalMutation.mutate({
      name: companyName.trim(),
      description: description.trim() || null,
      brandColor: brandColor || null
    });
  }

  function handleSaveHeartbeatPolicy() {
    heartbeatPolicyMutation.mutate(draftToHeartbeatIntervals(heartbeatIntervalsByRole));
  }

  function setView(nextView: "company" | "instance-ops" | "instance-auth" | "instance-secrets") {
    const next = new URLSearchParams(searchParams);
    next.set("view", nextView);
    setSearchParams(next);
  }

  return (
    <div className="w-full max-w-[min(1880px,calc(100vw-2rem))] space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Company Settings</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="h-7 px-2.5 text-[11px] font-medium" variant={isCompanyView ? "secondary" : "outline"} onClick={() => setView("company")}>
          Company
        </Button>
        <Button size="sm" className="h-7 px-2.5 text-[11px] font-medium" variant={settingsView === "instance-ops" ? "secondary" : "outline"} onClick={() => setView("instance-ops")}>
          Storage / DB / Runtime
        </Button>
        <Button size="sm" className="h-7 px-2.5 text-[11px] font-medium" variant={settingsView === "instance-auth" ? "secondary" : "outline"} onClick={() => setView("instance-auth")}>
          Provider Keys & Auth
        </Button>
        <Button size="sm" className="h-7 px-2.5 text-[11px] font-medium" variant={settingsView === "instance-secrets" ? "secondary" : "outline"} onClick={() => setView("instance-secrets")}>
          Paperclip Secrets
        </Button>
      </div>

      {isCompanyView ? (
        <>
      {/* General */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          General
        </div>
        <div className="space-y-3 rounded-md border border-border px-4 py-4">
          <Field label="Company name" hint="The display name for your company.">
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </Field>
          <Field
            label="Description"
            hint="Optional description shown in the company profile."
          >
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={description}
              placeholder="Optional company description"
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* Appearance */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Appearance
        </div>
        <div className="space-y-3 rounded-md border border-border px-4 py-4">
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <CompanyPatternIcon
                companyName={companyName || selectedCompany.name}
                brandColor={brandColor || null}
                className="rounded-[14px]"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Field
                label="Brand color"
                hint="Sets the hue for the company icon. Leave empty for auto-generated color."
              >
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandColor || "#6366f1"}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={brandColor}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^#[0-9a-fA-F]{0,6}$/.test(v)) {
                        setBrandColor(v);
                      }
                    }}
                    placeholder="Auto"
                    className="w-28 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none"
                  />
                  {brandColor && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setBrandColor("")}
                      className="text-xs text-muted-foreground"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </Field>
            </div>
          </div>
        </div>
      </div>

      {/* Save button for General + Appearance */}
      {generalDirty && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSaveGeneral}
            disabled={generalMutation.isPending || !companyName.trim()}
          >
            {generalMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
          {generalMutation.isSuccess && (
            <span className="text-xs text-muted-foreground">Saved</span>
          )}
          {generalMutation.isError && (
            <span className="text-xs text-destructive">
              {generalMutation.error instanceof Error
                ? generalMutation.error.message
                : "Failed to save"}
            </span>
          )}
        </div>
      )}

      {/* Hiring */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Hiring
        </div>
        <div className="rounded-md border border-border px-4 py-3">
          <ToggleField
            label="Require board approval for new hires"
            hint="New agent hires stay pending until approved by board."
            checked={!!selectedCompany.requireBoardApprovalForNewAgents}
            onChange={(v) => settingsMutation.mutate(v)}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Agent Heartbeat Policy
        </div>
        <div className="space-y-4 rounded-md border border-border px-4 py-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">Company-wide cadence defaults</div>
            <div className="text-sm text-muted-foreground">
              Manage heartbeat interval defaults centrally by role. New hires inherit this policy automatically. Save the policy first, then apply it to existing agents when you want to roll it out.
            </div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Leave a field blank to use the built-in Paperclip default for that role.
          </div>
          <div className="space-y-4">
            {HEARTBEAT_ROLE_GROUPS.map((group) => (
              <div key={group.title} className="space-y-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.roles.map((role) => (
                    <Field
                      key={role}
                      label={AGENT_ROLE_LABELS[role]}
                      hint="Heartbeat interval in seconds for this role."
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={30}
                          step={30}
                          value={heartbeatIntervalsByRole[role]}
                          onChange={(e) =>
                            setHeartbeatIntervalsByRole((prev) => ({
                              ...prev,
                              [role]: e.target.value,
                            }))
                          }
                          placeholder="default"
                          className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                        />
                        <span className="text-xs text-muted-foreground">sec</span>
                      </div>
                    </Field>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={handleSaveHeartbeatPolicy}
              disabled={heartbeatPolicyMutation.isPending || !heartbeatPolicyDirty}
            >
              {heartbeatPolicyMutation.isPending ? "Saving..." : "Save heartbeat policy"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => applyHeartbeatPolicyMutation.mutate()}
              disabled={applyHeartbeatPolicyMutation.isPending || heartbeatPolicyDirty}
            >
              {applyHeartbeatPolicyMutation.isPending ? "Applying..." : "Apply to existing agents"}
            </Button>
            {heartbeatPolicyDirty && (
              <span className="text-xs text-muted-foreground">
                Save the policy before applying it to existing agents.
              </span>
            )}
            {heartbeatPolicyMutation.isSuccess && !heartbeatPolicyDirty && (
              <span className="text-xs text-muted-foreground">Policy saved</span>
            )}
            {applyHeartbeatPolicyMutation.isSuccess && (
              <span className="text-xs text-muted-foreground">
                Applied to {applyHeartbeatPolicyMutation.data.updatedCount} agents
              </span>
            )}
          </div>
          {(heartbeatPolicyMutation.isError || applyHeartbeatPolicyMutation.isError) && (
            <span className="text-xs text-destructive">
              {heartbeatPolicyMutation.error instanceof Error
                ? heartbeatPolicyMutation.error.message
                : applyHeartbeatPolicyMutation.error instanceof Error
                  ? applyHeartbeatPolicyMutation.error.message
                  : "Failed to update heartbeat policy"}
            </span>
          )}
        </div>
      </div>

      {/* Invites */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Invites
        </div>
        <div className="space-y-3 rounded-md border border-border px-4 py-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              Generate an OpenClaw agent invite snippet.
            </span>
            <HintIcon text="Creates a short-lived OpenClaw agent invite and renders a copy-ready prompt." />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => inviteMutation.mutate()}
              disabled={inviteMutation.isPending}
            >
              {inviteMutation.isPending
                ? "Generating..."
                : "Generate OpenClaw Invite Prompt"}
            </Button>
          </div>
          {inviteError && (
            <p className="text-sm text-destructive">{inviteError}</p>
          )}
          {inviteSnippet && (
            <div className="rounded-md border border-border bg-muted/30 p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  OpenClaw Invite Prompt
                </div>
                {snippetCopied && (
                  <span
                    key={snippetCopyDelightId}
                    className="flex items-center gap-1 text-xs text-green-600 animate-pulse"
                  >
                    <Check className="h-3 w-3" />
                    Copied
                  </span>
                )}
              </div>
              <div className="mt-1 space-y-1.5">
                <textarea
                  className="h-[28rem] w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none"
                  value={inviteSnippet}
                  readOnly
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(inviteSnippet);
                        setSnippetCopied(true);
                        setSnippetCopyDelightId((prev) => prev + 1);
                        setTimeout(() => setSnippetCopied(false), 2000);
                      } catch {
                        /* clipboard may not be available */
                      }
                    }}
                  >
                    {snippetCopied ? "Copied snippet" : "Copy snippet"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-destructive uppercase tracking-wide">
          Danger Zone
        </div>
        <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-4">
          <p className="text-sm text-muted-foreground">
            Archive this company to hide it from the sidebar. This persists in
            the database.
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={
                archiveMutation.isPending ||
                selectedCompany.status === "archived"
              }
              onClick={() => {
                if (!selectedCompanyId) return;
                const confirmed = window.confirm(
                  `Archive company "${selectedCompany.name}"? It will be hidden from the sidebar.`
                );
                if (!confirmed) return;
                const nextCompanyId =
                  companies.find(
                    (company) =>
                      company.id !== selectedCompanyId &&
                      company.status !== "archived"
                  )?.id ?? null;
                archiveMutation.mutate({
                  companyId: selectedCompanyId,
                  nextCompanyId
                });
              }}
            >
              {archiveMutation.isPending
                ? "Archiving..."
                : selectedCompany.status === "archived"
                ? "Already archived"
                : "Archive company"}
            </Button>
            {archiveMutation.isError && (
              <span className="text-xs text-destructive">
                {archiveMutation.error instanceof Error
                  ? archiveMutation.error.message
                  : "Failed to archive company"}
              </span>
            )}
          </div>
        </div>
      </div>
        </>
      ) : (
        <div className="space-y-5">
          <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(94,165,255,0.14),transparent_32%),linear-gradient(180deg,rgba(12,13,18,0.98),rgba(5,6,10,0.98))] px-5 py-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)] sm:px-6 lg:px-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-4xl space-y-2.5">
                <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Global Instance Settings
                </div>
                <div className="space-y-1.5">
                  <div className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                    {instanceViewTitle}
                  </div>
                  <p className="max-w-3xl text-[12px] leading-5 text-slate-300">
                    {instanceViewDescription} These settings apply to the whole Paperclip installation, not just the currently selected company.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[560px]">
                <div className="rounded-[20px] border border-white/10 bg-black/30 px-4 py-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">Scope</div>
                  <div className="mt-1.5 text-[12px] font-semibold text-white">Instance-wide</div>
                  <div className="mt-1 text-[10px] text-slate-400">Shared across all companies</div>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-black/30 px-4 py-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">View</div>
                  <div className="mt-1.5 text-[12px] font-semibold text-white">{instanceViewTitle}</div>
                  <div className="mt-1 text-[10px] text-slate-400">Focused admin console section</div>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-black/30 px-4 py-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">Behavior</div>
                  <div className="mt-1.5 text-[12px] font-semibold text-white">Live config</div>
                  <div className="mt-1 text-[10px] text-slate-400">Changes update Paperclip runtime settings</div>
                </div>
              </div>
            </div>
          </div>
          <InstanceSettingsPanel section={instanceSection} />
        </div>
      )}
    </div>
  );
}

function buildAgentSnippet(input: AgentSnippetInput) {
  const candidateUrls = buildCandidateOnboardingUrls(input);
  const resolutionTestUrl = buildResolutionTestUrl(input);

  const candidateList =
    candidateUrls.length > 0
      ? candidateUrls.map((u) => `- ${u}`).join("\n")
      : "- (No candidate URLs available yet.)";

  const connectivityBlock =
    candidateUrls.length === 0
      ? `No candidate URLs are available. Ask your user to configure a reachable hostname in Paperclip, then retry.
Suggested steps:
- choose a hostname that resolves to the Paperclip host from your runtime
- run: pnpm paperclipai allowed-hostname <host>
- restart Paperclip
- verify with: curl -fsS http://<host>:3100/api/health
- regenerate this invite snippet`
      : `If none are reachable, ask your user to add a reachable hostname in Paperclip, restart, and retry.
Suggested command:
- pnpm paperclipai allowed-hostname <host>
Then verify with: curl -fsS <base-url>/api/health`;

  const resolutionLine = resolutionTestUrl
    ? `\nYou MUST test Paperclip-to-gateway reachability, call: ${resolutionTestUrl}?url=<urlencoded-gateway-url> (using the hostname that worked above). Do not assume your 172.x is necessarily reachable from Paperclip. Test it. `
    : "";

  return `You're invited to join a Paperclip organization.

The URLs you should try are:
${candidateList}

Connectivity guidance:
If you are running on a different machine than Paperclip, Paperclip must be reachable at one of the hostnames used above.
Verify the hostname works from your runtime with: GET <base-url>/api/health

${connectivityBlock}

For your "agentName", just use your own agent name (OpenClaw or whatever your name is) and send it directly.
You also need to send a gateway URL that Paperclip can access. Check your config and include that URL.${resolutionLine}

---

This onboarding flow is for OpenClaw Gateway.
When you submit the join request, use:
- \`adapterType: "openclaw_gateway"\`
- \`agentDefaultsPayload.url\` as your \`ws://\` or \`wss://\` gateway URL
- \`agentDefaultsPayload.headers["x-openclaw-token"]\` with your gateway token
- (legacy accepted) \`agentDefaultsPayload.headers["x-openclaw-auth"]\`
- Keep device auth enabled (recommended). If \`devicePrivateKeyPem\` is omitted, Paperclip will generate and persist one during join so pairing approvals remain stable.
- Only use \`disableDeviceAuth=true\` for special environments where pairing cannot be completed.

Do NOT use \`/v1/responses\` or \`/hooks/*\` in this join flow.

Before you do anything, please respond to your user that you understand the instructions and you're going to work on them. Then do the step above in another session called "paperclip-onboarding" and then tell your user when you're done. Update your user in intermediate steps along the way so they know what's going on.

Then after you've connected to Paperclip (exchanged keys etc.) you MUST review and follow the onboarding instructions in onboarding.txt they give you.

`;
}

function buildCandidateOnboardingUrls(input: AgentSnippetInput): string[] {
  const candidates = (input.connectionCandidates ?? [])
    .map((candidate) => candidate.trim())
    .filter(Boolean);
  const urls = new Set<string>();
  let onboardingUrl: URL | null = null;

  try {
    onboardingUrl = new URL(input.onboardingTextUrl);
    urls.add(onboardingUrl.toString());
  } catch {
    const trimmed = input.onboardingTextUrl.trim();
    if (trimmed) {
      urls.add(trimmed);
    }
  }

  if (!onboardingUrl) {
    for (const candidate of candidates) {
      urls.add(candidate);
    }
    return Array.from(urls);
  }

  const onboardingPath = `${onboardingUrl.pathname}${onboardingUrl.search}`;
  for (const candidate of candidates) {
    try {
      const base = new URL(candidate);
      urls.add(`${base.origin}${onboardingPath}`);
    } catch {
      urls.add(candidate);
    }
  }

  return Array.from(urls);
}

function buildResolutionTestUrl(input: AgentSnippetInput): string | null {
  const explicit = input.testResolutionUrl?.trim();
  if (explicit) return explicit;

  try {
    const onboardingUrl = new URL(input.onboardingTextUrl);
    const testPath = onboardingUrl.pathname.replace(
      /\/onboarding\.txt$/,
      "/test-resolution"
    );
    return `${onboardingUrl.origin}${testPath}`;
  } catch {
    return null;
  }
}
