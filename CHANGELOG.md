# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-07-17

### Added

- **Configurable storage root**: pass `--root <path>` (or `--root=<path>`) in the MCP config's
  `args` to choose where documentation lives. The `CODELORE_ROOT` environment variable is still
  supported as a fallback; the default remains `~/.codelore`. `~` in the path is expanded.
- **`search_docs` tool**: lightweight full-text search across all doc bodies, powered by
  [MiniSearch](https://github.com/lucaong/minisearch) (pure JS, in-memory, relevance-ranked with
  fuzzy and prefix matching — works on any OS, no external services). Returns the best-matching
  topics with a snippet each, optionally scoped to one project.
- Repository metadata in `package.json` (repository, bugs, homepage) and standard open-source
  files: license, changelog, contributing guide, code of conduct, security policy, issue/PR
  templates, and a CI workflow.
- Auto-publish workflow: merging a PR into `master` publishes to npm (with provenance) and
  creates a `vX.Y.Z` tag + GitHub release — but only when `package.json`'s version differs from
  the latest version on the registry.

### Changed

- Restructured the codebase from two files into role-based modules (`config`, `paths`, `meta`,
  `markdown`, `indexes`, `operations`, `search`, `server`, `index`). No behavior changes to the
  existing tools.

## [0.2.0] - 2026-07-16

### Added

- Prepared the package for npm publish.

## [0.1.0] - 2026-07-15

### Added

- Initial implementation of the CodeLore MCP server: hierarchical project → category → chapter →
  topic documentation with internal/usage docs, auto-regenerated `INDEX.md` files, and the
  `list_projects`, `register_project`, `define_category`, `define_chapter`, `define_topic`,
  `get_project_map`, `write_doc`, and `read_doc` tools.

[0.3.0]: https://github.com/PaulBenchea/codelore/releases/tag/v0.3.0
[0.2.0]: https://github.com/PaulBenchea/codelore/releases/tag/v0.2.0
[0.1.0]: https://github.com/PaulBenchea/codelore/releases/tag/v0.1.0
