import type { OpenCodeModelEntry } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a display name from a raw model id, e.g. "llama3.2:3b" → "Llama3.2 3b".
 * Leading Ollama namespaces (e.g. "library/") are stripped.
 */
export function toDisplayName(id: string): string {
  const trimmed = id.replace(/\/+$/, "");
  const segment = trimmed.includes("/") ? trimmed.split("/").at(-1)! : trimmed;
  const base = segment || trimmed || id;
  return base
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(/:/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCompactNumber(value: number): string {
  const suffixes = ["", "K", "M", "B", "T"];
  let scaled = value;
  let suffixIndex = 0;
  while (Math.abs(scaled) >= 1000 && suffixIndex < suffixes.length - 1) {
    scaled /= 1000;
    suffixIndex++;
  }
  return Number(scaled.toPrecision(3)).toString() + suffixes[suffixIndex];
}

/**
 * Format a number of bytes as a human-friendly size, e.g. 4_700_000_000 → "4.4GB".
 */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1).replace(/\.0$/, "")}${units[unitIndex]}`;
}

function resolvePath(path: string, values: Record<string, unknown>): unknown {
  let value: unknown = values;
  for (const segment of path.split(".")) {
    if (typeof value !== "object" || value === null || !(segment in value)) {
      return undefined;
    }
    value = (value as Record<string, unknown>)[segment];
  }
  return value;
}

function formatValue(value: unknown, path: string): string {
  if (value === undefined) return "";
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  if (typeof value === "number") {
    if (path.startsWith("limit.")) return formatCompactNumber(value);
  }
  return String(value);
}

function formatConditional(
  condition: string,
  values: Record<string, unknown>,
): string {
  const separatorIndex = condition.indexOf(":");
  if (separatorIndex === -1) return "";

  const pathsPart = condition.slice(0, separatorIndex);
  const bodyPart = condition.slice(separatorIndex + 1);
  const bodyMatch = /^'((?:\\'|[^'])*)'$/.exec(bodyPart);
  if (!bodyMatch) return "";

  const hasAnd = pathsPart.includes("&");
  const hasOr = pathsPart.includes("|");
  if (hasAnd && hasOr) return "";

  const paths = pathsPart.split(hasAnd ? "&" : "|").map((path) => path.trim());
  if (paths.some((path) => path === "")) return "";

  const resolvedValues = paths.map((path) => resolvePath(path, values));
  const shouldRender = hasAnd
    ? resolvedValues.every(Boolean)
    : resolvedValues.some(Boolean);
  if (!shouldRender) return "";

  return bodyMatch[1]
    .replace(/\\'/g, "'")
    .replace(/\$(\d+)/g, (_match, index: string) => {
      const numericIndex = Number(index);
      const value = resolvedValues[numericIndex];
      return value ? formatValue(value, paths[numericIndex]) : "";
    });
}

/**
 * Render a `modelNameFormat` template. Supports `{name}`, `{id}`, `{provider}`,
 * arbitrary `OpenCodeModelEntry` fields via dot notation, and conditional
 * expressions of the form `{?path:'text using $0'}`.
 */
export function formatModelName(
  format: string,
  model: OpenCodeModelEntry,
  providerID: string,
): string {
  const values: Record<string, unknown> = { ...model, provider: providerID };

  return format.replace(/\{([^{}]+)\}/g, (_placeholder, content: string) => {
    if (content.startsWith("?")) {
      return formatConditional(content.slice(1), values);
    }
    return formatValue(resolvePath(content, values), content);
  });
}

/**
 * Sort an object's keys by a given string key in the nested values.
 */
export function sortByKey<T extends Record<string, object>>(
  obj: T,
  key: string,
): T {
  return Object.fromEntries(Object.entries(obj).sort(([, a], [, b]) => {
    const aVal = a && typeof a === "object" && key in a ? (a as Record<string, unknown>)[key] : "";
    const bVal = b && typeof b === "object" && key in b ? (b as Record<string, unknown>)[key] : "";
    return String(aVal).localeCompare(String(bVal), "en", { numeric: true });
  })) as T;
}


