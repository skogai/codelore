# Contributing to CodeLore MCP

Thanks for your interest in contributing! This document explains how to get set up and what we
expect from contributions.

## Getting started

```sh
git clone https://github.com/PaulBenchea/codelore.git
cd codelore
npm install
npm run build        # compile to dist/
npm run dev          # run from source with tsx
```

To test your local build against a real MCP client (e.g. Claude Code):

```sh
claude mcp add --scope user codelore -- node <repo>/dist/index.js --root <some-test-dir>
```

Use `--root` (or the `CODELORE_ROOT` env var) to point the server at a throwaway directory so you
don't touch your real `~/.codelore` docs while developing.

## Project layout

| File | Role |
| --- | --- |
| `src/index.ts` | Entry point — wiring and startup only. |
| `src/config.ts` | Storage root resolution (`--root` flag → `CODELORE_ROOT` → `~/.codelore`). |
| `src/server.ts` | MCP server and tool registrations. |
| `src/operations.ts` | The public operations behind the tools. |
| `src/search.ts` | Full-text search (MiniSearch). |
| `src/paths.ts` | Slugify + path builders. |
| `src/meta.ts` | `.meta.json` read/write/validation. |
| `src/markdown.ts` | Doc rendering, frontmatter, body extraction, stubs. |
| `src/indexes.ts` | `INDEX.md` regeneration. |
| `src/types.ts` / `src/utils.ts` | Shared types and small helpers. |

## Guidelines

- **Keep it small and focused.** One change per pull request; don't mix refactoring with features.
- **Match the existing style.** TypeScript strict mode, ESM (`.js` import suffixes), no new
  dependencies unless there's a clear need.
- **Cross-platform.** The server must work on Windows, macOS, and Linux — use `node:path` for all
  path handling, never hardcode separators.
- **Tool output is for LLMs.** Tool results are markdown that an LLM reads; keep them concise,
  actionable, and self-describing (say what to call next).
- **Update the docs.** If you change behavior, update `README.md` and add a `CHANGELOG.md` entry
  under an `Unreleased` heading.

## Reporting bugs and requesting features

Open an [issue](https://github.com/PaulBenchea/codelore/issues) using the appropriate template.
For security vulnerabilities, please follow [SECURITY.md](SECURITY.md) instead of opening a public
issue.

## Pull request process

1. Fork the repository and create a branch from `master`.
2. Make your change; ensure `npm run build` passes with no errors.
3. Update documentation and the changelog as needed.
4. Open a pull request describing **what** changed and **why**.
