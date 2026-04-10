import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PatchInstanceGeneralSettings } from "@paperclipai/shared";
import { LogOut, SlidersHorizontal } from "lucide-react";
import { authApi } from "@/api/auth";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { useGeneralSettings } from "@/context/GeneralSettingsContext";
import { Button } from "../components/ui/button";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { cn } from "../lib/utils";
import { textFor } from "@/lib/ui-language";

const FEEDBACK_TERMS_URL = import.meta.env.VITE_FEEDBACK_TERMS_URL?.trim() || "https://paperclip.ing/tos";

export function InstanceGeneralSettings() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const { uiLanguage, setUiLanguage } = useGeneralSettings();

  const copy = {
    instanceSettings: textFor(uiLanguage, {
      en: "Instance Settings",
      "zh-CN": "实例设置",
    }),
    general: textFor(uiLanguage, {
      en: "General",
      "zh-CN": "通用",
    }),
    loading: textFor(uiLanguage, {
      en: "Loading general settings...",
      "zh-CN": "正在加载通用设置...",
    }),
    loadError: textFor(uiLanguage, {
      en: "Failed to load general settings.",
      "zh-CN": "加载通用设置失败。",
    }),
    updateError: textFor(uiLanguage, {
      en: "Failed to update general settings.",
      "zh-CN": "更新通用设置失败。",
    }),
    headerDescription: textFor(uiLanguage, {
      en: "Configure instance-wide defaults that affect how operator-visible logs are displayed.",
      "zh-CN": "配置实例级默认项，控制操作员可见日志和设置界面的显示方式。",
    }),
    displayLanguage: textFor(uiLanguage, {
      en: "Display language",
      "zh-CN": "显示语言",
    }),
    displayLanguageDescription: textFor(uiLanguage, {
      en: "Switch the settings area and shared navigation chrome between English and Simplified Chinese. This preference is saved in this browser.",
      "zh-CN": "在英文和简体中文之间切换设置页及共享导航文案。这个偏好会保存在当前浏览器中。",
    }),
    english: textFor(uiLanguage, {
      en: "English",
      "zh-CN": "English",
    }),
    englishDescription: textFor(uiLanguage, {
      en: "Show settings in English.",
      "zh-CN": "以英文显示设置界面。",
    }),
    chinese: textFor(uiLanguage, {
      en: "Simplified Chinese",
      "zh-CN": "简体中文",
    }),
    chineseDescription: textFor(uiLanguage, {
      en: "Show settings in Chinese.",
      "zh-CN": "以中文显示设置界面。",
    }),
    censorUsernameTitle: textFor(uiLanguage, {
      en: "Censor username in logs",
      "zh-CN": "隐藏日志中的用户名",
    }),
    censorUsernameDescription: textFor(uiLanguage, {
      en: "Hide the username segment in home-directory paths and similar operator-visible log output. Standalone username mentions outside of paths are not yet masked in the live transcript view. This is off by default.",
      "zh-CN": "在家目录路径和类似的操作员可见日志输出中隐藏用户名片段。路径之外单独出现的用户名目前还不会在实时转录视图中被遮罩。默认关闭。",
    }),
    censorUsernameAria: textFor(uiLanguage, {
      en: "Toggle username log censoring",
      "zh-CN": "切换日志用户名隐藏",
    }),
    keyboardShortcutsTitle: textFor(uiLanguage, {
      en: "Keyboard shortcuts",
      "zh-CN": "键盘快捷键",
    }),
    keyboardShortcutsDescription: textFor(uiLanguage, {
      en: "Enable app keyboard shortcuts, including inbox navigation and global shortcuts like creating issues or toggling panels. This is off by default.",
      "zh-CN": "启用应用快捷键，包括收件箱导航，以及创建 issue、切换面板等全局快捷键。默认关闭。",
    }),
    keyboardShortcutsAria: textFor(uiLanguage, {
      en: "Toggle keyboard shortcuts",
      "zh-CN": "切换键盘快捷键",
    }),
    feedbackTitle: textFor(uiLanguage, {
      en: "AI feedback sharing",
      "zh-CN": "AI 反馈共享",
    }),
    feedbackDescription: textFor(uiLanguage, {
      en: "Control whether thumbs up and thumbs down votes can send the voted AI output to Paperclip Labs. Votes are always saved locally.",
      "zh-CN": "控制点赞和点踩是否可以把被投票的 AI 输出发送给 Paperclip Labs。投票记录始终会保存在本地。",
    }),
    feedbackTerms: textFor(uiLanguage, {
      en: "Read our terms of service",
      "zh-CN": "查看服务条款",
    }),
    feedbackPrompt: textFor(uiLanguage, {
      en: "No default is saved yet. The next thumbs up or thumbs down choice will ask once and then save the answer here.",
      "zh-CN": "当前还没有保存默认值。下次点赞或点踩时会询问一次，并把结果保存在这里。",
    }),
    feedbackAllow: textFor(uiLanguage, {
      en: "Always allow",
      "zh-CN": "始终允许",
    }),
    feedbackAllowDescription: textFor(uiLanguage, {
      en: "Share voted AI outputs automatically.",
      "zh-CN": "自动共享被投票的 AI 输出。",
    }),
    feedbackDeny: textFor(uiLanguage, {
      en: "Don't allow",
      "zh-CN": "不允许",
    }),
    feedbackDenyDescription: textFor(uiLanguage, {
      en: "Keep voted AI outputs local only.",
      "zh-CN": "仅在本地保留被投票的 AI 输出。",
    }),
    feedbackDevNote: textFor(uiLanguage, {
      en: "To retest the first-use prompt in local dev, remove the feedbackDataSharingPreference key from the instance_settings.general JSON row for this instance, or set it back to \"prompt\". Unset and \"prompt\" both mean no default has been chosen yet.",
      "zh-CN": "如果要在本地开发里重新测试首次提示，可以从当前实例的 instance_settings.general JSON 行里删除 feedbackDataSharingPreference，或者把它改回 \"prompt\"。未设置和 \"prompt\" 都表示还没有选择默认值。",
    }),
    signOutTitle: textFor(uiLanguage, {
      en: "Sign out",
      "zh-CN": "退出登录",
    }),
    signOutDescription: textFor(uiLanguage, {
      en: "Sign out of this Paperclip instance. You will be redirected to the login page.",
      "zh-CN": "退出当前 Paperclip 实例登录。之后你会被重定向到登录页。",
    }),
    signOutPending: textFor(uiLanguage, {
      en: "Signing out...",
      "zh-CN": "正在退出...",
    }),
    signOutCta: textFor(uiLanguage, {
      en: "Sign out",
      "zh-CN": "退出登录",
    }),
    signOutError: textFor(uiLanguage, {
      en: "Failed to sign out.",
      "zh-CN": "退出登录失败。",
    }),
  };

  const signOutMutation = useMutation({
    mutationFn: () => authApi.signOut(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : copy.signOutError);
    },
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: copy.instanceSettings },
      { label: copy.general },
    ]);
  }, [copy.general, copy.instanceSettings, setBreadcrumbs]);

  const generalQuery = useQuery({
    queryKey: queryKeys.instance.generalSettings,
    queryFn: () => instanceSettingsApi.getGeneral(),
  });

  const updateGeneralMutation = useMutation({
    mutationFn: instanceSettingsApi.updateGeneral,
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.instance.generalSettings });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : copy.updateError);
    },
  });

  if (generalQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{copy.loading}</div>;
  }

  if (generalQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {generalQuery.error instanceof Error
          ? generalQuery.error.message
          : copy.loadError}
      </div>
    );
  }

  const censorUsernameInLogs = generalQuery.data?.censorUsernameInLogs === true;
  const keyboardShortcuts = generalQuery.data?.keyboardShortcuts === true;
  const feedbackDataSharingPreference = generalQuery.data?.feedbackDataSharingPreference ?? "prompt";

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{copy.general}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {copy.headerDescription}
        </p>
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{copy.displayLanguage}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {copy.displayLanguageDescription}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              {
                value: "en" as const,
                label: copy.english,
                description: copy.englishDescription,
              },
              {
                value: "zh-CN" as const,
                label: copy.chinese,
                description: copy.chineseDescription,
              },
            ].map((option) => {
              const active = uiLanguage === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-foreground bg-accent text-foreground"
                      : "border-border bg-background hover:bg-accent/50",
                  )}
                  onClick={() => setUiLanguage(option.value)}
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {option.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{copy.censorUsernameTitle}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {copy.censorUsernameDescription}
            </p>
          </div>
          <ToggleSwitch
            checked={censorUsernameInLogs}
            onCheckedChange={() => updateGeneralMutation.mutate({ censorUsernameInLogs: !censorUsernameInLogs })}
            disabled={updateGeneralMutation.isPending}
            aria-label={copy.censorUsernameAria}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{copy.keyboardShortcutsTitle}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {copy.keyboardShortcutsDescription}
            </p>
          </div>
          <ToggleSwitch
            checked={keyboardShortcuts}
            onCheckedChange={() => updateGeneralMutation.mutate({ keyboardShortcuts: !keyboardShortcuts })}
            disabled={updateGeneralMutation.isPending}
            aria-label={copy.keyboardShortcutsAria}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{copy.feedbackTitle}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {copy.feedbackDescription}
            </p>
            {FEEDBACK_TERMS_URL ? (
              <a
                href={FEEDBACK_TERMS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                {copy.feedbackTerms}
              </a>
            ) : null}
          </div>
          {feedbackDataSharingPreference === "prompt" ? (
            <div className="rounded-lg border border-border/70 bg-accent/20 px-3 py-2 text-sm text-muted-foreground">
              {copy.feedbackPrompt}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {[
              {
                value: "allowed",
                label: copy.feedbackAllow,
                description: copy.feedbackAllowDescription,
              },
              {
                value: "not_allowed",
                label: copy.feedbackDeny,
                description: copy.feedbackDenyDescription,
              },
            ].map((option) => {
              const active = feedbackDataSharingPreference === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={updateGeneralMutation.isPending}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    active
                      ? "border-foreground bg-accent text-foreground"
                      : "border-border bg-background hover:bg-accent/50",
                  )}
                  onClick={() =>
                    updateGeneralMutation.mutate({
                      feedbackDataSharingPreference: option.value as
                        | "allowed"
                        | "not_allowed",
                    })
                  }
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {option.description}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {copy.feedbackDevNote}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">{copy.signOutTitle}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {copy.signOutDescription}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={signOutMutation.isPending}
            onClick={() => signOutMutation.mutate()}
          >
            <LogOut className="size-4" />
            {signOutMutation.isPending ? copy.signOutPending : copy.signOutCta}
          </Button>
        </div>
      </section>
    </div>
  );
}
