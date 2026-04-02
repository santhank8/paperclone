const en = {
  translation: {
    // Sidebar navigation
    sidebar: {
      selectCompany: "Select company",
      newIssue: "New Issue",
      dashboard: "Dashboard",
      inbox: "Inbox",
      issues: "Issues",
      routines: "Routines",
      goals: "Goals",
      work: "Work",
      company: "Company",
      org: "Org",
      skills: "Skills",
      costs: "Costs",
      activity: "Activity",
      settings: "Settings",
      projects: "Projects",
      agents: "Agents",
    },

    // Instance settings sidebar
    instanceSettings: {
      title: "Instance Settings",
      general: "General",
      heartbeats: "Heartbeats",
      experimental: "Experimental",
      plugins: "Plugins",
    },

    // Layout
    layout: {
      skipToMain: "Skip to Main Content",
      closeSidebar: "Close sidebar",
      openSidebar: "Open sidebar",
      documentation: "Documentation",
      instanceSettings: "Instance settings",
      switchToLight: "Switch to light mode",
      switchToDark: "Switch to dark mode",
    },

    // Issue properties
    issueProperties: {
      status: "Status",
      priority: "Priority",
      labels: "Labels",
      assignee: "Assignee",
      project: "Project",
      parent: "Parent",
      depth: "Depth",
      createdBy: "Created by",
      started: "Started",
      completed: "Completed",
      created: "Created",
      updated: "Updated",
      noLabels: "No labels",
      noAssignee: "No assignee",
      unassigned: "Unassigned",
      assignToMe: "Assign to me",
      noProject: "No project",
      searchLabels: "Search labels...",
      searchAssignees: "Search assignees...",
      searchProjects: "Search projects...",
      createLabel: "Create label",
      user: "User",
      billingCode: "Billing code",
      goal: "Goal",
    },

    // Agent properties
    agentProperties: {
      status: "Status",
      role: "Role",
      title: "Title",
      adapter: "Adapter",
      session: "Session",
      lastError: "Last error",
      lastHeartbeat: "Last Heartbeat",
      reportsTo: "Reports To",
      created: "Created",
      capabilities: "Capabilities",
      model: "Model",
    },

    // Project properties
    projectProperties: {
      name: "Name",
      description: "Description",
      status: "Status",
      lead: "Lead",
      goals: "Goals",
      created: "Created",
      updated: "Updated",
      targetDate: "Target Date",
      clearRepo: "Clear repo",
      clearLocalFolder: "Clear local folder",
      codebaseHelp: "Codebase help",
      executionWorkspacesHelp: "Execution workspaces help",
    },

    // Goal properties
    goalProperties: {
      status: "Status",
      level: "Level",
      owner: "Owner",
      parentGoal: "Parent Goal",
      created: "Created",
      updated: "Updated",
    },

    // Pages
    pages: {
      issues: "Issues",
      agents: "Agents",
      projects: "Projects",
      goals: "Goals",
      routines: "Routines",
      activity: "Activity",
      inbox: "Inbox",
      costs: "Costs",
      org: "Org",
      approvals: "Approvals",
      skills: "Skills",
      settings: "Settings",
      dashboard: "Dashboard",
    },

    // Empty states
    emptyStates: {
      selectCompanyAgents: "Select a company to view agents.",
      selectCompanyProjects: "Select a company to view projects.",
      selectCompanyGoals: "Select a company to view goals.",
      selectCompanyRoutines: "Select a company to view routines.",
      selectCompanyActivity: "Select a company to view activity.",
      selectCompanyInbox: "Select a company to view inbox.",
      selectCompanyCosts: "Select a company to view costs.",
      selectCompanyOrg: "Select a company to view the org chart.",
      selectCompanySkills: "Select a company to manage skills.",
      noProjects: "No projects yet.",
      noGoals: "No goals yet.",
      noRoutines: "No routines yet. Use Create routine to define the first recurring workflow.",
      noActivity: "No activity yet.",
      inboxZero: "Inbox zero.",
      noInboxNew: "No new inbox items.",
      noInboxRecent: "No recent inbox items.",
      noInboxFilter: "No inbox items match these filters.",
      noPendingApprovals: "No pending approvals.",
      noApprovals: "No approvals yet.",
      noOrgHierarchy: "No organizational hierarchy defined.",
      selectSkill: "Select a skill to inspect its files.",
      noMonthlyCap: "No monthly cap configured",
      noFinanceEvents: "No finance events yet...",
      noHeartbeats: "No scheduler heartbeats match the current criteria.",
    },

    // Dialogs
    dialogs: {
      issueTitle: "Issue title",
      assignee: "Assignee",
      project: "Project",
      defaultModel: "Default model",
      addDescription: "Add description...",
      removeDocument: "Remove document",
      removeAttachment: "Remove attachment",
      projectName: "Project name",
      goalTitle: "Goal title",
      create: "Create",
      cancel: "Cancel",
      save: "Save",
      delete: "Delete",
      close: "Close",
      upload: "Upload",
    },

    // Agent config form
    agentConfig: {
      name: "Name",
      title: "Title",
      reportsTo: "Reports to",
      capabilities: "Capabilities",
      promptTemplate: "Prompt Template",
      adapterType: "Adapter type",
      workingDirectory: "Working directory (deprecated)",
      command: "Command",
      bootstrapPrompt: "Bootstrap prompt (legacy)",
      extraArgs: "Extra args (comma-separated)",
      envVars: "Environment variables",
      timeoutSec: "Timeout (sec)",
      gracePeriod: "Interrupt grace period (sec)",
      heartbeatInterval: "Heartbeat on interval",
      wakeOnDemand: "Wake on demand",
      cooldownSec: "Cooldown (sec)",
      maxConcurrentRuns: "Max concurrent runs",
      model: "Model",
      thinkingEffort: "Thinking effort",
    },

    // Common actions
    actions: {
      search: "Search",
      searchIssues: "Search issues, agents, projects...",
      searchIssuesPlaceholder: "Search issues...",
      leaveComment: "Leave a comment...",
      copyAsMarkdown: "Copy as markdown",
      attachImage: "Attach image",
      markAsRead: "Mark as read",
      dismissFromInbox: "Dismiss from inbox",
      expandDocument: "Expand document",
      collapseDocument: "Collapse document",
      listView: "List view",
      boardView: "Board view",
    },

    // Status labels
    statuses: {
      backlog: "Backlog",
      todo: "To Do",
      in_progress: "In Progress",
      in_review: "In Review",
      done: "Done",
      blocked: "Blocked",
      cancelled: "Cancelled",
    },

    // Priority labels
    priorities: {
      critical: "Critical",
      high: "High",
      medium: "Medium",
      low: "Low",
    },

    // Agent roles
    roles: {
      ceo: "CEO",
      cto: "CTO",
      manager: "Manager",
      engineer: "Engineer",
      designer: "Designer",
      qa: "QA",
    },

    // Onboarding / App
    app: {
      instanceSetupRequired: "Instance setup required",
      noInstanceAdmin: "No instance admin exists yet...",
      createFirstCompany: "Create your first company",
      getStarted: "Get started by creating a company.",
      addAgent: "Add Agent",
      startOnboarding: "Start Onboarding",
      createAnotherCompany: "Create another company",
      createAnotherAgent: "Create another agent",
      loading: "Loading...",
    },

    // Language
    language: {
      label: "Language",
      en: "English",
      ko: "한국어",
    },

    // Mobile bottom nav
    mobileNav: {
      dashboard: "Dashboard",
      inbox: "Inbox",
      issues: "Issues",
      agents: "Agents",
      more: "More",
    },

    // Breadcrumb & misc labels
    beta: "Beta",
  },
} as const;

export default en;
