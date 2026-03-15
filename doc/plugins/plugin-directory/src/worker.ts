import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import { ACTION_KEYS, DATA_KEYS, PLUGIN_ID } from "./constants.js";

interface DirectoryEntry {
  name: string;
  packageName: string;
  description: string;
  author: string;
  category: string;
  source?: string;
}

interface DirectoryRegistry {
  version: number;
  updated: string;
  plugins: DirectoryEntry[];
}

// Bundled registry - update this file to add new plugins to the directory.
// Community contributions add entries here via PRs.
const BUNDLED_REGISTRY: DirectoryRegistry = {
  version: 1,
  updated: "2026-03-15",
  plugins: [
    {
      name: "Hello World Widget",
      packageName: "@paperclipai/plugin-hello-world-example",
      description:
        "Reference UI plugin that adds a simple Hello World widget to the dashboard.",
      author: "Paperclip",
      category: "example",
      source:
        "https://github.com/paperclipai/paperclip/tree/master/packages/plugins/examples/plugin-hello-world-example",
    },
    {
      name: "Kitchen Sink",
      packageName: "@paperclipai/plugin-kitchen-sink-example",
      description:
        "Reference plugin demonstrating the full Paperclip plugin API surface: UI slots, bridge actions, events, jobs, webhooks, tools, workspace access, and runtime diagnostics.",
      author: "Paperclip",
      category: "example",
      source:
        "https://github.com/paperclipai/paperclip/tree/master/packages/plugins/examples/plugin-kitchen-sink-example",
    },
    {
      name: "File Browser",
      packageName: "@paperclipai/plugin-file-browser-example",
      description:
        "Adds a Files sidebar link, file browser tab on project detail pages, and comment file-link annotations.",
      author: "Paperclip",
      category: "example",
      source:
        "https://github.com/paperclipai/paperclip/tree/master/packages/plugins/examples/plugin-file-browser-example",
    },
  ],
};

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_ID} setup complete`);

    ctx.data.register(DATA_KEYS.directory, async () => {
      return BUNDLED_REGISTRY.plugins;
    });

    ctx.actions.register(ACTION_KEYS.install, async (params) => {
      const packageName =
        typeof params.packageName === "string" ? params.packageName : "";
      if (!packageName) {
        throw new Error("packageName is required");
      }

      const response = await ctx.http.fetch("/api/plugins/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageName }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Install failed (${response.status}): ${body.slice(0, 200)}`
        );
      }

      const result = await response.json();
      ctx.logger.info(`Installed plugin ${packageName}`);
      return result;
    });
  },

  async onHealth() {
    return {
      status: "ok",
      message: "Plugin Directory ready",
      details: {
        registryEntries: BUNDLED_REGISTRY.plugins.length,
      },
    };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
