import { describe, expect, it } from "vitest";

import { formatBytes, formatModelName, toDisplayName } from "./utils.js";
import type { OpenCodeModelEntry } from "./types.js";

describe("toDisplayName", () => {
  it("normalizes ids into display names", () => {
    expect(toDisplayName("llama3.2:3b")).toBe("Llama3.2 3b");
    expect(toDisplayName("gemma4")).toBe("Gemma4");
    expect(toDisplayName("gpt-4o-mini")).toBe("Gpt 4o Mini");
  });

  it("strips leading Ollama namespaces", () => {
    expect(toDisplayName("library/llama3.2:3b")).toBe("Llama3.2 3b");
  });
});

describe("formatBytes", () => {
  it("formats byte counts compactly", () => {
    expect(formatBytes(2_000_000_000)).toBe("1.9GB");
    expect(formatBytes(512)).toBe("512B");
  });
});

describe("formatModelName", () => {
  const model: OpenCodeModelEntry = {
    id: "llama3.2:3b",
    name: "Llama3.2 3b",
    family: "llama",
  };

  it("supports name, id and provider placeholders", () => {
    expect(formatModelName("{name}", model, "ollama")).toBe("Llama3.2 3b");
    expect(formatModelName("{id}", model, "ollama")).toBe("llama3.2:3b");
    expect(formatModelName("{provider}", model, "ollama")).toBe("ollama");
  });

  it("supports dot-notation fields and conditionals", () => {
    expect(formatModelName("{name}{?family:' ($0)'} - {id}", model, "ollama")).toBe(
      "Llama3.2 3b (llama) - llama3.2:3b",
    );
    expect(formatModelName("{?missing:'NO'}ok", model, "ollama")).toBe("ok");
  });

  it("resolves missing fields to empty strings", () => {
    expect(formatModelName("{nonexistent}", model, "ollama")).toBe("");
  });
});
