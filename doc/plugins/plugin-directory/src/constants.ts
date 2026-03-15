export const PLUGIN_ID = "@paperclipai/plugin-directory";
export const PLUGIN_VERSION = "0.1.0";
export const PAGE_ROUTE = "plugin-directory";

export const SLOT_IDS = {
  page: "plugin-directory-page",
  sidebar: "plugin-directory-sidebar-link",
} as const;

export const EXPORT_NAMES = {
  page: "PluginDirectoryPage",
  sidebar: "PluginDirectorySidebarLink",
} as const;

export const DATA_KEYS = {
  directory: "directory",
} as const;

export const ACTION_KEYS = {
  install: "install-plugin",
} as const;
