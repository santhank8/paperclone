import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import enNav from "./locales/en/nav.json";
import enDashboard from "./locales/en/dashboard.json";
import enAgents from "./locales/en/agents.json";
import enIssues from "./locales/en/issues.json";
import enProjects from "./locales/en/projects.json";
import enGoals from "./locales/en/goals.json";
import enApprovals from "./locales/en/approvals.json";
import enCosts from "./locales/en/costs.json";
import enActivity from "./locales/en/activity.json";
import enInbox from "./locales/en/inbox.json";
import enSettings from "./locales/en/settings.json";
import enOnboarding from "./locales/en/onboarding.json";
import enOrg from "./locales/en/org.json";
import enAuth from "./locales/en/auth.json";
import enErrors from "./locales/en/errors.json";

import zhCommon from "./locales/zh/common.json";
import zhNav from "./locales/zh/nav.json";
import zhDashboard from "./locales/zh/dashboard.json";
import zhAgents from "./locales/zh/agents.json";
import zhIssues from "./locales/zh/issues.json";
import zhProjects from "./locales/zh/projects.json";
import zhGoals from "./locales/zh/goals.json";
import zhApprovals from "./locales/zh/approvals.json";
import zhCosts from "./locales/zh/costs.json";
import zhActivity from "./locales/zh/activity.json";
import zhInbox from "./locales/zh/inbox.json";
import zhSettings from "./locales/zh/settings.json";
import zhOnboarding from "./locales/zh/onboarding.json";
import zhOrg from "./locales/zh/org.json";
import zhAuth from "./locales/zh/auth.json";
import zhErrors from "./locales/zh/errors.json";

const ns = [
  "common", "nav", "dashboard", "agents", "issues", "projects",
  "goals", "approvals", "costs", "activity", "inbox", "settings",
  "onboarding", "org", "auth", "errors",
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon, nav: enNav, dashboard: enDashboard,
        agents: enAgents, issues: enIssues, projects: enProjects,
        goals: enGoals, approvals: enApprovals, costs: enCosts,
        activity: enActivity, inbox: enInbox, settings: enSettings,
        onboarding: enOnboarding, org: enOrg, auth: enAuth, errors: enErrors,
      },
      zh: {
        common: zhCommon, nav: zhNav, dashboard: zhDashboard,
        agents: zhAgents, issues: zhIssues, projects: zhProjects,
        goals: zhGoals, approvals: zhApprovals, costs: zhCosts,
        activity: zhActivity, inbox: zhInbox, settings: zhSettings,
        onboarding: zhOnboarding, org: zhOrg, auth: zhAuth, errors: zhErrors,
      },
    },
    ns: [...ns],
    defaultNS: "common",
    fallbackLng: "en",
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "paperclip-lang",
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
