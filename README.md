# CodeLore MCP

An MCP server that maintains structured, two-perspective code documentation so LLMs can read a
short summary and fetch exactly the doc they need — instead of re-reading the codebase every time.

Every piece of documentation exists in two flavors:

- **internal** — how the code works (the code, explained)
- **usage** — how to use it (inputs, outputs, examples, recipes)

## Where the docs live

All documentation is stored under `~/.codelore` by default (next to `.claude`, `.gemini`, ...) —
see [Configuration](#configuration) to change the location:

```
~/.codelore/
├── INDEX.md                  # list of registered projects
└── <project>/                # e.g. cap
    ├── INDEX.md              # categories of the project
    └── <category>/           # e.g. angular, dotnet, sql
        ├── INDEX.md          # chapters of the category
        └── <chapter>/        # e.g. pages, components
            ├── INDEX.md      # topics of the chapter
            └── <topic>/      # e.g. grid-page
                ├── internal.md   # how it works
                └── usage.md      # how to use it
```

The hierarchy is `category` (technology) → `chapter` (functional area) → `topic` (the unit of
documentation); the internal/usage docs live on topics.

The convention is enforced entirely by the server: names are slugified, docs get standard
frontmatter (project/category/chapter/topic/kind/updated) and a generated title, and every
`INDEX.md` is regenerated from disk on each write so it can never drift. The LLM only ever
supplies the inner markdown body.

## Tools

| Tool | Purpose |
| --- | --- |
| `list_projects` | List registered projects with descriptions. |
| `register_project` | Register a project (idempotent; re-call to update the description). |
| `define_category` | Create/update a category (e.g. `angular`) with a description. |
| `define_chapter` | Create/update a chapter (e.g. `angular/pages`) with a description. |
| `define_topic` | Create/update a topic (e.g. `angular/pages/grid-page`); auto-creates empty `internal.md` + `usage.md`. |
| `get_project_map` | **The reading entry point.** One call returns the whole table of contents: categories, chapters, topics, descriptions, and which docs are filled. |
| `search_docs` | Full-text search across all doc bodies (fuzzy + prefix matching, relevance-ranked). Returns the best-matching topics with a snippet each; optionally scoped to one project. |
| `write_doc` | Write the `internal` or `usage` body of a topic (`replace` or `append`). |
| `read_doc` | Read exactly one topic's `internal`, `usage`, or `both` docs. |

## The intended flow

**Documenting** (while working with the user):

1. `register_project("cap", "…")`
2. `define_category("cap", "angular", "…")`
3. `define_chapter("cap", "angular", "pages", "…")`
4. `define_topic("cap", "angular", "pages", "grid-page", "…")`
5. `write_doc("cap", "angular", "pages", "grid-page", "usage", "…markdown…")`

**Reading** (when asked to do a task):

1. `get_project_map("cap")` → cheap table of contents
2. `read_doc("cap", "angular", "pages", "grid-page", "usage")` → only the doc that matters

Or, when you don't know which topic covers something:

1. `search_docs("grid column resize")` → ranked matches with snippets
2. `read_doc(...)` the best hit

## Setup

Once published to npm, no install is needed — register it with Claude Code (user scope, so it
works in every project):

```sh
claude mcp add --scope user codelore -- npx -y codelore-mcp
```

Or in any `.mcp.json` / MCP client config:

```json
{
  "mcpServers": {
    "codelore": {
      "command": "npx",
      "args": ["-y", "codelore-mcp"]
    }
  }
}
```

## Configuration

By default docs are stored under `~/.codelore`. To store them somewhere else, pass the `--root`
flag in the MCP config's `args`:

```json
{
  "mcpServers": {
    "codelore": {
      "command": "npx",
      "args": ["-y", "codelore-mcp", "--root", "D:\\team-docs\\.codelore"]
    }
  }
}
```

Resolution order: `--root <path>` (or `--root=<path>`) → `CODELORE_ROOT` environment variable →
`~/.codelore`. A leading `~` in the path is expanded to your home directory.

## Development

```sh
npm install
npm run build        # compile to dist/
npm run dev          # run from source with tsx
```

To use your local build instead of the npm package, point the client at it directly:

```sh
claude mcp add --scope user codelore -- node <repo>/MCPs/codelore/dist/index.js
```

## Publishing

```sh
npm publish          # prepublishOnly builds dist/ automatically
```
