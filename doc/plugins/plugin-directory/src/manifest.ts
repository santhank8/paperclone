import {
  EXPORT_NAMES,
  PAGE_ROUTE,
  PLUGIN_ID,
  PLUGIN_VERSION,
  SLOT_IDS,
} from "./constants.js";

const manifest = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Plugin Directory",
  description:
    "Browse and install community plugins from a curated registry. Adds a Plugin Directory page to the sidebar.",
  author: "Paperclip",
  categories: ["ui"] as const,
  capabilities: [
    "ui.page.register",
    "ui.sidebar.register",
    "http.outbound",
    "plugin.state.read",
    "plugin.state.write",
  ] as const,
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  ui: {
    slots: [
      {
        type: "page" as const,
        id: SLOT_IDS.page,
        displayName: "Plugin Directory",
        exportName: EXPORT_NAMES.page,
        routePath: PAGE_ROUTE,
      },
      {
        type: "sidebar" as const,
        id: SLOT_IDS.sidebar,
        displayName: "Plugin Directory",
        exportName: EXPORT_NAMES.sidebar,
      },
    ],
  },
};

export default manifest;
