import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  Database,
  HardDrive,
  KeyRound,
  Link2,
  RefreshCw,
  Server,
  Sparkles,
  TerminalSquare,
  XCircle,
} from "lucide-react";
import {
  SECRET_PROVIDERS,
  type InstanceClaudeConnectionProbeResult,
  type InstanceClaudeSubscriptionAuthResponse,
  type InstanceCodexConnectionProbeResult,
  type InstanceCodexSubscriptionAuthResponse,
  type UpdateInstanceSettings,
} from "@paperclipai/shared";
import { instanceSettingsApi } from "../api/instance-settings";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCents, formatTokens } from "../lib/utils";
import { cn } from "@/lib/utils";
import { Field, HintIcon } from "./agent-config-primitives";

type InstanceSettingsPanelSection = "all" | "operations" | "agent-auth" | "secrets";

export function InstanceSettingsPanel({
  section = "all",
}: {
  section?: InstanceSettingsPanelSection;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.instance.settings,
    queryFn: () => instanceSettingsApi.get(),
  });
  const claudeSubscriptionAuth = useQuery({
    queryKey: queryKeys.instance.claudeSubscriptionAuth,
    queryFn: () => instanceSettingsApi.getClaudeSubscriptionAuth(),
    enabled: section === "all" || section === "agent-auth",
    refetchInterval: (query) =>
      query.state.data?.session.state === "pending" ? 2000 : false,
  });
  const codexSubscriptionAuth = useQuery({
    queryKey: queryKeys.instance.codexSubscriptionAuth,
    queryFn: () => instanceSettingsApi.getCodexSubscriptionAuth(),
    enabled: section === "all" || section === "agent-auth",
    refetchInterval: (query) =>
      query.state.data?.session.state === "pending" ? 2000 : false,
  });

  const [storageProvider, setStorageProvider] = useState<"local_disk" | "s3">("local_disk");
  const [localDiskBaseDir, setLocalDiskBaseDir] = useState("");
  const [s3Bucket, setS3Bucket] = useState("");
  const [s3Region, setS3Region] = useState("");
  const [s3Endpoint, setS3Endpoint] = useState("");
  const [s3Prefix, setS3Prefix] = useState("");
  const [s3ForcePathStyle, setS3ForcePathStyle] = useState(false);
  const [s3AccessKeyId, setS3AccessKeyId] = useState("");
  const [s3SecretAccessKey, setS3SecretAccessKey] = useState("");
  const [s3SessionToken, setS3SessionToken] = useState("");

  const [backupEnabled, setBackupEnabled] = useState(true);
  const [backupIntervalMinutes, setBackupIntervalMinutes] = useState("60");
  const [backupRetentionDays, setBackupRetentionDays] = useState("30");
  const [backupDir, setBackupDir] = useState("");

  const [heartbeatSchedulerEnabled, setHeartbeatSchedulerEnabled] = useState(true);
  const [heartbeatSchedulerIntervalMs, setHeartbeatSchedulerIntervalMs] = useState("30000");
  const [agentRuntimeDir, setAgentRuntimeDir] = useState("");
  const [agentRuntimeSyncEnabled, setAgentRuntimeSyncEnabled] = useState(true);
  const [agentRuntimeSyncIntervalMs, setAgentRuntimeSyncIntervalMs] = useState("300000");

  const [secretsProvider, setSecretsProvider] = useState<(typeof SECRET_PROVIDERS)[number]>("local_encrypted");
  const [secretsStrictMode, setSecretsStrictMode] = useState(false);
  const [secretsKeyFilePath, setSecretsKeyFilePath] = useState("");

  const [claudeUseApiKey, setClaudeUseApiKey] = useState(false);
  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [claudeEstimateEnabled, setClaudeEstimateEnabled] = useState(false);
  const [claudeEstimateWindowHours, setClaudeEstimateWindowHours] = useState("5");
  const [claudeEstimateUnit, setClaudeEstimateUnit] = useState<"runs" | "input_tokens" | "total_tokens">("runs");
  const [claudeEstimateCapacity, setClaudeEstimateCapacity] = useState("100");
  const [claudeEstimateExtraCapacity, setClaudeEstimateExtraCapacity] = useState("0");
  const [codexUseApiKey, setCodexUseApiKey] = useState(false);
  const [codexApiKey, setCodexApiKey] = useState("");
  const [codexEstimateEnabled, setCodexEstimateEnabled] = useState(false);
  const [codexEstimateWindowHours, setCodexEstimateWindowHours] = useState("5");
  const [codexEstimateUnit, setCodexEstimateUnit] = useState<"runs" | "input_tokens" | "total_tokens">("runs");
  const [codexEstimateCapacity, setCodexEstimateCapacity] = useState("100");
  const [codexEstimateExtraCapacity, setCodexEstimateExtraCapacity] = useState("0");

  useEffect(() => {
    if (!data) return;

    setStorageProvider(data.storage.configured.provider);
    setLocalDiskBaseDir(data.storage.configured.localDisk.baseDir);
    setS3Bucket(data.storage.configured.s3.bucket);
    setS3Region(data.storage.configured.s3.region);
    setS3Endpoint(data.storage.configured.s3.endpoint ?? "");
    setS3Prefix(data.storage.configured.s3.prefix);
    setS3ForcePathStyle(data.storage.configured.s3.forcePathStyle);
    setS3AccessKeyId("");
    setS3SecretAccessKey("");
    setS3SessionToken("");

    setBackupEnabled(data.database.configuredBackup.enabled);
    setBackupIntervalMinutes(String(data.database.configuredBackup.intervalMinutes));
    setBackupRetentionDays(String(data.database.configuredBackup.retentionDays));
    setBackupDir(data.database.configuredBackup.dir);

    setHeartbeatSchedulerEnabled(data.runtime.configured.heartbeatScheduler.enabled);
    setHeartbeatSchedulerIntervalMs(String(data.runtime.configured.heartbeatScheduler.intervalMs));
    setAgentRuntimeDir(data.runtime.configured.agentRuntime.dir);
    setAgentRuntimeSyncEnabled(data.runtime.configured.agentRuntime.syncEnabled);
    setAgentRuntimeSyncIntervalMs(String(data.runtime.configured.agentRuntime.syncIntervalMs));

    setSecretsProvider(data.secrets.configured.provider);
    setSecretsStrictMode(data.secrets.configured.strictMode);
    setSecretsKeyFilePath(data.secrets.configured.localEncrypted.keyFilePath);

    setClaudeUseApiKey(data.agentAuth.configured.claudeLocal.useApiKey);
    setClaudeApiKey("");
    setClaudeEstimateEnabled(data.agentAuth.configured.claudeLocal.subscriptionEstimate.enabled);
    setClaudeEstimateWindowHours(String(data.agentAuth.configured.claudeLocal.subscriptionEstimate.windowHours));
    setClaudeEstimateUnit(data.agentAuth.configured.claudeLocal.subscriptionEstimate.unit);
    setClaudeEstimateCapacity(String(data.agentAuth.configured.claudeLocal.subscriptionEstimate.capacity));
    setClaudeEstimateExtraCapacity(String(data.agentAuth.configured.claudeLocal.subscriptionEstimate.extraCapacity));
    setCodexUseApiKey(data.agentAuth.configured.codexLocal.useApiKey);
    setCodexApiKey("");
    setCodexEstimateEnabled(data.agentAuth.configured.codexLocal.subscriptionEstimate.enabled);
    setCodexEstimateWindowHours(String(data.agentAuth.configured.codexLocal.subscriptionEstimate.windowHours));
    setCodexEstimateUnit(data.agentAuth.configured.codexLocal.subscriptionEstimate.unit);
    setCodexEstimateCapacity(String(data.agentAuth.configured.codexLocal.subscriptionEstimate.capacity));
    setCodexEstimateExtraCapacity(String(data.agentAuth.configured.codexLocal.subscriptionEstimate.extraCapacity));
  }, [data]);

  const saveSettings = useMutation({
    mutationFn: (payload: UpdateInstanceSettings) => instanceSettingsApi.update(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.settings });
    },
  });
  const startClaudeSubscriptionAuth = useMutation({
    mutationFn: () => instanceSettingsApi.startClaudeSubscriptionAuth(),
    onSuccess: async (result) => {
      queryClient.setQueryData(queryKeys.instance.claudeSubscriptionAuth, result);
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.claudeSubscriptionAuth });
    },
  });
  const testClaudeApiKey = useMutation({
    mutationFn: () => instanceSettingsApi.testClaudeApiKeyConnection(),
  });
  const testClaudeSubscription = useMutation({
    mutationFn: () => instanceSettingsApi.testClaudeSubscriptionConnection(),
  });
  const startCodexSubscriptionAuth = useMutation({
    mutationFn: () => instanceSettingsApi.startCodexSubscriptionAuth(),
    onSuccess: async (result) => {
      queryClient.setQueryData(queryKeys.instance.codexSubscriptionAuth, result);
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.codexSubscriptionAuth });
    },
  });
  const testCodexApiKey = useMutation({
    mutationFn: () => instanceSettingsApi.testCodexApiKeyConnection(),
  });
  const testCodexSubscription = useMutation({
    mutationFn: () => instanceSettingsApi.testCodexSubscriptionConnection(),
  });

  const storageDirty = useMemo(() => {
    if (!data) return false;
    const configured = data.storage.configured;
    return (
      storageProvider !== configured.provider ||
      localDiskBaseDir !== configured.localDisk.baseDir ||
      s3Bucket !== configured.s3.bucket ||
      s3Region !== configured.s3.region ||
      s3Endpoint !== (configured.s3.endpoint ?? "") ||
      s3Prefix !== configured.s3.prefix ||
      s3ForcePathStyle !== configured.s3.forcePathStyle ||
      s3AccessKeyId.trim().length > 0 ||
      s3SecretAccessKey.trim().length > 0 ||
      s3SessionToken.trim().length > 0
    );
  }, [
    data,
    localDiskBaseDir,
    s3AccessKeyId,
    s3Bucket,
    s3Endpoint,
    s3ForcePathStyle,
    s3Prefix,
    s3Region,
    s3SecretAccessKey,
    s3SessionToken,
    storageProvider,
  ]);

  const backupDirty = useMemo(() => {
    if (!data) return false;
    const configured = data.database.configuredBackup;
    return (
      backupEnabled !== configured.enabled ||
      backupIntervalMinutes !== String(configured.intervalMinutes) ||
      backupRetentionDays !== String(configured.retentionDays) ||
      backupDir !== configured.dir
    );
  }, [backupDir, backupEnabled, backupIntervalMinutes, backupRetentionDays, data]);

  const runtimeDirty = useMemo(() => {
    if (!data) return false;
    const configured = data.runtime.configured;
    return (
      heartbeatSchedulerEnabled !== configured.heartbeatScheduler.enabled ||
      heartbeatSchedulerIntervalMs !== String(configured.heartbeatScheduler.intervalMs) ||
      agentRuntimeDir !== configured.agentRuntime.dir ||
      agentRuntimeSyncEnabled !== configured.agentRuntime.syncEnabled ||
      agentRuntimeSyncIntervalMs !== String(configured.agentRuntime.syncIntervalMs)
    );
  }, [
    agentRuntimeDir,
    agentRuntimeSyncEnabled,
    agentRuntimeSyncIntervalMs,
    data,
    heartbeatSchedulerEnabled,
    heartbeatSchedulerIntervalMs,
  ]);

  const secretsDirty = useMemo(() => {
    if (!data) return false;
    const configured = data.secrets.configured;
    return (
      secretsProvider !== configured.provider ||
      secretsStrictMode !== configured.strictMode ||
      secretsKeyFilePath !== configured.localEncrypted.keyFilePath
    );
  }, [data, secretsKeyFilePath, secretsProvider, secretsStrictMode]);

  const agentAuthDefaultsDirty = useMemo(() => {
    if (!data) return false;
    return (
      claudeUseApiKey !== data.agentAuth.configured.claudeLocal.useApiKey ||
      codexUseApiKey !== data.agentAuth.configured.codexLocal.useApiKey
    );
  }, [claudeUseApiKey, codexUseApiKey, data]);

  const claudeKeyDirty = claudeApiKey.trim().length > 0;
  const codexKeyDirty = codexApiKey.trim().length > 0;
  const claudeEstimateDirty = useMemo(() => {
    if (!data) return false;
    const configured = data.agentAuth.configured.claudeLocal.subscriptionEstimate;
    return (
      claudeEstimateEnabled !== configured.enabled ||
      claudeEstimateWindowHours !== String(configured.windowHours) ||
      claudeEstimateUnit !== configured.unit ||
      claudeEstimateCapacity !== String(configured.capacity) ||
      claudeEstimateExtraCapacity !== String(configured.extraCapacity)
    );
  }, [
    claudeEstimateCapacity,
    claudeEstimateEnabled,
    claudeEstimateExtraCapacity,
    claudeEstimateUnit,
    claudeEstimateWindowHours,
    data,
  ]);
  const codexEstimateDirty = useMemo(() => {
    if (!data) return false;
    const configured = data.agentAuth.configured.codexLocal.subscriptionEstimate;
    return (
      codexEstimateEnabled !== configured.enabled ||
      codexEstimateWindowHours !== String(configured.windowHours) ||
      codexEstimateUnit !== configured.unit ||
      codexEstimateCapacity !== String(configured.capacity) ||
      codexEstimateExtraCapacity !== String(configured.extraCapacity)
    );
  }, [
    codexEstimateCapacity,
    codexEstimateEnabled,
    codexEstimateExtraCapacity,
    codexEstimateUnit,
    codexEstimateWindowHours,
    data,
  ]);

  const showOperations = section === "all" || section === "operations";
  const showAgentAuth = section === "all" || section === "agent-auth";
  const showSecrets = section === "all" || section === "secrets";

  return (
    <div className="space-y-6">
      {section === "all" && (
        <div className="space-y-4">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Instance Overview
          </div>
          <InfoBanner
            title="What lives here"
            tone="neutral"
            description="These are global Paperclip settings for this installation: file storage, S3, database backups, scheduler behavior, and runtime file sync. They do not belong to a single company or a single agent."
          />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <MetricTile icon={Server} label="Companies" value={data ? `${data.metrics.activeCompanies}/${data.metrics.totalCompanies}` : isLoading ? "Loading..." : "—"} hint="Active / total" />
            <MetricTile icon={Activity} label="Agents Running" value={data ? `${data.metrics.runningAgents}/${data.metrics.totalAgents}` : isLoading ? "Loading..." : "—"} hint="Running / total" />
            <MetricTile icon={Database} label="Runs 7d" value={data ? String(data.metrics.totalRuns7d) : isLoading ? "Loading..." : "—"} hint="Heartbeat runs" />
            <MetricTile icon={HardDrive} label="Storage" value={data ? data.storage.effective.provider.replace("_", " ") : isLoading ? "Loading..." : "—"} hint="Effective provider" />
            <MetricTile icon={Database} label="Month Spend" value={data ? formatCents(data.metrics.monthSpendCents) : isLoading ? "Loading..." : "—"} hint="Across all companies" />
            <MetricTile icon={Server} label="Deployment" value={data ? data.runtime.deploymentMode : isLoading ? "Loading..." : "—"} hint={data ? data.runtime.deploymentExposure : "Mode"} />
          </div>
          {error && (
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load instance settings"}
            </p>
          )}
        </div>
      )}

      {section !== "all" && error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load instance settings"}
        </p>
      )}

      {showOperations && (
      <Section title="File Storage & S3">
        <InfoBanner
          title="What this controls"
          tone="neutral"
          description="This section controls where Paperclip stores uploaded files, attachments, and other persisted file assets. Use local disk for simple local setups, or S3/S3-compatible storage for shared or remote storage."
        />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            This is global storage for the whole app, not per company and not per agent.
          </span>
          <HintIcon text="You can keep using the host AWS/IAM auth chain, or store static S3 credentials here for this instance. Static credentials apply immediately to future storage operations." />
        </div>
        {data?.storage.envOverrides.any && (
          <EnvOverrideNotice text="Some storage values are pinned by environment variables. Saving here still updates config.json, but the environment keeps winning until those overrides are removed." />
        )}
        <Field label="Storage backend" hint="Choose where new Paperclip files are written from now on.">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={storageProvider === "local_disk" ? "secondary" : "ghost"} onClick={() => setStorageProvider("local_disk")} disabled={data?.storage.envOverrides.provider}>
              Local Disk
            </Button>
            <Button type="button" size="sm" variant={storageProvider === "s3" ? "secondary" : "ghost"} onClick={() => setStorageProvider("s3")} disabled={data?.storage.envOverrides.provider}>
              AWS S3 / S3-compatible
            </Button>
          </div>
        </Field>
        {storageProvider === "local_disk" ? (
          <Field label="Local storage directory" hint="Folder on disk where Paperclip will write files when Local Disk is selected.">
            <input className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none" type="text" value={localDiskBaseDir} onChange={(e) => setLocalDiskBaseDir(e.target.value)} disabled={data?.storage.envOverrides.localDiskBaseDir} />
          </Field>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-3">
              <div className="text-sm font-medium text-foreground">S3 destination</div>
              <div className="mt-1 text-xs text-muted-foreground">
                This is the storage target itself: bucket, region, endpoint, prefix, and URL style.
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Field label="Bucket" hint="Bucket where Paperclip should write files.">
                  <input className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none" type="text" value={s3Bucket} onChange={(e) => setS3Bucket(e.target.value)} disabled={data?.storage.envOverrides.s3Bucket} />
                </Field>
                <Field label="Region" hint="AWS region, or the equivalent region name for your S3-compatible provider.">
                  <input className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none" type="text" value={s3Region} onChange={(e) => setS3Region(e.target.value)} disabled={data?.storage.envOverrides.s3Region} />
                </Field>
                <Field label="Endpoint" hint="Optional custom endpoint for MinIO, R2, Backblaze, and other S3-compatible services.">
                  <input className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none" type="text" value={s3Endpoint} onChange={(e) => setS3Endpoint(e.target.value)} placeholder="https://s3.amazonaws.com" disabled={data?.storage.envOverrides.s3Endpoint} />
                </Field>
                <Field label="Prefix" hint="Optional folder-like prefix inside the bucket, such as paperclip/prod/.">
                  <input className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none" type="text" value={s3Prefix} onChange={(e) => setS3Prefix(e.target.value)} disabled={data?.storage.envOverrides.s3Prefix} />
                </Field>
                <BooleanField label="Force path-style URLs" hint="Turn this on for providers that require path-style bucket URLs instead of bucket-name subdomains." value={s3ForcePathStyle} onToggle={() => setS3ForcePathStyle((value) => !value)} disabled={data?.storage.envOverrides.s3ForcePathStyle} />
              </div>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-3">
              <div className="text-sm font-medium text-foreground">S3 credentials for this instance</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Put the AWS key pair here only if you want Paperclip to store static S3 credentials. If you leave these blank, Paperclip falls back to environment variables, IAM role, or the default AWS auth chain.
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Field label="AWS access key id" hint="Optional static key id for S3. Leave blank to keep the current stored value or rely on env/IAM instead.">
                  <input className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none" type="password" value={s3AccessKeyId} onChange={(e) => setS3AccessKeyId(e.target.value)} placeholder={data?.storage.auth.configured.accessKeyIdPreview ?? "AKIA..."} disabled={data?.storage.envOverrides.s3AccessKeyId} />
                </Field>
                <Field label="AWS secret access key" hint="Optional static secret access key for S3. Leave blank to preserve the stored secret.">
                  <input className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none" type="password" value={s3SecretAccessKey} onChange={(e) => setS3SecretAccessKey(e.target.value)} placeholder={data?.storage.auth.configured.hasSecretAccessKey ? "Stored secret present" : "Not set"} disabled={data?.storage.envOverrides.s3SecretAccessKey} />
                </Field>
                <Field label="AWS session token" hint="Optional session token for temporary AWS credentials.">
                  <input className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none" type="password" value={s3SessionToken} onChange={(e) => setS3SessionToken(e.target.value)} placeholder={data?.storage.auth.configured.hasSessionToken ? "Stored token present" : "Optional"} disabled={data?.storage.envOverrides.s3SessionToken} />
                </Field>
              </div>
            </div>
          </div>
        )}
        <MutedInfo>
          <div>Effective storage backend: <span className="font-medium text-foreground">{data?.storage.effective.provider.replace("_", " ") ?? "—"}</span></div>
          <div>Effective S3 auth source: <span className="font-medium text-foreground">{data?.storage.auth.effective.source.replaceAll("_", " ") ?? "—"}</span></div>
          <div>Config file: <span className="font-mono">{data?.configPath ?? "—"}</span></div>
          <div>New uploads use the updated storage settings immediately. Existing files stay where they were already written.</div>
        </MutedInfo>
        {storageProvider === "s3" &&
          (data?.storage.auth.configured.hasAccessKeyId ||
            data?.storage.auth.configured.hasSecretAccessKey ||
            data?.storage.auth.configured.hasSessionToken) && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => saveSettings.mutate({ storageAuth: { s3: { clear: true } } })}
              disabled={saveSettings.isPending}
            >
              Clear stored AWS keys
            </Button>
            <span className="text-xs text-muted-foreground">After clearing, Paperclip falls back to env vars, IAM role, or the default AWS auth chain.</span>
          </div>
        )}
        <SaveRow
          dirty={storageDirty}
          pending={saveSettings.isPending}
          success={saveSettings.isSuccess}
          error={saveSettings.error}
          label="Save storage settings"
          onSave={() =>
            saveSettings.mutate({
              storage: {
                provider: storageProvider,
                localDisk: { baseDir: localDiskBaseDir.trim() },
                s3: {
                  bucket: s3Bucket.trim(),
                  region: s3Region.trim(),
                  endpoint: s3Endpoint.trim() || undefined,
                  prefix: s3Prefix,
                  forcePathStyle: s3ForcePathStyle,
                },
              },
              ...(storageProvider === "s3" &&
              (s3AccessKeyId.trim() || s3SecretAccessKey.trim() || s3SessionToken.trim())
                ? {
                    storageAuth: {
                      s3: {
                        ...(s3AccessKeyId.trim() ? { accessKeyId: s3AccessKeyId.trim() } : {}),
                        ...(s3SecretAccessKey.trim() ? { secretAccessKey: s3SecretAccessKey.trim() } : {}),
                        ...(s3SessionToken.trim() ? { sessionToken: s3SessionToken.trim() } : {}),
                      },
                    },
                  }
                : {}),
            })
          }
        />
      </Section>
      )}

      {showOperations && (
      <Section title="Database Backups">
        <InfoBanner
          title="What this controls"
          tone="info"
          description="This section only controls backup snapshots of the Paperclip database. It is about recovery and retention, not S3 file storage."
        />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            These settings decide how often Paperclip writes DB backups and how long they are kept.
          </span>
          <HintIcon text="These settings control Paperclip's automatic DB backup loop. They affect the whole installation." />
        </div>
        {data?.database.envOverrides.any && (
          <EnvOverrideNotice text="Some backup values are pinned by environment variables. Saving here updates config.json, but the environment keeps winning until those overrides are removed." />
        )}
        <BooleanField label="Automatic database backups" hint="Turn scheduled DB snapshot backups on or off for the whole Paperclip instance." value={backupEnabled} onToggle={() => setBackupEnabled((value) => !value)} disabled={data?.database.envOverrides.enabled} />
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Backup interval (minutes)" hint="How often Paperclip should write a new database backup.">
            <input className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none" type="number" min={1} value={backupIntervalMinutes} onChange={(e) => setBackupIntervalMinutes(e.target.value)} disabled={data?.database.envOverrides.intervalMinutes} />
          </Field>
          <Field label="Retention (days)" hint="How long old database backups are kept before automatic pruning.">
            <input className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none" type="number" min={1} value={backupRetentionDays} onChange={(e) => setBackupRetentionDays(e.target.value)} disabled={data?.database.envOverrides.retentionDays} />
          </Field>
          <Field label="Backup directory" hint="Folder on disk where Paperclip writes backup files.">
            <input className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none" type="text" value={backupDir} onChange={(e) => setBackupDir(e.target.value)} disabled={data?.database.envOverrides.dir} />
          </Field>
        </div>
        <MutedInfo>
          <div>Effective backup state: <span className="font-medium text-foreground">{data?.database.effectiveBackup.enabled ? "enabled" : "disabled"}</span></div>
          <div>Effective interval: <span className="font-medium text-foreground">{data?.database.effectiveBackup.intervalMinutes ?? "—"}m</span></div>
          <div>Effective retention: <span className="font-medium text-foreground">{data?.database.effectiveBackup.retentionDays ?? "—"}d</span></div>
        </MutedInfo>
        <SaveRow
          dirty={backupDirty}
          pending={saveSettings.isPending}
          success={saveSettings.isSuccess}
          error={saveSettings.error}
          label="Save backup settings"
          onSave={() =>
            saveSettings.mutate({
              databaseBackup: {
                enabled: backupEnabled,
                intervalMinutes: coercePositiveInt(backupIntervalMinutes, 60),
                retentionDays: coercePositiveInt(backupRetentionDays, 30),
                dir: backupDir.trim(),
              },
            })
          }
        />
      </Section>
      )}

      {showOperations && (
      <Section title="Scheduler & Runtime Files">
        <InfoBanner
          title="What this controls"
          tone="neutral"
          description="This section controls the server loop that wakes agents, plus syncing of agent runtime files. It is operational behavior for the whole instance."
        />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            Use this section for agent wake-up timing and runtime file sync, not for API keys or S3 credentials.
          </span>
          <HintIcon text="These settings affect how the instance wakes agents and syncs runtime files." />
        </div>
        {data?.runtime.envOverrides.any && (
          <EnvOverrideNotice text="Some runtime values are pinned by environment variables. Saving here updates config.json, but the environment keeps winning until those overrides are removed." />
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <BooleanField label="Heartbeat scheduler" hint="Turn the server-side scheduler on or off. This loop is what wakes agents on their configured intervals." value={heartbeatSchedulerEnabled} onToggle={() => setHeartbeatSchedulerEnabled((value) => !value)} disabled={data?.runtime.envOverrides.heartbeatSchedulerEnabled} />
          <Field label="Scheduler interval (ms)" hint="How often the Paperclip scheduler checks for work to dispatch.">
            <input className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none" type="number" min={10000} step={1000} value={heartbeatSchedulerIntervalMs} onChange={(e) => setHeartbeatSchedulerIntervalMs(e.target.value)} disabled={data?.runtime.envOverrides.heartbeatSchedulerIntervalMs} />
          </Field>
          <BooleanField label="Runtime file sync" hint="Turn periodic sync of agent runtime files on or off." value={agentRuntimeSyncEnabled} onToggle={() => setAgentRuntimeSyncEnabled((value) => !value)} disabled={data?.runtime.envOverrides.agentRuntimeSyncEnabled} />
          <Field label="Runtime sync interval (ms)" hint="How often Paperclip syncs agent runtime files.">
            <input className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none" type="number" min={60000} step={1000} value={agentRuntimeSyncIntervalMs} onChange={(e) => setAgentRuntimeSyncIntervalMs(e.target.value)} disabled={data?.runtime.envOverrides.agentRuntimeSyncIntervalMs} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Agent runtime directory" hint="Base folder on disk where Paperclip keeps agent runtime homes and working state.">
              <input className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none" type="text" value={agentRuntimeDir} onChange={(e) => setAgentRuntimeDir(e.target.value)} disabled={data?.runtime.envOverrides.agentRuntimeDir} />
            </Field>
          </div>
        </div>
        <MutedInfo>
          <div>Effective scheduler: <span className="font-medium text-foreground">{formatBoolInterval(data?.runtime.heartbeatSchedulerEnabled ?? false, data?.runtime.heartbeatSchedulerIntervalMs ?? 0)}</span></div>
          <div>Effective runtime sync: <span className="font-medium text-foreground">{formatBoolInterval(data?.runtime.agentRuntimeSyncEnabled ?? false, data?.runtime.agentRuntimeSyncIntervalMs ?? 0)}</span></div>
          <div>Effective runtime dir: <span className="font-mono text-foreground">{data?.runtime.agentRuntimeDir ?? "—"}</span></div>
        </MutedInfo>
        <SaveRow
          dirty={runtimeDirty}
          pending={saveSettings.isPending}
          success={saveSettings.isSuccess}
          error={saveSettings.error}
          label="Save runtime settings"
          onSave={() =>
            saveSettings.mutate({
              runtime: {
                heartbeatScheduler: {
                  enabled: heartbeatSchedulerEnabled,
                  intervalMs: coercePositiveInt(heartbeatSchedulerIntervalMs, 30000),
                },
                agentRuntime: {
                  dir: agentRuntimeDir.trim(),
                  syncEnabled: agentRuntimeSyncEnabled,
                  syncIntervalMs: coercePositiveInt(agentRuntimeSyncIntervalMs, 300000),
                },
              },
            })
          }
        />
      </Section>
      )}

      {showAgentAuth && (
      <Section title="Provider Keys & New Agent Defaults">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(89,126,255,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.08),transparent_28%),linear-gradient(180deg,rgba(12,13,18,0.98),rgba(5,6,10,0.98))] px-5 py-5 shadow-[0_18px_60px_rgba(0,0,0,0.32)] sm:px-6 lg:px-7">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-4xl space-y-2.5">
                <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Provider Keys & Auth
                </div>
                <div className="space-y-1.5">
                  <div className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                    Default auth mode for new local agents
                  </div>
                  <p className="max-w-3xl text-[12px] leading-5 text-slate-300">
                    Set shared provider keys, choose the default auth path for new Claude and Codex agents, and keep shared subscription readiness visible at a glance.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[620px]">
                <ToplineMetric
                  label="Scope"
                  value="Instance-wide"
                  hint="Applies to new local agents"
                />
                <ToplineMetric
                  label="Claude default"
                  value={claudeUseApiKey ? "API key" : "Local login"}
                  hint="Saved to instance config"
                />
                <ToplineMetric
                  label="Codex default"
                  value={codexUseApiKey ? "API key" : "Subscription"}
                  hint="Shared session when available"
                />
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <AuthDefaultProviderCard
                providerName="Claude"
                providerBadge="Anthropic"
                useApiKey={claudeUseApiKey}
                onSelectMode={(mode) => setClaudeUseApiKey(mode === "api")}
                apiDescription="Store an Anthropic key for Paperclip-managed auth."
                localDescription="Reuse the shared Claude subscription session."
              />
              <AuthDefaultProviderCard
                providerName="Codex"
                providerBadge="OpenAI"
                useApiKey={codexUseApiKey}
                onSelectMode={(mode) => setCodexUseApiKey(mode === "api")}
                apiDescription="Store an OpenAI key for Paperclip-managed auth."
                localDescription="Reuse the shared Codex subscription session."
              />
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <div className="rounded-[22px] border border-white/10 bg-black/30 px-4 py-3 text-[10px] leading-4 text-slate-400">
                API key mode uses Paperclip-managed credentials. Local login and subscription mode keep the CLI logged in inside the Paperclip runtime. In Docker, that session lives in the Paperclip container.
              </div>
              <SaveRow
                dirty={agentAuthDefaultsDirty}
                pending={saveSettings.isPending}
                success={saveSettings.isSuccess}
                error={saveSettings.error}
                label="Save new-agent defaults"
                onSave={() =>
                  saveSettings.mutate({
                    agentAuth: {
                      claudeLocal: {
                        useApiKey: claudeUseApiKey,
                      },
                      codexLocal: {
                        useApiKey: codexUseApiKey,
                      },
                    },
                  })
                }
              />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <ProviderControlSurface
              provider="claude"
              title="Claude Code"
              vendor="Anthropic"
              state={claudeProviderSurfaceState(
                claudeSubscriptionAuth.data,
                testClaudeApiKey.data,
                testClaudeSubscription.data,
                testClaudeApiKey.error,
                testClaudeSubscription.error,
                startClaudeSubscriptionAuth.error,
                claudeSubscriptionAuth.error,
              )}
              summary={claudeProviderSurfaceSummary(
                claudeSubscriptionAuth.data,
                testClaudeApiKey.data,
                testClaudeSubscription.data,
                testClaudeApiKey.error,
                testClaudeSubscription.error,
                startClaudeSubscriptionAuth.error,
                claudeSubscriptionAuth.error,
              )}
              keyLabel="Instance API key"
              keyHint="Store an Anthropic key for Paperclip-managed auth."
              keyValue={claudeApiKey}
              onKeyChange={setClaudeApiKey}
              keyPlaceholder={data?.agentAuth.configured.claudeLocal.apiKeyPreview ?? "No stored key"}
              hasStoredKey={Boolean(data?.agentAuth.configured.claudeLocal.hasApiKey)}
              onSaveKey={() =>
                saveSettings.mutate({
                  agentAuth: {
                    claudeLocal: {
                      useApiKey: claudeUseApiKey,
                      apiKey: claudeApiKey.trim(),
                    },
                  },
                })
              }
              onClearKey={
                data?.agentAuth.configured.claudeLocal.hasApiKey
                  ? () =>
                      saveSettings.mutate({
                        agentAuth: {
                          claudeLocal: {
                            useApiKey: claudeUseApiKey,
                            clearApiKey: true,
                          },
                        },
                      })
                  : undefined
              }
              saveDisabled={!claudeKeyDirty || saveSettings.isPending}
              keyActions={
                <Button
                  type="button"
                  size="sm"
                  className={COMPACT_BUTTON_CLASS}
                  variant="outline"
                  onClick={() => testClaudeApiKey.mutate()}
                  disabled={testClaudeApiKey.isPending}
                >
                  {testClaudeApiKey.isPending ? "Testing..." : "Test API key"}
                </Button>
              }
              keyMeta={[
                { label: "Saved preview", value: data?.agentAuth.configured.claudeLocal.apiKeyPreview ?? "No stored key" },
                { label: "Default mode", value: claudeUseApiKey ? "Instance API key" : "Local login / subscription" },
              ]}
              keySupplementaryContent={
                <ClaudeApiProbeCard
                  result={testClaudeApiKey.data}
                  error={testClaudeApiKey.error}
                />
              }
              loginTitle="Local login / subscription"
              loginSummary="Shared session reused by subscription-mode agents."
              loginCard={buildClaudeHandshakeCard(
                claudeSubscriptionAuth.data,
                testClaudeSubscription.data,
                testClaudeSubscription.error,
                startClaudeSubscriptionAuth.error,
                claudeSubscriptionAuth.error,
              )}
              onStartLogin={() => startClaudeSubscriptionAuth.mutate()}
              loginDisabled={startClaudeSubscriptionAuth.isPending || claudeSubscriptionAuth.data?.session.state === "pending"}
              loginContent={
                <ClaudeSubscriptionActions
                  auth={claudeSubscriptionAuth.data}
                  isLoading={claudeSubscriptionAuth.isLoading}
                  error={claudeSubscriptionAuth.error}
                  isStarting={startClaudeSubscriptionAuth.isPending}
                  startError={startClaudeSubscriptionAuth.error}
                  onStart={() => startClaudeSubscriptionAuth.mutate()}
                  onRefresh={() =>
                    queryClient.invalidateQueries({ queryKey: queryKeys.instance.claudeSubscriptionAuth })
                  }
                  testSubscriptionResult={testClaudeSubscription.data}
                  testSubscriptionError={testClaudeSubscription.error}
                  onTestSubscription={() => testClaudeSubscription.mutate()}
                  isTestingSubscription={testClaudeSubscription.isPending}
                />
              }
              loginMeta={buildClaudeLoginMeta(claudeSubscriptionAuth.data, claudeUseApiKey)}
              secondaryContent={
                <SubscriptionUsageEstimateCard
                  providerLabel="Claude subscription"
                  providerNote="Estimate Claude local subscription pressure in a rolling window."
                  status={data?.agentAuth.usage.claudeLocal}
                  enabled={claudeEstimateEnabled}
                  onEnabledChange={setClaudeEstimateEnabled}
                  windowHours={claudeEstimateWindowHours}
                  onWindowHoursChange={setClaudeEstimateWindowHours}
                  unit={claudeEstimateUnit}
                  onUnitChange={setClaudeEstimateUnit}
                  capacity={claudeEstimateCapacity}
                  onCapacityChange={setClaudeEstimateCapacity}
                  extraCapacity={claudeEstimateExtraCapacity}
                  onExtraCapacityChange={setClaudeEstimateExtraCapacity}
                  extraCapacityLabel="Extra headroom"
                  dirty={claudeEstimateDirty}
                  isSaving={saveSettings.isPending}
                  onSave={() =>
                    saveSettings.mutate({
                      agentAuth: {
                        claudeLocal: {
                          useApiKey: claudeUseApiKey,
                          subscriptionEstimate: {
                            enabled: claudeEstimateEnabled,
                            windowHours: coercePositiveInt(claudeEstimateWindowHours, 5),
                            unit: claudeEstimateUnit,
                            capacity: coercePositiveInt(claudeEstimateCapacity, 100),
                            extraCapacity: coerceNonNegativeInt(claudeEstimateExtraCapacity, 0),
                          },
                        },
                      },
                    })
                  }
                />
              }
            />

            <ProviderControlSurface
              provider="codex"
              title="Codex"
              vendor="OpenAI"
              state={codexProviderSurfaceState(
                codexSubscriptionAuth.data,
                testCodexApiKey.data,
                testCodexSubscription.data,
                testCodexApiKey.error,
                testCodexSubscription.error,
                startCodexSubscriptionAuth.error,
                codexSubscriptionAuth.error,
              )}
              summary={codexProviderSurfaceSummary(
                codexSubscriptionAuth.data,
                testCodexApiKey.data,
                testCodexSubscription.data,
                testCodexApiKey.error,
                testCodexSubscription.error,
                startCodexSubscriptionAuth.error,
                codexSubscriptionAuth.error,
              )}
              keyLabel="Instance API key"
              keyHint="Store an OpenAI key for Paperclip-managed auth."
              keyValue={codexApiKey}
              onKeyChange={setCodexApiKey}
              keyPlaceholder={data?.agentAuth.configured.codexLocal.apiKeyPreview ?? "No stored key"}
              hasStoredKey={Boolean(data?.agentAuth.configured.codexLocal.hasApiKey)}
              onSaveKey={() =>
                saveSettings.mutate({
                  agentAuth: {
                    codexLocal: {
                      useApiKey: codexUseApiKey,
                      apiKey: codexApiKey.trim(),
                    },
                  },
                })
              }
              onClearKey={
                data?.agentAuth.configured.codexLocal.hasApiKey
                  ? () =>
                      saveSettings.mutate({
                        agentAuth: {
                          codexLocal: {
                            useApiKey: codexUseApiKey,
                            clearApiKey: true,
                          },
                        },
                      })
                  : undefined
              }
              saveDisabled={!codexKeyDirty || saveSettings.isPending}
              keyActions={
                <Button
                  type="button"
                  size="sm"
                  className={COMPACT_BUTTON_CLASS}
                  variant="outline"
                  onClick={() => testCodexApiKey.mutate()}
                  disabled={testCodexApiKey.isPending}
                >
                  {testCodexApiKey.isPending ? "Testing..." : "Test API key"}
                </Button>
              }
              keyMeta={[
                { label: "Saved preview", value: data?.agentAuth.configured.codexLocal.apiKeyPreview ?? "No stored key" },
                { label: "Default mode", value: codexUseApiKey ? "Instance API key" : "Local login / subscription" },
              ]}
              keySupplementaryContent={
                <CodexApiProbeCard
                  result={testCodexApiKey.data}
                  error={testCodexApiKey.error}
                />
              }
              loginTitle="Local login / subscription"
              loginSummary="Shared session reused by subscription-mode agents."
              loginCard={buildCodexHandshakeCard(
                codexSubscriptionAuth.data,
                testCodexSubscription.data,
                testCodexSubscription.error,
                startCodexSubscriptionAuth.error,
                codexSubscriptionAuth.error,
              )}
              onStartLogin={() => startCodexSubscriptionAuth.mutate()}
              loginDisabled={startCodexSubscriptionAuth.isPending || codexSubscriptionAuth.data?.session.state === "pending"}
              loginContent={
                <CodexSubscriptionActions
                  auth={codexSubscriptionAuth.data}
                  isLoading={codexSubscriptionAuth.isLoading}
                  error={codexSubscriptionAuth.error}
                  isStarting={startCodexSubscriptionAuth.isPending}
                  startError={startCodexSubscriptionAuth.error}
                  onStart={() => startCodexSubscriptionAuth.mutate()}
                  onRefresh={() =>
                    queryClient.invalidateQueries({ queryKey: queryKeys.instance.codexSubscriptionAuth })
                  }
                  testSubscriptionResult={testCodexSubscription.data}
                  testSubscriptionError={testCodexSubscription.error}
                  onTestSubscription={() => testCodexSubscription.mutate()}
                  isTestingSubscription={testCodexSubscription.isPending}
                />
              }
              loginMeta={buildCodexLoginMeta(codexSubscriptionAuth.data, codexUseApiKey)}
              secondaryContent={
                <SubscriptionUsageEstimateCard
                  providerLabel="Codex subscription"
                  providerNote="Estimate Codex local subscription pressure in a rolling window."
                  status={data?.agentAuth.usage.codexLocal}
                  enabled={codexEstimateEnabled}
                  onEnabledChange={setCodexEstimateEnabled}
                  windowHours={codexEstimateWindowHours}
                  onWindowHoursChange={setCodexEstimateWindowHours}
                  unit={codexEstimateUnit}
                  onUnitChange={setCodexEstimateUnit}
                  capacity={codexEstimateCapacity}
                  onCapacityChange={setCodexEstimateCapacity}
                  extraCapacity={codexEstimateExtraCapacity}
                  onExtraCapacityChange={setCodexEstimateExtraCapacity}
                  extraCapacityLabel="Extension credits / extra capacity"
                  dirty={codexEstimateDirty}
                  isSaving={saveSettings.isPending}
                  onSave={() =>
                    saveSettings.mutate({
                      agentAuth: {
                        codexLocal: {
                          useApiKey: codexUseApiKey,
                          subscriptionEstimate: {
                            enabled: codexEstimateEnabled,
                            windowHours: coercePositiveInt(codexEstimateWindowHours, 5),
                            unit: codexEstimateUnit,
                            capacity: coercePositiveInt(codexEstimateCapacity, 100),
                            extraCapacity: coerceNonNegativeInt(codexEstimateExtraCapacity, 0),
                          },
                        },
                      },
                    })
                  }
                />
              }
            />
          </div>
        </div>
      </Section>
      )}

      {showSecrets && (
      <Section title="Secrets Backend">
        <InfoBanner
          title="What this controls"
          tone="neutral"
          description="This section controls Paperclip's own secret-storage system: where the app stores encrypted secret material and whether sensitive values should be referenced as secrets instead of pasted inline. It is separate from S3 destination settings and separate from Claude/Codex auth mode."
        />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            Configure how Paperclip stores encrypted secrets for this installation.
          </span>
          <HintIcon text="Changing the secrets provider affects how new secret material is created and resolved. External providers still require host-side setup." />
        </div>
        {data?.secrets.envOverrides.any && (
          <EnvOverrideNotice text="Some secrets settings are overridden by environment variables. Saving here updates config.json, but env overrides still win." />
        )}
        <Field label="Provider" hint="Default backend Paperclip should use when it stores new secret values.">
          <select
            className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
            value={secretsProvider}
            onChange={(e) => setSecretsProvider(e.target.value as (typeof SECRET_PROVIDERS)[number])}
            disabled={data?.secrets.envOverrides.provider}
          >
            {SECRET_PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>
                {provider.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        <BooleanField label="Strict mode" hint="Prefer secret references for sensitive values instead of inline plaintext env vars." value={secretsStrictMode} onToggle={() => setSecretsStrictMode((value) => !value)} disabled={data?.secrets.envOverrides.strictMode} />
        <Field label="Local encrypted key file" hint="Master key file used when the local encrypted provider is active.">
          <input className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none" type="text" value={secretsKeyFilePath} onChange={(e) => setSecretsKeyFilePath(e.target.value)} disabled={data?.secrets.envOverrides.localEncryptedKeyFilePath} />
        </Field>
        <MutedInfo>
          <div>Effective provider: <span className="font-medium text-foreground">{data?.secrets.effective.provider.replaceAll("_", " ") ?? "—"}</span></div>
          <div>Effective strict mode: <span className="font-medium text-foreground">{data?.secrets.effective.strictMode ? "enabled" : "disabled"}</span></div>
          <div>Effective key file: <span className="font-mono text-foreground">{data?.secrets.effective.masterKeyFilePath ?? "—"}</span></div>
        </MutedInfo>
        <SaveRow
          dirty={secretsDirty}
          pending={saveSettings.isPending}
          success={saveSettings.isSuccess}
          error={saveSettings.error}
          label="Save secrets settings"
          onSave={() =>
            saveSettings.mutate({
              secrets: {
                provider: secretsProvider,
                strictMode: secretsStrictMode,
                localEncrypted: {
                  keyFilePath: secretsKeyFilePath.trim(),
                },
              },
            })
          }
        />
      </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.16em]">{title}</div>
      <div className="space-y-3 rounded-md border border-border px-4 py-4">{children}</div>
    </div>
  );
}

function InfoBanner({
  title,
  description,
  tone = "neutral",
}: {
  title: string;
  description: string;
  tone?: "neutral" | "info";
}) {
  const className =
    tone === "info"
      ? "rounded-md border border-sky-300 bg-sky-50 px-3 py-3 text-[12px] text-sky-950 dark:border-sky-500/25 dark:bg-sky-950/40 dark:text-sky-100"
      : "rounded-md border border-border bg-muted/20 px-3 py-3 text-[12px] text-muted-foreground";
  return (
    <div className={className}>
      <div className="font-medium text-[12px] text-foreground">{title}</div>
      <div className="mt-1">{description}</div>
    </div>
  );
}

function EnvOverrideNotice({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[10px] text-amber-900 dark:border-amber-500/25 dark:bg-amber-950/50 dark:text-amber-100">
      {text}
    </div>
  );
}

function MutedInfo({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-1 rounded-md border border-border/70 bg-muted/20 px-3 py-3 text-[10px] text-muted-foreground">
      {children}
    </div>
  );
}

function BooleanField({
  label,
  hint,
  value,
  onToggle,
  disabled,
}: {
  label: string;
  hint: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-md border border-border px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">{label}</span>
          <HintIcon text={hint} />
        </div>
        <Button type="button" size="sm" className={COMPACT_BUTTON_CLASS} variant={value ? "secondary" : "ghost"} onClick={onToggle} disabled={disabled}>
          {value ? "Enabled" : "Disabled"}
        </Button>
      </div>
    </div>
  );
}

type SurfaceTone = "success" | "failure" | "idle";

type DetailItem = {
  label: string;
  value: string;
};

type HandshakeCardState = {
  state: SurfaceTone;
  label: string;
  title: string;
  line: string;
  actionLabel?: string;
};

const COMPACT_BUTTON_CLASS =
  "h-7 gap-1 px-2.5 text-[11px] font-medium [&_svg:not([class*='size-'])]:size-3.5";
const SHARED_LOGIN_LABEL = "Local login / subscription";

function ToplineMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-black/30 px-4 py-3">
      <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1.5 text-[12px] font-semibold text-white">{value}</div>
      <div className="mt-1 text-[10px] text-slate-400">{hint}</div>
    </div>
  );
}

function AuthDefaultProviderCard({
  providerName,
  providerBadge,
  useApiKey,
  onSelectMode,
  apiDescription,
  localDescription,
}: {
  providerName: string;
  providerBadge: string;
  useApiKey: boolean;
  onSelectMode: (mode: "api" | "local") => void;
  apiDescription: string;
  localDescription: string;
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.38))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Default mode for new {providerName} agents
          </div>
          <div className="mt-1.5 text-sm font-semibold text-white">{providerName}</div>
        </div>
        <StatusPill tone="idle" icon={<Sparkles className="h-3.5 w-3.5" />} label={providerBadge} />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <ModeChoiceCard
          active={useApiKey}
          icon={<KeyRound className="h-4 w-4" />}
          title="Instance API key"
          description={apiDescription}
          onClick={() => onSelectMode("api")}
        />
        <ModeChoiceCard
          active={!useApiKey}
          icon={<Link2 className="h-4 w-4" />}
          title={SHARED_LOGIN_LABEL}
          description={localDescription}
          onClick={() => onSelectMode("local")}
        />
      </div>
    </div>
  );
}

function ModeChoiceCard({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[22px] border px-4 py-3.5 text-left transition-all duration-150",
        active
          ? "border-white/18 bg-[linear-gradient(180deg,rgba(120,142,176,0.16),rgba(0,0,0,0.62))] shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
          : "border-white/10 bg-black/25 hover:border-white/20 hover:bg-black/35",
      )}
    >
      <div className="flex h-full items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 rounded-full border p-1.5",
              active ? "border-white/15 bg-white/8 text-slate-200" : "border-white/10 bg-white/5 text-slate-400",
            )}
          >
            {icon}
          </div>
          <div>
            <div className="text-[12px] font-semibold text-white">{title}</div>
            <div className="mt-1 text-[10px] leading-4 text-slate-400">{description}</div>
          </div>
        </div>
        <StatusPill
          tone="idle"
          icon={active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
          label={active ? "Selected" : "Available"}
        />
      </div>
    </button>
  );
}

function ProviderControlSurface({
  provider,
  title,
  vendor,
  state,
  summary,
  keyLabel,
  keyHint,
  keyValue,
  onKeyChange,
  keyPlaceholder,
  hasStoredKey,
  onSaveKey,
  onClearKey,
  saveDisabled,
  keyMeta,
  keyActions,
  keySupplementaryContent,
  loginTitle,
  loginSummary,
  loginCard,
  onStartLogin,
  loginDisabled,
  loginContent,
  loginMeta,
  secondaryContent,
}: {
  provider: "claude" | "codex";
  title: string;
  vendor: string;
  state: SurfaceTone;
  summary: string;
  keyLabel: string;
  keyHint: string;
  keyValue: string;
  onKeyChange: (value: string) => void;
  keyPlaceholder: string;
  hasStoredKey: boolean;
  onSaveKey: () => void;
  onClearKey?: () => void;
  saveDisabled: boolean;
  keyMeta: DetailItem[];
  keyActions?: React.ReactNode;
  keySupplementaryContent?: React.ReactNode;
  loginTitle: string;
  loginSummary: string;
  loginCard: HandshakeCardState;
  onStartLogin?: () => void;
  loginDisabled?: boolean;
  loginContent?: React.ReactNode;
  loginMeta: DetailItem[];
  secondaryContent?: React.ReactNode;
}) {
  return (
    <div className={cn("overflow-hidden rounded-[30px] border p-4 shadow-[0_24px_70px_rgba(0,0,0,0.3)] sm:p-5", surfaceToneClass(state))}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <ProviderGlyph provider={provider} tone={state} />
              <div>
                <div className="text-base font-semibold tracking-tight text-white">{title}</div>
                <div className="text-[11px] leading-5 text-slate-300">{summary}</div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={state} icon={surfaceToneIcon(state)} label={surfaceToneLabel(state)} />
            <StatusPill tone="idle" icon={<Sparkles className="h-3.5 w-3.5" />} label={vendor} />
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[26px] border border-white/10 bg-black/28 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[12px] font-semibold text-white">{keyLabel}</div>
                <div className="mt-1 text-[10px] leading-4 text-slate-400">{keyHint}</div>
              </div>
              <StoredStatePill stored={hasStoredKey} />
            </div>

            {keySupplementaryContent ? (
              <div className="mt-4">
                {keySupplementaryContent}
              </div>
            ) : null}

            <DetailGrid
              items={keyMeta}
              monospaceWhen={(item) => item.label.toLowerCase().includes("preview")}
            />

            <div className="mt-4 grid gap-3">
              <div>
                <label className="mb-2 block text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Paste new key
                </label>
                <input
                  className="w-full rounded-[18px] border border-white/10 bg-black/45 px-3 py-2.5 text-[12px] font-mono text-white outline-none transition focus:border-white/20"
                  type="password"
                  value={keyValue}
                  onChange={(e) => onKeyChange(e.target.value)}
                  placeholder={keyPlaceholder}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" className={COMPACT_BUTTON_CLASS} onClick={onSaveKey} disabled={saveDisabled}>
                  Save key
                </Button>
                {keyActions}
                {onClearKey && hasStoredKey && (
                  <Button type="button" size="sm" className={COMPACT_BUTTON_CLASS} variant="outline" onClick={onClearKey}>
                    Clear key
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-black/26 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[12px] font-semibold text-white">{loginTitle}</div>
                <div className="mt-1 text-[10px] leading-4 text-slate-400">{loginSummary}</div>
              </div>
              <SharedLoginPill />
            </div>

            <div className="mt-4">
              <HandshakeStatusCard card={loginCard} onClick={onStartLogin} disabled={loginDisabled} />
            </div>

            {loginContent ? (
              <div className="mt-4">
                {loginContent}
              </div>
            ) : null}

            <DetailGrid
              items={loginMeta}
              monospaceWhen={(item) =>
                item.value.includes("/") || item.value.includes("~/.") || item.value.includes(".paperclip") || item.value.includes("—")
              }
            />
          </div>
        </div>

        {secondaryContent ? (
          <div className="border-t border-white/8 pt-4">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Lower-emphasis tracking
                </div>
                <div className="mt-1.5 text-[12px] font-semibold text-white">Estimated usage</div>
                <div className="mt-1 text-[10px] leading-4 text-slate-400">
                  Directional subscription capacity planning for this provider.
                </div>
              </div>
            </div>
            <div className="rounded-[20px] bg-black/12 p-3.5">
              {secondaryContent}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function HandshakeStatusCard({
  card,
  onClick,
  disabled = false,
}: {
  card: HandshakeCardState;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const clickable = Boolean(onClick) && !disabled;
  const content = (
    <div
      className={cn(
        "rounded-[22px] border p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-150",
        handshakeCardClass(card.state),
        clickable && "hover:brightness-105",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {card.state === "idle" ? null : (
            <div className={cn("mt-0.5 rounded-full border p-1.5", handshakeIconClass(card.state))}>
              {surfaceToneIcon(card.state)}
            </div>
          )}
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">{card.label}</div>
            <div className="mt-1.5 text-[12px] font-semibold text-white">{card.title}</div>
            <div className="mt-1 text-[10px] leading-4 text-slate-300">{card.line}</div>
            {card.actionLabel ? (
              <div className="mt-2 text-[9px] font-medium uppercase tracking-[0.16em] text-slate-400">
                {card.actionLabel}
              </div>
            ) : null}
          </div>
        </div>
        <StatusPill
          tone={card.state}
          icon={card.state === "idle" ? undefined : surfaceToneIcon(card.state)}
          label={card.state === "success" ? "Healthy" : card.state === "failure" ? "Failed" : "Idle"}
        />
      </div>
    </div>
  );

  if (!onClick) return content;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "block w-full text-left",
        disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
      )}
    >
      {content}
    </button>
  );
}

function DetailGrid({
  items,
  monospaceWhen,
}: {
  items: DetailItem[];
  monospaceWhen?: (item: DetailItem) => boolean;
}) {
  return (
    <div className="mt-4 grid gap-x-4 gap-y-2 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
      {items.map((item) => {
        const monospace = monospaceWhen?.(item) ?? false;
        return (
          <div key={item.label} className="min-w-0 border-b border-white/8 pb-2 last:border-b-0 sm:border-b-0 sm:pb-0">
            <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</div>
            <div
              className={cn(
                "mt-1.5 min-w-0 text-[11px] text-white",
                monospace ? "break-all font-mono text-[10px]" : "break-words font-medium",
              )}
            >
              {item.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ClaudeApiProbeCard({
  result,
  error,
}: {
  result: InstanceClaudeConnectionProbeResult | undefined;
  error: unknown;
}) {
  const errorMessage =
    error instanceof Error ? error.message : error ? "Failed to run the API key probe" : null;

  return (
    <RuntimeSignalCard
      title="Claude API key probe"
      tone={probeTone(result, errorMessage)}
      summary={probeSummary(result, errorMessage, 'Run "Test API key" after saving a key.')}
      meta={[
        result?.checkedAt ? `Checked: ${formatIso(result.checkedAt)}` : null,
        result?.command ? `Command: ${result.command}` : null,
      ]}
      consoleLabel="Anthropic console"
      stdout={cleanConsoleText(result?.stdout ?? "")}
      stderr={cleanConsoleText(result?.stderr ?? "")}
      detail={result?.detail ?? errorMessage}
    />
  );
}

function ClaudeSubscriptionActions({
  auth,
  isLoading,
  error,
  isStarting,
  startError,
  onStart,
  onRefresh,
  onTestSubscription,
  isTestingSubscription,
  testSubscriptionResult,
  testSubscriptionError,
}: {
  auth: InstanceClaudeSubscriptionAuthResponse | undefined;
  isLoading: boolean;
  error: unknown;
  isStarting: boolean;
  startError: unknown;
  onStart: () => void;
  onRefresh: () => void;
  onTestSubscription: () => void;
  isTestingSubscription: boolean;
  testSubscriptionResult: InstanceClaudeConnectionProbeResult | undefined;
  testSubscriptionError: unknown;
}) {
  const status = auth?.loginStatus;
  const session = auth?.session;
  const startErrorMessage =
    startError instanceof Error ? startError.message : startError ? "Failed to start Claude login" : null;
  const loadErrorMessage =
    error instanceof Error ? error.message : error ? "Failed to load Claude login status" : null;
  const testSubscriptionErrorMessage =
    testSubscriptionError instanceof Error
      ? testSubscriptionError.message
      : testSubscriptionError
        ? "Failed to run the subscription probe"
        : null;

  const consoleStdout = cleanConsoleText(session?.stdout ?? "");
  const consoleStderr = cleanConsoleText(session?.stderr ?? "");

  return (
    <div className="space-y-4">
      {session?.loginUrl && (
        <div className="rounded-[22px] border border-sky-400/25 bg-sky-500/10 px-3.5 py-3 text-[10px] text-sky-100">
          Browser URL:
          <a
            href={session.loginUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-1 break-all underline underline-offset-2"
          >
            {session.loginUrl}
          </a>
        </div>
      )}

      <RuntimeSignalCard
        title="Claude subscription probe"
        tone={probeTone(testSubscriptionResult, testSubscriptionErrorMessage)}
        summary={probeSummary(testSubscriptionResult, testSubscriptionErrorMessage, 'Run "Test subscription" after the shared login is ready.')}
        meta={[
          status?.sharedConfigDir ? `Shared config dir: ${status.sharedConfigDir}` : auth?.sharedConfigDir ? `Shared config dir: ${auth.sharedConfigDir}` : null,
          testSubscriptionResult?.checkedAt ? `Checked: ${formatIso(testSubscriptionResult.checkedAt)}` : null,
        ]}
        consoleLabel="Claude runtime console"
        stdout={cleanConsoleText(testSubscriptionResult?.stdout ?? consoleStdout)}
        stderr={cleanConsoleText(testSubscriptionResult?.stderr ?? consoleStderr)}
        detail={testSubscriptionResult?.detail ?? testSubscriptionErrorMessage ?? loadErrorMessage ?? startErrorMessage}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" className={COMPACT_BUTTON_CLASS} onClick={onStart} disabled={isStarting || session?.state === "pending"}>
          {isStarting
            ? "Starting login..."
            : session?.state === "pending"
              ? "Waiting for browser confirmation..."
              : "Connect Claude subscription"}
        </Button>
        <Button type="button" size="sm" className={COMPACT_BUTTON_CLASS} variant="outline" onClick={onTestSubscription} disabled={isTestingSubscription}>
          {isTestingSubscription ? "Testing..." : "Test subscription"}
        </Button>
        <Button type="button" size="sm" className={COMPACT_BUTTON_CLASS} variant="outline" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className="h-4 w-4" />
          Refresh status
        </Button>
      </div>

      {(loadErrorMessage || startErrorMessage) && (
        <div className="rounded-[20px] border border-red-400/25 bg-red-500/10 px-3.5 py-3 text-[10px] text-red-100">
          {loadErrorMessage ?? startErrorMessage}
        </div>
      )}
    </div>
  );
}

function CodexApiProbeCard({
  result,
  error,
}: {
  result: InstanceCodexConnectionProbeResult | undefined;
  error: unknown;
}) {
  const errorMessage =
    error instanceof Error ? error.message : error ? "Failed to run the API key probe" : null;

  return (
    <RuntimeSignalCard
      title="OpenAI API key probe"
      tone={probeTone(result, errorMessage)}
      summary={probeSummary(result, errorMessage, 'Run "Test API key" after saving a key.')}
      meta={[
        result?.checkedAt ? `Checked: ${formatIso(result.checkedAt)}` : null,
        result?.command ? `Command: ${result.command}` : null,
      ]}
      consoleLabel="OpenAI console"
      stdout={cleanConsoleText(result?.stdout ?? "")}
      stderr={cleanConsoleText(result?.stderr ?? "")}
      detail={result?.detail ?? errorMessage}
    />
  );
}

function CodexSubscriptionActions({
  auth,
  isLoading,
  error,
  isStarting,
  startError,
  onStart,
  onRefresh,
  onTestSubscription,
  isTestingSubscription,
  testSubscriptionResult,
  testSubscriptionError,
}: {
  auth: InstanceCodexSubscriptionAuthResponse | undefined;
  isLoading: boolean;
  error: unknown;
  isStarting: boolean;
  startError: unknown;
  onStart: () => void;
  onRefresh: () => void;
  onTestSubscription: () => void;
  isTestingSubscription: boolean;
  testSubscriptionResult: InstanceCodexConnectionProbeResult | undefined;
  testSubscriptionError: unknown;
}) {
  const status = auth?.loginStatus;
  const session = auth?.session;
  const startErrorMessage =
    startError instanceof Error ? startError.message : startError ? "Failed to start device login" : null;
  const loadErrorMessage =
    error instanceof Error ? error.message : error ? "Failed to load Codex login status" : null;
  const testSubscriptionErrorMessage =
    testSubscriptionError instanceof Error
      ? testSubscriptionError.message
      : testSubscriptionError
        ? "Failed to run the subscription probe"
        : null;

  const consoleStdout = cleanConsoleText(session?.stdout ?? "");
  const consoleStderr = cleanConsoleText(session?.stderr ?? "");

  return (
    <div className="space-y-4">
      {(session?.loginUrl || session?.userCode) && (
        <div className="rounded-[22px] border border-sky-400/25 bg-sky-500/10 px-3.5 py-3 text-[10px] text-sky-100">
          {session.loginUrl && (
            <div>
              Browser URL:
              <a
                href={session.loginUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-1 break-all underline underline-offset-2"
              >
                {session.loginUrl}
              </a>
            </div>
          )}
          {session.userCode && (
            <div className="mt-2">
              One-time code:
              <span className="ml-1 rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-white">
                {session.userCode}
              </span>
            </div>
          )}
        </div>
      )}

      <RuntimeSignalCard
        title="Codex subscription probe"
        tone={probeTone(testSubscriptionResult, testSubscriptionErrorMessage)}
        summary={probeSummary(testSubscriptionResult, testSubscriptionErrorMessage, 'Run "Test subscription" after the shared login is ready.')}
        meta={[
          status?.sharedHomeDir ? `Shared home: ${status.sharedHomeDir}` : auth?.sharedHomeDir ? `Shared home: ${auth.sharedHomeDir}` : null,
          testSubscriptionResult?.checkedAt ? `Checked: ${formatIso(testSubscriptionResult.checkedAt)}` : null,
        ]}
        consoleLabel="Codex runtime console"
        stdout={cleanConsoleText(testSubscriptionResult?.stdout ?? consoleStdout)}
        stderr={cleanConsoleText(testSubscriptionResult?.stderr ?? consoleStderr)}
        detail={testSubscriptionResult?.detail ?? testSubscriptionErrorMessage ?? loadErrorMessage ?? startErrorMessage}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" className={COMPACT_BUTTON_CLASS} onClick={onStart} disabled={isStarting || session?.state === "pending"}>
          {isStarting
            ? "Starting login..."
            : session?.state === "pending"
              ? "Waiting for browser confirmation..."
              : "Connect Codex subscription"}
        </Button>
        <Button type="button" size="sm" className={COMPACT_BUTTON_CLASS} variant="outline" onClick={onTestSubscription} disabled={isTestingSubscription}>
          {isTestingSubscription ? "Testing..." : "Test subscription"}
        </Button>
        <Button type="button" size="sm" className={COMPACT_BUTTON_CLASS} variant="outline" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className="h-4 w-4" />
          Refresh status
        </Button>
      </div>

      {(loadErrorMessage || startErrorMessage) && (
        <div className="rounded-[20px] border border-red-400/25 bg-red-500/10 px-3.5 py-3 text-[10px] text-red-100">
          {loadErrorMessage ?? startErrorMessage}
        </div>
      )}
    </div>
  );
}

function RuntimeSignalCard({
  title,
  tone,
  summary,
  meta,
  consoleLabel,
  stdout,
  stderr,
  detail,
}: {
  title: string;
  tone: SurfaceTone;
  summary: string;
  meta: Array<string | null | undefined>;
  consoleLabel: string;
  stdout: string;
  stderr: string;
  detail?: string | null;
}) {
  const hasConsole = Boolean(stdout || stderr || detail);
  return (
    <div className={cn("min-w-0 rounded-[18px] border p-3", innerSurfaceToneClass(tone))}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] font-semibold text-white">{title}</div>
          <div className="mt-1 text-[10px] leading-4 text-slate-300">{summary}</div>
        </div>
        <StatusPill tone={tone} icon={surfaceToneIcon(tone)} label={surfaceToneLabel(tone)} />
      </div>
      <div className="mt-2.5 space-y-1 text-[10px] text-slate-400">
        {meta.filter((line): line is string => typeof line === "string" && line.length > 0).map((line) => (
          <div
            key={line}
            className={cn(
              "min-w-0",
              looksLikePathOrCommand(line) ? "break-all font-mono text-[9px]" : "break-words",
            )}
          >
            {line}
          </div>
        ))}
      </div>
      {hasConsole ? (
        <div className="mt-4">
          <ConsoleViewerDialog
            title={consoleLabel}
            description="Open the full runtime output in a wide modal so the command result fits without collapsing into a narrow card."
            stdout={stdout}
            stderr={stderr}
            detail={detail}
          />
        </div>
      ) : null}
    </div>
  );
}

function SubscriptionUsageEstimateCard({
  providerLabel,
  providerNote,
  status,
  enabled,
  onEnabledChange,
  windowHours,
  onWindowHoursChange,
  unit,
  onUnitChange,
  capacity,
  onCapacityChange,
  extraCapacity,
  onExtraCapacityChange,
  extraCapacityLabel,
  dirty,
  isSaving,
  onSave,
}: {
  providerLabel: string;
  providerNote: string;
  status:
    | {
        usedUnits: number;
        totalCapacityUnits: number;
        usagePercent: number;
        runCount: number;
        inputTokens: number;
        outputTokens: number;
        nextReliefAt: string | null;
      }
    | undefined;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  windowHours: string;
  onWindowHoursChange: (value: string) => void;
  unit: "runs" | "input_tokens" | "total_tokens";
  onUnitChange: (value: "runs" | "input_tokens" | "total_tokens") => void;
  capacity: string;
  onCapacityChange: (value: string) => void;
  extraCapacity: string;
  onExtraCapacityChange: (value: string) => void;
  extraCapacityLabel: string;
  dirty: boolean;
  isSaving: boolean;
  onSave: () => void;
}) {
  const usagePercent = status?.usagePercent ?? 0;
  const progressWidth = Math.min(100, Math.max(0, usagePercent));
  const tone =
    !enabled ? "bg-white/5" : usagePercent >= 100 ? "bg-red-500/8" : usagePercent >= 80 ? "bg-amber-500/8" : "bg-white/5";
  const progressTone =
    usagePercent >= 100 ? "bg-red-400" : usagePercent >= 80 ? "bg-amber-400" : "bg-emerald-400";
  const unitLabel =
    unit === "runs" ? "runs" : unit === "input_tokens" ? "input tokens" : "total tokens";

  return (
    <div className={cn("rounded-[22px] border border-white/10 p-3.5", tone)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] font-semibold text-white">Estimated usage until reset</div>
          <div className="mt-1 text-[10px] leading-4 text-slate-300">{providerNote}</div>
        </div>
        <StatusPill
          tone={usagePercent >= 100 ? "failure" : "idle"}
          icon={!enabled ? <CircleFallbackIcon /> : usagePercent >= 100 ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          label={!enabled ? "Disabled" : `~${usagePercent.toFixed(1)}% used`}
        />
      </div>

      <div className="mt-3 rounded-[18px] border border-white/10 bg-black/25 p-3">
        <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400">
          <span>{providerLabel}</span>
          <span>
            {status?.usedUnits ?? 0} / {status?.totalCapacityUnits ?? Math.max(1, coercePositiveInt(capacity, 1) + coerceNonNegativeInt(extraCapacity, 0))} {unitLabel}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div className={cn("h-full rounded-full transition-[width] duration-150", progressTone)} style={{ width: `${progressWidth}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-slate-400">
          <span>{status?.runCount ?? 0} runs</span>
          <span>{formatTokens(status?.inputTokens ?? 0)} in</span>
          <span>{formatTokens(status?.outputTokens ?? 0)} out</span>
          <span>Next relief: {formatIso(status?.nextReliefAt)}</span>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <BooleanField
          label="Track estimated subscription usage"
          hint="Turn on rolling-window estimation for local subscription usage pressure."
          value={enabled}
          onToggle={() => onEnabledChange(!enabled)}
        />
        <Field label="Window (hours)" hint="Rolling window length used for the estimate.">
          <input
            className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none"
            type="number"
            min={1}
            max={720}
            value={windowHours}
            onChange={(e) => onWindowHoursChange(e.target.value)}
          />
        </Field>
        <Field label="Estimate unit" hint="Choose what counts against the subscription window.">
          <select
            className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
            value={unit}
            onChange={(e) => onUnitChange(e.target.value as "runs" | "input_tokens" | "total_tokens")}
          >
            <option value="runs">Runs</option>
            <option value="input_tokens">Input tokens</option>
            <option value="total_tokens">Total tokens</option>
          </select>
        </Field>
        <Field label="Capacity per window" hint="Your estimated included capacity per rolling window.">
          <input
            className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none"
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => onCapacityChange(e.target.value)}
          />
        </Field>
        <div className="md:col-span-2">
          <Field label={extraCapacityLabel} hint="Optional manual extra capacity layered on top of the base window capacity.">
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none"
              type="number"
              min={0}
              value={extraCapacity}
              onChange={(e) => onExtraCapacityChange(e.target.value)}
            />
          </Field>
        </div>
      </div>

      {dirty ? (
        <div className="mt-3">
          <Button type="button" size="sm" className={COMPACT_BUTTON_CLASS} onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save usage estimate"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ConsoleViewerDialog({
  title,
  description,
  stdout,
  stderr,
  detail,
}: {
  title: string;
  description: string;
  stdout: string;
  stderr: string;
  detail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const diagnostics = [detail, stderr].filter(Boolean).join("\n\n");
  const hasDiagnostics = diagnostics.trim().length > 0;
  const diagnosticsLooksLikeError =
    /(?:error|failed|unauthorized|forbidden|denied|timeout|exception|traceback)/i.test(stderr) ||
    /"type":"error"/i.test(diagnostics);
  const diagnosticsTone: SurfaceTone =
    hasDiagnostics && diagnosticsLooksLikeError ? "failure" : "idle";
  const diagnosticsLabel = !hasDiagnostics
    ? "Empty"
    : diagnosticsLooksLikeError
      ? "Error text"
      : "Extra output";
  return (
    <>
      <Button type="button" size="sm" className={COMPACT_BUTTON_CLASS} variant="outline" onClick={() => setOpen(true)}>
        <TerminalSquare className="h-4 w-4" />
        View console
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-hidden border-white/10 bg-[#06070a] p-0">
          <DialogHeader className="border-b border-white/10 px-6 py-5">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[70vh] gap-0 overflow-hidden xl:grid-cols-2">
            <div className="border-b border-white/10 xl:border-r xl:border-b-0">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">stdout</div>
                <StatusPill tone={stdout ? "success" : "idle"} icon={stdout ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleFallbackIcon />} label={stdout ? "Present" : "Empty"} />
              </div>
              <pre className="h-[32vh] overflow-auto bg-black px-4 py-4 text-[10px] leading-4 text-emerald-100 xl:h-[70vh]">
                {stdout || "No stdout captured."}
              </pre>
            </div>
            <div>
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">extra technical output</div>
                <StatusPill
                  tone={diagnosticsTone}
                  icon={diagnosticsLooksLikeError ? <XCircle className="h-3.5 w-3.5" /> : <CircleFallbackIcon />}
                  label={diagnosticsLabel}
                />
              </div>
              <pre
                className={cn(
                  "h-[32vh] overflow-auto bg-black px-4 py-4 text-[10px] leading-4 xl:h-[70vh]",
                  diagnosticsLooksLikeError ? "text-red-200" : "text-slate-200",
                )}
              >
                {diagnostics || "No extra technical output captured."}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProviderGlyph({
  provider,
  tone: _tone,
}: {
  provider: "claude" | "codex";
  tone: SurfaceTone;
}) {
  return (
    <div
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5",
      )}
    >
      {provider === "claude" ? <ClaudeSvg className="h-6 w-6" /> : <OpenAISvg className="h-6 w-6" />}
    </div>
  );
}

function StatusPill({
  tone,
  icon,
  label,
}: {
  tone: SurfaceTone;
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        tone === "success"
          ? "border-emerald-400/25 bg-emerald-500/12 text-emerald-100"
          : tone === "failure"
            ? "border-red-400/25 bg-red-500/12 text-red-100"
            : "border-white/10 bg-white/5 text-slate-400",
      )}
    >
      {icon ? icon : null}
      {label}
    </span>
  );
}

function SharedLoginPill() {
  return (
    <StatusPill
      tone="idle"
      icon={<Link2 className="h-3.5 w-3.5" />}
      label={SHARED_LOGIN_LABEL}
    />
  );
}

function StoredStatePill({ stored }: { stored: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        stored
          ? "border-sky-400/35 bg-sky-500/18 text-sky-50 shadow-[0_0_0_1px_rgba(56,189,248,0.08)]"
          : "border-white/10 bg-white/5 text-slate-400",
      )}
    >
      {stored ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleFallbackIcon />}
      {stored ? "Stored" : "Not set"}
    </span>
  );
}

function surfaceToneClass(_tone: SurfaceTone): string {
  return "border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_34%),linear-gradient(180deg,rgba(12,13,16,0.98),rgba(5,6,8,0.98))]";
}

function innerSurfaceToneClass(tone: SurfaceTone): string {
  if (tone === "success") {
    return "border-emerald-400/14 bg-[linear-gradient(180deg,rgba(17,57,34,0.22),rgba(4,10,7,0.58))]";
  }
  if (tone === "failure") {
    return "border-red-400/14 bg-[linear-gradient(180deg,rgba(68,18,18,0.22),rgba(8,3,3,0.58))]";
  }
  return "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(0,0,0,0.34))]";
}

function handshakeCardClass(tone: SurfaceTone): string {
  if (tone === "success") {
    return "border-emerald-400/28 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.22),transparent_36%),linear-gradient(180deg,rgba(10,30,19,0.98),rgba(1,4,3,0.98))] shadow-[0_10px_32px_rgba(2,14,8,0.28)]";
  }
  if (tone === "failure") {
    return "border-red-400/28 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.2),transparent_36%),linear-gradient(180deg,rgba(31,13,13,0.98),rgba(4,2,2,0.98))] shadow-[0_10px_32px_rgba(18,4,4,0.28)]";
  }
  return "border-white/10 bg-[linear-gradient(180deg,rgba(38,40,46,0.94),rgba(13,14,18,0.98))]";
}

function handshakeIconClass(tone: SurfaceTone): string {
  if (tone === "success") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  if (tone === "failure") {
    return "border-red-400/30 bg-red-400/10 text-red-200";
  }
  return "border-white/10 bg-white/5 text-slate-300";
}

function surfaceToneIcon(tone: SurfaceTone) {
  if (tone === "success") return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (tone === "failure") return <XCircle className="h-3.5 w-3.5" />;
  return <CircleFallbackIcon />;
}

function surfaceToneLabel(tone: SurfaceTone): string {
  if (tone === "success") return "Ready";
  if (tone === "failure") return "Needs attention";
  return "Idle";
}

function claudeProviderSurfaceState(
  auth: InstanceClaudeSubscriptionAuthResponse | undefined,
  apiProbe: InstanceClaudeConnectionProbeResult | undefined,
  subscriptionProbe: InstanceClaudeConnectionProbeResult | undefined,
  apiProbeError: unknown,
  subscriptionProbeError: unknown,
  startError: unknown,
  loadError: unknown,
): SurfaceTone {
  if (apiProbeError || subscriptionProbeError || startError || loadError) return "failure";
  if (apiProbe?.ok || subscriptionProbe?.ok || auth?.loginStatus.loggedIn) return "success";
  if (apiProbe || subscriptionProbe || auth?.session.state === "failed") return "failure";
  return "idle";
}

function claudeProviderSurfaceSummary(
  auth: InstanceClaudeSubscriptionAuthResponse | undefined,
  apiProbe: InstanceClaudeConnectionProbeResult | undefined,
  subscriptionProbe: InstanceClaudeConnectionProbeResult | undefined,
  apiProbeError: unknown,
  subscriptionProbeError: unknown,
  startError: unknown,
  loadError: unknown,
): string {
  if (apiProbe?.ok) return apiProbe.summary;
  if (subscriptionProbe?.ok) return subscriptionProbe.summary;
  if (auth?.loginStatus.loggedIn) return "Shared Claude subscription is logged in and ready for local subscription mode.";
  if (apiProbeError || subscriptionProbeError || startError || loadError) return "One or more Claude connection checks failed. Open the console output for the exact error.";
  if (auth?.session.state === "pending") return "Waiting for the browser sign-in step to complete.";
  if (auth?.session.state === "failed") return "The last Claude login attempt failed. Open the console output to see the CLI response.";
  return "No successful Claude connection has been confirmed yet.";
}

function claudeSubscriptionPanelTone(
  auth: InstanceClaudeSubscriptionAuthResponse | undefined,
  subscriptionProbe: InstanceClaudeConnectionProbeResult | undefined,
  subscriptionProbeError: unknown,
  startError: unknown,
  loadError: unknown,
): SurfaceTone {
  if (subscriptionProbe?.ok || auth?.loginStatus.loggedIn) return "success";
  if (subscriptionProbeError || startError || loadError || auth?.session.state === "failed") return "failure";
  return "idle";
}

function codexProviderSurfaceState(
  auth: InstanceCodexSubscriptionAuthResponse | undefined,
  apiProbe: InstanceCodexConnectionProbeResult | undefined,
  subscriptionProbe: InstanceCodexConnectionProbeResult | undefined,
  apiProbeError: unknown,
  subscriptionProbeError: unknown,
  startError: unknown,
  loadError: unknown,
): SurfaceTone {
  if (apiProbeError || subscriptionProbeError || startError || loadError) return "failure";
  if (apiProbe?.ok || subscriptionProbe?.ok || auth?.loginStatus.loggedIn) return "success";
  if (apiProbe || subscriptionProbe || auth?.session.state === "failed") return "failure";
  return "idle";
}

function codexProviderSurfaceSummary(
  auth: InstanceCodexSubscriptionAuthResponse | undefined,
  apiProbe: InstanceCodexConnectionProbeResult | undefined,
  subscriptionProbe: InstanceCodexConnectionProbeResult | undefined,
  apiProbeError: unknown,
  subscriptionProbeError: unknown,
  startError: unknown,
  loadError: unknown,
): string {
  if (apiProbe?.ok) return apiProbe.summary;
  if (subscriptionProbe?.ok) return subscriptionProbe.summary;
  if (auth?.loginStatus.loggedIn) return "Shared Codex subscription is logged in and ready for local subscription mode.";
  if (apiProbeError || subscriptionProbeError || startError || loadError) return "One or more Codex connection checks failed. Open the console output for the exact error.";
  if (auth?.session.state === "pending") return "Waiting for the browser/device-auth step to complete.";
  if (auth?.session.state === "failed") return "The last Codex login attempt failed. Open the console output to see the CLI response.";
  return "No successful Codex connection has been confirmed yet.";
}

function codexSubscriptionPanelTone(
  auth: InstanceCodexSubscriptionAuthResponse | undefined,
  subscriptionProbe: InstanceCodexConnectionProbeResult | undefined,
  subscriptionProbeError: unknown,
  startError: unknown,
  loadError: unknown,
): SurfaceTone {
  if (subscriptionProbe?.ok || auth?.loginStatus.loggedIn) return "success";
  if (subscriptionProbeError || startError || loadError || auth?.session.state === "failed") return "failure";
  return "idle";
}

function buildClaudeHandshakeCard(
  auth: InstanceClaudeSubscriptionAuthResponse | undefined,
  subscriptionProbe: InstanceClaudeConnectionProbeResult | undefined,
  subscriptionProbeError: unknown,
  startError: unknown,
  loadError: unknown,
): HandshakeCardState {
  const tone = claudeSubscriptionPanelTone(
    auth,
    subscriptionProbe,
    subscriptionProbeError,
    startError,
    loadError,
  );
  if (tone === "success") {
    return {
      state: "success",
      label: "Handshake state",
      title: "Subscription ready",
      line: "Shared session is active and reusable.",
      actionLabel: "Connected",
    };
  }
  if (tone === "failure") {
    return {
      state: "failure",
      label: "Handshake state",
      title: "Handshake failed",
      line: "Unable to establish shared subscription session.",
      actionLabel: "Click to reconnect",
    };
  }
  if (auth?.session.state === "pending") {
    return {
      state: "idle",
      label: "Handshake state",
      title: "Waiting for browser",
      line: "Shared login started and is waiting for browser confirmation.",
      actionLabel: "Connection in progress",
    };
  }
  return {
    state: "idle",
    label: "Handshake state",
    title: "Not connected",
    line: "No shared subscription handshake has been started.",
    actionLabel: "Click to connect",
  };
}

function buildCodexHandshakeCard(
  auth: InstanceCodexSubscriptionAuthResponse | undefined,
  subscriptionProbe: InstanceCodexConnectionProbeResult | undefined,
  subscriptionProbeError: unknown,
  startError: unknown,
  loadError: unknown,
): HandshakeCardState {
  const tone = codexSubscriptionPanelTone(
    auth,
    subscriptionProbe,
    subscriptionProbeError,
    startError,
    loadError,
  );
  if (tone === "success") {
    return {
      state: "success",
      label: "Handshake state",
      title: "Subscription ready",
      line: "Shared session is active and reusable.",
      actionLabel: "Connected",
    };
  }
  if (tone === "failure") {
    return {
      state: "failure",
      label: "Handshake state",
      title: "Handshake failed",
      line: "Unable to establish shared subscription session.",
      actionLabel: "Click to reconnect",
    };
  }
  if (auth?.session.state === "pending") {
    return {
      state: "idle",
      label: "Handshake state",
      title: "Waiting for browser",
      line: "Shared login started and is waiting for browser confirmation.",
      actionLabel: "Connection in progress",
    };
  }
  return {
    state: "idle",
    label: "Handshake state",
    title: "Not connected",
    line: "No shared subscription handshake has been started.",
    actionLabel: "Click to connect",
  };
}

function buildClaudeLoginMeta(
  auth: InstanceClaudeSubscriptionAuthResponse | undefined,
  claudeUseApiKey: boolean,
): DetailItem[] {
  return [
    {
      label: "Shared config dir",
      value: auth?.loginStatus.sharedConfigDir ?? auth?.sharedConfigDir ?? "—",
    },
    {
      label: "Last checked",
      value: formatIsoCompact(auth?.loginStatus.checkedAt),
    },
    {
      label: "New-agent default",
      value: claudeUseApiKey ? "API key" : "Shared subscription",
    },
  ];
}

function buildCodexLoginMeta(
  auth: InstanceCodexSubscriptionAuthResponse | undefined,
  codexUseApiKey: boolean,
): DetailItem[] {
  return [
    {
      label: "Shared home",
      value: auth?.loginStatus.sharedHomeDir ?? auth?.sharedHomeDir ?? "—",
    },
    {
      label: "Last checked",
      value: formatIsoCompact(auth?.loginStatus.checkedAt),
    },
    {
      label: "New-agent default",
      value: codexUseApiKey ? "API key" : "Shared subscription",
    },
  ];
}

type ProbeResultLike = {
  ok: boolean;
  summary: string;
  detail: string | null;
};

function probeTone(
  result: ProbeResultLike | undefined,
  errorMessage: string | null,
): SurfaceTone {
  if (errorMessage) return "failure";
  if (result?.ok) return "success";
  if (result) return "failure";
  return "idle";
}

function probeSummary(
  result: ProbeResultLike | undefined,
  errorMessage: string | null,
  emptyText: string,
): string {
  if (errorMessage) return errorMessage;
  if (result) return result.summary;
  return emptyText;
}

function CircleFallbackIcon() {
  return <span className="inline-block h-2.5 w-2.5 rounded-full bg-current/80" />;
}

function looksLikePathOrCommand(value: string): boolean {
  return (
    value.includes("/") ||
    value.includes("\\") ||
    value.includes(".paperclip") ||
    value.includes("Command:") ||
    value.includes("Shared home:") ||
    value.includes("Shared config dir:")
  );
}

function ClaudeSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <path
        d="M33.3 12.3c-8.5 0-15.7 5-18.9 12.2C8.5 25.1 4 30.3 4 36.8 4 44.6 10.3 51 18.2 51h10.1V33.9c0-4.7 3.8-8.4 8.4-8.4h5.2c-.9-7.4-7.1-13.2-14.6-13.2Z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M45.8 25.5H36.7c-4.7 0-8.4 3.8-8.4 8.4V51h17.5C53.7 51 60 44.6 60 36.8c0-6.9-5-12.6-11.5-13.9-.7 1-1.6 1.8-2.7 2.6Z"
        fill="currentColor"
        opacity="0.72"
      />
    </svg>
  );
}

function OpenAISvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <path
        d="M31.8 8c4.9 0 8.7 2.3 10.9 6.4l7.5 4.4c4.1 2.4 6.6 6.6 6.6 11.3 0 4.9-2.5 9-6.6 11.3l-.6.4.6.4c4.1 2.4 6.6 6.5 6.6 11.3 0 4.7-2.5 8.9-6.6 11.3-4.1 2.4-8.9 2.4-13 0l-7.5-4.4C25.5 58 20.7 58 16.6 55.6c-4.1-2.4-6.6-6.6-6.6-11.3 0-4.8 2.5-8.9 6.6-11.3l.6-.4-.6-.4c-4.1-2.3-6.6-6.4-6.6-11.3 0-4.7 2.5-8.9 6.6-11.3 4.1-2.4 8.9-2.4 13 0l2.2 1.3C32 8.2 31.9 8.1 31.8 8Z"
        stroke="currentColor"
        strokeWidth="5"
        opacity="0.9"
      />
      <path
        d="m24.7 20.4 14.7 8.4v16.9l-14.7 8.4L10 45.7V28.8l14.7-8.4Z"
        stroke="currentColor"
        strokeWidth="5"
        opacity="0.52"
      />
    </svg>
  );
}

function SaveRow({
  dirty,
  pending,
  success,
  error,
  label,
  onSave,
}: {
  dirty: boolean;
  pending: boolean;
  success: boolean;
  error: unknown;
  label: string;
  onSave: () => void;
}) {
  if (!dirty) return null;
  const errorMessage = error instanceof Error ? error.message : error ? "Failed to save" : null;
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" className={COMPACT_BUTTON_CLASS} onClick={onSave} disabled={pending}>
        {pending ? "Saving..." : label}
      </Button>
      {success && <span className="text-[10px] text-muted-foreground">Saved</span>}
      {errorMessage && <span className="text-[10px] text-destructive">{errorMessage}</span>}
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Server;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-md border border-border px-4 py-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function formatBoolInterval(enabled: boolean, intervalMs: number): string {
  if (!enabled) return "disabled";
  const seconds = Math.round(intervalMs / 1000);
  if (seconds < 60) return `enabled · every ${seconds}s`;
  return `enabled · every ${Math.round(seconds / 60)}m`;
}

function cleanConsoleText(value: string): string {
  return value
    .replace(/\u001b\[[0-9;]*m/g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .trim();
}

function coercePositiveInt(value: string, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
}

function coerceNonNegativeInt(value: string, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.round(parsed);
}

function formatIso(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatIsoCompact(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
