import { afterEach, describe, expect, it, vi } from "vitest";

import { applyDiscovery, discoverProviderModels } from "./plugin.js";
import type { OpenCodeProvider } from "./types.js";

const mockFetch = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

function stubTags(json: unknown): void {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => json,
  } as Response);
  vi.stubGlobal("fetch", mockFetch);
}

function stubDiscoveryResponses(...json: unknown[]): void {
  for (const response of json) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => response,
    } as Response);
  }
  vi.stubGlobal("fetch", mockFetch);
}

describe("discoverProviderModels", () => {
  it("does nothing for providers without discovery enabled", async () => {
    const provider: OpenCodeProvider = {
      options: { baseURL: "http://localhost:11434" },
    };
    await discoverProviderModels("ollama", provider);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("strips the plugin options key before discovery", async () => {
    stubTags({ models: [{ name: "gemma4", model: "gemma4" }] });
    const provider: OpenCodeProvider = {
      options: {
        baseURL: "http://localhost:11434",
        "opencode-ollama": { discovery: true },
      },
    };
    await discoverProviderModels("ollama", provider);
    expect(provider.options?.["opencode-ollama"]).toBeUndefined();
    expect(provider.options?.baseURL).toBe("http://localhost:11434");
  });

  it("merges discovered models while keeping manual overrides", async () => {
    stubDiscoveryResponses(
      {
        models: [
          { name: "gemma4", model: "gemma4" },
          { name: "llama3.2:3b", model: "llama3.2:3b" },
        ],
      },
      { capabilities: ["completion"] },
      { capabilities: ["completion"] },
    );
    const provider: OpenCodeProvider = {
      name: "Ollama",
      options: {
        baseURL: "http://localhost:11434",
        "opencode-ollama": { discovery: true },
      },
      models: {
        "gemma4": { name: "Gemma 4 (manual)" },
      },
    };
    await discoverProviderModels("ollama", provider);

    expect(provider.models?.["gemma4"].name).toBe("Gemma 4 (manual)");
    expect(provider.models?.["llama3.2:3b"]).toBeDefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:11434/api/tags",
      expect.anything(),
    );
  });

  it("sets model flags from /api/show capabilities", async () => {
    stubDiscoveryResponses(
      { models: [{ name: "qwen3-vl", model: "qwen3-vl" }] },
      { capabilities: ["completion", "tools", "thinking", "vision"] },
    );
    const provider: OpenCodeProvider = {
      options: {
        baseURL: "http://localhost:11434",
        "opencode-ollama": { discovery: true },
      },
    };

    await discoverProviderModels("ollama", provider);

    expect(provider.models?.["qwen3-vl"]).toMatchObject({
      tool_call: true,
      reasoning: true,
      attachment: true,
      modalities: { input: ["text", "image"], output: ["text"] },
    });
  });

  it("excludes embedding-family models from discovery", async () => {
    stubTags({
      models: [
        { name: "gemma4", model: "gemma4", details: { family: "gemma4" } },
        {
          name: "nomic-embed-text",
          model: "nomic-embed-text",
          details: { family: "embedding" },
        },
      ],
    });
    const provider: OpenCodeProvider = {
      options: {
        baseURL: "http://localhost:11434",
        "opencode-ollama": { discovery: true },
      },
    };
    await discoverProviderModels("ollama", provider);
    expect(provider.models?.["gemma4"]).toBeDefined();
    expect(provider.models?.["nomic-embed-text"]).toBeUndefined();
  });

  it("logs a warning when discovery is enabled without a baseURL", async () => {
    const errors: string[] = [];
    const provider: OpenCodeProvider = {
      options: { "opencode-ollama": { discovery: true } },
    };
    await discoverProviderModels("ollama", provider, async (level, message) => {
      if (level === "warn") errors.push(message);
    });
    expect(errors.some((m) => m.includes("no baseURL"))).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("logs an error and keeps existing config when fetch fails", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: "Error" } as Response);
    vi.stubGlobal("fetch", mockFetch);
    const errors: string[] = [];
    const provider: OpenCodeProvider = {
      options: {
        baseURL: "http://localhost:11434",
        "opencode-ollama": { discovery: true },
      },
      models: { existing: { name: "Existing" } },
    };
    await discoverProviderModels("ollama", provider, async (level, message) => {
      if (level === "error") errors.push(message);
    });
    expect(errors.some((m) => m.includes("Model discovery failed"))).toBe(true);
    expect(provider.models?.existing.name).toBe("Existing");
  });
});

describe("applyDiscovery", () => {
  it("discovers for every provider with discovery enabled in parallel", async () => {
    stubTags({ models: [{ name: "a", model: "a" }] });
    const config = {
      provider: {
        ollamaA: { options: { baseURL: "http://a:11434", "opencode-ollama": { discovery: true } } },
        ollamaB: { options: { baseURL: "http://b:11434", "opencode-ollama": { discovery: true } } },
        other: { options: { baseURL: "http://c:11434" } },
      },
    };
    await applyDiscovery(config);
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});
