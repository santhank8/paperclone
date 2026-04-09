import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PaperclipPluginManifestV1 } from "@paperclipai/shared";
import type { PluginLoader } from "./plugin-loader.js";
import type { pluginRegistryService } from "./plugin-registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

export interface FirstPartyPluginCatalogEntry {
  packageName: string;
  pluginKey: string;
  displayName: string;
  description: string;
  localPath: string;
  tag: "first_party";
}

type CatalogDefinition = Omit<FirstPartyPluginCatalogEntry, "localPath"> & {
  relativePath: string;
};

const FIRST_PARTY_PLUGIN_DEFINITIONS: CatalogDefinition[] = [
  {
    packageName: "@paperclipai/plugin-company-pulse",
    pluginKey: "paperclip.hello-world-example",
    displayName: "Pulso da Empresa",
    description: "Widget operacional de dashboard para resumir carga, issues abertas, metas e agentes ativos da empresa.",
    relativePath: "packages/plugins/company-pulse",
    tag: "first_party",
  },
  {
    packageName: "@paperclipai/plugin-workspace-explorer",
    pluginKey: "paperclip-file-browser-example",
    displayName: "Explorador de Workspace",
    description: "Superfície operacional para navegar workspaces, editar arquivos e abrir referências vindas de comentários.",
    relativePath: "packages/plugins/workspace-explorer",
    tag: "first_party",
  },
  {
    packageName: "@paperclipai/plugin-central-operacoes",
    pluginKey: "paperclip-kitchen-sink-example",
    displayName: "Central de Operações",
    description: "Cockpit operacional para intake, automações, diagnósticos, follow-up, métricas e coordenação entre agentes.",
    relativePath: "packages/plugins/central-operacoes",
    tag: "first_party",
  },
];

export function listFirstPartyPluginCatalog(): FirstPartyPluginCatalogEntry[] {
  return FIRST_PARTY_PLUGIN_DEFINITIONS.flatMap((definition) => {
    const localPath = path.resolve(REPO_ROOT, definition.relativePath);
    if (!existsSync(localPath)) return [];
    return [{
      packageName: definition.packageName,
      pluginKey: definition.pluginKey,
      displayName: definition.displayName,
      description: definition.description,
      localPath,
      tag: "first_party" as const,
    }];
  });
}

function manifestNeedsSync(
  plugin: Awaited<ReturnType<ReturnType<typeof pluginRegistryService>["listInstalled"]>>[number],
  entry: FirstPartyPluginCatalogEntry,
  manifest: PaperclipPluginManifestV1,
): boolean {
  const currentPackagePath = plugin.packagePath ? path.resolve(plugin.packagePath) : null;
  const currentDisplayName =
    typeof plugin.manifestJson?.displayName === "string" ? plugin.manifestJson.displayName : null;
  const currentDescription =
    typeof plugin.manifestJson?.description === "string" ? plugin.manifestJson.description : null;

  return (
    plugin.packageName !== entry.packageName ||
    currentPackagePath !== entry.localPath ||
    plugin.version !== manifest.version ||
    currentDisplayName !== manifest.displayName ||
    currentDescription !== manifest.description
  );
}

export async function syncFirstPartyPluginRecords(
  registry: ReturnType<typeof pluginRegistryService>,
  loader: PluginLoader,
): Promise<void> {
  const catalog = listFirstPartyPluginCatalog();
  if (catalog.length === 0) return;

  const byKey = new Map(catalog.map((entry) => [entry.pluginKey, entry]));
  const installedPlugins = await registry.listInstalled();

  for (const plugin of installedPlugins) {
    const catalogEntry = byKey.get(plugin.pluginKey);
    if (!catalogEntry) continue;

    const manifest = await loader.loadManifest(catalogEntry.localPath);
    if (!manifest || manifest.id !== catalogEntry.pluginKey) continue;
    if (!manifestNeedsSync(plugin, catalogEntry, manifest)) continue;

    await registry.update(plugin.id, {
      packageName: catalogEntry.packageName,
      packagePath: catalogEntry.localPath,
      version: manifest.version,
      manifest,
    });
  }
}
