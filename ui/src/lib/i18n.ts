import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import commonEn from "../locales/en/common.json";
import dashboardEn from "../locales/en/pages/dashboard.json";
import issuesEn from "../locales/en/pages/issues.json";
import agentsEn from "../locales/en/pages/agents.json";
import projectsEn from "../locales/en/pages/projects.json";
import routinesEn from "../locales/en/pages/routines.json";
import goalsEn from "../locales/en/pages/goals.json";
import approvalsEn from "../locales/en/pages/approvals.json";
import costsEn from "../locales/en/pages/costs.json";
import activityEn from "../locales/en/pages/activity.json";
import commonFr from "../locales/fr/common.json";
import dashboardFr from "../locales/fr/pages/dashboard.json";
import issuesFr from "../locales/fr/pages/issues.json";
import agentsFr from "../locales/fr/pages/agents.json";
import projectsFr from "../locales/fr/pages/projects.json";
import routinesFr from "../locales/fr/pages/routines.json";
import goalsFr from "../locales/fr/pages/goals.json";
import approvalsFr from "../locales/fr/pages/approvals.json";
import costsFr from "../locales/fr/pages/costs.json";
import activityFr from "../locales/fr/pages/activity.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: commonEn, dashboard: dashboardEn, issues: issuesEn, agents: agentsEn, projects: projectsEn, routines: routinesEn, goals: goalsEn, approvals: approvalsEn, costs: costsEn, activity: activityEn },
      fr: { common: commonFr, dashboard: dashboardFr, issues: issuesFr, agents: agentsFr, projects: projectsFr, routines: routinesFr, goals: goalsFr, approvals: approvalsFr, costs: costsFr, activity: activityFr },
    },
    defaultNS: "common",
    fallbackLng: "en",
    interpolation: { escapeValue: true },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "paperclip-language",
    },
  });

export default i18n;
