# opencode-ollama

An OpenCode plugin that auto-discovers installed models from an Ollama server and registers them as an OpenAI-compatible provider.

## Features

- Discovers every model installed on a local Ollama server via the native `GET /api/tags` endpoint
- Registers them under an `@ai-sdk/openai-compatible` provider pointing at Ollama's `/v1` endpoint
- Fills in model metadata from Ollama's tags and model details, including native context length and capabilities
- Excludes non-chat models (e.g. the `embedding` family) that cannot serve chat completions
- Supports custom display-name formatting
- Explicit manual model entries always win over discovered ones

## Installation

Add the plugin and enable discovery on an Ollama provider:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-ollama"],
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama",
      "options": {
        "baseURL": "http://localhost:11434/v1",
        "opencode-ollama": {
          "discovery": true,
          "discoveryTimeout": 10000,
          "discoveryCache": "PT1H"
        }
      }
    }
  }
}
```

The plugin fetches `GET /api/tags` when OpenCode starts and merges the discovered models into the provider config, so they show up in the model picker. Manually configured model entries take precedence over discovered ones.

The `baseURL` may include a trailing slash, a `/v1`, or an `/api` suffix — all are normalized away before the plugin builds the endpoints. Base URLs:

- Local server: `http://localhost:11434/v1`
- Hosted API: `https://ollama.com/v1` (requires an `apiKey`)

For the hosted Ollama API, set `apiKey` to your [API key](https://ollama.com/settings/keys).

Discovery requests time out after 10 seconds by default. Set `discoveryTimeout` to a non-negative number of milliseconds to override it. Discovery failures are logged but do not prevent OpenCode from starting; existing manually configured models remain available.

Restart OpenCode after changing plugin or provider configuration.

## Model Names

Without `modelNameFormat`, model IDs are normalized into display names. For example, `llama3.2:3b` becomes `Llama3.2 3b` and `gpt-4o-mini` becomes `Gpt 4o Mini`.

Set `modelNameFormat` to customize display names:

```json
{
  "provider": {
    "ollama": {
      "options": {
        "baseURL": "http://localhost:11434/v1",
        "opencode-ollama": {
          "discovery": true,
          "modelNameFormat": "{name} ({family} {?options.parameterSize:'$0'})"
        }
      }
    }
  }
}
```

Supported placeholders:

- `{name}`: normalized model name
- `{id}`: effective model ID (the Ollama tag name, e.g. `llama3.2:3b`)
- `{provider}`: OpenCode provider ID (e.g. `ollama`)
- Any discovered `OpenCodeModelEntry` field, using dot notation for nested values. Examples include `{family}`, `{options.parameterSize}`, and `{options.quantizationLevel}`.

Access to the discovered metadata fields:

| Field | Source |
| --- | --- |
| `family` | `details.family` |
| `options.parameterSize` | `details.parameter_size` |
| `options.quantizationLevel` | `details.quantization_level` |
| `options.families` | `details.families` |
| `options.size` | model size on disk, formatted (e.g. `8.9GB`) |
| `limit.context` | native model context length from `model_info.*.context_length` |

Ollama does not report a separate maximum output-token limit. Since OpenCode requires
`limit.output` whenever `limit.context` is configured, discovery uses the context length as
the theoretical output upper bound. The actual available output is the context length minus
the input tokens, and may be lower due to Ollama server configuration.

The plugin deliberately does not add raw `/api/show` fields such as licenses, prompt
templates, parameter text, or the full `model_info` object to the OpenCode config. They do
not affect OpenCode model behavior and can make the resolved configuration unnecessarily large.

Arrays and objects are inserted as JSON. Placeholders for fields that are not available on a model resolve to an empty string.

### Conditional Expressions

Use a conditional expression to include text only when model metadata is available:

```
{?path:'text using $0'}
```

The condition is one or more field paths, and the quoted body can reference their values by zero-based position (`$0`, `$1`, and so on). A conditional resolves to an empty string when its condition is not met.

```json
{
  "modelNameFormat": "{name}{?options.parameterSize:' ($0)'}{?options.quantizationLevel:' [q: $0]'}"
}
```

The example might produce `Llama3.2 3b (3.2B) [q: Q4_K_M]`. Missing fields, `false`, `0`, and empty strings suppress their conditional text.

- Use `&` when every path must be present and truthy: `{?family&options.parameterSize:'$0 ($1)'}`.
- Use `|` when any path may be present and truthy: `{?family|options.parameterSize:'$0$1'}`.
- `$0`, `$1`, and later references retain the position of each listed path. An unavailable value inserts an empty string.
- Escape a literal single quote in the body as `\'`.
- Do not mix `&` and `|` in one conditional expression.

`discovery`, `discoveryTimeout`, `discoveryCache`, and `modelNameFormat` are consumed by the plugin (nested under the `opencode-ollama` options key) and are not passed to the underlying AI SDK provider.

Keep provider credentials in environment variables or a secret manager. Do not store live API keys in project environment files or commit them to source control.

## Resolved Configuration

Use OpenCode's debug command to print the final merged configuration after discovery:

```bash
opencode debug config
```

To save it for inspection:

```bash
opencode debug config > resolved-opencode.json
```

The output includes discovered models, manual overrides, and all inherited OpenCode settings. It can include API keys and other secrets, so do not commit or share it.

## Development

```
npm run build        # type-check + bundle -> dist/opencode-ollama.js
npm run lint         # eslint src
npm run test:run     # vitest run
```

## License

This project is licensed under the [MIT License](LICENSE).
