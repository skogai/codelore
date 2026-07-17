# Security Policy

## Supported Versions

Only the latest published version of `codelore-mcp` receives security fixes.

## Reporting a Vulnerability

Please **do not** open a public issue for security vulnerabilities. Instead, report them
privately via [GitHub Security Advisories](https://github.com/PaulBenchea/codelore/security/advisories/new)
or by email to benchea.paul01@gmail.com.

Include as much detail as you can (affected version, reproduction steps, impact). You should
receive an acknowledgement within a few days; a fix and disclosure will be coordinated with you.

## Scope notes

CodeLore is a local stdio MCP server that reads and writes markdown files under a user-chosen
directory. It performs no network calls at runtime. The main areas of interest are path handling
(names are slugified to `[a-z0-9-]` before being used in paths) and anything that could make the
server read or write outside its configured root.
