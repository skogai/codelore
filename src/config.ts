import * as path from "node:path";
import * as os from "node:os";

/**
 * Where all documentation lives. Resolution order:
 *
 *   1. `--root <path>` (or `--root=<path>`) CLI flag — set it in the MCP
 *      config's `args`, e.g. `"args": ["-y", "codelore-mcp", "--root", "D:\\docs"]`
 *   2. `CODELORE_ROOT` environment variable
 *   3. `~/.codelore` (default, next to .claude, .gemini, ...)
 */

function expandHome(p: string): string {
  return p === "~" || p.startsWith("~/") || p.startsWith("~\\")
    ? path.join(os.homedir(), p.slice(1))
    : p;
}

function resolveRoot(): string {
  const argv = process.argv;
  const flagIndex = argv.indexOf("--root");
  const fromArg =
    flagIndex !== -1
      ? argv[flagIndex + 1]
      : argv.find((a) => a.startsWith("--root="))?.slice("--root=".length);
  const chosen = fromArg || process.env.CODELORE_ROOT;
  return chosen ? path.resolve(expandHome(chosen)) : path.join(os.homedir(), ".codelore");
}

export const ROOT = resolveRoot();
