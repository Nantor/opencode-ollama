import type {
  OllamaModelDetails,
  OllamaModelSummary,
  OpenCodeModelEntry,
  OpenCodeProvider,
} from "./types.js";
import { toNum } from "./types.js";
import { normalizeBaseURL } from "./fetch.js";
import { formatBytes, formatModelName, sortByKey, toDisplayName } from "./utils.js";

// ---------------------------------------------------------------------------
// Map Ollama models → OpenCode provider config
// ---------------------------------------------------------------------------

const NOT_CHAT_FAMILIES = new Set(["embedding"]);

function isChatModel(summary: OllamaModelSummary): boolean {
  const family = summary.details?.family?.toLowerCase();
  return !family || !NOT_CHAT_FAMILIES.has(family);
}

function modelOptions(
  summary: OllamaModelSummary,
): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  const summaryDetails = summary.details ?? {};
  if (summaryDetails.parameter_size) options.parameterSize = summaryDetails.parameter_size;
  if (summaryDetails.quantization_level) options.quantizationLevel = summaryDetails.quantization_level;
  if (summaryDetails.families) options.families = summaryDetails.families;
  return options;
}

function contextLength(details: OllamaModelDetails | undefined): number | undefined {
  for (const [key, value] of Object.entries(details?.model_info ?? {})) {
    if (!key.endsWith(".context_length")) continue;
    const context = toNum(value);
    if (context !== undefined && context > 0) return context;
  }
  return undefined;
}

function applyCapabilities(
  model: OpenCodeModelEntry,
  details: OllamaModelDetails | undefined,
): void {
  const capabilities = new Set(details?.capabilities?.map((capability) => capability.toLowerCase()));
  model.temperature = true;
  if (capabilities.has("tools")) model.tool_call = true;
  if (capabilities.has("thinking")) model.reasoning = true;
  if (capabilities.has("vision")) {
    model.attachment = true;
    model.modalities = { input: ["text", "image"], output: ["text"] };
  }
}

export function buildProviderConfig(
  summaries: OllamaModelSummary[],
  apiBaseURL: string,
  apiKey?: string,
  providerName = "Ollama",
  modelNameFormat?: string,
  providerID = "ollama",
  modelDetails: Record<string, OllamaModelDetails | undefined> = {},
): OpenCodeProvider {
  const modelsMap: Record<string, OpenCodeModelEntry> = Object.create(null) as Record<
    string,
    OpenCodeModelEntry
  >;

  for (const summary of summaries) {
    const id = summary.name;
    const modelEntry: OpenCodeModelEntry = {
      id,
      name: "",
    };

    const family = summary.details?.family;
    if (family) {
      modelEntry.family = family;
    }

    applyCapabilities(modelEntry, modelDetails[id]);

    const context = contextLength(modelDetails[id]);
    if (context !== undefined) {
      // OpenCode requires an output value; the model's context window is its
      // theoretical upper bound when the prompt contains no tokens.
      modelEntry.limit = { context, output: context };
    }

    // Ollama embeds a vision encoder in many models without reporting it
    // directly, so we cannot reliably infer attachments here. Leave it unset.
    const options = modelOptions(summary);
    if (Object.keys(options).length > 0) {
      modelEntry.options = options;
    }

    if (summary.size !== undefined) {
      modelEntry.options = {
        ...modelEntry.options,
        size: formatBytes(summary.size),
      };
    }

    const normalizedName = toDisplayName(id);
    const formatValues: OpenCodeModelEntry = {
      ...modelEntry,
      id,
      name: normalizedName,
    };
    modelEntry.name = modelNameFormat !== undefined
      ? formatModelName(modelNameFormat, formatValues, providerID)
      : normalizedName;

    modelsMap[id] = modelEntry;
  }

  const provider: OpenCodeProvider = {
    npm: "@ai-sdk/openai-compatible",
    name: providerName,
    options: {
      baseURL: `${normalizeBaseURL(apiBaseURL)}/v1`,
      ...(apiKey ? { apiKey } : {}),
    },
    models: sortByKey(modelsMap, "name"),
  };

  return provider;
}

export { isChatModel };
