import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchOllamaModelDetails, fetchOllamaModels, normalizeBaseURL } from "./fetch.js";
import type { OllamaListResponse } from "./types.js";

const mockFetch = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
  mockFetch.mockReset();
});

function stubFetch(json: unknown): void {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => json,
  } as Response);
  vi.stubGlobal("fetch", mockFetch);
}

describe("normalizeBaseURL", () => {
  it("strips trailing slashes, /v1 and /api suffixes", () => {
    expect(normalizeBaseURL("http://localhost:11434")).toBe("http://localhost:11434");
    expect(normalizeBaseURL("http://localhost:11434/")).toBe("http://localhost:11434");
    expect(normalizeBaseURL("http://localhost:11434/v1")).toBe("http://localhost:11434");
    expect(normalizeBaseURL("http://localhost:11434/api")).toBe("http://localhost:11434");
    expect(normalizeBaseURL("http://localhost:11434/v1/")).toBe("http://localhost:11434");
  });
});

describe("fetchOllamaModels", () => {
  it("fetches /api/tags and returns model summaries", async () => {
    const response: OllamaListResponse = {
      models: [
        { name: "llama3.2:3b", model: "llama3.2:3b" },
        { name: "gemma4", model: "gemma4" },
      ],
    };
    stubFetch(response);

    const models = await fetchOllamaModels("http://localhost:11434");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:11434/api/tags");
    expect(init.headers["Authorization"]).toBeUndefined();
    expect(models).toHaveLength(2);
    expect(models[0].name).toBe("llama3.2:3b");
  });

  it("sends a Bearer token when an api key is provided", async () => {
    stubFetch({ models: [{ name: "x", model: "x" }] });
    await fetchOllamaModels("http://localhost:11434", "secret-key");
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["Authorization"]).toBe("Bearer secret-key");
  });

  it("throws when the response is missing a models array", async () => {
    stubFetch({ models: "nope" });
    await expect(fetchOllamaModels("http://localhost:11434"))
      .rejects.toThrow(/missing models array/);
  });

  it("throws on non-ok responses", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: "Error" } as Response);
    vi.stubGlobal("fetch", mockFetch);
    await expect(fetchOllamaModels("http://localhost:11434")).rejects.toThrow(
      /HTTP 500/,
    );
  });
});

describe("fetchOllamaModelDetails", () => {
  it("posts the model name to /api/show", async () => {
    stubFetch({
      capabilities: ["completion", "tools"],
      model_info: { "qwen3.context_length": 40_960 },
    });

    const details = await fetchOllamaModelDetails("http://localhost:11434", "qwen3:8b");

    expect(details.capabilities).toEqual(["completion", "tools"]);
    expect(details.model_info?.["qwen3.context_length"]).toBe(40_960);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:11434/api/show",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ model: "qwen3:8b" }),
      }),
    );
  });
});
