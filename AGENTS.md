# AGENTS.md

opencode-ollama - OpenCode plugin that auto-discovers installed models from an Ollama server

## Essential commands

```
npm run build        # type-check + bundle -> dist/opencode-ollama.js
npm run lint         # eslint src
npm run lint:fix     # eslint src --fix
npm run test         # vitest (watch)
npm run test:run     # vitest run
```

## Architecture

Plugin entrypoint: `src/index.ts`. Hook implementation: `src/plugin.ts`. Build output: the single bundled file `dist/opencode-ollama.js`.

Flow: OpenCode loads the plugin -> the `config` hook finds providers with `options["opencode-ollama"].discovery: true` -> fetches `GET /api/tags` (the Ollama native list-models endpoint) -> merges discovered models into the live provider config. Explicit model entries win.

### Key exports

- `OllamaDiscoveryPlugin` - OpenCode plugin function and default export
- `applyDiscovery(config, log?)` - applies discovery to an OpenCode config
- `discoverProviderModels(providerID, provider, log?)` - discovers one opted-in provider
- `buildProviderConfig(summaries, apiBaseURL, apiKey?, providerName?, modelNameFormat?, providerID?)` - maps Ollama summaries to an OpenCode provider using `@ai-sdk/openai-compatible` against the `/v1` endpoint

### Provider config

The plugin only touches providers with `options["opencode-ollama"].discovery === true`. `options.baseURL` may include trailing slashes, a `/v1`, or an `/api` suffix (all are normalized away). Plugin-only options (the whole `options["opencode-ollama"]` object) are removed before OpenCode initializes the AI SDK adapter.

`modelNameFormat` supports `{name}`, `{id}`, and `{provider}` placeholders, plus dot-notation fields and conditionals. Without it, model IDs are normalized into display names (e.g. `llama3.2:3b` -> `Llama3.2 3b`).

Models whose family is `embedding` are excluded from discovery since they cannot serve chat completions.

## ESLint conventions

- **No explicit `any`** (error)
- **No unused vars** (ignore `_` prefix)
- **Explicit function return types** (warn, allow expressions)
- **Consistent type assertions** (error)
- **prefer-const** (error)

## Test fixtures

Tests mock `fetch` globally via `vi.stubGlobal("fetch", vi.fn())`.
