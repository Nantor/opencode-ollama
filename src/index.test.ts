import { describe, expect, it } from "vitest";

import pluginModule, { OllamaDiscoveryPlugin } from "./index.js";

describe("plugin module", () => {
  it("exports the OpenCode server plugin module shape", () => {
    expect(pluginModule.id).toBe("opencode-ollama");
    expect(pluginModule.server).toBe(OllamaDiscoveryPlugin);
  });
});
