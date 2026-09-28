import type {
  OllamaListResponse,
  OllamaModelDetails,
  OllamaModelSummary,
} from "./types.js";

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchEndpoint<T>(
  baseURL: string,
  path: string,
  apiKey?: string,
  timeoutMs = 10_000,
  init?: RequestInit,
): Promise<T> {
  const url = `${baseURL.replace(/\/+$/, "")}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, headers, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} from ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Return the base URL without any trailing `/v1` or `/api` suffix so callers
 * can construct both the native (`/api/tags`) and OpenAI-compatible (`/v1`)
 * endpoints from a single configured URL.
 */
export function normalizeBaseURL(baseURL: string): string {
  return baseURL.replace(/\/+$/, "").replace(/\/v1$/, "").replace(/\/api$/, "");
}

/**
 * Fetch the list of installed models from Ollama's native `GET /api/tags`.
 * The optional API key is forwarded as a Bearer token for Ollama's hosted API
 * (`https://ollama.com/api/tags`); local servers ignore it.
 */
export async function fetchOllamaModels(
  baseURL: string,
  apiKey?: string,
  timeoutMs?: number,
): Promise<OllamaModelSummary[]> {
  const url = normalizeBaseURL(baseURL);
  const json = await fetchEndpoint<OllamaListResponse>(
    url,
    "/api/tags",
    apiKey,
    timeoutMs,
  );
  if (!Array.isArray(json.models)) {
    throw new Error(`Unexpected response from ${url}/api/tags: missing models array`);
  }
  return json.models.filter(
    (model): model is OllamaModelSummary =>
      typeof model === "object" && model !== null && typeof model.name === "string",
  );
}

/** Fetch capability metadata for a model from Ollama's `POST /api/show`. */
export async function fetchOllamaModelDetails(
  baseURL: string,
  model: string,
  apiKey?: string,
  timeoutMs?: number,
): Promise<OllamaModelDetails> {
  return fetchEndpoint<OllamaModelDetails>(
    normalizeBaseURL(baseURL),
    "/api/show",
    apiKey,
    timeoutMs,
    {
      method: "POST",
      body: JSON.stringify({ model }),
    },
  );
}
