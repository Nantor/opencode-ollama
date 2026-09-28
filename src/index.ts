import type { PluginModule } from "@opencode-ai/plugin";

import { OllamaDiscoveryPlugin } from "./plugin.js";

export {
  OllamaDiscoveryPlugin,
  applyDiscovery,
  discoverProviderModels,
} from "./plugin.js";
export { buildProviderConfig } from "./provider.js";
export { fetchOllamaModelDetails, fetchOllamaModels, normalizeBaseURL } from "./fetch.js";

export default {
  id: "opencode-ollama",
  server: OllamaDiscoveryPlugin,
} satisfies PluginModule;
