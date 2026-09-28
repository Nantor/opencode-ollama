// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Logger = (
  level: "info" | "warn" | "error",
  message: string,
) => void | Promise<void>;

/** A single model summary returned by Ollama's `GET /api/tags`. */
export interface OllamaModelSummary {
  name: string;
  model: string;
  remote_model?: string;
  remote_host?: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OllamaListResponse {
  models?: OllamaModelSummary[];
}

/** Model metadata returned by Ollama's `POST /api/show`. */
export interface OllamaModelDetails {
  parameters?: string;
  license?: string;
  modified_at?: string;
  template?: string;
  capabilities?: string[];
  thinking?: {
    values: Array<boolean | string>;
    default: boolean | string;
  };
  details?: OllamaModelSummary["details"] & { parent_model?: string };
  model_info?: Record<string, unknown>;
}

/** Coerce a value to a number, returning undefined if it is not a valid one. */
export function toNum(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : undefined;
  if (typeof v === "string") {
    if (v.trim() === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }
  return undefined;
}

export interface OpenCodeModelLimit {
  context: number;
  output: number;
  input?: number;
}

export interface OpenCodeModelModalities {
  input?: Array<"text" | "audio" | "image" | "video" | "pdf">;
  output?: Array<"text" | "audio" | "image" | "video" | "pdf">;
}

export interface OpenCodeModelEntry {
  id?: string;
  name?: string;
  family?: string;
  release_date?: string;
  attachment?: boolean;
  reasoning?: boolean;
  temperature?: boolean;
  tool_call?: boolean;
  interleaved?: boolean | { field: "reasoning_content" | "reasoning_details" };
  cost?: { input: number; output: number };
  limit?: OpenCodeModelLimit;
  modalities?: OpenCodeModelModalities;
  experimental?: boolean;
  status?: "alpha" | "beta" | "deprecated" | "active";
  provider?: { npm?: string; api?: string };
  options?: Record<string, unknown>;
  headers?: Record<string, string>;
  variants?: Record<string, { disabled?: boolean }>;
}

export interface OpenCodeDiscoveryOptions {
  discovery?: boolean;
  discoveryTimeout?: number;
  modelNameFormat?: string;
}

export interface OpenCodeProvider {
  npm?: string;
  name?: string;
  options?: {
    baseURL?: string;
    apiKey?: string;
    "opencode-ollama"?: OpenCodeDiscoveryOptions;
    [key: string]: unknown;
  };
  models?: Record<string, OpenCodeModelEntry>;
  [key: string]: unknown;
}

export interface OpenCodeConfig {
  $schema?: string;
  provider?: Record<string, OpenCodeProvider | undefined>;
  [key: string]: unknown;
}
