import type { Plugin } from "@opencode-ai/plugin";

import { fetchOllamaModelDetails, fetchOllamaModels } from "./fetch.js";
import { buildProviderConfig, isChatModel } from "./provider.js";
import type {
  Logger,
  OpenCodeConfig,
  OpenCodeProvider,
} from "./types.js";

async function safeLog(
  log: Logger | undefined,
  level: "info" | "warn" | "error",
  message: string,
): Promise<void> {
  try {
    await log?.(level, message);
  } catch {
    // Logging must never prevent provider initialization.
  }
}

export async function discoverProviderModels(
  providerID: string,
  provider: OpenCodeProvider | undefined,
  log?: Logger,
): Promise<void> {
  if (!provider) return;
  const options = provider.options;
  const pluginOptions = options?.["opencode-ollama"];
  if (pluginOptions?.discovery !== true) return;

  if (options) {
    const { ["opencode-ollama"]: _pluginConfig, ...adapterOptions } = options;
    provider.options = adapterOptions;
  }

  if (!options?.baseURL) {
    await safeLog(
      log,
      "warn",
      `Provider "${providerID}" has discovery enabled but no baseURL`,
    );
    return;
  }
  const baseURL = options.baseURL;

  const timeoutMs =
    typeof pluginOptions.discoveryTimeout === "number" &&
    Number.isFinite(pluginOptions.discoveryTimeout) &&
    pluginOptions.discoveryTimeout >= 0
      ? pluginOptions.discoveryTimeout
      : undefined;

  try {
    const models = await fetchOllamaModels(baseURL, options.apiKey, timeoutMs);

    const chatModels = models.filter(isChatModel);
    const details = await Promise.all(chatModels.map(async (model) => {
      try {
        return [model.name, await fetchOllamaModelDetails(
          baseURL,
          model.name,
          options.apiKey,
          timeoutMs,
        )] as const;
      } catch {
        // Older Ollama servers may not support /api/show. Model discovery still works without it.
        return [model.name, undefined] as const;
      }
    }));
    const discovered = buildProviderConfig(
      chatModels,
      baseURL,
      options.apiKey,
      provider.name ?? providerID,
      typeof pluginOptions.modelNameFormat === "string"
        ? pluginOptions.modelNameFormat
        : undefined,
      providerID,
      Object.fromEntries(details),
    );

    provider.models = {
      ...discovered.models,
      ...provider.models,
    };
    await safeLog(
      log,
      "info",
      `Discovered ${chatModels.length} usable model(s) for provider "${providerID}"`,
    );
  } catch (error) {
    await safeLog(
      log,
      "error",
      `Model discovery failed for "${providerID}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function applyDiscovery(
  config: OpenCodeConfig,
  log?: Logger,
): Promise<void> {
  await Promise.all(
    Object.entries(config.provider ?? {}).map(([providerID, provider]) =>
      discoverProviderModels(providerID, provider, log),
    ),
  );
}

export const OllamaDiscoveryPlugin: Plugin = async ({ client }) => {
  const log: Logger = async (level, message) => {
    await client.app.log({
      body: {
        service: "opencode-ollama",
        level,
        message,
      },
    });
  };

  return {
    config: async (config) => applyDiscovery(config as OpenCodeConfig, log),
  };
};
