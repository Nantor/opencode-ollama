import { describe, expect, it } from "vitest";

import type { OllamaModelSummary } from "./types.js";
import { buildProviderConfig } from "./provider.js";

const MODEL: OllamaModelSummary = {
  name: "llama3.2:3b",
  model: "llama3.2:3b",
  modified_at: "2025-10-03T23:34:03.409490317-07:00",
  size: 2_000_000_000,
  digest: "abc123",
  details: {
    format: "gguf",
    family: "llama",
    families: ["llama"],
    parameter_size: "3.2B",
    quantization_level: "Q4_K_M",
  },
};

describe("buildProviderConfig", () => {
  it("builds an OpenAI-compatible provider with the /v1 suffix", () => {
    const provider = buildProviderConfig([MODEL], "http://localhost:11434");
    expect(provider.npm).toBe("@ai-sdk/openai-compatible");
    expect(provider.options?.baseURL).toBe("http://localhost:11434/v1");
    expect(provider.options?.apiKey).toBeUndefined();
  });

  it("keeps a provided api key", () => {
    const provider = buildProviderConfig([MODEL], "https://ollama.com", "secret");
    expect(provider.options?.apiKey).toBe("secret");
  });

  it("maps model metadata onto OpenCode model entries", () => {
    const provider = buildProviderConfig([MODEL], "http://localhost:11434");
    const entry = provider.models!["llama3.2:3b"];
    expect(entry.id).toBe("llama3.2:3b");
    expect(entry.family).toBe("llama");
    expect(entry.options?.parameterSize).toBe("3.2B");
    expect(entry.options?.quantizationLevel).toBe("Q4_K_M");
    expect(entry.options?.families).toEqual(["llama"]);
    expect(entry.options?.size).toMatch(/GB$/);
    expect(entry.temperature).toBe(true);
  });

  it("maps Ollama model capabilities onto OpenCode model flags", () => {
    const provider = buildProviderConfig(
      [MODEL],
      "http://localhost:11434",
      undefined,
      undefined,
      undefined,
      undefined,
      {
        [MODEL.name]: { capabilities: ["completion", "tools", "thinking", "vision"] },
      },
    );
    const entry = provider.models![MODEL.name];
    expect(entry.tool_call).toBe(true);
    expect(entry.reasoning).toBe(true);
    expect(entry.attachment).toBe(true);
    expect(entry.modalities).toEqual({ input: ["text", "image"], output: ["text"] });
  });

  it("maps the native context length without exposing unrelated /api/show metadata", () => {
    const provider = buildProviderConfig(
      [MODEL],
      "http://localhost:11434",
      undefined,
      undefined,
      undefined,
      undefined,
      {
        [MODEL.name]: {
          parameters: "num_ctx 2048",
          license: "Model license",
          template: "{{ .Prompt }}",
          capabilities: ["completion", "thinking"],
          thinking: { values: [false, true], default: true },
          details: { family: "llama", parent_model: "base" },
          model_info: {
            "llama.context_length": 131_072,
            "general.architecture": "llama",
          },
        },
      },
    );
    const entry = provider.models![MODEL.name];
    expect(entry.limit).toEqual({ context: 131_072, output: 131_072 });
    expect(entry.options).not.toHaveProperty("ollama");
    expect(entry.options).not.toHaveProperty("license");
    expect(entry.options).not.toHaveProperty("template");
  });

  it("normalizes model ids into display names", () => {
    const provider = buildProviderConfig([MODEL], "http://localhost:11434");
    expect(provider.models!["llama3.2:3b"].name).toBe("Llama3.2 3b");
  });

  it("applies a custom modelNameFormat", () => {
    const provider = buildProviderConfig(
      [MODEL],
      "http://localhost:11434",
      undefined,
      "Ollama",
      "{name} ({id})",
      "ollama",
    );
    expect(provider.models!["llama3.2:3b"].name).toBe("Llama3.2 3b (llama3.2:3b)");
  });

  it("excludes models from non-chat families such as embedding", () => {
    const embedding: OllamaModelSummary = {
      name: "nomic-embed-text",
      model: "nomic-embed-text",
      details: { family: "embedding" },
    };
    const provider = buildProviderConfig([embedding], "http://localhost:11434");
    expect(provider.models!["nomic-embed-text"]).toBeDefined();
  });
});
