import type { UIAdapterModule } from "../types";
import type { CreateConfigValues } from "@paperclipai/adapter-utils";
import { parseHermesStdoutLine, buildHermesConfig as upstreamBuildHermesConfig } from "hermes-paperclip-adapter/ui";
import { HermesLocalConfigFields } from "./config-fields";

/**
 * Wrap upstream buildHermesConfig to handle auto-detect and provider mapping.
 * When model is empty/falsy, omit it so the server adapter uses auto-detection
 * from ~/.hermes/config.yaml instead of falling back to DEFAULT_MODEL.
 */
function buildHermesConfig(values: CreateConfigValues): Record<string, unknown> {
  const config = upstreamBuildHermesConfig(values);
  if (!values.model || values.model.trim().length === 0) {
    delete config.model;
  }
  if (values.args && values.args.trim().length > 0) {
    config.provider = values.args.trim();
  }
  return config;
}

export const hermesLocalUIAdapter: UIAdapterModule = {
  type: "hermes_local",
  label: "Hermes Agent",
  parseStdoutLine: parseHermesStdoutLine,
  ConfigFields: HermesLocalConfigFields,
  buildAdapterConfig: buildHermesConfig,
};